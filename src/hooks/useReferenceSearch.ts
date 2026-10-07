import { useState, useCallback } from "react";
import { ReferenceResponse } from "../types/reference";
import { aiApiJson } from "@/utils/aiApi";

export function useReferenceSearch() {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [data, setData] = useState<ReferenceResponse | null>(null);

    const search = useCallback(async (query: string, topK = 5) => {
        if (!query.trim()) return;
        setLoading(true);
        setError(null);
        try {
            // Use medmacs-ai gateway (works everywhere — web, Capacitor, dev)
            // silentLimitError: true prevents quota popups for reference search
            const result = await aiApiJson<ReferenceResponse>('reference', { query, top_k: topK }, { silentLimitError: true });
            if (result && (result as any).error) {
                setError((result as any).error);
                setData(null);
                return null;
            }
            setData(result);
            return result;
        } catch (err: any) {
            console.error("Reference search failed:", err);
            // Silently swallow quota/plan errors — references failing shouldn't block the quiz
            if (err?.status === 403 || err?.status === 429) {
                setData(null);
                return null;
            }
            setError(err.message || 'Failed to search references');
            setData(null);
            return null;
        } finally {
            setLoading(false);
        }
    }, []);

    return { search, loading, error, data, setData };
}
