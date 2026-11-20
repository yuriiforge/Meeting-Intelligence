/**
 * Turns a model answer into simple blocks for rendering: paragraphs and
 * bullet lists, with inline bold text and [n] citations. Deliberately tiny
 * instead of a full Markdown renderer: answers are short, and rendering only
 * what we expect means model output can never inject HTML.
 */

export type Inline =
  | { kind: 'text'; text: string }
  | { kind: 'bold'; text: string }
  | { kind: 'cite'; numbers: number[] };

export type Block =
  { kind: 'paragraph'; inline: Inline[] } | { kind: 'list'; items: Inline[][] };

const BULLET = /^\s*(?:[-*•]|\d+[.)])\s+/;

export function parseAnswer(answer: string): Block[] {
  const blocks: Block[] = [];
  for (const rawLine of answer.split('\n')) {
    const line = rawLine.trim();
    if (!line) continue;

    if (BULLET.test(line)) {
      const item = parseInline(line.replace(BULLET, ''));
      const last = blocks.at(-1);
      if (last?.kind === 'list') last.items.push(item);
      else blocks.push({ kind: 'list', items: [item] });
    } else {
      blocks.push({ kind: 'paragraph', inline: parseInline(line) });
    }
  }
  return blocks;
}

/** Splits a line into text, **bold** and [1] / [1][2] / [1, 2] citations. */
export function parseInline(line: string): Inline[] {
  const parts: Inline[] = [];
  const pattern = /\*\*(.+?)\*\*|((?:\s*\[\d+(?:\s*,\s*\d+)*\])+)/g;
  let last = 0;

  for (const match of line.matchAll(pattern)) {
    const index = match.index ?? 0;
    if (index > last)
      parts.push({ kind: 'text', text: line.slice(last, index) });
    if (match[1] !== undefined) {
      parts.push({ kind: 'bold', text: match[1] });
    } else {
      const numbers = [...match[2].matchAll(/\d+/g)].map((m) => Number(m[0]));
      parts.push({ kind: 'cite', numbers: [...new Set(numbers)] });
    }
    last = index + match[0].length;
  }
  if (last < line.length) parts.push({ kind: 'text', text: line.slice(last) });
  return parts;
}
