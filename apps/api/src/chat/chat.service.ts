import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  LLM_PROVIDER,
  type LlmProvider,
  type LlmResult,
} from '../llm/llm-provider.js';
import { RetrievalService } from '../retrieval/retrieval.service.js';
import type { SearchHit } from '../retrieval/retrieval.types.js';
import type { ChatEvent, ChatRequest, ChatSource } from './chat.types.js';
import { checkCitations } from './citations.js';
import {
  buildMessages,
  NO_SOURCES_ANSWER,
  retrievalQuery,
  SYSTEM_PROMPT,
} from './prompt.js';

/** Excerpts per answer: ~6 x 400 tokens keeps prompts small and focused. */
const SOURCES_PER_ANSWER = 6;
/** A meeting answer should be short; this also caps cost per question. */
const MAX_ANSWER_TOKENS = 1024;

/**
 * Retrieval-augmented answers with citations:
 * retrieve -> (nothing found? answer without the model) -> prompt -> stream
 * -> verify which [n] citations point at real sources.
 */
@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(
    private readonly retrieval: RetrievalService,
    @Inject(LLM_PROVIDER) private readonly llm: LlmProvider,
  ) {}

  async *answer(
    request: ChatRequest,
    signal?: AbortSignal,
  ): AsyncGenerator<ChatEvent> {
    const startedAt = Date.now();
    const { hits } = await this.retrieval.search({
      query: retrievalQuery(request.question, request.history),
      meetingIds: request.meetingIds,
      limit: SOURCES_PER_ANSWER,
    });
    const retrievalMs = Date.now() - startedAt;
    const sources = hits.map(toSource);
    yield { type: 'sources', sources };

    if (sources.length === 0) {
      // Guardrail: with no evidence there is nothing to ground an answer in,
      // so don't give the model a chance to make one up.
      yield { type: 'token', text: NO_SOURCES_ANSWER };
      yield this.done({
        answer: '',
        sourceCount: 0,
        grounded: false,
        result: null,
        retrievalMs,
        startedAt,
      });
      return;
    }

    const generation = this.llm.stream({
      system: SYSTEM_PROMPT,
      messages: buildMessages(request.question, sources, request.history),
      maxTokens: MAX_ANSWER_TOKENS,
      signal,
    });

    let answer = '';
    let step = await generation.next();
    while (!step.done) {
      answer += step.value;
      yield { type: 'token', text: step.value };
      step = await generation.next();
    }

    const done = this.done({
      answer,
      sourceCount: sources.length,
      grounded: true,
      result: step.value,
      retrievalMs,
      startedAt,
    });
    this.logger.log(
      `chat q_chars=${request.question.length} sources=${sources.length} ` +
        `cited=${done.cited.length} invalid=${done.invalidCitations.length} ` +
        `stop=${done.stopReason} model=${done.usage.model} ` +
        `tokens_in=${done.usage.inputTokens} tokens_out=${done.usage.outputTokens} ` +
        `retrieval_ms=${retrievalMs} total_ms=${done.usage.totalMs}`,
    );
    yield done;
  }

  private done(args: {
    answer: string;
    sourceCount: number;
    grounded: boolean;
    result: LlmResult | null;
    retrievalMs: number;
    startedAt: number;
  }): Extract<ChatEvent, { type: 'done' }> {
    const { cited, invalid } = checkCitations(args.answer, args.sourceCount);
    return {
      type: 'done',
      cited,
      invalidCitations: invalid,
      grounded: args.grounded,
      stopReason: args.result?.stopReason ?? 'no_sources',
      usage: {
        provider: this.llm.name,
        model: args.result?.model ?? this.llm.model,
        inputTokens: args.result?.inputTokens ?? null,
        outputTokens: args.result?.outputTokens ?? null,
        retrievalMs: args.retrievalMs,
        totalMs: Date.now() - args.startedAt,
      },
    };
  }
}

function toSource(hit: SearchHit, index: number): ChatSource {
  return {
    number: index + 1,
    chunkId: hit.chunkId,
    meetingId: hit.meetingId,
    meetingTitle: hit.meetingTitle,
    occurredAt: hit.occurredAt,
    speakers: hit.speakers,
    startSeconds: hit.startSeconds,
    endSeconds: hit.endSeconds,
    startUtterance: hit.startUtterance,
    endUtterance: hit.endUtterance,
    content: hit.content,
  };
}
