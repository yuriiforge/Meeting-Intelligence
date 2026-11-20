/** Inclusive range of utterance sequences, e.g. the lines a search hit covers. */
export interface UtteranceRange {
  from: number;
  to: number;
}

/** Reads ?from=12&to=18 from a meeting URL; `to` defaults to `from`. */
export function rangeFromParams(
  params: URLSearchParams,
): UtteranceRange | null {
  if (!params.has('from')) return null;
  const from = Number(params.get('from'));
  const to = Number(params.get('to') ?? from);
  if (!Number.isInteger(from) || !Number.isInteger(to)) return null;
  return { from: Math.min(from, to), to: Math.max(from, to) };
}

/** The query string that rangeFromParams reads back. */
export function rangeToParams(range: UtteranceRange): string {
  return new URLSearchParams({
    from: String(range.from),
    to: String(range.to),
  }).toString();
}
