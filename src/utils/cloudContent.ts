import { supabase } from '@/integrations/supabase/client';
import { clearCachedMCQDataSync, getStoredScopeKey, setStoredScopeKey } from '@/utils/mcqContentCache';

const DEFAULT_CONTENT_API_URL = 'https://contents.medmacs.app/api/content';
const CONTENT_API_URL = import.meta.env.VITE_CONTENT_API_URL || DEFAULT_CONTENT_API_URL;
// Mobile networks frequently need several seconds for their first DNS/TLS handshake.
// Four seconds caused healthy cold connections to be aborted during page transitions.
const CONTENT_API_TIMEOUT_MS = 12000;
const CONTENT_API_MAX_ATTEMPTS = 2;
const inFlightContentRequests = new Map<string, Promise<unknown>>();

const createContentUrl = () => {
  if (/^https?:\/\//i.test(CONTENT_API_URL)) {
    return new URL(CONTENT_API_URL);
  }

  const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost';
  return new URL(CONTENT_API_URL, origin);
};

const extractContentPayload = <T>(payload: any): T | null => {
  if (payload === null || payload === undefined) return null;
  if (Array.isArray(payload)) return payload as T;
  if (payload.data !== undefined) return payload.data as T;

  const contentKeys = [
    'subjects',
    'subject',
    'chapters',
    'chapter',
    'mcqs',
    'seqs',
    'seq',
    'questions',
    'items',
    'result',
  ];

  for (const key of contentKeys) {
    if (payload[key] !== undefined) return payload[key] as T;
  }

  return payload as T;
};

export const fetchCloudContent = async <T>(
  resource: string,
  params: Record<string, string | number | null | undefined> = {},
  options: { throwOnFailure?: boolean } = {},
): Promise<T | null> => {
  try {
    console.log(`[fetchCloudContent] Requesting resource: ${resource}`, { params, CONTENT_API_URL });
    let sessionTimeoutId: ReturnType<typeof setTimeout> | undefined;
    const sessionResult = await Promise.race([
      supabase.auth.getSession(),
      new Promise<null>(resolve => {
        sessionTimeoutId = setTimeout(() => resolve(null), CONTENT_API_TIMEOUT_MS);
      }),
    ]);
    if (sessionTimeoutId) clearTimeout(sessionTimeoutId);

    const token = sessionResult?.data.session?.access_token;
    console.log(`[fetchCloudContent] Auth token present: ${!!token}`);

    if (!token) {
      console.warn(`[fetchCloudContent] No access token available for resource: ${resource}`);
      if (options.throwOnFailure) throw new Error('Content session unavailable');
      return null;
    }

    const url = createContentUrl();
    url.searchParams.set('resource', resource);

    Object.entries(params).forEach(([key, value]) => {
      if (value !== null && value !== undefined) {
        url.searchParams.set(key, String(value));
      }
    });

    const requestKey = url.toString();
    console.log(`[fetchCloudContent] Full URL: ${requestKey}`);
    let request = inFlightContentRequests.get(requestKey);
    if (!request) {
      request = (async () => {
        let response: Response | null = null;
        let lastError: unknown = null;

        for (let attempt = 0; attempt < CONTENT_API_MAX_ATTEMPTS; attempt += 1) {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), CONTENT_API_TIMEOUT_MS);
          try {
            response = await fetch(requestKey, {
              method: 'GET',
              headers: {
                Authorization: `Bearer ${token}`,
              },
              cache: 'default',
              signal: controller.signal,
            });
            console.log(`[fetchCloudContent] Response status for ${resource}: ${response.status}`);
            if (response.ok || response.status < 500) break;
          } catch (error) {
            console.error(`[fetchCloudContent] Fetch attempt ${attempt + 1} failed:`, error);
            lastError = error;
          } finally {
            clearTimeout(timeoutId);
          }
        }

        if (!response) {
          console.error(`[fetchCloudContent] No response received for ${resource}`);
          throw lastError ?? new Error('Content server unavailable');
        }
        if (!response.ok) {
          const errText = await response.text().catch(() => '');
          console.error(`[fetchCloudContent] Response not OK (${response.status}): ${errText}`);
          throw new Error(`Content request failed (${response.status})`);
        }

        const serverUserScope = response.headers.get('X-User-Scope');
        if (serverUserScope) {
          const storedScope = getStoredScopeKey();
          if (storedScope && storedScope !== serverUserScope) {
            console.log(`[fetchCloudContent] ETag Scope change detected (${storedScope} -> ${serverUserScope}). Invalidating all caches.`);
            clearCachedMCQDataSync();
          }
          setStoredScopeKey(serverUserScope);
        }

        const json = await response.json();
        const extracted = extractContentPayload<T>(json);
        console.log(`[fetchCloudContent] Extracted payload for ${resource}:`, { raw: json, extracted });
        return extracted;
      })().finally(() => {
        inFlightContentRequests.delete(requestKey);
      });
      inFlightContentRequests.set(requestKey, request);
    }

    return await request as T | null;
  } catch (error) {
    console.error(`[fetchCloudContent] Caught error fetching ${resource}:`, error);
    if (options.throwOnFailure) throw error;
    return null;
  }
};
