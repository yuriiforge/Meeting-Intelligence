import { parseTranscript, TranscriptParseError } from './transcript-parser.js';

const lines = (...l: string[]) => l.join('\n');

describe('parseTranscript', () => {
  describe('speaker turns', () => {
    it('parses bracketed hh:mm:ss turns', () => {
      const { utterances, warnings } = parseTranscript(
        lines(
          '[00:00:05] Alice: Morning, everyone.',
          '[00:00:12] Bob: Hi Alice.',
        ),
      );

      expect(utterances).toEqual([
        {
          sequence: 0,
          speaker: 'Alice',
          startSeconds: 5,
          text: 'Morning, everyone.',
        },
        { sequence: 1, speaker: 'Bob', startSeconds: 12, text: 'Hi Alice.' },
      ]);
      expect(warnings).toEqual([]);
    });

    it.each([
      ['[12:34] Alice: hi', 754],
      ['12:34 Alice: hi', 754],
      ['00:12:34 Alice: hi', 754],
      ['[1:02:03] Alice: hi', 3723],
    ])('accepts the format "%s"', (line, startSeconds) => {
      const [turn] = parseTranscript(line).utterances;

      expect(turn).toMatchObject({
        speaker: 'Alice',
        startSeconds,
        text: 'hi',
      });
    });

    it('keeps multi-word speaker labels with roles', () => {
      const [turn] = parseTranscript(
        '[00:00:01] Priya Shah (PM): Let us start.',
      ).utterances;

      expect(turn.speaker).toBe('Priya Shah (PM)');
    });

    it('keeps colons inside the spoken text', () => {
      const [turn] = parseTranscript(
        '[00:00:01] Alice: The ratio is 3:1, note: tentative.',
      ).utterances;

      expect(turn.text).toBe('The ratio is 3:1, note: tentative.');
    });

    it('joins wrapped lines into the previous turn', () => {
      const { utterances } = parseTranscript(
        lines(
          '[00:00:01] Alice: This is a long thought',
          '  that continues on the next line',
          '',
          'and one more.',
          '[00:00:09] Bob: Got it.',
        ),
      );

      expect(utterances[0].text).toBe(
        'This is a long thought that continues on the next line and one more.',
      );
      expect(utterances).toHaveLength(2);
    });

    it('handles Windows line endings and a UTF-8 BOM', () => {
      const { utterances } = parseTranscript(
        '﻿[00:00:01] Alice: one\r\n[00:00:02] Bob: two\r\n',
      );

      expect(utterances.map((u) => u.text)).toEqual(['one', 'two']);
      expect(utterances[0].speaker).toBe('Alice');
    });
  });

  describe('headers', () => {
    it('reads Title and Date headers before the first turn', () => {
      const { metadata, warnings } = parseTranscript(
        lines(
          'Title: Weekly sync',
          'Date: 2026-11-03',
          '',
          '[00:00:01] Alice: hi',
        ),
      );

      expect(metadata.title).toBe('Weekly sync');
      expect(metadata.occurredAt?.toISOString()).toBe(
        '2026-11-03T00:00:00.000Z',
      );
      expect(warnings).toEqual([]);
    });

    it('reads a markdown heading as the title', () => {
      const { metadata } = parseTranscript(
        lines('# Design review', '[00:00:01] Alice: hi'),
      );

      expect(metadata.title).toBe('Design review');
    });

    it('treats "Title:" after the first turn as speech, not a header', () => {
      const { metadata, utterances } = parseTranscript(
        lines('[00:00:01] Alice: hi', 'Title: not a header'),
      );

      expect(metadata.title).toBeUndefined();
      expect(utterances[0].text).toBe('hi Title: not a header');
    });
  });

  describe('warnings (non-fatal)', () => {
    it('warns about and skips an invalid timestamp', () => {
      const { utterances, warnings } = parseTranscript(
        lines('[00:00:01] Alice: ok', '[00:75:00] Bob: bad minute'),
      );

      expect(utterances).toHaveLength(1);
      expect(warnings).toEqual([
        { line: 2, message: expect.stringContaining('Invalid timestamp') },
      ]);
    });

    it('warns about unrecognised lines before the first turn', () => {
      const { warnings } = parseTranscript(
        lines('Recorded by Zoom', '[00:00:01] Alice: hi'),
      );

      expect(warnings).toEqual([{ line: 1, message: expect.any(String) }]);
    });

    it('warns about, but keeps, out-of-order timestamps', () => {
      const { utterances, warnings } = parseTranscript(
        lines('[00:05:00] Alice: later', '[00:01:00] Bob: earlier'),
      );

      expect(utterances).toHaveLength(2);
      expect(warnings[0]).toMatchObject({ line: 2 });
    });

    it('drops empty turns, renumbers the rest and reports the line', () => {
      const { utterances, warnings } = parseTranscript(
        lines('[00:00:01] Alice:', '[00:00:02] Bob: hi'),
      );

      expect(utterances).toEqual([
        { sequence: 0, speaker: 'Bob', startSeconds: 2, text: 'hi' },
      ]);
      expect(warnings).toEqual([{ line: 1, message: expect.any(String) }]);
    });

    it('warns about an unparseable date', () => {
      const { metadata, warnings } = parseTranscript(
        lines('Date: next Tuesday', '[00:00:01] Alice: hi'),
      );

      expect(metadata.occurredAt).toBeUndefined();
      expect(warnings[0].message).toContain('next Tuesday');
    });
  });

  describe('failures', () => {
    it.each([
      ['an empty file', ''],
      ['plain prose', 'We met and talked about the roadmap.'],
      ['speaker labels without timestamps', 'Alice: hi\nBob: hello'],
    ])('rejects %s', (_, source) => {
      expect(() => parseTranscript(source)).toThrow(TranscriptParseError);
    });

    it('includes collected issues in the error', () => {
      try {
        parseTranscript('Alice: hi');
        expect.unreachable();
      } catch (error) {
        expect((error as TranscriptParseError).issues).toEqual([
          { line: 1, message: expect.any(String) },
        ]);
      }
    });
  });
});
