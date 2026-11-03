import type { ReactNode } from 'react';

// Server content stays plain text. Only these small formatting markers become elements.
export function formatAnnouncementText(value: string | null | undefined): ReactNode[] {
  const text = value || '';
  const parts: ReactNode[] = [];
  const markers = /\*\*([^*\n]+)\*\*|__([^_\n]+)__|\*([^*\n]+)\*|_([^_\n]+)_|~([^~\n]+)~|`([^`\n]+)`/g;
  let cursor = 0;

  for (const match of text.matchAll(markers)) {
    const index = match.index ?? 0;
    if (index > cursor) parts.push(text.slice(cursor, index));

    if (match[1] !== undefined) {
      parts.push(<strong key={index} className="text-[1.25em] font-black leading-tight tracking-tight">{match[1]}</strong>);
    } else if (match[2] !== undefined) {
      parts.push(<u key={index} className="decoration-2 underline-offset-2">{match[2]}</u>);
    } else if (match[3] !== undefined) {
      parts.push(<strong key={index} className="font-bold">{match[3]}</strong>);
    } else if (match[4] !== undefined) {
      parts.push(<em key={index}>{match[4]}</em>);
    } else if (match[5] !== undefined) {
      parts.push(<s key={index} className="decoration-2">{match[5]}</s>);
    } else {
      parts.push(<code key={index} className="rounded bg-white/10 px-1 py-0.5 font-mono text-[0.9em]">{match[6]}</code>);
    }
    cursor = index + match[0].length;
  }

  if (cursor < text.length) parts.push(text.slice(cursor));
  return parts;
}

const bulletLine = /^\s*[-•*]\s+(.+)$/;
const numberedLine = /^\s*\d+[.)]\s+(.+)$/;
const quoteLine = /^\s*>\s+(.+)$/;

export function formatAnnouncementPreview(value: string | null | undefined): ReactNode[] {
  const text = (value || '').replace(/\r\n?/g, '\n').split('\n').map((line) =>
    line.replace(/^\s*[-•*]\s+/, '• ').replace(/^\s*>\s+/, '› '),
  ).join('\n');
  return formatAnnouncementText(text);
}

export function AnnouncementBody({ text }: { text: string | null | undefined }) {
  const lines = (text || '').replace(/\r\n?/g, '\n').split('\n');
  const blocks: ReactNode[] = [];
  let index = 0;

  while (index < lines.length) {
    if (!lines[index].trim()) {
      index++;
      continue;
    }

    const bullet = lines[index].match(bulletLine);
    const numbered = lines[index].match(numberedLine);
    const quote = lines[index].match(quoteLine);

    if (bullet || numbered) {
      const start = index;
      const matcher = bullet ? bulletLine : numberedLine;
      const items: ReactNode[] = [];
      while (index < lines.length) {
        const item = lines[index].match(matcher);
        if (!item) break;
        items.push(<li key={index} className="pl-1">{formatAnnouncementText(item[1])}</li>);
        index++;
      }
      blocks.push(bullet
        ? <ul key={start} className="list-disc space-y-1.5 pl-5 marker:text-teal-300">{items}</ul>
        : <ol key={start} className="list-decimal space-y-1.5 pl-5 marker:text-teal-300">{items}</ol>);
      continue;
    }

    if (quote) {
      const start = index;
      const quoteLines: string[] = [];
      while (index < lines.length) {
        const line = lines[index].match(quoteLine);
        if (!line) break;
        quoteLines.push(line[1]);
        index++;
      }
      blocks.push(<blockquote key={start} className="whitespace-pre-line border-l-2 border-teal-300/70 pl-3 italic text-white/70">{formatAnnouncementText(quoteLines.join('\n'))}</blockquote>);
      continue;
    }

    const start = index;
    const paragraph: string[] = [];
    while (index < lines.length && lines[index].trim()
      && !bulletLine.test(lines[index]) && !numberedLine.test(lines[index]) && !quoteLine.test(lines[index])) {
      paragraph.push(lines[index]);
      index++;
    }
    blocks.push(<p key={start} className="whitespace-pre-line">{formatAnnouncementText(paragraph.join('\n'))}</p>);
  }

  return <div className="mb-5 space-y-3 break-words text-sm leading-6 text-white/80">{blocks}</div>;
}
