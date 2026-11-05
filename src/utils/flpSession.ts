import { fetchFlpEndpoint, flpEndpoint } from '@/utils/flpEndpoint';
import { supabase } from '@/integrations/supabase/client';

export interface FlpQuestion {
  id: string;
  question: string;
  options: string[];
  correct_answer: string;
  explanation?: string;
  chapter_id: string;
}

export interface FlpDraft {
  sessionId: string;
  mcqs: FlpQuestion[];
  subjectName?: string;
  currentQuestionIndex: number;
  userAnswers: Record<string, string | null>;
  deadline: number;
  savedAt: number;
}

const endpoint = () => flpEndpoint('/session');

async function request(url: URL, method: "GET" | "PUT" | "DELETE" = "GET", draft?: FlpDraft) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Sign in to access your FLP.');
  const response = await fetchFlpEndpoint(url, {
    method,
    headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
    body: draft ? JSON.stringify(draft) : undefined,
    signal: AbortSignal.timeout(12000),
  });
  const payload = await response.json().catch(() => null);
  if (response.status === 404 && payload?.error === 'Not found') {
    throw new Error('FLP session storage is not available on this endpoint yet.');
  }
  if (!response.ok || !payload) throw new Error(payload?.error || 'Could not connect to FLP session storage.');
  return payload;
}

export async function getActiveFlp(): Promise<FlpDraft | null> {
  const draft: FlpDraft | null = (await request(endpoint())).data ?? null;
  if (!draft) return null;

  // Recover a newer local answer change after an interrupted network request.
  try {
    const local = JSON.parse(localStorage.getItem('flp_session') ?? 'null');
    if (local?.sessionId === draft.sessionId && local.savedAt > draft.savedAt) {
      return { ...draft, currentQuestionIndex: local.currentQuestionIndex, userAnswers: local.userAnswers };
    }
  } catch {
    // The server draft remains available if local storage cannot be read.
  }
  return draft;
}

export async function saveFlpDraft(draft: FlpDraft, start = false): Promise<void> {
  const params = new URLSearchParams({ attemptId: draft.sessionId });
  if (start) params.set('start', '1');
  const url = endpoint();
  url.search = params.toString();
  await request(url, "PUT", draft);
}

export async function discardFlpDraft(sessionId: string): Promise<void> {
  const url = endpoint();
  url.searchParams.set('attemptId', sessionId);
  await request(url, "DELETE");

  try {
    const local = JSON.parse(localStorage.getItem('flp_session') ?? 'null');
    if (local?.sessionId === sessionId) localStorage.removeItem('flp_session');
  } catch {
    // The draft has already been deleted from the server.
  }
}

export async function startFlp(mcqs: FlpQuestion[], subjectId: string | null, subjectName?: string): Promise<FlpDraft> {
  const existing = await getActiveFlp();
  if (existing) return existing;

  const { data, error } = await supabase.rpc('initialize_flp_session', {
    p_subject_id: subjectId,
    p_mcq_count: mcqs.length,
    p_test_config_id: 'flp_weekly_test_id',
  });
  if (error) throw error;
  const result = data as { allowed: boolean; error?: string; session_id?: string } | null;
  if (!result?.allowed || !result.session_id) throw new Error(result?.error || 'Could not start the FLP.');

  const savedAt = Date.now();
  const draft: FlpDraft = {
    sessionId: result.session_id, subjectName, savedAt,
    mcqs: mcqs.map(question => {
      const options = [...question.options];
      for (let index = options.length - 1; index > 0; index--) {
        const other = Math.floor(Math.random() * (index + 1));
        [options[index], options[other]] = [options[other], options[index]];
      }
      return { ...question, options };
    }),
    currentQuestionIndex: 0, userAnswers: {}, deadline: savedAt + mcqs.length * 60000,
  };
  try {
    await saveFlpDraft(draft, true);
    return draft;
  } catch (error) {
    const active = await getActiveFlp().catch(() => null);
    if (active) return active;
    throw error;
  }
}
