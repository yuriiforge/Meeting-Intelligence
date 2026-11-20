import { Search as SearchIcon, SearchX } from 'lucide-react';
import { useMemo, useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router';
import { useMeetings, useSearch } from '../../api/hooks';
import type { SearchMode } from '../../api/types';
import { SearchHitCard } from './SearchHitCard';

const MODES: { value: SearchMode; label: string; hint: string }[] = [
  { value: 'hybrid', label: 'Hybrid', hint: 'Meaning and exact words, fused' },
  {
    value: 'semantic',
    label: 'Semantic',
    hint: 'Similar meaning (embeddings)',
  },
  { value: 'keyword', label: 'Keyword', hint: 'Exact words (full-text)' },
];

export function SearchPage() {
  const [params, setParams] = useSearchParams();
  const q = params.get('q') ?? '';
  const meetingId = params.get('meetingId') ?? '';
  const speaker = params.get('speaker') ?? '';
  const mode = (params.get('mode') as SearchMode | null) ?? 'hybrid';

  const { data: meetings } = useMeetings();
  const search = useSearch({
    q,
    meetingId: meetingId || undefined,
    speaker: speaker || undefined,
    mode,
  });

  const speakers = useMemo(
    () => [...new Set((meetings ?? []).flatMap((m) => m.speakers))].sort(),
    [meetings],
  );

  /** Updates one URL parameter, so every search is linkable and survives reloads. */
  function update(key: string, value: string) {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: key !== 'q' });
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 md:px-8">
      <h1 className="text-2xl font-semibold tracking-tight">Search</h1>
      <p className="mt-1 text-sm text-muted">
        Find where something was discussed, across all meetings.
      </p>

      <QueryForm initial={q} onSubmit={(value) => update('q', value)} />

      <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
        <select
          value={meetingId}
          onChange={(e) => update('meetingId', e.target.value)}
          aria-label="Filter by meeting"
          className="max-w-64 rounded-lg border border-line bg-surface px-2 py-1.5"
        >
          <option value="">All meetings</option>
          {meetings?.map((m) => (
            <option key={m.id} value={m.id}>
              {m.title}
            </option>
          ))}
        </select>
        <select
          value={speaker}
          onChange={(e) => update('speaker', e.target.value)}
          aria-label="Filter by speaker"
          className="rounded-lg border border-line bg-surface px-2 py-1.5"
        >
          <option value="">Anyone speaking</option>
          {speakers.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <div
          role="radiogroup"
          aria-label="Retrieval mode"
          className="ml-auto inline-flex rounded-lg border border-line bg-surface p-0.5"
        >
          {MODES.map((m) => (
            <button
              key={m.value}
              type="button"
              role="radio"
              aria-checked={mode === m.value}
              title={m.hint}
              onClick={() =>
                update('mode', m.value === 'hybrid' ? '' : m.value)
              }
              className={`rounded-md px-2.5 py-1 text-xs font-medium ${
                mode === m.value
                  ? 'bg-accent text-on-accent'
                  : 'text-muted hover:text-ink'
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      <section className="mt-6" aria-live="polite">
        {!q && (
          <p className="text-sm text-muted">
            Try “Why did the launch date move?” or “payments SDK”.
          </p>
        )}
        {search.isError && (
          <p className="text-sm text-danger">
            Search failed: {search.error.message}
          </p>
        )}
        {q && search.isPending && (
          <p className="text-sm text-muted">Searching…</p>
        )}
        {search.data && (
          <>
            <p className="mb-3 text-xs text-faint">
              {search.data.hits.length} result
              {search.data.hits.length === 1 ? '' : 's'} in {search.data.tookMs}{' '}
              ms
            </p>
            {search.data.hits.length === 0 ? (
              <div className="rounded-xl border border-dashed border-line p-10 text-center text-sm text-muted">
                <SearchX className="mx-auto mb-2 size-6" aria-hidden />
                Nothing found. Only meetings that finished indexing are
                searched.
              </div>
            ) : (
              <ol
                className={`space-y-3 ${search.isPlaceholderData ? 'opacity-60' : ''}`}
              >
                {search.data.hits.map((hit) => (
                  <li key={hit.chunkId}>
                    <SearchHitCard hit={hit} query={q} />
                  </li>
                ))}
              </ol>
            )}
          </>
        )}
      </section>
    </div>
  );
}

function QueryForm({
  initial,
  onSubmit,
}: {
  initial: string;
  onSubmit: (q: string) => void;
}) {
  const [value, setValue] = useState(initial);
  const [lastInitial, setLastInitial] = useState(initial);
  // Follow the URL when it changes from elsewhere (e.g. the sidebar search).
  if (initial !== lastInitial) {
    setLastInitial(initial);
    setValue(initial);
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    onSubmit(value.trim());
  }

  return (
    <form role="search" onSubmit={submit} className="relative mt-6">
      <SearchIcon
        className="pointer-events-none absolute left-3.5 top-1/2 size-5 -translate-y-1/2 text-faint"
        aria-hidden
      />
      <input
        type="search"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Ask about a topic, decision or person…"
        aria-label="Search query"
        autoFocus
        className="w-full rounded-xl border border-line bg-surface py-3 pl-11 pr-24 text-base outline-none placeholder:text-faint focus:border-accent focus:ring-2 focus:ring-accent/20"
      />
      <button
        type="submit"
        className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-on-accent hover:opacity-90"
      >
        Search
      </button>
    </form>
  );
}
