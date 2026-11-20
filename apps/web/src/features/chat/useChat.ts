import { useCallback, useEffect, useRef, useState } from 'react';
import {
  streamChat,
  type ChatDone,
  type ChatRequest,
  type ChatSource,
} from '../../api/chat';

export interface ChatTurn {
  id: number;
  question: string;
  answer: string;
  sources: ChatSource[];
  status: 'retrieving' | 'answering' | 'done' | 'stopped' | 'error';
  done?: ChatDone;
  error?: string;
}

/**
 * Conversation state for the Ask page. Only finished turns are sent back as
 * history; the server re-retrieves excerpts for every question.
 */
export function useChat(meetingIds?: string[]) {
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const abortRef = useRef<AbortController | null>(null);
  const busy = turns.some(
    (t) => t.status === 'retrieving' || t.status === 'answering',
  );

  // Cancel an in-flight answer when leaving the page.
  useEffect(() => () => abortRef.current?.abort(), []);

  const update = (id: number, change: (turn: ChatTurn) => ChatTurn) =>
    setTurns((prev) => prev.map((t) => (t.id === id ? change(t) : t)));

  const ask = useCallback(
    async (question: string) => {
      const id = Date.now();
      const history: ChatRequest['history'] = turns
        .filter((t) => t.status === 'done' && t.done?.grounded)
        .flatMap((t) => [
          { role: 'user' as const, content: t.question },
          { role: 'assistant' as const, content: t.answer },
        ]);
      setTurns((prev) => [
        ...prev,
        { id, question, answer: '', sources: [], status: 'retrieving' },
      ]);

      const abort = new AbortController();
      abortRef.current = abort;
      try {
        await streamChat(
          { question, history, meetingIds },
          (event) => {
            switch (event.type) {
              case 'sources':
                update(id, (t) => ({
                  ...t,
                  sources: event.sources,
                  status: 'answering',
                }));
                break;
              case 'token':
                update(id, (t) => ({ ...t, answer: t.answer + event.text }));
                break;
              case 'done':
                update(id, (t) => ({ ...t, done: event, status: 'done' }));
                break;
              case 'error':
                update(id, (t) => ({
                  ...t,
                  error: event.message,
                  status: 'error',
                }));
                break;
            }
          },
          abort.signal,
        );
      } catch (error) {
        update(id, (t) =>
          abort.signal.aborted
            ? { ...t, status: 'stopped' }
            : {
                ...t,
                status: 'error',
                error:
                  error instanceof Error ? error.message : 'Request failed',
              },
        );
      }
    },
    [turns, meetingIds],
  );

  const stop = useCallback(() => abortRef.current?.abort(), []);
  const reset = useCallback(() => {
    abortRef.current?.abort();
    setTurns([]);
  }, []);

  return { turns, busy, ask, stop, reset };
}
