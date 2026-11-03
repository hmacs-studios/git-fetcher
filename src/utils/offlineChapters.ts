import { fetchCloudContent } from '@/utils/cloudContent';
import { supabase } from '@/integrations/supabase/client';

export type OfflineChapterStatus = 'idle' | 'downloading' | 'downloaded';

type OfflineSubject = {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  year: string;
  institutes?: string[];
};

type OfflineChapter = {
  id: string;
  name: string;
  description: string;
  chapter_number: number;
  subject_id: string;
  mcq_count?: number;
  content_type?: 'question_bank' | 'past_paper' | null;
};

type OfflineMCQ = {
  id: string;
  question: string;
  options: string[];
  correct_answer: string;
  explanation: string;
  subject: string;
  chapter_id: string;
  selected_answer?: string;
};

type OfflineAttemptedAnswer = {
  selectedAnswer: string;
  isCorrect?: boolean;
  updatedAt?: string;
};

export type OfflineChapterPayload = {
  subject: OfflineSubject;
  chapter: OfflineChapter;
  mcqs: OfflineMCQ[];
  attemptedAnswers?: Record<string, OfflineAttemptedAnswer>;
  downloadedAt: string;
};

export type OfflineChapterSummary = {
  id: string;
  subjectId: string;
  subjectName: string;
  chapterName: string;
  chapterNumber: number;
  mcqCount: number;
  downloadedAt: string;
  contentType?: 'question_bank' | 'past_paper' | null;
};

type StoredChapter = {
  id: string;
  subjectId: string;
  iv: string;
  ciphertext: string;
  downloadedAt: string;
};

const DB_NAME = 'medmacs-offline-chapters';
const DB_VERSION = 1;
const CHAPTER_STORE = 'chapters';
const KEY_STORE = 'keys';
const KEY_ID = 'mcq-chapter-key';
const OFFLINE_EVENT = 'medmacs-offline-chapters-changed';
const downloading = new Set<string>();

let dbPromise: Promise<IDBDatabase> | null = null;

const ensureBrowserStorage = () => {
  if (typeof window === 'undefined' || !window.indexedDB || !window.crypto?.subtle) {
    throw new Error('Encrypted offline storage is unavailable on this device.');
  }
};

const openDb = () => {
  ensureBrowserStorage();
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(CHAPTER_STORE)) {
        db.createObjectStore(CHAPTER_STORE, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(KEY_STORE)) {
        db.createObjectStore(KEY_STORE, { keyPath: 'id' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

  return dbPromise;
};

const requestToPromise = <T>(request: IDBRequest<T>): Promise<T> =>
  new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

const transactionDone = (transaction: IDBTransaction) =>
  new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });

const getStoreValue = async <T>(storeName: string, key: IDBValidKey) => {
  const db = await openDb();
  return requestToPromise<T | undefined>(db.transaction(storeName, 'readonly').objectStore(storeName).get(key));
};

const putStoreValue = async (storeName: string, value: unknown) => {
  const db = await openDb();
  const transaction = db.transaction(storeName, 'readwrite');
  transaction.objectStore(storeName).put(value);
  await transactionDone(transaction);
};

const deleteStoreValue = async (storeName: string, key: IDBValidKey) => {
  const db = await openDb();
  const transaction = db.transaction(storeName, 'readwrite');
  transaction.objectStore(storeName).delete(key);
  await transactionDone(transaction);
};

const getAllStoreValues = async <T>(storeName: string) => {
  const db = await openDb();
  return requestToPromise<T[]>(db.transaction(storeName, 'readonly').objectStore(storeName).getAll());
};

const getEncryptionKey = async () => {
  const existing = await getStoreValue<{ id: string; key: CryptoKey }>(KEY_STORE, KEY_ID);
  if (existing?.key) return existing.key;

  const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  await putStoreValue(KEY_STORE, { id: KEY_ID, key });
  return key;
};

const toBase64 = (bytes: Uint8Array) => {
  let binary = '';
  bytes.forEach(byte => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary);
};

const fromBase64 = (value: string) => {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
};

const encryptPayload = async (payload: OfflineChapterPayload) => {
  const key = await getEncryptionKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(JSON.stringify(payload));
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoded);

  return {
    iv: toBase64(iv),
    ciphertext: toBase64(new Uint8Array(encrypted)),
  };
};

const decryptPayload = async (record: StoredChapter): Promise<OfflineChapterPayload | null> => {
  try {
    const key = await getEncryptionKey();
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: fromBase64(record.iv) },
      key,
      fromBase64(record.ciphertext),
    );
    return JSON.parse(new TextDecoder().decode(decrypted));
  } catch (error) {
    console.warn('Unable to decrypt offline chapter', error);
    return null;
  }
};

const emitOfflineChange = () => {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(OFFLINE_EVENT));
  }
};

export const subscribeOfflineChapterChanges = (callback: () => void) => {
  if (typeof window === 'undefined') return () => {};
  window.addEventListener(OFFLINE_EVENT, callback);
  return () => window.removeEventListener(OFFLINE_EVENT, callback);
};

export const getOfflineChapterStatus = async (chapterId: string): Promise<OfflineChapterStatus> => {
  if (downloading.has(chapterId)) return 'downloading';
  try {
    const record = await getStoreValue<StoredChapter>(CHAPTER_STORE, chapterId);
    return record ? 'downloaded' : 'idle';
  } catch {
    return 'idle';
  }
};

export const isChapterDownloaded = async (chapterId: string) => {
  return (await getOfflineChapterStatus(chapterId)) === 'downloaded';
};

