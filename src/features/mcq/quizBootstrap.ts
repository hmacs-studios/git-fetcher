import { supabase } from '@/integrations/supabase/client';
import { fetchMCQsByChapter, type MCQ } from '@/utils/mcqData';
import { getQueuedMCQAnswerMap } from '@/utils/offlineAnswerSync';
import { isChapterDownloaded } from '@/utils/offlineChapters';
import {
  createMCQTraceId,
  logMCQDiagnostic,
} from '@/utils/mcqDiagnostics';

export interface PreparedMCQ extends Omit<MCQ, 'options'> {
  options: string[];
  shuffledOptions: string[];
  originalCorrectIndex: number;
}

export type PreparedMCQQuiz = {
  questions: PreparedMCQ[];
  answers: Record<string, { selectedAnswer: string }>;
  firstUnansweredIndex: number;
  invalidQuestions: MCQ[];
};

type PrepareMCQQuizInput = {
  chapterId: string;
  userId: string;
  mistakeMode?: boolean;
  mistakeMcqIds?: string[];
};

const preparedQuizzes = new Map<string, Promise<PreparedMCQQuiz>>();
const MAX_PREPARED_QUIZZES = 3;
const ACCESS_DEADLINE_MS = 10000;
const ACCESS_CACHE_MS = 15000;
const RESUME_DEADLINE_MS = 12000;
const PREPARATION_DEADLINE_MS = 45000;
const chapterAccessChecks = new Map<string, {
  expiresAt: number;
  promise: Promise<void>;
}>();

const withDeadline = <T,>(promise: PromiseLike<T>, timeoutMs: number, message: string) =>
  new Promise<T>((resolve, reject) => {
    const timeoutId = window.setTimeout(() => reject(new Error(message)), timeoutMs);
    Promise.resolve(promise).then(
      value => {
        window.clearTimeout(timeoutId);
        resolve(value);
      },
      error => {
        window.clearTimeout(timeoutId);
        reject(error);
      },
    );
  });

export class ChapterLockedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ChapterLockedError';
  }
}

const runChapterAccessCheck = async (chapterId: string, traceId: string) => {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    logMCQDiagnostic('access_check_skipped_offline', {
      traceId,
      chapterId,
    }, 'warn');
    return;
  }

  const startedAt = performance.now();
  const accessResult = await withDeadline(
    supabase.rpc('get_mcq_chapter_access', { p_chapter_id: chapterId }),
    ACCESS_DEADLINE_MS,
    'Unable to verify chapter availability. Please try again.',
  );
  if (accessResult.error) {
    const functionMissing = accessResult.error.code === 'PGRST202';
    if (!functionMissing && typeof navigator !== 'undefined' && navigator.onLine) {
      logMCQDiagnostic('access_check_failed', {
        traceId,
        chapterId,
        durationMs: Math.round(performance.now() - startedAt),
        code: accessResult.error.code,
      }, 'error');
      throw new Error('Unable to verify chapter availability. Please try again.');
    }
    logMCQDiagnostic('access_check_compatibility', {
      traceId,
      chapterId,
      durationMs: Math.round(performance.now() - startedAt),
    }, 'warn');
    return;
  }

  const access = accessResult.data as {
    allowed?: boolean;
    message?: string | null;
  } | null;
  if (access?.allowed === false) {
    logMCQDiagnostic('chapter_locked', {
      traceId,
      chapterId,
      durationMs: Math.round(performance.now() - startedAt),
    }, 'warn');
    throw new ChapterLockedError(
      access.message || 'This chapter is temporarily unavailable.',
    );
  }
  logMCQDiagnostic('access_check_complete', {
    traceId,
    chapterId,
    durationMs: Math.round(performance.now() - startedAt),
  });
};

const assertChapterAccess = (chapterId: string, traceId: string) => {
  const existing = chapterAccessChecks.get(chapterId);
  if (existing && existing.expiresAt > Date.now()) {
    logMCQDiagnostic('access_check_reused', {
      traceId,
      chapterId,
    });
    return existing.promise;
  }

  const promise = runChapterAccessCheck(chapterId, traceId).catch(error => {
    chapterAccessChecks.delete(chapterId);
    throw error;
  });
  chapterAccessChecks.set(chapterId, {
    expiresAt: Date.now() + ACCESS_CACHE_MS,
    promise,
  });
  return promise;
};

const getPreparationKey = ({
  chapterId,
  userId,
  mistakeMode = false,
  mistakeMcqIds = [],
}: PrepareMCQQuizInput) =>
  [userId, chapterId, mistakeMode ? 'mistakes' : 'standard', ...mistakeMcqIds].join(':');

const shuffleArray = <T,>(array: T[]) => {
  const shuffled = [...array];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[randomIndex]] = [shuffled[randomIndex], shuffled[index]];
  }
  return shuffled;
};

