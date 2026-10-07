import type { Chapter, MCQ } from '@/utils/mcqData';
import { logMCQDiagnostic } from '@/utils/mcqDiagnostics';

type CachedMCQChapter = {
  chapterId: string;
  mcqs: MCQ[];
  cachedAt: string;
};

const DB_NAME = 'medmacs-mcq-content-cache';
const DB_VERSION = 1;
const MCQ_STORE = 'chapter-mcqs';

let dbPromise: Promise<IDBDatabase> | null = null;
const DB_OPEN_TIMEOUT_MS = 3000;

const openDb = () => {
  if (typeof window === 'undefined' || !window.indexedDB) {
    throw new Error('MCQ content cache is unavailable.');
  }
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    let settled = false;
    const timeoutId = window.setTimeout(() => {
      settled = true;
      dbPromise = null;
      reject(new Error('MCQ cache database did not open in time.'));
    }, DB_OPEN_TIMEOUT_MS);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(MCQ_STORE)) {
        request.result.createObjectStore(MCQ_STORE, { keyPath: 'chapterId' });
      }
    };
    request.onsuccess = () => {
      window.clearTimeout(timeoutId);
      if (settled) {
        request.result.close();
        return;
      }
      settled = true;
      resolve(request.result);
    };
    request.onerror = () => {
      window.clearTimeout(timeoutId);
      if (settled) return;
      settled = true;
      dbPromise = null;
      reject(request.error);
    };
    request.onblocked = () => {
      window.clearTimeout(timeoutId);
      if (settled) return;
      settled = true;
      dbPromise = null;
      logMCQDiagnostic('content_cache_db_blocked', {}, 'warn');
      reject(new Error('MCQ cache database is blocked.'));
    };
  });
  return dbPromise;
};

const requestToPromise = <T>(request: IDBRequest<T>) =>
  new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

const transactionDone = (transaction: IDBTransaction) =>
  new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });

const ACTIVE_SCOPE_KEY = 'medmacs_mcq_active_scope';
const SUBJECTS_CACHE_PREFIX = 'medmacs_mcq_subjects_cache:';
const CHAPTERS_CACHE_PREFIX = 'medmacs_mcq_chapters_cache:';

export const getStoredScopeKey = (): string => {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem(ACTIVE_SCOPE_KEY) || '';
};

export const setStoredScopeKey = (scopeKey: string) => {
  if (typeof window === 'undefined') return;
  if (scopeKey) localStorage.setItem(ACTIVE_SCOPE_KEY, scopeKey);
  else localStorage.removeItem(ACTIVE_SCOPE_KEY);
};

export const clearCachedMCQDataSync = () => {
  if (typeof window === 'undefined') return;
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (key.startsWith(SUBJECTS_CACHE_PREFIX) || key.startsWith(CHAPTERS_CACHE_PREFIX) || key === 'medmacs_mcq_subjects_cache' || key === ACTIVE_SCOPE_KEY || key === 'medmacs_mcq_profile_scope')) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(k => localStorage.removeItem(k));
  } catch (err) {
    console.error('Failed to synchronously invalidate MCQ localStorage cache:', err);
  }
};

export const readCachedChapters = (subjectId: string, scopeKey = ''): Chapter[] => {
  if (typeof window === 'undefined') return [];
  try {
    const key = scopeKey
      ? `${CHAPTERS_CACHE_PREFIX}${scopeKey}:${subjectId}`
      : `${CHAPTERS_CACHE_PREFIX}${subjectId}`;
    const value = localStorage.getItem(key);
    const parsed = value ? JSON.parse(value) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

export const cacheChapters = (subjectId: string, chapters: Chapter[], scopeKey = '') => {
  if (typeof window === 'undefined' || chapters.length === 0) return;
  try {
    const key = scopeKey
      ? `${CHAPTERS_CACHE_PREFIX}${scopeKey}:${subjectId}`
      : `${CHAPTERS_CACHE_PREFIX}${subjectId}`;
    localStorage.setItem(key, JSON.stringify(chapters));
  } catch {
    // Navigation can continue when storage is unavailable or full.
  }
};

export const getCachedChapterMCQs = async (chapterId: string): Promise<MCQ[]> => {
  try {
    const db = await openDb();
    const record = await requestToPromise<CachedMCQChapter | undefined>(
      db.transaction(MCQ_STORE, 'readonly').objectStore(MCQ_STORE).get(chapterId),
    );
    return Array.isArray(record?.mcqs) ? record.mcqs : [];
  } catch {
    logMCQDiagnostic('content_cache_read_failed', { chapterId }, 'warn');
    return [];
  }
};

export const cacheChapterMCQs = async (chapterId: string, mcqs: MCQ[]) => {
  if (mcqs.length === 0) return;
  try {
    const db = await openDb();
    const transaction = db.transaction(MCQ_STORE, 'readwrite');
    transaction.objectStore(MCQ_STORE).put({
      chapterId,
      mcqs,
      cachedAt: new Date().toISOString(),
    } satisfies CachedMCQChapter);
    await transactionDone(transaction);
  } catch {
    logMCQDiagnostic('content_cache_write_failed', {
      chapterId,
      questionCount: mcqs.length,
    }, 'warn');
    // A failed cache write must never prevent a quiz from starting.
  }
};

export const clearCachedMCQData = async () => {
  if (typeof window === 'undefined') return;
  clearCachedMCQDataSync();
  try {
    // Clear IndexedDB MCQ content store
    try {
      const db = await openDb();
      const transaction = db.transaction(MCQ_STORE, 'readwrite');
      transaction.objectStore(MCQ_STORE).clear();
      await transactionDone(transaction);
    } catch (e) {
      logMCQDiagnostic('content_cache_clear_failed', {}, 'warn');
    }
  } catch (err) {
    console.error('Failed to invalidate MCQ content cache:', err);
  }
};
