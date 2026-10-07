import type { ApiRequest, ApiResponse } from './http-types';
import { fetchReferenceChunks, publicReferenceChunk } from './reference-utils';

/**
 * medmacs-validation API
 * 
 * Standalone reference verification endpoint connecting strictly to OCI RAG & NLI search.
 * Contains ZERO LLM calls or model fallbacks.
 */
export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  try {
    const {
      question,
      correctAnswer = '',
    } = req.body || {};

    const questionText = String(question || '').trim();
    const correctAnswerText = String(correctAnswer || '').trim();

    if (!questionText) {
      return res.status(400).json({ error: 'question is required' });
    }

    let internalReferences: any[] = [];
    try {
      const searchQuery = `${questionText} ${correctAnswerText}`.trim();
      const referenceData = await fetchReferenceChunks(searchQuery, 10);
      internalReferences = Array.isArray(referenceData?.results) ? referenceData.results : [];
    } catch (error) {
      console.error('OCI Reference/NLI vector search failed:', error);
    }

    // Filter relevant chunks matching similarity confidence threshold (score >= 0.35)
    const matchingIndexes: number[] = [];
    const citations: any[] = [];

    internalReferences.forEach((ref: any, idx: number) => {
      const score = typeof ref.score === 'number' ? ref.score : 0;
      if (score >= 0.35) {
        matchingIndexes.push(idx);
        citations.push(publicReferenceChunk(ref));
      }
    });

    if (matchingIndexes.length > 0) {
      return res.status(200).json({
        verdict: 'verified',
        sourceBasis: 'internal',
        matchingIndexes,
        markedAnswerWrong: false,
        correctAnswerSuggestion: '',
        summary: `Dr Ahroid verified this question against ${matchingIndexes.length} matching textbook reference section(s).`,
        citations,
      });
    }

    return res.status(200).json({
      verdict: 'no_references',
      sourceBasis: 'none',
      matchingIndexes: [],
      markedAnswerWrong: false,
      correctAnswerSuggestion: '',
      summary: 'No possible book reference found for this question in the current library.',
      citations: [],
    });
  } catch (error: any) {
    console.error('Reference validation error:', error);
    return res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
}
