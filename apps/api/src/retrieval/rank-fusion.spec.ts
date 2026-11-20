import { reciprocalRankFusion, RRF_K } from './rank-fusion.js';

describe('reciprocalRankFusion', () => {
  it('returns nothing for empty lists', () => {
    expect(reciprocalRankFusion({ semantic: [], keyword: [] })).toEqual([]);
  });

  it('keeps the order of a single list', () => {
    const fused = reciprocalRankFusion({ semantic: ['a', 'b', 'c'] });

    expect(fused.map((r) => r.id)).toEqual(['a', 'b', 'c']);
    expect(fused[0]).toEqual({
      id: 'a',
      score: 1 / (RRF_K + 1),
      ranks: { semantic: 1 },
    });
  });

  it('ranks an item found by both lists above items found by one', () => {
    const fused = reciprocalRankFusion({
      semantic: ['a', 'shared'],
      keyword: ['b', 'shared'],
    });

    expect(fused[0]).toMatchObject({
      id: 'shared',
      ranks: { semantic: 2, keyword: 2 },
    });
  });

  it('sums contributions from each list', () => {
    const [top] = reciprocalRankFusion({ semantic: ['x'], keyword: ['x'] });

    expect(top.score).toBeCloseTo(2 / (RRF_K + 1));
  });

  it('breaks score ties by best rank, then by list order', () => {
    // a/b tie at rank 1 and d/c tie at rank 2; semantic is listed first.
    const fused = reciprocalRankFusion({
      semantic: ['a', 'd'],
      keyword: ['b', 'c'],
    });

    expect(fused.map((r) => r.id)).toEqual(['a', 'b', 'd', 'c']);
  });

  it('ranks a weak match in both lists above a top match in only one', () => {
    // 1/(60+1) = 0.0164 vs 2/(60+30) = 0.0222: the double match still wins,
    // which is the point of fusion. Shown here so the trade-off is explicit.
    const fused = reciprocalRankFusion({
      semantic: [
        'top',
        ...Array.from({ length: 28 }, (_, i) => `s${i}`),
        'both',
      ],
      keyword: [...Array.from({ length: 29 }, (_, i) => `k${i}`), 'both'],
    });

    expect(fused[0].id).toBe('both');
  });

  it('breaks an exact tie in favour of the earlier list, regardless of id', () => {
    // 'z' (#1 semantic) and 'a' (#1 keyword) have identical scores.
    const fused = reciprocalRankFusion({ semantic: ['z'], keyword: ['a'] });
    const reversed = reciprocalRankFusion({ keyword: ['a'], semantic: ['z'] });

    expect(fused.map((r) => r.id)).toEqual(['z', 'a']);
    expect(reversed.map((r) => r.id)).toEqual(['a', 'z']);
  });

  it('ignores an id repeated within the same list', () => {
    const fused = reciprocalRankFusion({ semantic: ['a', 'a', 'b'] });

    expect(fused).toHaveLength(2);
    expect(fused[0].score).toBeCloseTo(1 / (RRF_K + 1));
  });
});
