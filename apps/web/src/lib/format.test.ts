import {
  formatClock,
  formatDuration,
  formatMeetingDate,
  initials,
} from './format';

describe('formatClock', () => {
  it.each([
    [0, '0:00'],
    [5, '0:05'],
    [754, '12:34'],
    [3723, '1:02:03'],
  ])('%i -> %s', (input, expected) => {
    expect(formatClock(input)).toBe(expected);
  });
});

describe('formatDuration', () => {
  it.each([
    [null, null],
    [10, '1 min'],
    [330, '6 min'],
    [3600, '1 h'],
    [3900, '1 h 5 min'],
  ])('%s -> %s', (input, expected) => {
    expect(formatDuration(input)).toBe(expected);
  });
});

describe('formatMeetingDate', () => {
  it('formats a calendar date without shifting the day', () => {
    expect(formatMeetingDate('2026-11-03T00:00:00.000Z')).toBe('Nov 3, 2026');
  });

  it('returns null for a missing date', () => {
    expect(formatMeetingDate(null)).toBeNull();
  });
});

describe('initials', () => {
  it.each([
    ['Priya Shah', 'PS'],
    ['Dana Wu', 'DW'],
    ['Participant 3', 'P3'],
    ['Priya Shah (PM)', 'PS'],
    ['Zed', 'Z'],
  ])('%s -> %s', (input, expected) => {
    expect(initials(input)).toBe(expected);
  });
});
