export interface FusedResult {
  id: string;
  score: number;
  /** 1-based rank of the id in each list it appeared in. */
  ranks: Record<string, number>;
}

/**
 * The usual RRF constant (Cormack et al., 2009). It damps the advantage of
 * the very top ranks, so a result found by both lists beats one that is first
 * in only one of them.
 */
export const RRF_K = 60;

/**
 * Reciprocal rank fusion: score(id) = sum over lists of 1 / (k + rank).
 *
 * It only uses ranks, not raw scores. That matters here because cosine
 * distances and full-text rank values are on unrelated scales and can't be
 * compared or added directly.
 */
export function reciprocalRankFusion(
  lists: Record<string, readonly string[]>,
  k: number = RRF_K,
): FusedResult[] {
  const fused = new Map<string, FusedResult>();

  for (const [name, ids] of Object.entries(lists)) {
    ids.forEach((id, index) => {
      const rank = index + 1;
      const entry = fused.get(id) ?? { id, score: 0, ranks: {} };
      if (entry.ranks[name] !== undefined) return; // ignore duplicates in one list
      entry.ranks[name] = rank;
      entry.score += 1 / (k + rank);
      fused.set(id, entry);
    });
  }

  // Exact ties are common (e.g. #1 in one list vs #1 in the other) and must
  // not depend on ids, which are random. Rule: better best rank first, then
  // the item whose best rank comes from the earlier list (callers pass lists
  // in priority order), then id as a last resort.
  const priority = Object.keys(lists);
  return [...fused.values()].sort(
    (a, b) =>
      b.score - a.score ||
      bestRank(a) - bestRank(b) ||
      listPriority(a, priority) - listPriority(b, priority) ||
      a.id.localeCompare(b.id),
  );
}

function bestRank(result: FusedResult): number {
  return Math.min(...Object.values(result.ranks));
}

/** Index of the earliest list in which the result has its best rank. */
function listPriority(result: FusedResult, priority: string[]): number {
  const best = bestRank(result);
  return priority.findIndex((name) => result.ranks[name] === best);
}
