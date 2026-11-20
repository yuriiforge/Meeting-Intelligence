/** Short words that would highlight half the text. */
const STOPWORDS = new Set(
  (
    'a an and are as at be but by did do does for from had has have how i in ' +
    'is it of on or our so that the their them they this to was we were what ' +
    'when where which who why will with would you'
  ).split(' '),
);

export interface TextPart {
  text: string;
  match: boolean;
}

/**
 * Splits `text` into parts, marking words that start with a query term
 * ("launch" also marks "launched"). A light visual aid only: the real
 * keyword ranking (stemming, stopwords) happens in Postgres.
 */
export function highlightTerms(text: string, query: string): TextPart[] {
  const terms = [
    ...new Set(
      query
        .toLowerCase()
        .split(/[^\p{L}\p{N}]+/u)
        .filter((t) => t.length > 1 && !STOPWORDS.has(t)),
    ),
  ];
  if (terms.length === 0) return [{ text, match: false }];

  const escaped = terms.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  // Word start = not preceded by a letter/digit (\b is ASCII-only).
  const pattern = new RegExp(
    `((?<![\\p{L}\\p{N}])(?:${escaped.join('|')})[\\p{L}\\p{N}]*)`,
    'iu',
  );

  // With one capture group, split alternates: text, match, text, match, ...
  return text
    .split(pattern)
    .map((part, index) => ({ text: part, match: index % 2 === 1 }))
    .filter((part) => part.text !== '');
}