const fetchLatestAttemptedAnswers = async (userId: string | undefined, mcqIds: string[]) => {
  if (!userId || mcqIds.length === 0) return {};

  const { data, error } = await supabase
    .from('user_answers')
    .select('mcq_id, selected_answer, is_correct, created_at')
    .eq('user_id', userId)
    .in('mcq_id', mcqIds)
    .order('created_at', { ascending: true });

  if (error) {
    console.warn('Unable to include attempted answers in offline chapter download', error);
    return {};
  }

  return (data || []).reduce<Record<string, OfflineAttemptedAnswer>>((acc, answer) => {
    if (!answer.mcq_id) return acc;
    acc[answer.mcq_id] = {
      selectedAnswer: answer.selected_answer,
      isCorrect: answer.is_correct,
      updatedAt: answer.created_at,
    };
    return acc;
  }, {});
};

export const downloadChapterForOffline = async (subject: OfflineSubject, chapter: OfflineChapter, userId?: string) => {
  if (downloading.has(chapter.id)) return;
  downloading.add(chapter.id);
  emitOfflineChange();

  try {
    const mcqs = await fetchCloudContent<OfflineMCQ[]>('mcqs', { chapterId: chapter.id }) ?? [];
    if (mcqs.length === 0) {
      throw new Error('No MCQs were found for this chapter.');
    }

    const attemptedAnswers = await fetchLatestAttemptedAnswers(userId, mcqs.map(mcq => mcq.id));
    const mcqsWithAttempts = mcqs.map(mcq => {
      const attempted = attemptedAnswers[mcq.id];
      return attempted ? { ...mcq, selected_answer: attempted.selectedAnswer } : mcq;
    });

    const payload: OfflineChapterPayload = {
      subject,
      chapter: { ...chapter, mcq_count: chapter.mcq_count ?? mcqs.length },
      mcqs: mcqsWithAttempts,
      attemptedAnswers,
      downloadedAt: new Date().toISOString(),
    };
    const encrypted = await encryptPayload(payload);

    await putStoreValue(CHAPTER_STORE, {
      id: chapter.id,
      subjectId: subject.id,
      downloadedAt: payload.downloadedAt,
      ...encrypted,
    });
  } finally {
    downloading.delete(chapter.id);
    emitOfflineChange();
  }
};

export const deleteOfflineChapter = async (chapterId: string) => {
  await deleteStoreValue(CHAPTER_STORE, chapterId);
  emitOfflineChange();
};

export const getOfflineChapterPayload = async (chapterId: string) => {
  const record = await getStoreValue<StoredChapter>(CHAPTER_STORE, chapterId);
  return record ? decryptPayload(record) : null;
};

export const getOfflineChapterSummaries = async (): Promise<OfflineChapterSummary[]> => {
  try {
    const records = await getAllStoreValues<StoredChapter>(CHAPTER_STORE);
    const payloads = await Promise.all(records.map(record => decryptPayload(record)));

    return payloads
      .filter(Boolean)
      .map(payload => ({
        id: payload.chapter.id,
        subjectId: payload.subject.id,
        subjectName: payload.subject.name,
        chapterName: payload.chapter.name,
        chapterNumber: payload.chapter.chapter_number,
        mcqCount: payload.mcqs.length,
        downloadedAt: payload.downloadedAt,
        contentType: payload.chapter.content_type,
      }))
      .sort((a, b) => a.subjectName.localeCompare(b.subjectName) || a.chapterNumber - b.chapterNumber);
  } catch {
    return [];
  }
};

export const getOfflineSubjects = async () => {
  try {
    const records = await getAllStoreValues<StoredChapter>(CHAPTER_STORE);
    const payloads = await Promise.all(records.map(record => decryptPayload(record)));
    const byId = new Map<string, OfflineSubject>();

    payloads.filter(Boolean).forEach(payload => byId.set(payload.subject.id, payload.subject));
    return Array.from(byId.values());
  } catch {
    return [];
  }
};

export const getOfflineSubjectById = async (subjectId: string) => {
  try {
    const subjects = await getOfflineSubjects();
    return subjects.find(subject => subject.id === subjectId) ?? null;
  } catch {
    return null;
  }
};

export const getOfflineChaptersBySubject = async (subjectId: string) => {
  try {
    const records = await getAllStoreValues<StoredChapter>(CHAPTER_STORE);
    const subjectRecords = records.filter(record => record.subjectId === subjectId);
    const payloads = await Promise.all(subjectRecords.map(record => decryptPayload(record)));

    return payloads
      .filter(Boolean)
      .map(payload => ({ ...payload.chapter, mcq_count: payload.chapter.mcq_count ?? payload.mcqs.length }))
      .sort((a, b) => a.chapter_number - b.chapter_number);
  } catch {
    return [];
  }
};

export const getOfflineChapterById = async (chapterId: string, subjectId?: string) => {
  try {
    const payload = await getOfflineChapterPayload(chapterId);
    if (!payload) return null;
    if (subjectId && payload.subject.id !== subjectId) return null;
    return { ...payload.chapter, mcq_count: payload.chapter.mcq_count ?? payload.mcqs.length };
  } catch {
    return null;
  }
};

export const getOfflineMCQsByChapter = async (chapterId: string) => {
  try {
    const payload = await getOfflineChapterPayload(chapterId);
    return payload?.mcqs ?? [];
  } catch {
    return [];
  }
};

export const clearAllOfflineChapters = async () => {
  if (typeof window === 'undefined') return;
  try {
    const db = await openDb();
    const transaction = db.transaction([CHAPTER_STORE, KEY_STORE], 'readwrite');
    transaction.objectStore(CHAPTER_STORE).clear();
    transaction.objectStore(KEY_STORE).clear();
    await transactionDone(transaction);
    emitOfflineChange();
  } catch (err) {
    console.warn('Unable to clear offline encrypted chapters store on sign out:', err);
  }
};

