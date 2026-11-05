import { fetchFlpEndpoint, flpEndpoint } from '@/utils/flpEndpoint';
import { supabase } from "@/integrations/supabase/client";

type FlpPayload<T> = { data?: T[]; error?: string } | null;

interface FlpRequestOptions {
  params?: URLSearchParams;
  onProgress?: (loaded: number) => void;
  signal?: AbortSignal;
}

function readPayload<T>(status: number, payload: FlpPayload<T>): T[] {
  if (status >= 400) throw new Error(payload?.error || `FLP service returned HTTP ${status}.`);
  if (!Array.isArray(payload?.data)) throw new Error("The FLP service returned an invalid response.");
  return payload.data;
}

export async function fetchFlpContent<T>(
  resource: "" | "/subjects",
  { params, onProgress, signal }: FlpRequestOptions = {},
): Promise<T[]> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("Please sign in again to access FLPs.");

  const url = flpEndpoint(resource);
  if (params) url.search = params.toString();
  if (onProgress) url.searchParams.set("progress", "1");

  const controller = new AbortController();
  const abort = () => controller.abort(signal?.reason);
  signal?.addEventListener("abort", abort, { once: true });
  if (signal?.aborted) abort();
  const timeout = setTimeout(() => controller.abort(new Error("The FLP request timed out. Please try again.")), 45000);

  try {
    const response = await fetchFlpEndpoint(url, {
      headers: { Authorization: `Bearer ${session.access_token}` },
      signal: controller.signal,
    });

    if (!response.ok || !response.body || !response.headers.get("Content-Type")?.includes("application/x-ndjson")) {
      return readPayload<T>(response.status, await response.json().catch(() => null));
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let pending = "";
    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        pending += decoder.decode(value, { stream: true });
        const lines = pending.split("\n");
        pending = lines.pop() ?? "";
        for (const line of lines) {
          if (!line) continue;
          const event = JSON.parse(line);
          if (event.type === "progress" && Number.isFinite(event.loaded)) onProgress?.(event.loaded);
          if (event.type === "result") return readPayload<T>(event.status, event.payload);
        }
      }
      throw new Error("The FLP connection closed before the paper was ready. Please try again.");
    } finally {
      await reader.cancel().catch(() => {});
      reader.releaseLock();
    }
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener("abort", abort);
  }
}
