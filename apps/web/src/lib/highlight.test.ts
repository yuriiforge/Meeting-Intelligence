import { highlightTerms } from './highlight';

const marked = (text: string, query: string) =>
  highlightTerms(text, query)
    .filter((p) => p.match)
    .map((p) => p.text);

describe('highlightTerms', () => {
  it('marks query words, case-insensitively', () => {
    expect(marked('The SDK upgrade and the sdk docs', 'sdk')).toEqual([
      'SDK',
      'sdk',
    ]);
  });

  it('marks longer forms of a word', () => {
    expect(marked('We launched; launch is set', 'launch')).toEqual([
      'launched',
      'launch',
    ]);
  });

  it('does not match inside other words', () => {
    expect(marked('relaunch', 'launch')).toEqual([]);
  });

  it('ignores stopwords and single letters', () => {
    expect(marked('what is the plan', 'what is the a')).toEqual([]);
  });

  it('keeps the full text intact', () => {
    const text = 'Dana moved the date to December 15th.';
    const parts = highlightTerms(text, 'date december');

    expect(parts.map((p) => p.text).join('')).toBe(text);
    expect(parts.filter((p) => p.match).map((p) => p.text)).toEqual([
      'date',
      'December',
    ]);
  });

  it('treats regex characters in the query literally', () => {
    // "(" must not break the pattern; "2" and "0" are too short to mark.
    expect(marked('Version 2.0 (beta)', '2.0 (beta')).toEqual(['beta']);
  });

  it('returns the text unchanged for an empty query', () => {
    expect(highlightTerms('hello', '')).toEqual([
      { text: 'hello', match: false },
    ]);
  });
});
