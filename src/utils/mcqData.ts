import { supabase } from '@/integrations/supabase/client';
import { aiApiJson } from '@/utils/aiApi';
import { fetchCloudContent } from '@/utils/cloudContent';
import {
  getOfflineChapterById,
  getOfflineChaptersBySubject,
  getOfflineMCQsByChapter,
  getOfflineSubjectById,
  getOfflineSubjects,
} from '@/utils/offlineChapters';
import {
  cacheChapterMCQs,
  cacheChapters,
  clearCachedMCQData,
  clearCachedMCQDataSync,
  getCachedChapterMCQs,
  getStoredScopeKey,
  readCachedChapters,
  setStoredScopeKey,
} from '@/utils/mcqContentCache';
import { logMCQDiagnostic } from '@/utils/mcqDiagnostics';

const backgroundRefreshAt = new Map<string, number>();
const BACKGROUND_REFRESH_INTERVAL_MS = 10 * 60 * 1000;
const shouldRefreshInBackground = (key: string) => {
  const now = Date.now();
  const lastRefresh = backgroundRefreshAt.get(key) || 0;
  if (now - lastRefresh < BACKGROUND_REFRESH_INTERVAL_MS) return false;
  backgroundRefreshAt.set(key, now);
  return true;
};

export interface Subject {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  year: string;
  institutes?: string[];
  free_unlimited_access?: boolean;
}

export interface Chapter {
  id: string;
  name: string;
  description: string;
  chapter_number: number;
  subject_id: string;
  mcq_count?: number;
  content_type?: 'question_bank' | 'past_paper' | null;
  is_locked?: boolean;
  lock_message?: string | null;
  lock_updated_at?: string | null;
}

export interface MCQ {
  id: string;
  question: string;
  options: string[];
  correct_answer: string;
  explanation: string;
  subject: string;
  chapter_id: string;
}

export interface SEQSubject {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  year: string;
  institutes?: string[];
}

export interface SEQChapter {
  id: string;
  name: string;
  description: string;
  chapter_number: number;
  subject_id: string;
  seq_count?: number;
}

export interface SEQ {
  id: string;
  question: string;
  model_answer: string;
  explanation: string;
  chapter_id: string;
}

export interface SEQEvaluationResult {
  is_correct: boolean;
  satisfaction_index: number;
  corrected_answer: string;
  explanation: string;
}

const mergeById = <T extends { id: string }>(primary: T[], fallback: T[]) => {
  const merged = new Map<string, T>();
  fallback.forEach(item => merged.set(item.id, item));
  primary.forEach(item => merged.set(item.id, item));
  return Array.from(merged.values());
};

const SUBJECTS_CACHE_KEY = 'medmacs_mcq_subjects_cache';
// This query only decorates already-usable subject data, so fail fast instead
// of making the subject and chapter flows feel like the API is down.
const OPTIONAL_QUERY_TIMEOUT_MS = 1500;

const hasExplicitProfileYear = async (): Promise<boolean> => {
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) return false;

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('year, institute')
    .eq('id', authData.user.id)
    .maybeSingle();

  if (profileError) return false;
  
  if (profile?.institute === 'nre' || profile?.institute === 'nle') return true;

  return String(profile?.year || '').trim().length > 0;
};

const getCurrentProfileScopeTag = async (): Promise<string | null> => {
  try {
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData.user) return null;

    const { data: profile } = await supabase
      .from('profiles')
      .select('institute, year')
      .eq('id', authData.user.id)
      .maybeSingle();

    const institute = String(profile?.institute || '').trim().toLowerCase();
    const year = String(profile?.year || '').trim().toLowerCase();
    return `${authData.user.id}:${institute}:${year}`;
  } catch {
    return null;
  }
};

