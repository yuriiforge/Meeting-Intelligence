import {
  AlertTriangle,
  ArrowLeft,
  CalendarDays,
  Clock,
  MessageCircleQuestion,
  RefreshCw,
  Search,
} from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router';
import { ApiError } from '../../api/client';
import { useMeeting, useReindexMeeting } from '../../api/hooks';
import { SpeakerAvatar } from '../../components/Speakers';
import { StatusBadge } from '../../components/StatusBadge';
import { formatDuration, formatMeetingDate } from '../../lib/format';
import { rangeFromParams } from '../../lib/range';
import { Transcript } from './Transcript';

export function MeetingPage() {
  const { id = '' } = useParams();
  const [params] = useSearchParams();
  const { data: meeting, isPending, error } = useMeeting(id);
  const reindex = useReindexMeeting();

  if (isPending) {
    return <div className="p-8 text-sm text-muted">Loading meeting…</div>;
  }
  if (error) {
    const notFound =
      error instanceof ApiError &&
      (error.status === 404 || error.status === 400);
    return (
      <div className="mx-auto max-w-3xl p-8">
        <p className="text-sm text-danger">
          {notFound
            ? 'This meeting does not exist.'
            : 'Could not load this meeting.'}
        </p>
        <Link
          to="/"
          className="mt-4 inline-block text-sm text-accent hover:underline"
        >
          Back to meetings
        </Link>
      </div>
    );
  }

  const date = formatMeetingDate(meeting.occurredAt);
  const duration = formatDuration(meeting.durationSeconds);

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 md:px-8">
      <Link
        to="/"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted hover:text-ink"
      >
        <ArrowLeft className="size-4" aria-hidden />
        All meetings
      </Link>

      <header className="rounded-2xl border border-line bg-surface p-5 md:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h1 className="text-xl font-semibold tracking-tight md:text-2xl">
            {meeting.title}
          </h1>
          <StatusBadge status={meeting.status} />
        </div>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted">
          {date && (
            <span className="inline-flex items-center gap-1">
              <CalendarDays className="size-4" aria-hidden />
              {date}
            </span>
          )}
          {duration && (
            <span className="inline-flex items-center gap-1">
              <Clock className="size-4" aria-hidden />
              {duration}
            </span>
          )}
          <span>{meeting.utteranceCount} turns</span>
          {meeting.sourceFilename && (
            <span className="font-mono text-xs leading-5">
              {meeting.sourceFilename}
            </span>
          )}
        </div>

        <ul className="mt-4 flex flex-wrap gap-2" aria-label="Speakers">
          {meeting.speakers.map((name) => (
            <li
              key={name}
              className="inline-flex items-center gap-2 rounded-full border border-line py-0.5 pl-0.5 pr-3 text-sm"
            >
              <SpeakerAvatar name={name} size="sm" />
              {name}
            </li>
          ))}
        </ul>

        {meeting.status === 'FAILED' && (
          <div className="mt-4 flex flex-wrap items-center gap-3 rounded-lg border border-danger/30 bg-danger/5 p-3 text-sm">
            <AlertTriangle
              className="size-4 shrink-0 text-danger"
              aria-hidden
            />
            <span className="min-w-0 flex-1">
              Indexing failed: {meeting.error ?? 'unknown error'}. The
              transcript is saved, but it can't be searched yet.
            </span>
            <button
              type="button"
              onClick={() => reindex.mutate(meeting.id)}
              disabled={reindex.isPending}
              className="inline-flex items-center gap-1 rounded-md border border-line bg-surface px-2 py-1 font-medium hover:bg-raised"
            >
              <RefreshCw
                className={`size-3.5 ${reindex.isPending ? 'animate-spin' : ''}`}
                aria-hidden
              />
              Retry
            </button>
          </div>
        )}

        {meeting.status === 'READY' && (
          <div className="mt-4 flex flex-wrap gap-2">
            <div className="min-w-0 flex-1">
              <MeetingSearch meetingId={meeting.id} />
            </div>
            <Link
              to={`/ask?meetingId=${meeting.id}`}
              className="inline-flex items-center gap-2 rounded-lg bg-accent px-3 py-2 text-sm font-medium text-on-accent hover:opacity-90"
            >
              <MessageCircleQuestion className="size-4" aria-hidden />
              Ask about this meeting
            </Link>
          </div>
        )}
      </header>

      <section className="mt-6 rounded-2xl border border-line bg-surface p-2 md:p-4">
        <Transcript
          utterances={meeting.utterances}
          highlight={rangeFromParams(params)}
        />
      </section>
    </div>
  );
}

/** Search scoped to this meeting; results open on the search page. */
function MeetingSearch({ meetingId }: { meetingId: string }) {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');

  function submit(event: FormEvent) {
    event.preventDefault();
    const q = query.trim();
    if (q) navigate(`/search?${new URLSearchParams({ q, meetingId })}`);
  }

  return (
    <form role="search" onSubmit={submit} className="relative">
      <Search
        className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-faint"
        aria-hidden
      />
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search this meeting…"
        aria-label="Search this meeting"
        className="w-full rounded-lg border border-line bg-canvas py-2 pl-9 pr-3 text-sm outline-none placeholder:text-faint focus:border-accent focus:ring-2 focus:ring-accent/20"
      />
    </form>
  );
}
