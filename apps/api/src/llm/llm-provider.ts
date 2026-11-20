export interface LlmMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface LlmRequest {
  system: string;
  messages: LlmMessage[];
  maxTokens: number;
  /** Aborts generation, e.g. when the client disconnects. */
  signal?: AbortSignal;
}

export interface LlmResult {
  /** Model that actually answered (may differ after a server-side fallback). */
  model: string;
  /** Why generation ended. `refusal` = a safety filter declined to answer. */
  stopReason: 'end' | 'max_tokens' | 'refusal' | 'other';
  inputTokens: number | null;
  outputTokens: number | null;
}

export interface LlmProvider {
  readonly name: 'ollama' | 'anthropic' | 'fake';
  readonly model: string;
  /** Yields answer text as it is generated; returns usage when done. */
  stream(request: LlmRequest): AsyncGenerator<string, LlmResult>;
}

/** Nest injection token for the configured LlmProvider. */
export const LLM_PROVIDER = Symbol('LLM_PROVIDER');

export class LlmError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'LlmError';
  }
}
