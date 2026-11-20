import Anthropic from '@anthropic-ai/sdk';
import {
  LlmError,
  type LlmProvider,
  type LlmRequest,
  type LlmResult,
} from './llm-provider.js';

export interface AnthropicLlmOptions {
  model: string;
  effort: 'low' | 'medium' | 'high';
  /** Defaults to `new Anthropic()`, which reads credentials from the environment. */
  client?: Anthropic;
}

/**
 * Claude via the Messages API, streamed.
 *
 * Server-side refusal fallback is on (`fallbacks: "default"`): if a safety
 * classifier declines the request, the API re-runs it on a fallback model
 * within the same call, so users get an answer rather than an empty reply.
 * The model that actually answered is reported back in the result.
 */
export class AnthropicLlmProvider implements LlmProvider {
  readonly name = 'anthropic' as const;
  readonly model: string;
  private readonly effort: AnthropicLlmOptions['effort'];
  private readonly client: Anthropic;

  constructor(options: AnthropicLlmOptions) {
    this.model = options.model;
    this.effort = options.effort;
    this.client = options.client ?? new Anthropic();
  }

  async *stream(request: LlmRequest): AsyncGenerator<string, LlmResult> {
    const stream = this.client.beta.messages.stream(
      {
        model: this.model,
        max_tokens: request.maxTokens,
        system: request.system,
        messages: request.messages,
        output_config: { effort: this.effort },
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
      },
      { signal: request.signal },
    );

    try {
      for await (const event of stream) {
        if (
          event.type === 'content_block_delta' &&
          event.delta.type === 'text_delta'
        ) {
          yield event.delta.text;
        }
      }
      const message = await stream.finalMessage();
      return {
        model: message.model,
        stopReason:
          message.stop_reason === 'end_turn'
            ? 'end'
            : message.stop_reason === 'max_tokens'
              ? 'max_tokens'
              : message.stop_reason === 'refusal'
                ? 'refusal'
                : 'other',
        inputTokens: message.usage.input_tokens,
        outputTokens: message.usage.output_tokens,
      };
    } catch (error) {
      if (request.signal?.aborted) throw error;
      if (error instanceof Anthropic.APIError) {
        throw new LlmError(
          `Claude API error ${error.status ?? ''}: ${error.message}`,
          { cause: error },
        );
      }
      throw error;
    }
  }
}
