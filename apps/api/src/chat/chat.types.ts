import type { LlmMessage } from '../llm/llm-provider.js';

export interface ChatRequest {
  question: string;
  /** Earlier turns of this conversation, oldest first. */
  history?: LlmMessage[];
  /** Restrict retrieval to these meetings (e.g. "ask about this meeting"). */
  meetingIds?: string[];
}

/** A retrieved chunk shown to the model as `[n]` and to the user as a citation. */
export interface ChatSource {
  /** 1-based number used in the answer, e.g. [2]. */
  number: number;
  chunkId: string;
  meetingId: string;
  meetingTitle: string;
  occurredAt: string | null;
  speakers: string[];
  startSeconds: number;
  endSeconds: number;
  startUtterance: number;
  endUtterance: number;
  content: string;
}

export interface ChatUsage {
  provider: string;
  model: string;
  inputTokens: number | null;
  outputTokens: number | null;
  retrievalMs: number;
  totalMs: number;
}

/**
 * Server-sent events of one answer, in order:
 * sources -> token* -> done   (or error at any point).
 */
export type ChatEvent =
  | { type: 'sources'; sources: ChatSource[] }
  | { type: 'token'; text: string }
  | {
      type: 'done';
      /** Source numbers the answer actually cited, in order of first use. */
      cited: number[];
      /** Cited numbers that match no source (the model made them up). */
      invalidCitations: number[];
      /** False when nothing relevant was found and no model was called. */
      grounded: boolean;
      stopReason: string;
      usage: ChatUsage;
    }
  | { type: 'error'; message: string };
