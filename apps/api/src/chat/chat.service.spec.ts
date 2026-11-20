import { FakeLlmProvider } from '../../test/support/fake-llm.provider.js';
import type { RetrievalService } from '../retrieval/retrieval.service.js';
import type { SearchHit } from '../retrieval/retrieval.types.js';
import { ChatService } from './chat.service.js';
import type { ChatEvent } from './chat.types.js';
import { NO_SOURCES_ANSWER, SYSTEM_PROMPT } from './prompt.js';

const hit = (n: number): SearchHit => ({
  chunkId: `c${n}`,
  meetingId: 'm1',
  meetingTitle: 'Launch review',
  occurredAt: '2026-11-17T00:00:00.000Z',
  sequence: n,
  content: `[00:00:0${n}] Dana Wu: point ${n}`,
  speakers: ['Dana Wu'],
  startSeconds: n,
  endSeconds: n + 1,
  startUtterance: n,
  endUtterance: n,
  score: 1 / (60 + n),
  ranks: { semantic: n },
});

function setup(hits: SearchHit[]) {
  const search = vi.fn().mockResolvedValue({ hits });
  const retrieval = { search } as unknown as RetrievalService;
  const llm = new FakeLlmProvider();
  return { service: new ChatService(retrieval, llm), llm, search };
}

async function collect(
  stream: AsyncGenerator<ChatEvent>,
): Promise<ChatEvent[]> {
  const events: ChatEvent[] = [];
  for await (const event of stream) events.push(event);
  return events;
}

const doneOf = (events: ChatEvent[]) =>
  events.find(
    (e): e is Extract<ChatEvent, { type: 'done' }> => e.type === 'done',
  )!;
const textOf = (events: ChatEvent[]) =>
  events.flatMap((e) => (e.type === 'token' ? [e.text] : [])).join('');

describe('ChatService', () => {
  it('streams sources, then tokens, then a done event', async () => {
    const { service } = setup([hit(1), hit(2)]);

    const events = await collect(
      service.answer({ question: 'When is launch?' }),
    );

    expect(events[0]).toMatchObject({ type: 'sources' });
    expect(events.at(-1)?.type).toBe('done');
    expect(textOf(events)).toBe('The launch moved to December 15th [1].');
  });

  it('numbers sources from 1 and passes them to the model', async () => {
    const { service, llm } = setup([hit(1), hit(2)]);

    const events = await collect(
      service.answer({ question: 'When is launch?' }),
    );

    const sources = events[0].type === 'sources' ? events[0].sources : [];
    expect(sources.map((s) => [s.number, s.chunkId])).toEqual([
      [1, 'c1'],
      [2, 'c2'],
    ]);
    expect(llm.requests[0].system).toBe(SYSTEM_PROMPT);
    expect(llm.requests[0].messages.at(-1)?.content).toContain(
      '<excerpt number="2"',
    );
  });

  it('reports which sources were cited and which citations were invented', async () => {
    const { service, llm } = setup([hit(1), hit(2)]);
    llm.answer = 'Moved [2]. Also [1] and [5].';

    const done = doneOf(await collect(service.answer({ question: 'q' })));

    expect(done).toMatchObject({
      cited: [2, 1],
      invalidCitations: [5],
      grounded: true,
    });
    expect(done.usage).toMatchObject({
      provider: 'fake',
      model: 'fake-llm',
      outputTokens: 20,
    });
  });

  it('does not call the model when nothing relevant is found', async () => {
    const { service, llm } = setup([]);

    const events = await collect(
      service.answer({ question: 'What about Mars?' }),
    );

    expect(llm.requests).toHaveLength(0);
    expect(textOf(events)).toBe(NO_SOURCES_ANSWER);
    expect(doneOf(events)).toMatchObject({
      grounded: false,
      stopReason: 'no_sources',
      cited: [],
    });
  });

  it('searches with the previous question for short follow-ups', async () => {
    const { service, search } = setup([hit(1)]);

    await collect(
      service.answer({
        question: 'why?',
        history: [
          { role: 'user', content: 'When is the launch?' },
          { role: 'assistant', content: 'Dec 15 [1].' },
        ],
      }),
    );

    expect(search).toHaveBeenCalledWith(
      expect.objectContaining({ query: 'When is the launch? why?' }),
    );
  });

  it('passes the meeting filter to retrieval', async () => {
    const { service, search } = setup([hit(1)]);

    await collect(service.answer({ question: 'q', meetingIds: ['m1'] }));

    expect(search).toHaveBeenCalledWith(
      expect.objectContaining({ meetingIds: ['m1'] }),
    );
  });

  it('propagates model failures to the caller', async () => {
    const { service, llm } = setup([hit(1)]);
    llm.failure = new Error('model down');

    await expect(collect(service.answer({ question: 'q' }))).rejects.toThrow(
      'model down',
    );
  });
});