export const readCachedSubjects = (): Subject[] => {
  if (typeof window === 'undefined') return [];
  try {
    const activeScope = getStoredScopeKey();
    const key = activeScope ? `medmacs_mcq_subjects_cache:${activeScope}` : 'medmacs_mcq_subjects_cache';
    const cached = localStorage.getItem(key);
    const parsed = cached ? JSON.parse(cached) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const cacheSubjects = async (subjects: Subject[]) => {
  if (typeof window === 'undefined' || subjects.length === 0) return;
  try {
    const activeScope = await getCurrentProfileScopeTag();
    if (activeScope) {
      setStoredScopeKey(activeScope);
      localStorage.setItem(`medmacs_mcq_subjects_cache:${activeScope}`, JSON.stringify(subjects));
    } else {
      localStorage.setItem('medmacs_mcq_subjects_cache', JSON.stringify(subjects));
    }
  } catch {
    // Storage can be unavailable or full; subjects can still be used in memory.
  }
};

const fetchSubjectFreeUnlimitedFlags = async (subjectIds: string[]) => {
  const uniqueIds = Array.from(new Set(subjectIds.filter(Boolean)));
  if (uniqueIds.length === 0) return new Map<string, boolean>();

  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), OPTIONAL_QUERY_TIMEOUT_MS);

  try {
    const { data, error } = await supabase
      .from('subjects')
      .select('id, free_unlimited_access')
      .in('id', uniqueIds)
      .abortSignal(controller.signal);

    if (error || !data) return new Map<string, boolean>();
    return new Map(data.map(subject => [subject.id, subject.free_unlimited_access === true]));
  } catch {
    return new Map<string, boolean>();
  } finally {
    window.clearTimeout(timeoutId);
  }
};

const applySubjectFreeUnlimitedFlags = async (subjects: Subject[]) => {
  const flags = await fetchSubjectFreeUnlimitedFlags(subjects.map(subject => subject.id));
  if (flags.size === 0) return subjects;

  return subjects.map(subject => ({
    ...subject,
    free_unlimited_access: flags.get(subject.id) ?? subject.free_unlimited_access,
  }));
};

export const fetchSubjects = async (): Promise<Subject[]> => {
  if (!(await hasExplicitProfileYear())) {
    clearCachedMCQDataSync();
    return [];
  }

  // Verify cached scope matches current profile (user_id:institute:year)
  const currentScopeTag = await getCurrentProfileScopeTag();
  const storedScopeTag = getStoredScopeKey();

  if (storedScopeTag && currentScopeTag && storedScopeTag !== currentScopeTag) {
    console.log('[fetchSubjects] Scope changed. Clearing old institute/year caches immediately.');
    clearCachedMCQDataSync();
    void clearCachedMCQData();
  }

  if (currentScopeTag) {
    setStoredScopeKey(currentScopeTag);
  }

  const isScopeMatch = !storedScopeTag || !currentScopeTag || storedScopeTag === currentScopeTag;
  const cachedSubjects = readCachedSubjects();

  if (cachedSubjects.length > 0 && isScopeMatch) {
    if (shouldRefreshInBackground('subjects')) {
      void fetchCloudContent<Subject[]>('mcq-subjects')
        .then(async subjects => {
          if (!subjects?.length) return;
          await cacheSubjects(await applySubjectFreeUnlimitedFlags(subjects));
        })
        .catch(() => undefined);
    }
    return cachedSubjects;
  }

  const [cloudResult, offlineSubjects] = await Promise.all([
    fetchCloudContent<Subject[]>('mcq-subjects', {}, { throwOnFailure: true })
      .then(data => ({ data, error: null }))
      .catch(error => ({ data: null, error })),
    getOfflineSubjects().catch(() => []),
  ]);

  const availableSubjects = mergeById(
    cloudResult.data?.length ? cloudResult.data : (isScopeMatch ? cachedSubjects : []),
    offlineSubjects as Subject[],
  );
  if (cloudResult.error && availableSubjects.length === 0) throw cloudResult.error;
  const subjects = await applySubjectFreeUnlimitedFlags(availableSubjects);
  await cacheSubjects(subjects);
  return subjects;
};

