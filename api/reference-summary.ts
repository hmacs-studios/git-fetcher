import type { ApiRequest, ApiResponse } from './http-types';
import { fetchReferenceChunks, publicReferenceChunk } from './reference-utils';

const GROQ_MODEL = process.env.GROQ_SUMMARY_MODEL || process.env.GROQ_VERIFICATION_MODEL || 'openai/gpt-oss-120b';

const extractOutputText = (data: any) => data?.choices?.[0]?.message?.content || '';

const extractJsonObject = (text: string) => {
  const cleaned = String(text || '')
    .trim()
    .replace(/^```(?:json)?/i, '')
    .replace(/```$/i, '')
    .trim();

  let start = -1;
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = 0; index < cleaned.length; index += 1) {
    const char = cleaned[index];
    if (inString) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === '"') inString = false;
      continue;
    }

    if (char === '"') inString = true;
    if (char === '{') {
      if (depth === 0) start = index;
      depth += 1;
    } else if (char === '}' && depth > 0) {
      depth -= 1;
      if (depth === 0 && start >= 0) return cleaned.slice(start, index + 1);
    }
  }

  return '';
};

const parseSummary = (text: string) => {
  const jsonText = extractJsonObject(text);
  if (!jsonText) return null;
  try {
    return JSON.parse(jsonText);
  } catch {
    const repaired = jsonText
      .replace(/,\s*([}\]])/g, '$1')
      .replace(/[“”]/g, '"')
      .replace(/[‘’]/g, "'");
    return JSON.parse(repaired);
  }
};

const fallbackPlainSummary = (text: string) =>
  String(text || '')
    .replace(/```[\s\S]*?```/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 700);

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  try {
    const groqApiKey = process.env.GROQ_API_KEY;
    if (!groqApiKey) return res.status(500).json({ error: 'GROQ_API_KEY is not configured' });

    const { question, top_k = 5 } = req.body || {};
    if (!question?.trim()) return res.status(400).json({ error: 'question is required' });

    const referenceData = await fetchReferenceChunks(question, top_k);
    const references = referenceData.results.slice(0, 10);

    if (references.length === 0) {
      return res.status(200).json({
        summary: '',
        citations: [],
        status: 'no_references',
      });
    }

    const referenceText = references
      .map((ref: any, index: number) => `${index}: ${ref.book || 'Reference'}, page ${ref.page || '-'}\n${ref.content || ''}`)
      .join('\n\n');

    const prompt = `You are Dr Ahroid, an MBBS tutor.

Create a short original teaching summary that answers the student's question using the internal reference snippets as private context.

Question:
${question}

Private reference context:
${referenceText}

Return only JSON in this exact shape:
{"summary":"2-4 concise sentences, no quotes and no close paraphrase of source text.","citationIndexes":[0,2]}

Rules:
- Do not quote the private snippets.
- Do not rewrite the snippets sentence-by-sentence.
- Do not mention hidden chunks or internal context.
- Keep it educational and focused on the question.
- citationIndexes should include only the private references that materially support the summary.`;

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${groqApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: [
          {
            role: 'system',
            content: 'Return only valid JSON. Do not include markdown, raw source text, or quotes from private snippets.',
          },
          { role: 'user', content: prompt },
        ],
        temperature: 0.1,
        max_tokens: 700,
        response_format: { type: 'json_object' },
      }),
    });

    if (!response.ok) {
      const detail = await response.text();
      console.error('Reference summary provider error:', response.status, detail);
      return res.status(502).json({ error: 'Reference summary is temporarily unavailable.' });
    }

    const data = await response.json();
    const parsed = parseSummary(extractOutputText(data));
    const citationIndexes = Array.isArray(parsed?.citationIndexes)
      ? parsed.citationIndexes.filter((index: number) => Number.isInteger(index) && index >= 0 && index < references.length)
      : [];
    const citations = (citationIndexes.length ? citationIndexes : references.map((_, index) => index).slice(0, 3))
      .map((index: number) => publicReferenceChunk(references[index]));

    return res.status(200).json({
      summary: parsed?.summary || fallbackPlainSummary(extractOutputText(data)) || 'Dr Ahroid could not format a focused summary right now.',
      citations,
      status: 'summarized',
    });
  } catch (error: any) {
    console.error('Reference summary error:', error);
    return res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
}
