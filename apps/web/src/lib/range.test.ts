import { rangeFromParams, rangeToParams } from './range';

const parse = (query: string) => rangeFromParams(new URLSearchParams(query));

describe('rangeFromParams', () => {
  it('reads from and to', () => {
    expect(parse('from=3&to=7')).toEqual({ from: 3, to: 7 });
  });

  it('defaults to a single line when `to` is missing', () => {
    expect(parse('from=4')).toEqual({ from: 4, to: 4 });
  });

  it('orders a reversed range', () => {
    expect(parse('from=9&to=2')).toEqual({ from: 2, to: 9 });
  });

  it.each(['', 'to=5', 'from=abc', 'from=1.5'])('ignores "%s"', (query) => {
    expect(parse(query)).toBeNull();
  });

  it('round-trips with rangeToParams', () => {
    expect(parse(rangeToParams({ from: 12, to: 18 }))).toEqual({
      from: 12,
      to: 18,
    });
  });
});