export const fetchSubjectById = async (subjectId: string): Promise<Subject | null> => {
  if (!(await hasExplicitProfileYear())) return null;

  const withFreeUnlimitedFlag = async (subject: Subject | null) => {
    if (!subject) return null;
    const flags = await fetchSubjectFreeUnlimitedFlags([subject.id]);
    return {
      ...subject,
      free_unlimited_access: flags.get(subject.id) ?? subject.free_unlimited_access,
    };
  };

  const cachedSubject = readCachedSubjects().find(item => item.id === subjectId) ?? null;
  if (cachedSubject) {
    if (shouldRefreshInBackground(`subject:${subjectId}`)) {
      void fetchCloudContent<Subject>('mcq-subject', { subjectId })
        .then(subject => {
          if (!subject) return;
          const subjects = mergeById([subject], readCachedSubjects());
          cacheSubjects(subjects);
        })
        .catch(() => undefined);
    }
    return withFreeUnlimitedFlag(cachedSubject);
  }

  let cloudError: unknown = null;
  const subject = await fetchCloudContent<Subject>('mcq-subject', { subjectId }, { throwOnFailure: true })
    .catch(error => {
      cloudError = error;
      return null;
    });
  if (subject) return withFreeUnlimitedFlag(subject);

  const offlineSubject = await getOfflineSubjectById(subjectId);
  if (offlineSubject) return withFreeUnlimitedFlag(offlineSubject as Subject);

  const subjects = await fetchSubjects();
  const fallbackSubject = subjects.find(item => item.id === subjectId) ?? null;
  if (!fallbackSubject && cloudError) throw cloudError;
  return fallbackSubject;
};

export const fetchChaptersBySubject = async (subjectId: string): Promise<Chapter[]> => {
  if (!(await hasExplicitProfileYear())) return [];

  const scopeKey = getStoredScopeKey();
  const cachedChapters = readCachedChapters(subjectId, scopeKey);
  if (cachedChapters.length > 0) {
    if (shouldRefreshInBackground(`chapters:${subjectId}:${scopeKey}`)) {
      void fetchCloudContent<Chapter[]>('mcq-chapters', { subjectId })
        .then(chapters => {
          if (chapters?.length) cacheChapters(subjectId, chapters, scopeKey);
        })
        .catch(() => undefined);
    }
    return cachedChapters.sort((a, b) => a.chapter_number - b.chapter_number);
  }

  const [cloudResult, offlineChapters] = await Promise.all([
    fetchCloudContent<Chapter[]>('mcq-chapters', { subjectId }, { throwOnFailure: true })
      .then(data => ({ data, error: null }))
      .catch(error => ({ data: null, error })),
    getOfflineChaptersBySubject(subjectId).catch(() => []),
  ]);

  if (cloudResult.error && offlineChapters.length === 0) throw cloudResult.error;
  const chapters = mergeById(cloudResult.data ?? [], offlineChapters as Chapter[])
    .sort((a, b) => a.chapter_number - b.chapter_number);
  cacheChapters(subjectId, chapters, scopeKey);
  return chapters;
};

export const fetchChapterById = async (chapterId: string, subjectId?: string): Promise<Chapter | null> => {
  if (!(await hasExplicitProfileYear())) return null;

  if (subjectId) {
    const scopeKey = getStoredScopeKey();
    const cachedChapter = readCachedChapters(subjectId, scopeKey).find(chapter => chapter.id === chapterId);
    if (cachedChapter) return cachedChapter;
  }

  const chapter = await fetchCloudContent<Chapter>('mcq-chapter', { chapterId, subjectId });
  if (chapter) return chapter;

  const offlineChapter = await getOfflineChapterById(chapterId, subjectId);
  if (offlineChapter) return offlineChapter as Chapter;

  if (!subjectId) return null;
  const chapters = await fetchChaptersBySubject(subjectId);
  return chapters.find(item => item.id === chapterId) ?? null;
};

