import { EmbeddingError, toPgVector } from './embedding-provider.js';

describe('toPgVector', () => {
  it('formats a vector as pgvector text', () => {
    expect(toPgVector([0.5, -1, 2e-7])).toBe('[0.5,-1,2e-7]');
  });

  it.each([NaN, Infinity])('rejects %s', (bad) => {
    expect(() => toPgVector([0.1, bad])).toThrow(EmbeddingError);
  });
});
