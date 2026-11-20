/**
 * Rough token count (~4 characters per token for English).
 *
 * Only used to size chunks, where being off by ~10–20% is fine. An exact count
 * would need the embedding model's own tokenizer, and that couples chunking
 * to one model.
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}