export const fetchMCQsByChapter = async (chapterId: string): Promise<MCQ[]> => {
  if (!(await hasExplicitProfileYear())) return [];

  const startedAt = performance.now();
  const cachedMcqs = await getCachedChapterMCQs(chapterId);
  if (cachedMcqs.length > 0) {
    logMCQDiagnostic('content_cache_hit', {
      chapterId,
      durationMs: Math.round(performance.now() - startedAt),
      questionCount: cachedMcqs.length,
    });
    if (shouldRefreshInBackground(`mcqs:${chapterId}`)) {
      void fetchCloudContent<MCQ[]>('mcqs', { chapterId })
        .then(mcqs => mcqs?.length ? cacheChapterMCQs(chapterId, mcqs) : undefined)
        .catch(() => undefined);
    }
    return cachedMcqs;
  }

  // A downloaded chapter is a complete local snapshot. Prefer it before
  // consulting navigator.onLine or waiting for the content API because
  // Android WebView can report "online" without usable internet access.
  const downloadedMcqs = await getOfflineMCQsByChapter(chapterId) as MCQ[];
  if (downloadedMcqs.length > 0) {
    logMCQDiagnostic('content_downloaded_hit', {
      chapterId,
      durationMs: Math.round(performance.now() - startedAt),
      questionCount: downloadedMcqs.length,
    });
    await cacheChapterMCQs(chapterId, downloadedMcqs);
    return downloadedMcqs;
  }

  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    logMCQDiagnostic('content_unavailable', {
      chapterId,
      durationMs: Math.round(performance.now() - startedAt),
      questionCount: 0,
    }, 'error');
    return [];
  }

  logMCQDiagnostic('content_cache_miss', {
    chapterId,
    durationMs: Math.round(performance.now() - startedAt),
  });
  const networkStartedAt = performance.now();
  const cloudMcqs = await fetchCloudContent<MCQ[]>('mcqs', { chapterId });
  if (cloudMcqs?.length) {
    await cacheChapterMCQs(chapterId, cloudMcqs);
    logMCQDiagnostic('content_network_complete', {
      chapterId,
      durationMs: Math.round(performance.now() - networkStartedAt),
      questionCount: cloudMcqs.length,
    });
    return cloudMcqs;
  }
  const offlineMcqs = await getOfflineMCQsByChapter(chapterId) as MCQ[];
  logMCQDiagnostic(
    offlineMcqs.length > 0 ? 'content_offline_fallback' : 'content_unavailable',
    {
      chapterId,
      durationMs: Math.round(performance.now() - networkStartedAt),
      questionCount: offlineMcqs.length,
    },
    offlineMcqs.length > 0 ? 'warn' : 'error',
  );
  if (offlineMcqs.length) await cacheChapterMCQs(chapterId, offlineMcqs);
  return offlineMcqs;
};

export const fetchMCQsBySubject = async (subjectId: string): Promise<MCQ[]> => {
  if (!(await hasExplicitProfileYear())) return [];
  return await fetchCloudContent<MCQ[]>('mcqs-by-subject', { subjectId }) ?? [];
};

export const fetchMCQsBySubjects = async (subjectIds: string[]): Promise<MCQ[]> => {
  if (subjectIds.length === 0) return [];
  if (!(await hasExplicitProfileYear())) return [];
  return await fetchCloudContent<MCQ[]>('mcqs-by-subjects', { subjectIds: subjectIds.join(',') }) ?? [];
};

export const getUserStats = async (userId: string) => {
  try {
    const { data: compactSummary, error: compactSummaryError } = await supabase
      .rpc('get_mcq_practice_summary');
    if (!compactSummaryError && compactSummary && typeof compactSummary === 'object') {
      const summary = compactSummary as unknown as {
        totalQuestions?: number;
        correctAnswers?: number;
        accuracy?: number;
        averageTime?: number;
        bestStreak?: number;
      };
      return {
        totalQuestions: summary.totalQuestions || 0,
        correctAnswers: summary.correctAnswers || 0,
        accuracy: summary.accuracy || 0,
        averageTime: summary.averageTime || 0,
        bestStreak: summary.bestStreak || 0,
        savedQuestions: 0,
      };
    }

    const { data: answers, error: answersError } = await supabase
      .from('user_answers')
      .select('is_correct, time_taken, created_at')
      .eq('user_id', userId);

    if (answersError) {
      return { totalQuestions: 0, correctAnswers: 0, accuracy: 0, averageTime: 0, bestStreak: 0, savedQuestions: 0 };
    }

    const totalQuestions = answers?.length || 0;
    const correctAnswers = answers?.filter(a => a.is_correct).length || 0;
    const accuracy = totalQuestions > 0 ? Math.round((correctAnswers / totalQuestions) * 100) : 0;
    const averageTime = answers?.length > 0
      ? Math.round(answers.reduce((sum, a) => sum + (a.time_taken || 0), 0) / answers.length)
      : 0;

    let bestStreak = 0;
    let currentCorrectStreak = 0;
    answers?.forEach(answer => {
      if (answer.is_correct) {
        currentCorrectStreak++;
        bestStreak = Math.max(bestStreak, currentCorrectStreak);
      } else {
        currentCorrectStreak = 0;
      }
    });

    // Calculate consecutive days streak
    const calculateCurrentStreak = (answersData: any[]) => {
      if (!answersData || answersData.length === 0) return 0;
      
      const answerDates = [...new Set(answersData.map(a => {
        const date = new Date(a.created_at);
        return date.toLocaleDateString("en-US", { timeZone: "Asia/Karachi" });
      }))];

      if (answerDates.length === 0) return 0;

      const today = new Date();
      const todayPKT = new Date(today.toLocaleString("en-US", { timeZone: "Asia/Karachi" }));
      todayPKT.setHours(0, 0, 0, 0);
      
      const yesterday = new Date(todayPKT);
      yesterday.setDate(yesterday.getDate() - 1);

      const dateObjects = answerDates.map(d => {
        const [month, day, year] = d.split('/');
        return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
      }).sort((a, b) => b.getTime() - a.getTime());

      const mostRecentDate = dateObjects[0];
      const isToday = mostRecentDate.getTime() === todayPKT.getTime();
      const isYesterday = mostRecentDate.getTime() === yesterday.getTime();

      if (!isToday && !isYesterday) return 0;

      let streak = 1;
      let currentDate = new Date(mostRecentDate);

      for (let i = 1; i < dateObjects.length; i++) {
        const prevDate = new Date(dateObjects[i]);
        const expectedPrevDate = new Date(currentDate);
        expectedPrevDate.setDate(expectedPrevDate.getDate() - 1);

        if (prevDate.getTime() === expectedPrevDate.getTime()) {
          streak++;
          currentDate = prevDate;
        } else {
          break;
        }
      }

      return streak;
    };

    const currentStreak = calculateCurrentStreak(answers || []);

    return { totalQuestions, correctAnswers, accuracy, averageTime, bestStreak, savedQuestions: currentStreak };
  } catch {
    return { totalQuestions: 0, correctAnswers: 0, accuracy: 0, averageTime: 0, bestStreak: 0, savedQuestions: 0 };
  }
};

