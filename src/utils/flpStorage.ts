import { fetchFlpEndpoint, flpEndpoint } from '@/utils/flpEndpoint';
const archiveUrl = (attemptId: string) => {
  const url = flpEndpoint('/archive');
  url.searchParams.set('attemptId', attemptId);
  return url;
};
const FLP_STORAGE_API = 'https://contents.medmacs.app/api/flp-storage';

interface AttemptData {
  attempt_id: string;
  mcqs: any[];
  question_attempts: any[];
  score: number;
  total_questions: number;
  completed_at: string;
  [key: string]: any;
}

async function getAuthHeaders(): Promise<Record<string, string>> {
  const { supabase } = await import('@/integrations/supabase/client');
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error('Not authenticated');
  return {
    'Authorization': `Bearer ${session.access_token}`,
    'Content-Type': 'application/json',
  };
}

export async function writeAttemptData(data: AttemptData): Promise<void> {
  const headers = await getAuthHeaders();
  const res = await fetchFlpEndpoint(archiveUrl(data.attempt_id), {
    method: 'POST',
    signal: AbortSignal.timeout(12000),
    headers,
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Failed to write attempt data' }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }

}

function comparableJson(value: unknown): string {
  return JSON.stringify(value, (_key, item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return item;
    return Object.fromEntries(Object.keys(item).sort().map(key => [key, item[key]]));
  });
}

export function matchesArchivedAttempt(expected: AttemptData, archived: AttemptData | null): boolean {
  return archived !== null && comparableJson(expected) === comparableJson(archived);
}

export async function readArchivedAttempt(attemptId: string): Promise<AttemptData | null> {
  return fetchReview(archiveUrl(attemptId));
}

export async function readAttemptData(r2Key: string): Promise<AttemptData | null> {
  return fetchReview(`${FLP_STORAGE_API}?action=read&key=${encodeURIComponent(r2Key)}`);
}

async function fetchReview(url: string | URL): Promise<AttemptData | null> {
  const headers = await getAuthHeaders();
  const init = { headers, signal: AbortSignal.timeout(12000) };
  const res = typeof url === 'string' ? await fetch(url, init) : await fetchFlpEndpoint(url, init);

  if (res.status === 404 || res.status === 410) return null;
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Failed to read attempt data' }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }

  return res.json();
}

export async function deleteAttemptData(r2Key: string): Promise<void> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${FLP_STORAGE_API}?action=delete&key=${encodeURIComponent(r2Key)}`, {
    method: 'DELETE',
    headers,
  });

  if (!res.ok && res.status !== 404) {
    const err = await res.json().catch(() => ({ error: 'Failed to delete attempt data' }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
}
