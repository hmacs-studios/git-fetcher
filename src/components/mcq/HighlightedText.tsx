import React, { useMemo } from 'react';
import type { GlossaryTerm } from '@/services/glossaryService';

interface HighlightedTextProps {
  text: string;
  terms: GlossaryTerm[];
  onTermClick: (term: GlossaryTerm) => void;
  className?: string;
}

/**
 * Parses text and highlights matched glossary terms in accent color.
 * Clicking a highlighted term triggers `onTermClick`.
 */
export const HighlightedText: React.FC<HighlightedTextProps> = ({
  text,
  terms,
  onTermClick,
  className,
}) => {
  const elements = useMemo(() => {
    if (!text || !terms || terms.length === 0) {
      return text;
    }

    // Sort terms by length descending to match multi-word terms first (e.g., 'erythroblastosis fetalis' before 'erythroblast')
    const sortedTerms = [...terms].sort((a, b) => b.term.length - a.term.length);
    const termMap = new Map<string, GlossaryTerm>();
    sortedTerms.forEach(t => termMap.set(t.term.toLowerCase(), t));

    // Escape regex characters
    const escapedTerms = sortedTerms.map(t =>
      t.term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    );

    // Match word boundaries: (?:\bterm\b)
    const regex = new RegExp(`\\b(${escapedTerms.join('|')})\\b`, 'gi');

    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = regex.exec(text)) !== null) {
      const matchStart = match.index;
      const matchedString = match[0];
      const matchEnd = matchStart + matchedString.length;

      // Push preceding normal text
      if (matchStart > lastIndex) {
        parts.push(text.substring(lastIndex, matchStart));
      }

      // Look up definition
      const matchedData = termMap.get(matchedString.toLowerCase());

      parts.push(
        <button
          key={`glossary-${matchStart}-${matchedString}`}
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            if (matchedData) onTermClick(matchedData);
          }}
          className="inline font-semibold text-primary underline decoration-primary/40 decoration-dotted underline-offset-4 transition-colors hover:text-primary/80 hover:decoration-solid active:opacity-75 focus-visible:outline-none"
          title="Tap to see medical glossary definition"
        >
          {matchedString}
        </button>
      );

      lastIndex = matchEnd;
    }

    if (lastIndex < text.length) {
      parts.push(text.substring(lastIndex));
    }

    return parts;
  }, [text, terms, onTermClick]);

  return <span className={className}>{elements}</span>;
};
