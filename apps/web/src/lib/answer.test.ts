import { parseAnswer, parseInline } from './answer';

describe('parseInline', () => {
  it('extracts citations', () => {
    expect(parseInline('Moved to Dec 15 [2].')).toEqual([
      { kind: 'text', text: 'Moved to Dec 15' },
      { kind: 'cite', numbers: [2] },
      { kind: 'text', text: '.' },
    ]);
  });

  it('merges adjacent and comma-separated citations', () => {
    expect(parseInline('Both [1][3] and [2, 4]')).toEqual([
      { kind: 'text', text: 'Both' },
      { kind: 'cite', numbers: [1, 3] },
      { kind: 'text', text: ' and' },
      { kind: 'cite', numbers: [2, 4] },
    ]);
  });

  it('extracts bold text', () => {
    expect(parseInline('**Decision:** ship it')).toEqual([
      { kind: 'bold', text: 'Decision:' },
      { kind: 'text', text: ' ship it' },
    ]);
  });

  it('leaves non-numeric brackets alone', () => {
    expect(parseInline('Label [beta]')).toEqual([
      { kind: 'text', text: 'Label [beta]' },
    ]);
  });
});

describe('parseAnswer', () => {
  it('splits paragraphs and groups bullet lines into one list', () => {
    const blocks = parseAnswer(
      'Two decisions:\n\n- Launch on Dec 15 [1]\n- No paid tier [2]\n\nThat is all.',
    );

    expect(blocks.map((b) => b.kind)).toEqual([
      'paragraph',
      'list',
      'paragraph',
    ]);
    expect(blocks[1]).toMatchObject({
      kind: 'list',
      items: [expect.any(Array), expect.any(Array)],
    });
  });

  it('accepts numbered lists and other bullet characters', () => {
    expect(parseAnswer('1. one\n2) two\n• three')).toEqual([
      {
        kind: 'list',
        items: [
          [{ kind: 'text', text: 'one' }],
          [{ kind: 'text', text: 'two' }],
          [{ kind: 'text', text: 'three' }],
        ],
      },
    ]);
  });

  it('returns nothing for an empty answer', () => {
    expect(parseAnswer('')).toEqual([]);
  });
});
