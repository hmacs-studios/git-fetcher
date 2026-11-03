/**
 * Medical Glossary Service for git-fetcher
 * Connects to Medmacs Glossary API Microservice
 */

import { aiApiJson, aiApiOrigin } from '@/utils/aiApi';

export interface GlossaryTerm {
  term: string;
  definition: string;
  category?: string;
}

// In-memory LRU cache to avoid repeated network calls
const glossaryCache = new Map<string, GlossaryTerm | null>();
const textMatchCache = new Map<string, GlossaryTerm[]>();

/**
 * Find matching medical glossary terms for a block of text (question/options)
 * Uses https://ai.medmacs.app/api/glossary
 */
export async function matchGlossaryTerms(text: string): Promise<GlossaryTerm[]> {
  if (!text || text.trim().length < 5) return [];

  const cacheKey = text.trim();
  if (textMatchCache.has(cacheKey)) {
    return textMatchCache.get(cacheKey)!;
  }

  try {
    const data = await aiApiJson<{ matches?: GlossaryTerm[] }>('glossary', { text });
    const matches = Array.isArray(data.matches) ? data.matches : [];

    // Store in individual cache as well
    matches.forEach((item) => {
      if (item.term) {
        glossaryCache.set(item.term.toLowerCase(), item);
      }
    });

    textMatchCache.set(cacheKey, matches);
    return matches;
  } catch (error) {
    console.warn('[Glossary] Match failed:', error);
    return [];
  }
}

/**
 * Fetch a single term definition
 */
export async function fetchGlossaryTerm(term: string): Promise<GlossaryTerm | null> {
  const clean = term.trim().toLowerCase();
  if (!clean) return null;

  if (glossaryCache.has(clean)) {
    return glossaryCache.get(clean) || null;
  }

  try {
    const res = await fetch(`${aiApiOrigin}/api/glossary?term=${encodeURIComponent(clean)}`);
    if (!res.ok) {
      glossaryCache.set(clean, null);
      return null;
    }

    const data = await res.json() as GlossaryTerm;
    glossaryCache.set(clean, data);
    return data;
  } catch (error) {
    console.warn('[Glossary] Term fetch failed:', error);
    return null;
  }
}

