import { supabase } from '@/integrations/supabase/client';

export const aiApiOrigin = (import.meta.env.VITE_AI_API_ORIGIN || 'https://ai.medmacs.app').replace(/\/$/, '');

export const aiApiUrl = (path: string) => `${aiApiOrigin}/api/${path.replace(/^\/+/, '')}`;

export class AiApiError extends Error {
  status: number;
  code?: string;
  payload?: Record<string, any>;
  feature?: string;
  limitPeriod?: 'daily' | 'weekly' | 'monthly' | 'cooldown';
  resetAt?: string;
  appCode?: number;
  limit?: number | null;
  used?: number | null;
  remaining?: number;

  constructor(message: string, status: number, code?: string, payload?: Record<string, any>) {
    super(message);
    this.name = 'AiApiError';
    this.status = status;
    this.code = code;
    this.payload = payload;
    this.feature = payload?.feature || payload?.limit_type || undefined;
    this.limitPeriod = payload?.window || payload?.period || payload?.limit_period || undefined;
    this.resetAt = payload?.reset_at || payload?.resetAt || undefined;
    this.appCode = payload?.app_code || undefined;
    this.limit = payload?.limit ?? null;
    this.used = payload?.used ?? null;
    this.remaining = payload?.remaining ?? undefined;
  }
}

export type AiStreamStatus = {
  phase?: string;
  text?: string;
};

type AiLimitErrorCallback = (error: AiApiError) => void;

let _onAiLimitError: AiLimitErrorCallback | null = null;

export const setOnAiLimitError = (callback: AiLimitErrorCallback | null) => {
  _onAiLimitError = callback;
};

const aiStatusMessages: Record<number, string> = {
  401: 'Please log in to use AI.',
  403: 'This AI feature is not available for your current plan.',
  429: 'Your AI quota for this feature has been reached.',
  503: 'AI is temporarily unavailable. Please try again shortly.',
};

export interface AiApiInitOptions extends RequestInit {
  silentLimitError?: boolean;
}

export const aiApiFetch = async (path: string, init: AiApiInitOptions = {}) => {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;

  const headers = new Headers(init.headers);
  if (!headers.has('Content-Type') && init.body) headers.set('Content-Type', 'application/json');
  if (token) headers.set('Authorization', `Bearer ${token}`);

  let response = await fetch(aiApiUrl(path), { ...init, headers });
  
  if (!response.ok && response.status === 401 && path.startsWith('reference')) {
    response = await fetch(`/api/${path.replace(/^\/+/, '')}`, {
      ...init,
      headers: init.headers || { 'Content-Type': 'application/json' },
    });
  }

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    const error = new AiApiError(
      payload.error || payload.message || aiStatusMessages[response.status] || `AI request failed with status ${response.status}`,
      response.status,
      payload.code,
      payload,
    );
    if ((error.status === 403 || error.status === 429) && !init.silentLimitError) {
      _onAiLimitError?.(error);
    }
    throw error;
  }

  return response;
};

export const aiApiJson = async <T = any>(path: string, body: unknown, init: AiApiInitOptions = {}): Promise<T> => {
  const bodyStr = JSON.stringify(body);
  const response = await aiApiFetch(path, {
    ...init,
    method: init.method || 'POST',
    body: bodyStr,
  });
  const result = await response.json() as Promise<T>;
  return result;
};

export const aiApiStream = async (
  path: string,
  body: unknown,
  handlers: { onStatus?: (status: AiStreamStatus) => void; onDelta?: (text: string) => void },
  init: RequestInit = {},
) => {
  const bodyStr = JSON.stringify(body);
  const response = await aiApiFetch(path, {
    ...init,
    method: init.method || 'POST',
    body: bodyStr,
    headers: { Accept: 'text/event-stream', ...(init.headers || {}) },
  });
  if (!response.body) throw new AiApiError('Streaming is unavailable in this browser.', response.status);
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let result: any = {};
  const consume = (raw: string) => {
    const blocks = raw.split('\n\n');
    buffer = blocks.pop() || '';
    for (const block of blocks) {
      const dataLine = block.split('\n').find(line => line.startsWith('data: '));
      const event = block.split('\n').find(line => line.startsWith('event: '))?.slice(7) || '';
      if (!dataLine) continue;
      const data = JSON.parse(dataLine.slice(6));
      if (event === 'status') handlers.onStatus?.({ phase: data.phase, text: data.text || '' });
      if (event === 'delta') handlers.onDelta?.(data.text || '');
      if (event === 'done') result = data;
      if (event === 'error') {
        const err = new AiApiError(data.error || 'AI request failed.', response.status, data.code, data);
        if (err.status === 403 || err.status === 429) _onAiLimitError?.(err);
        throw err;
      }
    }
  };
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    consume(buffer + decoder.decode(value, { stream: true }));
  }
  if (buffer) consume(`${buffer}\n\n`);
  return result;
};
