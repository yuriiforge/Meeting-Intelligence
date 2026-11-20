export const SEARCH_MODES = ['hybrid', 'semantic', 'keyword'] as const;
export type SearchMode = (typeof SEARCH_MODES)[number];

export interface SearchOptions {
  query: string;
  /** Max hits returned. */
  limit?: number;
  /** Only search these meetings. */
  meetingIds?: string[];
  /** Only chunks where at least one of these people speaks. */
  speakers?: string[];
  /** `hybrid` in normal use; the single modes exist for evaluation and debugging. */
  mode?: SearchMode;
}

export interface SearchHit {
  chunkId: string;
  meetingId: string;
  meetingTitle: string;
  occurredAt: string | null;
  sequence: number;
  content: string;
  speakers: string[];
  startSeconds: number;
  endSeconds: number;
  startUtterance: number;
  endUtterance: number;
  /** Fused RRF score. Only meaningful for ordering, not as a confidence. */
  score: number;
  /** 1-based rank from each retriever that found this chunk. */
  ranks: { semantic?: number; keyword?: number };
}

export interface SearchResult {
  query: string;
  mode: SearchMode;
  hits: SearchHit[];
  tookMs: number;
}
