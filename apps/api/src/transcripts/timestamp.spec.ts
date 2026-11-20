import { formatTimestamp, parseTimestamp } from './timestamp.js';

describe('parseTimestamp', () => {
  it.each([
    ['00:00:00', 0],
    ['00:12:34', 754],
    ['1:02:03', 3723],
    ['12:34', 754],
    ['0:05', 5],
  ])('parses %s as %i seconds', (input, expected) => {
    expect(parseTimestamp(input)).toBe(expected);
  });

  it.each(['12', '1:2:3:4', '00:61', '00:60:00', 'aa:bb', ''])(
    'rejects %s',
    (input) => {
      expect(parseTimestamp(input)).toBeNull();
    },
  );

  it('allows minutes >= 60 in mm:ss form (long meetings without hours)', () => {
    expect(parseTimestamp('75:00')).toBe(4500);
  });
});

describe('formatTimestamp', () => {
  it.each([
    [0, '00:00:00'],
    [754, '00:12:34'],
    [3723, '01:02:03'],
  ])('formats %i as %s', (input, expected) => {
    expect(formatTimestamp(input)).toBe(expected);
  });

  it('round-trips with parseTimestamp', () => {
    expect(parseTimestamp(formatTimestamp(5025))).toBe(5025);
  });
});