export const getAttemptedChapterIds = async (userId: string): Promise<string[]> => {
  try {
    const { data, error } = await supabase
      .from('user_answers')
      .select('mcqs(chapter_id)')
      .eq('user_id', userId);

    if (error || !data) return [];
    const chapterIds = data
      .map((row: any) => row.mcqs?.[0]?.chapter_id)
      .filter(Boolean);
    return Array.from(new Set(chapterIds));
  } catch {
    return [];
  }
};

export const getChapterAnswerCount = async (userId: string, chapterId: string): Promise<number> => {
  try {
    const { data, error } = await supabase
      .from('user_answers')
      .select('mcq_id, mcqs(chapter_id)')
      .eq('user_id', userId);

    if (error || !data) return 0;
    const count = data.filter((row: any) => row.mcqs?.[0]?.chapter_id === chapterId).length;
    return count;
  } catch {
    return 0;
  }
};

export const fetchSEQSubjects = async (): Promise<SEQSubject[]> => {
  return await fetchCloudContent<SEQSubject[]>('app-seq-subjects') ?? [];
};

export const fetchSEQSubjectById = async (subjectId: string): Promise<SEQSubject | null> => {
  const subject =
    await fetchCloudContent<SEQSubject>('app-seq-subject', { subjectId }) ??
    await fetchCloudContent<SEQSubject>('seq-subject', { subjectId });
  if (subject) return subject;

  const subjects = await fetchSEQSubjects();
  return subjects.find(item => item.id === subjectId) ?? null;
};

export const fetchSEQChaptersBySubject = async (subjectId: string): Promise<SEQChapter[]> => {
  return await fetchCloudContent<SEQChapter[]>('app-seq-chapters', { subjectId }) ?? [];
};

export const fetchSEQChapterById = async (chapterId: string, subjectId?: string): Promise<SEQChapter | null> => {
  const chapter =
    await fetchCloudContent<SEQChapter>('app-seq-chapter', { chapterId, subjectId }) ??
    await fetchCloudContent<SEQChapter>('seq-chapter', { chapterId, subjectId });
  if (chapter) return chapter;

  if (!subjectId) return null;
  const chapters = await fetchSEQChaptersBySubject(subjectId);
  return chapters.find(item => item.id === chapterId) ?? null;
};

export const fetchSEQByChapter = async (chapterId: string): Promise<SEQ[]> => {
  return await fetchCloudContent<SEQ[]>('app-seqs', { chapterId }) ?? [];
};

