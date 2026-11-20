/**
 * Vector size of the `chunks.embedding vector(768)` column. Fixed by the
 * schema, not config: a model with another size needs a migration and a
 * full re-embed.
 */
export const EMBEDDING_DIMENSIONS = 768;

/** Some models embed documents and search queries differently. */
export type EmbeddingPurpose = 'document' | 'query';

export interface EmbeddingProvider {
  /** Stored with every vector so a model change can be detected. */
  readonly model: string;
  /** Returns one vector per input text, in the same order. */
  embed(
    texts: readonly string[],
    purpose: EmbeddingPurpose,
  ): Promise<number[][]>;
}

/** Nest injection token for the configured EmbeddingProvider. */
export const EMBEDDING_PROVIDER = Symbol('EMBEDDING_PROVIDER');

export class EmbeddingError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'EmbeddingError';
  }
}

/** Serialises a vector into pgvector's text form, e.g. "[0.1,0.2]". */
export function toPgVector(vector: readonly number[]): string {
  if (!vector.every(Number.isFinite)) {
    throw new EmbeddingError('Embedding contains a non-finite value');
  }
  return `[${vector.join(',')}]`;
}
