import { LlmError } from './llm-provider.js';
import { OllamaLlmProvider, readNdjson } from './ollama-llm.provider.js';

/** A response whose body arrives in the given raw chunks. */
function streamedResponse(chunks: string[], status = 200): Response {
  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      chunks.forEach((c) => controller.enqueue(encoder.encode(c)));
      controller.close();
    },
  });
  return new Response(body, { status });
}

const line = (value: object) => `${JSON.stringify(value)}\n`;

async function drain(provider: OllamaLlmProvider) {
  const generator = provider.stream({
    system: 'sys',
    messages: [{ role: 'user', content: 'hi' }],
    maxTokens: 50,
  });
  const text: string[] = [];
  let step = await generator.next();
  while (!step.done) {
    text.push(step.value);
    step = await generator.next();
  }
  return { text: text.join(''), result: step.value };
}

describe('OllamaLlmProvider', () => {
  it('streams text and reports usage from the final chunk', async () => {
    const fetch = vi.fn(() =>
      Promise.resolve(
        streamedResponse([
          line({ message: { content: 'Hel' } }) +
            line({ message: { content: 'lo' } }),
          line({
            done: true,
            done_reason: 'stop',
            prompt_eval_count: 42,
            eval_count: 7,
          }),
        ]),
      ),
    );
    const provider = new OllamaLlmProvider({
      baseUrl: 'http://o:11434',
      model: 'qwen',
      fetch,
    });

    const { text, result } = await drain(provider);

    expect(text).toBe('Hello');
    expect(result).toEqual({
      model: 'qwen',
      stopReason: 'end',
      inputTokens: 42,
      outputTokens: 7,
    });
  });

  it('sends the system prompt first and a large enough context window', async () => {
    const fetch = vi.fn((_url: string | URL | Request, _init?: RequestInit) =>
      Promise.resolve(
        streamedResponse([line({ done: true, done_reason: 'stop' })]),
      ),
    );
    const provider = new OllamaLlmProvider({
      baseUrl: 'http://o:11434/',
      model: 'qwen',
      fetch,
    });

    await drain(provider);

    const [url, init] = fetch.mock.calls[0];
    const body = JSON.parse(init?.body as string) as {
      messages: { role: string }[];
      options: { num_ctx: number; num_predict: number };
    };
    expect(url).toBe('http://o:11434/api/chat');
    expect(body.messages.map((m) => m.role)).toEqual(['system', 'user']);
    expect(body.options).toMatchObject({ num_ctx: 8192, num_predict: 50 });
  });

  it('maps a length stop to max_tokens', async () => {
    const fetch = vi.fn(() =>
      Promise.resolve(
        streamedResponse([line({ done: true, done_reason: 'length' })]),
      ),
    );

    const { result } = await drain(
      new OllamaLlmProvider({ baseUrl: 'http://o', model: 'qwen', fetch }),
    );

    expect(result.stopReason).toBe('max_tokens');
  });

  it('hints at `ollama pull` when the model is missing', async () => {
    const fetch = vi.fn(() =>
      Promise.resolve(new Response('model not found', { status: 404 })),
    );

    await expect(
      drain(
        new OllamaLlmProvider({ baseUrl: 'http://o', model: 'qwen', fetch }),
      ),
    ).rejects.toThrow(/run `ollama pull qwen`/);
  });

  it('turns an error inside the stream into an LlmError', async () => {
    const fetch = vi.fn(() =>
      Promise.resolve(streamedResponse([line({ error: 'out of memory' })])),
    );

    await expect(
      drain(
        new OllamaLlmProvider({ baseUrl: 'http://o', model: 'qwen', fetch }),
      ),
    ).rejects.toBeInstanceOf(LlmError);
  });
});

describe('readNdjson', () => {
  it('handles JSON lines split across network chunks', async () => {
    const response = streamedResponse(['{"a":', '1}\n{"a"', ':2}\n{"a":3}']);

    const values: unknown[] = [];
    for await (const value of readNdjson(response.body!)) values.push(value);

    expect(values).toEqual([{ a: 1 }, { a: 2 }, { a: 3 }]);
  });
});