const normalizeOptionText = (value: unknown) => String(value ?? '')
  .trim()
  .replace(/^\s*[A-Z0-9]+\s*[.)\-:]\s*/i, '')
  .replace(/\s+/g, ' ')
  .toLowerCase();

const resolveCorrectOption = (mcq: MCQ) => {
  const options = Array.isArray(mcq.options)
    ? mcq.options.filter(option => typeof option === 'string' && option.trim())
    : [];
  const rawAnswer = String(mcq.correct_answer ?? '').trim();
  if (options.length < 2 || !rawAnswer) return null;

  const exactMatch = options.find(option => option.trim() === rawAnswer);
  if (exactMatch) return exactMatch;

  const normalizedAnswer = normalizeOptionText(rawAnswer);
  const textMatch = options.find(option => normalizeOptionText(option) === normalizedAnswer);
  if (textMatch) return textMatch;

  const answerMarker = rawAnswer.match(/^\s*([A-Z]|\d+)\s*[.)\-:]?\s*$/i)?.[1];
  if (!answerMarker) return null;

  const optionIndex = /^\d+$/.test(answerMarker)
    ? Number(answerMarker) - 1
    : answerMarker.toUpperCase().charCodeAt(0) - 65;
  return optionIndex >= 0 && optionIndex < options.length ? options[optionIndex] : null;
};

const fetchLatestChapterAnswers = async (
  chapterId: string,
  userId: string,
  questionIdsPromise: Promise<string[]>,
) => {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    logMCQDiagnostic('resume_lookup_skipped_offline', {
      chapterId,
    }, 'warn');
    return [];
  }

  const startedAt = performance.now();
  try {
    const compactResult = await withDeadline(
      supabase.rpc('get_mcq_chapter_latest_answers', { p_chapter_id: chapterId }),
      RESUME_DEADLINE_MS,
      'Resume lookup timed out.',
    );
    if (!compactResult.error && Array.isArray(compactResult.data) && compactResult.data.length > 0) {
      logMCQDiagnostic('resume_compact_complete', {
        chapterId,
        durationMs: Math.round(performance.now() - startedAt),
        answerCount: compactResult.data?.length ?? 0,
      });
      return compactResult.data ?? [];
    }

    logMCQDiagnostic('resume_compact_unavailable', {
      chapterId,
      code: compactResult.error?.code,
    }, 'warn');
  } catch (error) {
    logMCQDiagnostic('resume_compact_timeout', {
      chapterId,
      errorMessage: error instanceof Error ? error.message : String(error),
    }, 'warn');
  }

  const questionIds = await questionIdsPromise;
  if (questionIds.length === 0) return [];

  try {
    const fallbackResult = await withDeadline(
      supabase
        .from('user_answers')
        .select('mcq_id, selected_answer, created_at')
        .eq('user_id', userId)
        .in('mcq_id', questionIds)
        .order('created_at', { ascending: true }),
      RESUME_DEADLINE_MS,
      'Your quiz progress took too long to load. Please try again.',
    );
    if (fallbackResult.error) throw fallbackResult.error;
    logMCQDiagnostic('resume_fallback_complete', {
      chapterId,
      durationMs: Math.round(performance.now() - startedAt),
      answerCount: fallbackResult.data?.length ?? 0,
    }, 'warn');
    return fallbackResult.data ?? [];
  } catch (error) {
    // Answer history improves resume behavior but must never prevent a
    // downloaded chapter from opening when the network is unavailable.
    logMCQDiagnostic('resume_fallback_unavailable', {
      chapterId,
      durationMs: Math.round(performance.now() - startedAt),
      errorMessage: error instanceof Error ? error.message : String(error),
    }, 'warn');
    return [];
  }
};

