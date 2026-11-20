import { checkCitations } from './citations.js';

describe('checkCitations', () => {
  it('collects cited sources in order of first use', () => {
    expect(
      checkCitations('B happened [2]. A happened [1]. B again [2].', 3),
    ).toEqual({
      cited: [2, 1],
      invalid: [],
    });
  });

  it('accepts adjacent and comma-separated citations', () => {
    expect(checkCitations('Both [1][3], also [2, 4].', 4).cited).toEqual([
      1, 3, 2, 4,
    ]);
  });

  it('flags numbers that match no source', () => {
    expect(checkCitations('True [1]. Made up [7]. Zero [0].', 3)).toEqual({
      cited: [1],
      invalid: [7, 0],
    });
  });

  it('ignores bracketed text that is not a citation', () => {
    expect(checkCitations('Version [beta] at [00:01:16]', 3)).toEqual({
      cited: [],
      invalid: [],
    });
  });

  it('finds nothing in an answer without citations', () => {
    expect(checkCitations("I couldn't find that.", 3).cited).toEqual([]);
  });
});
