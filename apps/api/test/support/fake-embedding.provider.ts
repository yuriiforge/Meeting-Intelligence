import { createHash } from 'node:crypto';
import {
  EMBEDDING_DIMENSIONS,
  type EmbeddingProvider,
  type EmbeddingPurpose,
} from '../../src/embeddings/embedding-provider.js';

/**
 * Deterministic stand-in for a real embedding model: the same text always
 * gives the same unit vector. No network, so tests are fast and offline.
 * Set `failure` to make the next calls throw.
 */
export class FakeEmbeddingProvider implements EmbeddingProvider {
  readonly model = 'fake-embedding';
  failure: Error | null = null;
  readonly calls: { texts: readonly string[]; purpose: EmbeddingPurpose }[] =
    [];

  embed(
    texts: readonly string[],
    purpose: EmbeddingPurpose,
  ): Promise<number[][]> {
    this.calls.push({ texts, purpose });
    if (this.failure) return Promise.reject(this.failure);
    return Promise.resolve(texts.map(fakeVector));
  }
}

function fakeVector(text: string): number[] {
  const vector: number[] = [];
  let block = 0;
  while (vector.length < EMBEDDING_DIMENSIONS) {
    const digest = createHash('sha256').update(`${block++}:${text}`).digest();
    for (const byte of digest) vector.push(byte / 255 - 0.5);
  }
  vector.length = EMBEDDING_DIMENSIONS;
  const norm = Math.hypot(...vector);
  return vector.map((v) => v / norm);
}