export const fetchRandomSEQ = async (chapterId: string): Promise<SEQ | null> => {
  try {
    const seqs = await fetchSEQByChapter(chapterId);
    if (seqs.length === 0) return null;
    return seqs[Math.floor(Math.random() * seqs.length)];
  } catch {
    return null;
  }
};

export const evaluateSEQAnswer = async (
  userAnswer: string,
  question: string,
  bookReferences: string
): Promise<SEQEvaluationResult> => {
  try {
    const data = await aiApiJson<Partial<SEQEvaluationResult>>('seq_ai', {
      userAnswer,
      question,
      bookReferences
    }, {});
    return {
      is_correct: data.is_correct ?? false,
      satisfaction_index: data.satisfaction_index ?? 0,
      corrected_answer: data.corrected_answer ?? userAnswer,
      explanation: data.explanation ?? ''
    };
  } catch (error) {
    console.error('SEQ evaluation error:', error);
    return {
      is_correct: false,
      satisfaction_index: 0,
      corrected_answer: userAnswer,
      explanation: 'Failed to evaluate answer. Please try again.'
    };
  }
};

export const saveSEQAnswer = async (
  seqId: string,
  userAnswer: string,
  isCorrect: boolean,
  satisfactionIndex: number,
  correctedAnswer: string,
  explanation: string,
  bookReference: string,
  timeTaken: number
) => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data, error } = await supabase
      .from('user_seq_answers')
      .insert({
        user_id: user.id,
        seq_id: seqId,
        user_answer: userAnswer,
        is_correct: isCorrect,
        satisfaction_index: satisfactionIndex,
        corrected_answer: correctedAnswer,
        explanation: explanation,
        book_reference: bookReference,
        time_taken: timeTaken
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error saving SEQ answer:', error);
    return null;
  }
};

export const getUserSEQStats = async (userId: string) => {
  try {
    const { data: answers, error: answersError } = await supabase
      .from('user_seq_answers')
      .select('*')
      .eq('user_id', userId);

    if (answersError) {
      return { totalQuestions: 0, correctAnswers: 0, accuracy: 0, averageTime: 0, avgSatisfaction: 0 };
    }

    const totalQuestions = answers?.length || 0;
    const correctAnswers = answers?.filter(a => a.is_correct).length || 0;
    const accuracy = totalQuestions > 0 ? Math.round((correctAnswers / totalQuestions) * 100) : 0;
    const averageTime = answers?.length > 0
      ? Math.round(answers.reduce((sum, a) => sum + (a.time_taken || 0), 0) / answers.length)
      : 0;
    const avgSatisfaction = answers?.length > 0
      ? Math.round(answers.reduce((sum, a) => sum + (a.satisfaction_index || 0), 0) / answers.length)
      : 0;

    return { totalQuestions, correctAnswers, accuracy, averageTime, avgSatisfaction };
  } catch {
    return { totalQuestions: 0, correctAnswers: 0, accuracy: 0, averageTime: 0, avgSatisfaction: 0 };
  }
};

export const getUserSEQAnswersByChapter = async (userId: string, chapterId: string) => {
  try {
    const seqs = await fetchSEQByChapter(chapterId);

    const seqIds = seqs.map(s => s.id);
    
    if (seqIds.length === 0) return {};

    const { data, error } = await supabase
      .from('user_seq_answers')
      .select('*')
      .eq('user_id', userId)
      .in('seq_id', seqIds);

    if (error) throw error;
    
    const answersMap: Record<string, {
      userAnswer: string;
      isCorrect: boolean;
      satisfactionIndex: number;
      correctedAnswer: string;
      explanation: string;
      createdAt: string;
    }> = {};

    data?.forEach(answer => {
      answersMap[answer.seq_id] = {
        userAnswer: answer.user_answer,
        isCorrect: answer.is_correct,
        satisfactionIndex: answer.satisfaction_index,
        correctedAnswer: answer.corrected_answer,
        explanation: answer.explanation,
        createdAt: answer.created_at
      };
    });

    return answersMap;
  } catch {
    return {};
  }
};

export const getFirstUnattemptedSEQIndex = async (userId: string, chapterId: string, seqs: SEQ[]) => {
  try {
    const answersMap = await getUserSEQAnswersByChapter(userId, chapterId);
    
    for (let i = 0; i < seqs.length; i++) {
      if (!answersMap[seqs[i].id]) {
        return i;
      }
    }
    return seqs.length;
  } catch {
    return 0;
  }
};
