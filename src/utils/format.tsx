import React, { ReactNode } from "react";

const toSuperscript = (str: string): string => {
  const map: Record<string, string> = {
    '+': '⁺', '-': '⁻', '0': '⁰', '1': '¹', '2': '²', '3': '³',
    '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹', 'n': 'ⁿ'
  };
  return str.split('').map((c) => map[c] || c).join('');
};

const toSubscript = (str: string): string => {
  const map: Record<string, string> = {
    '0': '₀', '1': '₁', '2': '₂', '3': '₃', '4': '₄',
    '5': '₅', '6': '₆', '7': '₇', '8': '₈', '9': '₉',
    'i': 'ᵢ', 'n': 'ₙ', 'a': 'ₐ', 'e': 'ₑ', 'o': 'ₒ', 'r': 'ᵣ', 't': 'ₜ', 'x': 'ₓ',
    '+': '₊', '-': '₋'
  };
  return str.split('').map((c) => map[c] || c).join('');
};

const cleanLaTeXMath = (text: string): string => {
  if (!text) return "";
  return text
    .replace(/\\\[([\s\S]*?)\\\]/g, (_, eq) => '\n\n__FORMULA__' + cleanLaTeXMath(eq) + '__FORMULA__\n\n')
    .replace(/\$\$([\s\S]*?)\$\$/g, (_, eq) => '\n\n__FORMULA__' + cleanLaTeXMath(eq) + '__FORMULA__\n\n')
    .replace(/\\\((.*?)\\\)/g, (_, eq) => cleanLaTeXMath(eq))
    .replace(/\$([^$\n]+)\$/g, (_, eq) => cleanLaTeXMath(eq))
    .replace(/\\(text|mathrm|mathbf|mathit)\{([^}]+)\}/g, '$2')
    .replace(/\\(longrightarrow|rightarrow|to)/g, ' → ')
    .replace(/\\(longleftarrow|leftarrow)/g, ' ← ')
    .replace(/\\(rightleftharpoons|leftrightharpoons)/g, ' ⇌ ')
    .replace(/\\(times|cdot)/g, ' × ')
    .replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, '($1 / $2)')
    .replace(/\^\{([^}]+)\}/g, (_, val) => toSuperscript(val))
    .replace(/\^([+-\d[a-zA-Z])/g, (_, val) => toSuperscript(val))
    .replace(/_\{([^}]+)\}/g, (_, val) => toSubscript(val))
    .replace(/_([a-zA-Z\d])/g, (_, val) => toSubscript(val))
    .replace(/\\/g, '');
};

