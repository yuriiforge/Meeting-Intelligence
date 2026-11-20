import { chunkUtterances, formatUtterance } from './chunker.js';
import { estimateTokens } from './tokens.js';
import type { ParsedUtterance } from './transcript-parser.js';

/** Builds turns 10 s apart; `words` controls each turn's length. */
function turns(speakers: string[], words = 10): ParsedUtterance[] {
  return speakers.map((speaker, sequence) => ({
    sequence,
    speaker,
    startSeconds: sequence * 10,
    text: Array.from({ length: words }, (_, i) => `word${i}`).join(' '),
  }));
}

describe('formatUtterance', () => {
  it('renders the canonical citation form', () => {
    expect(
      formatUtterance({
        sequence: 0,
        speaker: 'Alice',
        startSeconds: 754,
        text: 'hi',
      }),
    ).toBe('[00:12:34] Alice: hi');
  });
});

describe('chunkUtterances', () => {
  it('returns no chunks for no turns', () => {
    expect(chunkUtterances([])).toEqual([]);
  });

  it('keeps a short transcript in a single chunk', () => {
    const [chunk, ...rest] = chunkUtterances(turns(['Alice', 'Bob', 'Alice']));

    expect(rest).toEqual([]);
    expect(chunk).toMatchObject({
      sequence: 0,
      speakers: ['Alice', 'Bob'],
      startSeconds: 0,
      endSeconds: 20,
      startUtterance: 0,
      endUtterance: 2,
    });
    expect(chunk.content.split('\n')).toHaveLength(3);
    expect(chunk.tokenCount).toBe(estimateTokens(chunk.content));
  });

  it('respects the token budget and never splits a turn', () => {
    const input = turns(Array.from({ length: 40 }, (_, i) => `S${i % 3}`));
    const chunks = chunkUtterances(input, { maxTokens: 100, overlapTokens: 0 });

    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) {
      expect(chunk.tokenCount).toBeLessThanOrEqual(100);
      // Every line is a complete, formatted turn.
      const expected = input
        .slice(chunk.startUtterance, chunk.endUtterance + 1)
        .map(formatUtterance)
        .join('\n');
      expect(chunk.content).toBe(expected);
    }
  });

  it('covers every turn, in order, with no gaps', () => {
    const input = turns(Array.from({ length: 30 }, () => 'A'));
    const chunks = chunkUtterances(input, { maxTokens: 80, overlapTokens: 25 });

    expect(chunks[0].startUtterance).toBe(0);
    expect(chunks.at(-1)?.endUtterance).toBe(29);
    for (let i = 1; i < chunks.length; i++) {
      expect(chunks[i].startUtterance).toBeLessThanOrEqual(
        chunks[i - 1].endUtterance + 1,
      );
      expect(chunks[i].endUtterance).toBeGreaterThan(
        chunks[i - 1].endUtterance,
      );
    }
  });

  it('overlaps consecutive chunks by whole turns', () => {
    const input = turns(Array.from({ length: 20 }, () => 'A'));
    const turnTokens = estimateTokens(formatUtterance(input[0]));

    // Budget for exactly one turn of overlap...
    const one = chunkUtterances(input, {
      maxTokens: 100,
      overlapTokens: turnTokens,
    });
    expect(one[1].startUtterance).toBe(one[0].endUtterance);

    // ...and for exactly two.
    const two = chunkUtterances(input, {
      maxTokens: 100,
      overlapTokens: turnTokens * 2,
    });
    expect(two[1].startUtterance).toBe(two[0].endUtterance - 1);
  });

  it('does not overlap when overlapTokens is 0', () => {
    const chunks = chunkUtterances(
      turns(Array.from({ length: 20 }, () => 'A')),
      {
        maxTokens: 100,
        overlapTokens: 0,
      },
    );

    expect(chunks[1].startUtterance).toBe(chunks[0].endUtterance + 1);
  });

  it('puts an over-long turn in its own chunk instead of splitting it', () => {
    const input = [
      ...turns(['Alice']),
      {
        sequence: 1,
        speaker: 'Bob',
        startSeconds: 10,
        text: 'long '.repeat(200),
      },
      { sequence: 2, speaker: 'Alice', startSeconds: 20, text: 'ok' },
    ];
    const chunks = chunkUtterances(input, { maxTokens: 100, overlapTokens: 0 });

    const bobChunk = chunks.find((c) => c.speakers.includes('Bob'));
    expect(bobChunk).toMatchObject({ startUtterance: 1, endUtterance: 1 });
    expect(bobChunk?.tokenCount).toBeGreaterThan(100);
  });

  it('always adds a new turn even when overlap meets a huge turn', () => {
    const input = [
      ...turns(['A', 'B', 'C']),
      {
        sequence: 3,
        speaker: 'D',
        startSeconds: 30,
        text: 'long '.repeat(200),
      },
    ];
    const chunks = chunkUtterances(input, {
      maxTokens: 100,
      overlapTokens: 80,
    });

    // No chunk may consist solely of turns already covered.
    const ends = chunks.map((c) => c.endUtterance);
    expect(new Set(ends).size).toBe(ends.length);
    expect(ends.at(-1)).toBe(3);
  });

  it('sets endSeconds to the start of the next turn after the chunk', () => {
    const input = turns(Array.from({ length: 10 }, () => 'A'));
    const [first] = chunkUtterances(input, {
      maxTokens: 100,
      overlapTokens: 0,
    });

    expect(first.endSeconds).toBe(input[first.endUtterance + 1].startSeconds);
  });
});