const prepareQuiz = async ({
  chapterId,
  userId,
  mistakeMode = false,
  mistakeMcqIds = [],
}: PrepareMCQQuizInput): Promise<PreparedMCQQuiz> => {
  const chapterQuestionsPromise = fetchMCQsByChapter(chapterId);
  const questionIdsPromise = chapterQuestionsPromise.then(questions =>
    questions.map(question => question.id),
  );
  const latestAnswersPromise = mistakeMode
    ? Promise.resolve([])
    : isChapterDownloaded(chapterId).then(downloaded => {
      if (downloaded) {
        logMCQDiagnostic('resume_lookup_skipped_downloaded', {
          chapterId,
        });
        return [];
      }
      return fetchLatestChapterAnswers(chapterId, userId, questionIdsPromise);
    });
  const chapterQuestions = await chapterQuestionsPromise;
  let selectedQuestions = chapterQuestions;

  if (mistakeMode) {
    let wrongIds = mistakeMcqIds;
    if (wrongIds.length === 0 && chapterQuestions.length > 0) {
      const { data } = await supabase
        .from('user_answers')
        .select('mcq_id')
        .eq('user_id', userId)
        .eq('is_correct', false)
        .in('mcq_id', chapterQuestions.map(question => question.id));
      wrongIds = [...new Set((data ?? []).map(answer => answer.mcq_id).filter(Boolean))];
    }
    const wrongQuestionIds = new Set(wrongIds);
    selectedQuestions = chapterQuestions.filter(question => wrongQuestionIds.has(question.id));
  }

  const invalidQuestions: MCQ[] = [];
  const validQuestions = selectedQuestions.reduce<MCQ[]>((questions, question) => {
    const correctAnswer = resolveCorrectOption(question);
    if (!correctAnswer) {
      invalidQuestions.push(question);
      return questions;
    }
    questions.push({ ...question, correct_answer: correctAnswer });
    return questions;
  }, []);

  const questions = validQuestions.map((question): PreparedMCQ => {
    const shuffledOptions = shuffleArray(question.options);
    return {
      ...question,
      shuffledOptions,
      originalCorrectIndex: shuffledOptions.indexOf(question.correct_answer),
    };
  });

  const answers: Record<string, { selectedAnswer: string }> = {};
  validQuestions.forEach(question => {
    const embeddedAnswer = (question as MCQ & {
      selected_answer?: string;
      selectedAnswer?: string;
    }).selected_answer || (question as MCQ & { selectedAnswer?: string }).selectedAnswer;
    if (embeddedAnswer) answers[question.id] = { selectedAnswer: embeddedAnswer };
  });

  if (!mistakeMode && questions.length > 0) {
    const questionIds = questions.map(question => question.id);
    const [latestAnswers, queuedAnswers] = await Promise.all([
      latestAnswersPromise,
      getQueuedMCQAnswerMap(userId, questionIds),
    ]);

    latestAnswers.forEach(answer => {
      if (answer.mcq_id) answers[answer.mcq_id] = { selectedAnswer: answer.selected_answer };
    });
    Object.assign(answers, queuedAnswers);
  }

  const firstUnanswered = questions.findIndex(question => !answers[question.id]);
  return {
    questions,
    answers,
    firstUnansweredIndex: firstUnanswered >= 0 ? firstUnanswered : Math.max(questions.length - 1, 0),
    invalidQuestions,
  };
};

export const prepareMCQQuiz = async (input: PrepareMCQQuizInput) => {
  const traceId = createMCQTraceId();
  const startedAt = performance.now();
  const key = getPreparationKey(input);
  const existing = preparedQuizzes.get(key);
  logMCQDiagnostic('prepare_started', {
    traceId,
    chapterId: input.chapterId,
    mistakeMode: input.mistakeMode === true,
    reusedPreparation: Boolean(existing),
  });
  const preparation = existing ?? withDeadline(
    prepareQuiz(input),
    PREPARATION_DEADLINE_MS,
    'Quiz preparation took too long. Please try again.',
  ).catch(error => {
    preparedQuizzes.delete(key);
    throw error;
  });
  if (existing) {
    preparedQuizzes.delete(key);
    preparedQuizzes.set(key, existing);
  } else {
    preparedQuizzes.set(key, preparation);
    while (preparedQuizzes.size > MAX_PREPARED_QUIZZES) {
      const oldestKey = preparedQuizzes.keys().next().value;
      if (typeof oldestKey === 'string') preparedQuizzes.delete(oldestKey);
    }
  }

  try {
    const accessCheck = isChapterDownloaded(input.chapterId).then(downloaded => {
      if (downloaded) {
        logMCQDiagnostic('access_check_skipped_downloaded', {
          traceId,
          chapterId: input.chapterId,
        });
        return;
      }
      return assertChapterAccess(input.chapterId, traceId);
    });
    const [, preparedQuiz] = await Promise.all([
      accessCheck,
      preparation,
    ]);
    logMCQDiagnostic('prepare_complete', {
      traceId,
      chapterId: input.chapterId,
      durationMs: Math.round(performance.now() - startedAt),
      questionCount: preparedQuiz.questions.length,
      answeredCount: Object.keys(preparedQuiz.answers).length,
      firstUnansweredIndex: preparedQuiz.firstUnansweredIndex,
    });
    return preparedQuiz;
  } catch (error) {
    logMCQDiagnostic('prepare_failed', {
      traceId,
      chapterId: input.chapterId,
      durationMs: Math.round(performance.now() - startedAt),
      errorName: error instanceof Error ? error.name : 'UnknownError',
      errorMessage: error instanceof Error ? error.message : String(error),
    }, 'error');
    throw error;
  }
};

export const clearPreparedMCQQuiz = (input: PrepareMCQQuizInput) => {
  preparedQuizzes.delete(getPreparationKey(input));
};
