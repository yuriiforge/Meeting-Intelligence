// Mirrors apps/api/src/chat/chat.types.ts.

export interface ChatSource {
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

export interface ChatDone {
  type: 'done';
  cited: number[];
  invalidCitations: number[];
  grounded: boolean;
  stopReason: string;
  usage: {
    provider: string;
    model: string;
    inputTokens: number | null;
    outputTokens: number | null;
    retrievalMs: number;
    totalMs: number;
  };
}

export type ChatEvent =
  | { type: 'sources'; sources: ChatSource[] }
  | { type: 'token'; text: string }
  | ChatDone
  | { type: 'error'; message: string };

export interface ChatRequest {
  question: string;
  history: { role: 'user' | 'assistant'; content: string }[];
  meetingIds?: string[];
}

/**
 * Incremental parser for server-sent events. Network chunks can end anywhere,
 * even mid-event, so text is buffered until a blank line closes an event.
 */
export class SseParser {
  private buffer = '';

  push(chunk: string): ChatEvent[] {
    this.buffer += chunk.replace(/\r\n/g, '\n');
    const blocks = this.buffer.split('\n\n');
    this.buffer = blocks.pop() ?? '';
    return blocks.flatMap((block) => {
      const data = block
        .split('\n')
        .filter((line) => line.startsWith('data:'))
        .map((line) => line.slice(5).trimStart())
        .join('\n');
      return data ? [JSON.parse(data) as ChatEvent] : [];
    });
  }
}

/** POSTs a question and calls `onEvent` for each event as it streams in. */
export async function streamChat(
  request: ChatRequest,
  onEvent: (event: ChatEvent) => void,
  signal?: AbortSignal,
): Promise<void> {
  const response = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(request),
    signal,
  });
  if (!response.ok || !response.body) {
    const body = (await response.json().catch(() => null)) as {
      message?: string | string[];
    } | null;
    const message = Array.isArray(body?.message)
      ? body.message.join(', ')
      : (body?.message ?? `Request failed (${response.status})`);
    throw new Error(message);
  }

  const parser = new SseParser();
  const decoder = new TextDecoder();
  const reader = response.body.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    parser.push(decoder.decode(value, { stream: true })).forEach(onEvent);
  }
}
