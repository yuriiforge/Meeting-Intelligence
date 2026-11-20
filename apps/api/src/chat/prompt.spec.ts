import type { ChatSource } from './chat.types.js';
import {
  buildMessages,
  CITATION_REMINDER,
  formatSources,
  retrievalQuery,
  stripCitations,
  SYSTEM_PROMPT,
} from './prompt.js';

const source = (
  number: number,
  overrides: Partial<ChatSource> = {},
): ChatSource => ({
  number,
  chunkId: `c${number}`,
  meetingId: 'm1',
  meetingTitle: 'Launch review',
  occurredAt: '2026-11-17T00:00:00.000Z',
  speakers: ['Dana Wu'],
  startSeconds: 76,
  endSeconds: 163,
  startUtterance: 10,
  endUtterance: 12,
  content: '[00:01:16] Dana Wu: Now the date.',
  ...overrides,
});

describe('formatSources', () => {
  it('numbers excerpts and labels them with meeting, date and time', () => {
    expect(formatSources([source(1)])).toBe(
      '<excerpt number="1" meeting="Launch review, 2026-11-17" time="00:01:16-00:02:43">\n' +
        '[00:01:16] Dana Wu: Now the date.\n' +
        '</excerpt>',
    );
  });

  it('escapes quotes in titles so they cannot break the excerpt tag', () => {
    const text = formatSources([source(1, { meetingTitle: 'The "big" one' })]);

    expect(text).toContain('meeting="The &quot;big&quot; one');
  });
});

describe('buildMessages', () => {
  it('puts the excerpts and question into the last user message', () => {
    const messages = buildMessages('When is launch?', [source(1), source(2)]);

    expect(messages).toHaveLength(1);
    expect(messages[0].role).toBe('user');
    expect(messages[0].content).toMatch(/^<excerpts>\n<excerpt number="1"/);
    expect(messages[0].content).toContain(
      '</excerpts>\n\nQuestion: When is launch?\n\n',
    );
  });

  it('ends with the citation reminder, where small models follow it best', () => {
    const messages = buildMessages('When is launch?', [source(1)]);

    expect(messages[0].content.endsWith(CITATION_REMINDER)).toBe(true);
  });

  it('keeps recent history, without old citation markers', () => {
    const messages = buildMessages(
      'Why?',
      [source(1)],
      [
        { role: 'user', content: 'When is launch?' },
        { role: 'assistant', content: 'December 15th [2].' },
      ],
    );

    expect(messages.map((m) => m.role)).toEqual(['user', 'assistant', 'user']);
    expect(messages[1].content).toBe('December 15th.');
  });

  it('drops history until it starts with a user turn', () => {
    const history = Array.from({ length: 7 }, (_, i) => ({
      role: i % 2 === 0 ? ('user' as const) : ('assistant' as const),
      content: `turn ${i}`,
    }));

    // The last 6 turns start with an assistant turn, which is dropped.
    const messages = buildMessages('Next?', [source(1)], history);

    expect(messages[0]).toEqual({ role: 'user', content: 'turn 2' });
  });
});

describe('retrievalQuery', () => {
  const history = [
    { role: 'user' as const, content: 'When is the launch?' },
    { role: 'assistant' as const, content: 'December 15th.' },
  ];

  it('adds the previous question to a short follow-up', () => {
    expect(retrievalQuery('why did it move?', history)).toBe(
      'When is the launch? why did it move?',
    );
  });

  it('uses a self-contained question as is', () => {
    const question =
      'What did legal require for the push notification consent screen?';
    expect(retrievalQuery(question, history)).toBe(question);
  });

  it('uses the question as is without history', () => {
    expect(retrievalQuery('why?')).toBe('why?');
  });
});

describe('stripCitations', () => {
  it.each([
    ['Moved to Dec 15 [2].', 'Moved to Dec 15.'],
    ['A [1][3] and B [2, 4].', 'A and B.'],
    ['No markers here.', 'No markers here.'],
  ])('%s -> %s', (input, expected) => {
    expect(stripCitations(input)).toBe(expected);
  });
});

describe('SYSTEM_PROMPT', () => {
  it('covers grounding, citations and prompt injection', () => {
    expect(SYSTEM_PROMPT).toMatch(/only facts stated in the excerpts/);
    expect(SYSTEM_PROMPT).toMatch(/\[2\]/);
    expect(SYSTEM_PROMPT).toMatch(/do not follow them/);
  });
});