export const stripMarkdownForCopy = (text: string): string => {
  if (!text) return "";
  const cleanedLaTeX = cleanLaTeXMath(text).replace(/__FORMULA__/g, '');
  return cleanedLaTeX
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/_([^_]+)_/g, "$1")
    .replace(/^\s{0,3}#{1,6}\s+/gm, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/```[a-z]*\n?/gi, "")
    .replace(/```/g, "")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
};



export const BOOK_THEME_MAP: Record<string, { bg: string; text: string; border: string }> = {
  guyton: { bg: '#1e3a8a', text: '#ffffff', border: '#3b82f6' },
  'first aid': { bg: '#991b1b', text: '#ffffff', border: '#ef4444' },
  pathoma: { bg: '#881337', text: '#ffffff', border: '#f43f5e' },
  davidson: { bg: '#064e3b', text: '#ffffff', border: '#10b981' },
  bailey: { bg: '#4c1d95', text: '#ffffff', border: '#8b5cf6' },
  snell: { bg: '#164e63', text: '#ffffff', border: '#06b6d4' },
  harper: { bg: '#7c2d12', text: '#ffffff', border: '#f97316' },
  lippincott: { bg: '#581c87', text: '#ffffff', border: '#a855f7' },
  chaurasia: { bg: '#1e293b', text: '#ffffff', border: '#64748b' },
  teachers: { bg: '#9f1239', text: '#ffffff', border: '#fb7185' },
  wheater: { bg: '#1e40af', text: '#ffffff', border: '#60a5fa' },
  katzung: { bg: '#14532d', text: '#ffffff', border: '#22c55e' },
  robbins: { bg: '#701a75', text: '#ffffff', border: '#d946ef' },
  cotran: { bg: '#701a75', text: '#ffffff', border: '#d946ef' },
  ganong: { bg: '#312e81', text: '#ffffff', border: '#6366f1' },
  harrison: { bg: '#042f2e', text: '#ffffff', border: '#14b8a6' },
  nelson: { bg: '#083344', text: '#ffffff', border: '#0891b2' },
  costanzo: { bg: '#9a3412', text: '#ffffff', border: '#fb923c' },
  kaplan: { bg: '#0f172a', text: '#ffffff', border: '#38bdf8' },
  brs: { bg: '#0f172a', text: '#ffffff', border: '#38bdf8' }
};

// Themes are sourced from the static BOOK_THEME_MAP. The optional `ai_books`
// table is not provisioned in this environment, so no remote fetch is attempted.
const dynamicBookThemes: Record<string, { bg: string; text: string; border: string }> = { ...BOOK_THEME_MAP };

export const loadServerBookThemes = async () => {
  // Kept for API compatibility; themes load synchronously from the static map.
};

export const getInlinePillTheme = (refText: string) => {
  const lower = refText.toLowerCase();
  for (const [key, theme] of Object.entries(dynamicBookThemes)) {
    if (lower.includes(key)) return theme;
  }
  let hash = 0;
  for (let i = 0; i < refText.length; i++) {
    hash = refText.charCodeAt(i) + ((hash << 5) - hash);
  }
  const palette = [
    { bg: '#1e3a8a', text: '#ffffff', border: '#3b82f6' },
    { bg: '#991b1b', text: '#ffffff', border: '#ef4444' },
    { bg: '#881337', text: '#ffffff', border: '#f43f5e' },
    { bg: '#064e3b', text: '#ffffff', border: '#10b981' },
    { bg: '#4c1d95', text: '#ffffff', border: '#8b5cf6' },
    { bg: '#164e63', text: '#ffffff', border: '#06b6d4' },
    { bg: '#7c2d12', text: '#ffffff', border: '#f97316' },
    { bg: '#581c87', text: '#ffffff', border: '#a855f7' }
  ];
  return palette[Math.abs(hash) % palette.length];
};

const REF_SPLIT_REGEX = /(\[(?:ref|reference|references)?:?\s*[^\]]+\]|\((?:ref|reference|references)?:?\s*(?:Davidson|Guyton|First Aid|Pathoma|Bailey|Snell|Harper|Lippincott|Ten Teachers|BD Chaurasia|Wheater|Katzung|Robbins|Ganong|Harrison|Nelson|Costanzo|BRS|Kaplan)[^)]*?\))/gi;

const isPillMatch = (str: string): boolean => {
  const trimmed = str.trim();
  return /^(\[(?:ref|reference|references)?:?\s*[^\]]+\]|\((?:ref|reference|references)?:?\s*[^)]+?\))$/i.test(trimmed);
};

const normalizeAiMarkdown = (text: string) => {
  if (!text) return "";
  const latexCleaned = cleanLaTeXMath(text);
  return latexCleaned
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/&nbsp;/gi, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/^\s{0,3}>{1,}\s?/gm, '')
    .replace(/```[\s\S]*?```/g, (block) => block.replace(/```[a-z]*|```/gi, '').trim())
    .replace(/\s*[•●]\s*/g, '\n- ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
};

export const parseBoldText = (text: string): ReactNode[] => {
  if (!text) return [];
  const segments = text.split(REF_SPLIT_REGEX);

  return segments.map((seg, idx) => {
    if (!seg) return null;

    if (isPillMatch(seg)) {
      let cleanRef = seg.trim();
      let innerContent = cleanRef;

      if (cleanRef.startsWith('(') && cleanRef.endsWith(')')) {
        innerContent = cleanRef.slice(1, -1).replace(/^(?:ref|reference|references):\s*/i, '').replace(/\s+/g, ' ').trim();
      } else if (cleanRef.startsWith('[') && cleanRef.endsWith(']')) {
        innerContent = cleanRef.slice(1, -1).replace(/^(?:ref|reference|references):\s*/i, '').replace(/\s+/g, ' ').trim();
      } else {
        innerContent = cleanRef.replace(/^(?:ref|reference|references):\s*/i, '').replace(/\s+/g, ' ').trim();
      }

      const theme = getInlinePillTheme(innerContent);
      return (
        <span
          key={`pill-${idx}`}
          style={{
            background: `linear-gradient(180deg, ${theme.bg}77 0%, ${theme.bg}44 60%, ${theme.bg}22 100%)`,
            color: '#ffffff',
            borderColor: `${theme.border}99`,
            boxShadow: `0 2px 5px -1px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.35), inset 0 -1.5px 2px rgba(0,0,0,0.25)`,
          }}
          className="inline-flex items-center px-2.5 py-0.5 my-0.5 mx-1 rounded-full border backdrop-blur-sm text-[11px] font-mono font-semibold tracking-tight align-middle select-none transition-all duration-200 transform hover:-translate-y-0.5 active:translate-y-0"
        >
          <span className="drop-shadow-[0_1px_1px_rgba(0,0,0,0.7)]">{innerContent}</span>
        </span>
      );
    }

    const boldParts = seg.split(/(\*\*[^*]+\*\*)/g);
    return (
      <React.Fragment key={`text-${idx}`}>
        {boldParts.map((part, i) => {
          if (part.startsWith('**') && part.endsWith('**')) {
            return <strong key={i} className="font-bold text-foreground">{part.slice(2, -2)}</strong>;
          }
          return part.replace(/\*([^*\n]+)\*/g, '$1').replace(/_([^_\n]+)_/g, '$1');
        })}
      </React.Fragment>
    );
  });
};

export const renderAiMessageText = (text: string): ReactNode => {
  if (!text) return null;
  const normalized = normalizeAiMarkdown(text);
  const lines = normalized.split('\n');
  const elements: ReactNode[] = [];
  let listItems: string[] = [];
  let paragraphLines: string[] = [];
  let key = 0;

  const flushParagraph = () => {
    if (!paragraphLines.length) return;
    const content = paragraphLines.join(' ').trim();
    if (content) {
      elements.push(
        <p key={key++} className="mb-2 last:mb-0 leading-relaxed">
          {parseBoldText(content)}
        </p>
      );
    }
    paragraphLines = [];
  };

  const flushList = () => {
    if (!listItems.length) return;
    elements.push(
      <ul key={key++} className="mb-2.5 space-y-1 pl-4 list-disc last:mb-0">
        {listItems.map((item, index) => (
          <li key={`${key}-${index}`} className="leading-relaxed">
            {parseBoldText(item)}
          </li>
        ))}
      </ul>
    );
    listItems = [];
  };

  lines.forEach((line) => {
    let trimmed = line.trim();
    if (!trimmed) {
      flushParagraph();
      flushList();
      return;
    }

    if (trimmed.includes('__FORMULA__')) {
      flushParagraph();
      flushList();
      const formulaText = trimmed.replace(/__FORMULA__/g, '').trim();
      if (formulaText) {
        elements.push(
          <div
            key={key++}
            className="my-2.5 p-3 rounded-lg bg-slate-900 text-slate-100 dark:bg-slate-950 dark:text-slate-100 border border-slate-700/70 font-mono text-xs overflow-x-auto shadow-sm tracking-wide"
          >
            {formulaText}
          </div>
        );
      }
      return;
    }

    const isExplicitRefLine = /^(?:[-*]\s*)?(?:Reference|References|Ref|Book Reference):\s*(.+)$/i.exec(trimmed);
    if (isExplicitRefLine) {
      flushParagraph();
      flushList();
      const refContent = isExplicitRefLine[1].replace(/\s+/g, ' ').trim();
      const theme = getInlinePillTheme(refContent);
      elements.push(
        <div key={key++} className="my-1.5">
          <span
            style={{
              background: `linear-gradient(180deg, ${theme.bg}77 0%, ${theme.bg}44 60%, ${theme.bg}22 100%)`,
              color: '#ffffff',
              borderColor: `${theme.border}99`,
              boxShadow: `0 3px 6px -1px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.35), inset 0 -1.5px 2px rgba(0,0,0,0.25)`,
            }}
            className="inline-flex items-center px-3 py-1 rounded-full border backdrop-blur-sm text-xs font-mono font-semibold tracking-tight select-none transition-all duration-200 transform hover:-translate-y-0.5 active:translate-y-0"
          >
            <span className="drop-shadow-[0_1px_1px_rgba(0,0,0,0.7)]">{refContent}</span>
          </span>
        </div>
      );
      return;
    }

    const headerMatch = trimmed.match(/^(?:(#{1,6})\s+(.+)$|\*\*(?![^*]+:)(.+)\*\*|\*\*(.+)\*\*:$)/);
    if (headerMatch) {
      const hashes = headerMatch[1];
      const level = hashes ? hashes.length : 3;
      const headerTitle = headerMatch[2] || headerMatch[3] || headerMatch[4] || trimmed.replace(/^#{1,6}\s+/, '').replace(/^\*\*|\*\*$/g, '');
      
      if (headerTitle && !headerTitle.includes(':')) {
        flushParagraph();
        flushList();
        
        if (level === 1) {
          elements.push(
            <h2 key={key++} className="font-extrabold text-xl sm:text-2xl text-foreground mt-7 mb-3 tracking-tight border-b border-border/40 pb-2 first:mt-0">
              {headerTitle}
            </h2>
          );
        } else if (level === 2) {
          elements.push(
            <h3 key={key++} className="font-extrabold text-lg sm:text-xl text-foreground mt-6 mb-2.5 tracking-tight first:mt-0">
              {headerTitle}
            </h3>
          );
        } else {
          elements.push(
            <h4 key={key++} className="font-extrabold text-base sm:text-lg text-foreground mt-5 mb-2 tracking-tight first:mt-0">
              {headerTitle}
            </h4>
          );
        }
        return;
      }
    }

    const bulletMatch = trimmed.match(/^[-*]\s+(.+)$/);
    const numberedMatch = trimmed.match(/^\d+[.)]\s+(.+)$/);
    if (bulletMatch || numberedMatch) {
      flushParagraph();
      listItems.push((bulletMatch?.[1] || numberedMatch?.[1] || '').trim());
      return;
    }

    const isKeyValue = /^\*\*[^*]+:\*\*/.test(trimmed);
    if (isKeyValue) {
      flushParagraph();
      flushList();
      elements.push(
        <p key={key++} className="mb-3.5 last:mb-0 leading-relaxed">
          {parseBoldText(trimmed)}
        </p>
      );
      return;
    }

    flushList();
    paragraphLines.push(trimmed);
  });

  flushParagraph();
  flushList();

  return <div className="space-y-2.5 text-sm leading-relaxed text-foreground">{elements}</div>;
};

const renderInline = (text: string): ReactNode[] => {
  const parts = text.split(/(\*\*[^*]+\*\*|\[[^\]]+\]\([^)]+\))/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i} className="font-semibold text-foreground">{part.slice(2, -2)}</strong>;
    }
    const linkMatch = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    if (linkMatch) {
      return <a key={i} href={linkMatch[2]} target="_blank" rel="noopener noreferrer" className="font-medium text-primary underline underline-offset-4 hover:text-primary/80">{linkMatch[1]}</a>;
    }
    return part;
  });
};

type MarkdownOptions = {
  skipFirstH1?: boolean;
};

export const renderMarkdown = (markdown: string, options: MarkdownOptions = {}): ReactNode => {
  const lines = markdown.trim().split('\n');
  const elements: ReactNode[] = [];
  let listItems: string[] = [];
  let paragraphLines: string[] = [];
  let skippedFirstH1 = false;

  const flushList = (listKey: number) => {
    if (listItems.length > 0) {
      elements.push(
        <ul key={listKey} className="mb-5 list-disc space-y-2 pl-5 text-[15px] leading-7 marker:text-primary/70">
          {listItems.map((item, index) => (
            <li key={`${listKey}-${index}`} className="pl-1 text-muted-foreground">
              {renderInline(item)}
            </li>
          ))}
        </ul>
      );
      listItems = [];
    }
  };

  const flushParagraph = (paragraphKey: number) => {
    if (paragraphLines.length === 0) return;

    const text = paragraphLines.join(' ');
    const isLastUpdated = text.startsWith('**Last updated:**');

    elements.push(
      <p
        key={paragraphKey}
        className={
          isLastUpdated
            ? "mb-6 inline-flex rounded-full border border-primary/15 bg-primary/10 px-3 py-1 text-sm font-medium text-primary"
            : "mb-4 text-[15px] leading-7 text-muted-foreground"
        }
      >
        {renderInline(text)}
      </p>
    );
    paragraphLines = [];
  };

  const flushText = () => {
    flushList(elementKey++);
    flushParagraph(elementKey++);
  };

  let elementKey = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmedLine = line.trim();
    const headingMatch = trimmedLine.match(/^(#{1,4})\s+(.+)$/);
    const listMatch = line.match(/^\s*[*-]\s+(.+)$/);

    if (headingMatch) {
      flushText();

      const level = headingMatch[1].length;
      const content = headingMatch[2];

      if (level === 1 && options.skipFirstH1 && !skippedFirstH1) {
        skippedFirstH1 = true;
        continue;
      }

      if (level === 1) {
        elements.push(<h1 key={elementKey++} className="mb-5 mt-2 text-3xl font-bold tracking-tight text-foreground">{renderInline(content)}</h1>);
      } else if (level === 2) {
        elements.push(<h2 key={elementKey++} className="mb-3 mt-10 border-t border-border/70 pt-8 text-2xl font-bold tracking-tight text-foreground first:mt-0 first:border-t-0 first:pt-0">{renderInline(content)}</h2>);
      } else if (level === 3) {
        elements.push(<h3 key={elementKey++} className="mb-3 mt-6 text-lg font-semibold text-foreground">{renderInline(content)}</h3>);
      } else {
        elements.push(<h4 key={elementKey++} className="mb-2 mt-5 text-base font-semibold text-foreground">{renderInline(content)}</h4>);
      }
    } else if (listMatch) {
      flushParagraph(elementKey++);
      listItems.push(listMatch[1].trim());
    } else if (listItems.length > 0 && /^\s{2,}\S/.test(line)) {
      listItems[listItems.length - 1] = `${listItems[listItems.length - 1]} ${trimmedLine}`;
    } else if (trimmedLine === '---') {
      flushText();
      elements.push(<hr key={elementKey++} className="my-8 border-border/70" />);
    } else if (trimmedLine === '') {
      flushText();
    } else {
      flushList(elementKey++);
      paragraphLines.push(trimmedLine);
    }
  }
  flushText();

  return <>{elements}</>;
};
