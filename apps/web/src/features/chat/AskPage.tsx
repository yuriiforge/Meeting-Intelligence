import {
  AlertTriangle,
  ArrowUp,
  MessageCircleQuestion,
  RotateCcw,
  Square,
} from 'lucide-react';
import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from 'react';
import { useSearchParams } from 'react-router';
import { useMeetings } from '../../api/hooks';
import { Answer } from './Answer';
import { SourceList } from './SourceList';
import { useChat, type ChatTurn } from './useChat';

const SUGGESTIONS = [
  'Why did the launch date move?',
  'What did we decide about offline editing?',
  'What are the open action items and who owns them?',
  'What did users think of the new onboarding?',
];

export function AskPage() {
  const [params, setParams] = useSearchParams();
  const meetingId = params.get('meetingId') ?? '';
  const { data: meetings } = useMeetings();
  const scope = meetings?.find((m) => m.id === meetingId);
  const { turns, busy, ask, stop, reset } = useChat(
    meetingId ? [meetingId] : undefined,
  );
  const bottomRef = useRef<HTMLDivElement>(null);

  const lastAnswerLength = turns.at(-1)?.answer.length ?? 0;
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' });
  }, [turns.length, lastAnswerLength]);

  function changeScope(id: string) {
    reset();
    setParams(id ? { meetingId: id } : {});
  }

  return (
    <div className="mx-auto flex min-h-[calc(100svh-3.5rem)] max-w-3xl flex-col px-4 md:min-h-svh md:px-8">
      <header className="flex flex-wrap items-center justify-between gap-3 py-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Ask</h1>
          <p className="text-sm text-muted">
            Answers come only from your meetings, with links to what was said.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={meetingId}
            onChange={(e) => changeScope(e.target.value)}
            aria-label="Meetings to ask about"
            className="max-w-60 rounded-lg border border-line bg-surface px-2 py-1.5 text-sm"
          >
            <option value="">All meetings</option>
            {meetings?.map((m) => (
              <option key={m.id} value={m.id}>
                {m.title}
              </option>
            ))}
          </select>
          {turns.length > 0 && (
            <button
              type="button"
              onClick={reset}
              className="inline-flex items-center gap-1 rounded-lg border border-line px-2 py-1.5 text-sm text-muted hover:bg-raised"
              title="Start a new conversation"
            >
              <RotateCcw className="size-3.5" aria-hidden />
              New
            </button>
          )}
        </div>
      </header>

      <section className="flex-1 space-y-8 pb-6" aria-live="polite">
        {turns.length === 0 ? (
          <EmptyState scopeTitle={scope?.title} onPick={(q) => void ask(q)} />
        ) : (
          turns.map((turn) => <Turn key={turn.id} turn={turn} />)
        )}
        <div ref={bottomRef} />
      </section>

      <Composer busy={busy} onAsk={(q) => void ask(q)} onStop={stop} />
    </div>
  );
}

function EmptyState({
  scopeTitle,
  onPick,
}: {
  scopeTitle?: string;
  onPick: (question: string) => void;
}) {
  return (
    <div className="py-10 text-center">
      <MessageCircleQuestion
        className="mx-auto size-10 text-accent"
        aria-hidden
      />
      <h2 className="mt-3 text-lg font-semibold">
        {scopeTitle ? `Ask about “${scopeTitle}”` : 'Ask about your meetings'}
      </h2>
      <p className="mx-auto mt-1 max-w-md text-sm text-muted">
        Decisions, action items, who said what, and how things changed between
        meetings.
      </p>
      <div className="mx-auto mt-6 grid max-w-xl gap-2 sm:grid-cols-2">
        {SUGGESTIONS.map((q) => (
          <button
            key={q}
            type="button"
            onClick={() => onPick(q)}
            className="rounded-xl border border-line bg-surface px-3 py-2.5 text-left text-sm hover:border-accent/50 hover:bg-raised"
          >
            {q}
          </button>
        ))}
      </div>
    </div>
  );
}

function Turn({ turn }: { turn: ChatTurn }) {
  const streaming = turn.status === 'retrieving' || turn.status === 'answering';
  const invalid = turn.done?.invalidCitations ?? [];
  const uncited = turn.done?.grounded && turn.done.cited.length === 0;

  return (
    <article className="space-y-3">
      <div className="ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-md bg-accent px-4 py-2 text-[15px] text-on-accent">
        {turn.question}
      </div>

      <div className="rounded-2xl border border-line bg-surface p-4">
        {turn.status === 'retrieving' && (
          <p className="text-sm text-muted">Searching the meetings…</p>
        )}
        {turn.answer && (
          <Answer
            text={turn.answer}
            sources={turn.sources}
            streaming={streaming}
          />
        )}
        {turn.status === 'answering' && !turn.answer && (
          <p className="text-sm text-muted">
            Found {turn.sources.length} relevant excerpts. Writing the answer…
          </p>
        )}
        {turn.status === 'stopped' && (
          <p className="mt-2 text-xs text-faint">Stopped.</p>
        )}
        {turn.status === 'error' && (
          <p className="flex items-center gap-2 text-sm text-danger">
            <AlertTriangle className="size-4" aria-hidden />
            {turn.error}
          </p>
        )}

        {(uncited || invalid.length > 0) && (
          <p className="mt-3 rounded-md bg-warn/10 px-2 py-1 text-xs text-warn">
            {uncited
              ? 'This answer has no citations. Check it against the excerpts below.'
              : `Citation ${invalid.join(', ')} doesn't match any excerpt.`}
          </p>
        )}

        {turn.status !== 'retrieving' && (
          <SourceList sources={turn.sources} cited={turn.done?.cited ?? []} />
        )}

        {turn.done && turn.done.grounded && (
          <p className="mt-2 text-[11px] text-faint">
            {turn.done.usage.model} ·{' '}
            {(turn.done.usage.totalMs / 1000).toFixed(1)} s
          </p>
        )}
      </div>
    </article>
  );
}

function Composer({
  busy,
  onAsk,
  onStop,
}: {
  busy: boolean;
  onAsk: (question: string) => void;
  onStop: () => void;
}) {
  const [question, setQuestion] = useState('');

  function submit(event?: FormEvent) {
    event?.preventDefault();
    const q = question.trim();
    if (!q || busy) return;
    setQuestion('');
    onAsk(q);
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      submit();
    }
  }

  return (
    <form
      onSubmit={submit}
      className="sticky bottom-0 -mx-4 border-t border-line bg-canvas/95 px-4 py-4 backdrop-blur md:mx-0 md:border-0 md:px-0"
    >
      <div className="relative flex items-end rounded-2xl border border-line bg-surface shadow-sm focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/20">
        <textarea
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={onKeyDown}
          rows={1}
          maxLength={1000}
          placeholder="Ask a question about your meetings…"
          aria-label="Your question"
          className="max-h-40 min-h-12 flex-1 resize-none bg-transparent px-4 py-3 text-[15px] outline-none placeholder:text-faint"
        />
        {busy ? (
          <button
            type="button"
            onClick={onStop}
            className="m-2 rounded-xl border border-line p-2 text-muted hover:bg-raised"
            aria-label="Stop answering"
          >
            <Square className="size-4" />
          </button>
        ) : (
          <button
            type="submit"
            disabled={!question.trim()}
            className="m-2 rounded-xl bg-accent p-2 text-on-accent disabled:opacity-40"
            aria-label="Ask"
          >
            <ArrowUp className="size-4" />
          </button>
        )}
      </div>
    </form>
  );
}
