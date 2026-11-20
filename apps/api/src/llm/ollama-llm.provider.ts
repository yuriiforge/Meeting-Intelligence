import {
  LlmError,
  type LlmProvider,
  type LlmRequest,
  type LlmResult,
} from './llm-provider.js';

export interface OllamaLlmOptions {
  baseUrl: string;
  model: string;
  /**
   * Context window to allocate. Ollama's default is small (2-4K tokens) and
   * silently drops the start of longer prompts, which would cut off sources.
   */
  contextTokens?: number;
  /** Injectable for tests. */
  fetch?: typeof fetch;
}

interface OllamaChatChunk {
  message?: { content?: string };
  done?: boolean;
  done_reason?: string;
  prompt_eval_count?: number;
  eval_count?: number;
  error?: string;
}

/** Streams from Ollama's /api/chat, which returns one JSON object per line. */
export class OllamaLlmProvider implements LlmProvider {
  readonly name = 'ollama' as const;
  readonly model: string;
  private readonly baseUrl: string;
  private readonly contextTokens: number;
  private readonly fetch: typeof fetch;

  constructor(options: OllamaLlmOptions) {
    this.model = options.model;
    this.baseUrl = options.baseUrl.replace(/\/+$/, '');
    this.contextTokens = options.contextTokens ?? 8192;
    this.fetch = options.fetch ?? globalThis.fetch;
  }

  async *stream(request: LlmRequest): AsyncGenerator<string, LlmResult> {
    const response = await this.post(request);
    let last: OllamaChatChunk = {};

    for await (const chunk of readNdjson(response.body!)) {
      if (chunk.error) throw new LlmError(`Ollama error: ${chunk.error}`);
      const text = chunk.message?.content;
      if (text) yield text;
      last = chunk;
    }

    return {
      model: this.model,
      stopReason:
        last.done_reason === 'stop'
          ? 'end'
          : last.done_reason === 'length'
            ? 'max_tokens'
            : 'other',
      inputTokens: last.prompt_eval_count ?? null,
      outputTokens: last.eval_count ?? null,
    };
  }

  private async post(request: LlmRequest): Promise<Response> {
    let response: Response;
    try {
      response = await this.fetch(`${this.baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        signal: request.signal,
        body: JSON.stringify({
          model: this.model,
          stream: true,
          messages: [
            { role: 'system', content: request.system },
            ...request.messages,
          ],
          options: {
            num_ctx: this.contextTokens,
            num_predict: request.maxTokens,
            // Small local models drift less from the sources when sampling is
            // conservative. (Not sent to Claude, where the API sets sampling.)
            temperature: 0.2,
          },
        }),
      });
    } catch (error) {
      if (request.signal?.aborted) throw error;
      throw new LlmError(`Ollama is unreachable at ${this.baseUrl}`, {
        cause: error,
      });
    }
    if (!response.ok || !response.body) {
      const body = await response.text().catch(() => '');
      const hint =
        response.status === 404 ? ` (run \`ollama pull ${this.model}\`)` : '';
      throw new LlmError(
        `Ollama returned HTTP ${response.status}${hint}: ${body.slice(0, 300)}`,
      );
    }
    return response;
  }
}

/** Parses a newline-delimited JSON stream, tolerating chunk boundaries mid-line. */
export async function* readNdjson(
  body: ReadableStream<Uint8Array>,
): AsyncGenerator<OllamaChatChunk> {
  const decoder = new TextDecoder();
  let buffer = '';
  for await (const bytes of body) {
    buffer += decoder.decode(bytes, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';
    for (const line of lines) {
      if (line.trim()) yield JSON.parse(line) as OllamaChatChunk;
    }
  }
  if (buffer.trim()) yield JSON.parse(buffer) as OllamaChatChunk;
}
