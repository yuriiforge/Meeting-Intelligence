import type {
  LlmProvider,
  LlmRequest,
  LlmResult,
} from '../../src/llm/llm-provider.js';

/**
 * Scripted stand-in for a model: streams `answer` in small pieces and records
 * every request, so tests can check exactly what the model was shown.
 */
export class FakeLlmProvider implements LlmProvider {
  readonly name = 'fake' as const;
  readonly model = 'fake-llm';
  answer = 'The launch moved to December 15th [1].';
  failure: Error | null = null;
  readonly requests: LlmRequest[] = [];

  async *stream(request: LlmRequest): AsyncGenerator<string, LlmResult> {
    this.requests.push(request);
    if (this.failure) throw this.failure;
    for (const piece of this.answer.match(/.{1,8}/gs) ?? []) {
      await Promise.resolve();
      yield piece;
    }
    return {
      model: this.model,
      stopReason: 'end',
      inputTokens: 100,
      outputTokens: 20,
    };
  }
}
