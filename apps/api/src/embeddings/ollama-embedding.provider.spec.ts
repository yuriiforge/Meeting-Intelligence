import { EMBEDDING_DIMENSIONS, EmbeddingError } from './embedding-provider.js';
import {
  OllamaEmbeddingProvider,
  taskPrefix,
} from './ollama-embedding.provider.js';

const vector = (fill = 0.1) => Array<number>(EMBEDDING_DIMENSIONS).fill(fill);

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

/** A fetch stub that answers each request with one vector per input. */
function echoFetch() {
  return vi.fn((_url: string | URL | Request, init?: RequestInit) => {
    const { input } = JSON.parse(init?.body as string) as { input: string[] };
    return Promise.resolve(
      jsonResponse({ embeddings: input.map(() => vector()) }),
    );
  });
}

function provider(fetch: typeof globalThis.fetch, model = 'nomic-embed-text') {
  return new OllamaEmbeddingProvider({
    baseUrl: 'http://ollama:11434/',
    model,
    batchSize: 2,
    fetch,
  });
}

const sentBodies = (fetch: ReturnType<typeof echoFetch>) =>
  fetch.mock.calls.map(
    ([, init]) => JSON.parse(init?.body as string) as Record<string, unknown>,
  );

describe('OllamaEmbeddingProvider', () => {
  it('posts to /api/embed with model, input and truncation', async () => {
    const fetch = echoFetch();

    await provider(fetch).embed(['hello'], 'document');

    expect(fetch).toHaveBeenCalledWith(
      'http://ollama:11434/api/embed',
      expect.objectContaining({ method: 'POST' }),
    );
    expect(sentBodies(fetch)[0]).toEqual({
      model: 'nomic-embed-text',
      input: ['search_document: hello'],
      truncate: true,
    });
  });

  it('uses the query prefix for queries', async () => {
    const fetch = echoFetch();

    await provider(fetch).embed(['when is launch?'], 'query');

    expect(sentBodies(fetch)[0].input).toEqual([
      'search_query: when is launch?',
    ]);
  });

  it('splits input into batches and keeps order', async () => {
    const fetch = echoFetch();

    const vectors = await provider(fetch).embed(['a', 'b', 'c'], 'document');

    expect(fetch).toHaveBeenCalledTimes(2);
    expect(sentBodies(fetch).map((b) => b.input)).toEqual([
      ['search_document: a', 'search_document: b'],
      ['search_document: c'],
    ]);
    expect(vectors).toHaveLength(3);
  });

  it('makes no request for empty input', async () => {
    const fetch = echoFetch();

    expect(await provider(fetch).embed([], 'document')).toEqual([]);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('explains a network failure', async () => {
    const fetch = vi.fn(() => Promise.reject(new TypeError('fetch failed')));

    await expect(provider(fetch).embed(['a'], 'document')).rejects.toThrow(
      /unreachable at http:\/\/ollama:11434: fetch failed/,
    );
  });

  it('hints at `ollama pull` when the model is missing', async () => {
    const fetch = vi.fn(() =>
      Promise.resolve(jsonResponse({ error: 'model not found' }, 404)),
    );

    await expect(provider(fetch).embed(['a'], 'document')).rejects.toThrow(
      /HTTP 404 \(run `ollama pull nomic-embed-text`\)/,
    );
  });

  it('rejects vectors of the wrong size', async () => {
    const fetch = vi.fn(() =>
      Promise.resolve(jsonResponse({ embeddings: [[0.1, 0.2]] })),
    );

    await expect(provider(fetch).embed(['a'], 'document')).rejects.toThrow(
      /2-dimensional vectors; the database expects 768/,
    );
  });

  it('rejects a response with the wrong number of vectors', async () => {
    const fetch = vi.fn(() =>
      Promise.resolve(jsonResponse({ embeddings: [vector(), vector()] })),
    );

    await expect(
      provider(fetch).embed(['a'], 'document'),
    ).rejects.toBeInstanceOf(EmbeddingError);
  });
});

describe('taskPrefix', () => {
  it.each([
    ['nomic-embed-text', 'document', 'search_document: '],
    ['nomic-embed-text:v1.5', 'query', 'search_query: '],
    ['mxbai-embed-large', 'query', ''],
  ] as const)('%s / %s -> "%s"', (model, purpose, expected) => {
    expect(taskPrefix(model, purpose)).toBe(expected);
  });
});
