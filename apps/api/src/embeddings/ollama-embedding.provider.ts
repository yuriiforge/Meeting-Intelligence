import {
  EMBEDDING_DIMENSIONS,
  EmbeddingError,
  type EmbeddingProvider,
  type EmbeddingPurpose,
} from './embedding-provider.js';

export interface OllamaEmbeddingOptions {
  baseUrl: string;
  model: string;
  /** Texts per HTTP request. Keeps request size and latency bounded. */
  batchSize?: number;
  /** Per request. Generous because CPU-only embedding is slow on first load. */
  timeoutMs?: number;
  /** Injectable for tests. */
  fetch?: typeof fetch;
}

interface OllamaEmbedResponse {
  embeddings?: unknown;
}

/** Calls Ollama's batch embedding endpoint, POST /api/embed. */
export class OllamaEmbeddingProvider implements EmbeddingProvider {
  readonly model: string;
  private readonly baseUrl: string;
  private readonly batchSize: number;
  private readonly timeoutMs: number;
  private readonly fetch: typeof fetch;

  constructor(options: OllamaEmbeddingOptions) {
    this.model = options.model;
    this.baseUrl = options.baseUrl.replace(/\/+$/, '');
    this.batchSize = options.batchSize ?? 32;
    this.timeoutMs = options.timeoutMs ?? 120_000;
    this.fetch = options.fetch ?? globalThis.fetch;
  }

  async embed(
    texts: readonly string[],
    purpose: EmbeddingPurpose,
  ): Promise<number[][]> {
    const prefix = taskPrefix(this.model, purpose);
    const vectors: number[][] = [];
    for (let i = 0; i < texts.length; i += this.batchSize) {
      const batch = texts.slice(i, i + this.batchSize).map((t) => prefix + t);
      vectors.push(...(await this.request(batch)));
    }
    return vectors;
  }

  private async request(input: string[]): Promise<number[][]> {
    let response: Response;
    try {
      response = await this.fetch(`${this.baseUrl}/api/embed`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ model: this.model, input, truncate: true }),
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch (error) {
      throw new EmbeddingError(
        `Ollama is unreachable at ${this.baseUrl}: ${describe(error)}`,
        { cause: error },
      );
    }

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      const hint =
        response.status === 404 ? ` (run \`ollama pull ${this.model}\`)` : '';
      throw new EmbeddingError(
        `Ollama returned HTTP ${response.status}${hint}: ${body.slice(0, 300)}`,
      );
    }

    const { embeddings } = (await response.json()) as OllamaEmbedResponse;
    return this.validate(embeddings, input.length);
  }

  private validate(embeddings: unknown, expected: number): number[][] {
    if (!Array.isArray(embeddings) || embeddings.length !== expected) {
      throw new EmbeddingError(
        `Ollama returned ${Array.isArray(embeddings) ? embeddings.length : 'no'} embeddings for ${expected} inputs`,
      );
    }
    for (const vector of embeddings as unknown[]) {
      if (!Array.isArray(vector) || vector.length !== EMBEDDING_DIMENSIONS) {
        throw new EmbeddingError(
          `Model "${this.model}" returned ${Array.isArray(vector) ? vector.length : 'non-array'}-dimensional vectors; ` +
            `the database expects ${EMBEDDING_DIMENSIONS}`,
        );
      }
    }
    return embeddings as number[][];
  }
}

/**
 * nomic-embed-text is trained with task prefixes, and retrieval quality drops
 * noticeably without them (https://huggingface.co/nomic-ai/nomic-embed-text-v1.5).
 */
export function taskPrefix(model: string, purpose: EmbeddingPurpose): string {
  if (!model.startsWith('nomic-embed-text')) return '';
  return purpose === 'query' ? 'search_query: ' : 'search_document: ';
}

function describe(error: unknown): string {
  if (error instanceof Error) {
    return error.name === 'TimeoutError' ? 'request timed out' : error.message;
  }
  return String(error);
}
