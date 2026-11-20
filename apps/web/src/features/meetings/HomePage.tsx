import { CalendarDays, Clock, MessageSquareText, Plus } from 'lucide-react';
import { Link, useOutletContext } from 'react-router';
import { useMeetings } from '../../api/hooks';
import type { MeetingSummary } from '../../api/types';
import type { ShellContext } from '../../components/AppShell';
import { SpeakerStack } from '../../components/Speakers';
import { StatusBadge } from '../../components/StatusBadge';
import { formatDuration, formatMeetingDate } from '../../lib/format';

export function HomePage() {
  const { openUpload } = useOutletContext<ShellContext>();
  const { data: meetings, isPending, isError } = useMeetings();

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 md:px-8">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Your meetings
          </h1>
          <p className="mt-1 text-sm text-muted">
            Upload transcripts, then search across every discussion and
            decision.
          </p>
        </div>
        <button
          type="button"
          onClick={openUpload}
          className="inline-flex items-center gap-2 rounded-lg border border-line bg-surface px-3 py-2 text-sm font-medium hover:bg-raised"
        >
          <Plus className="size-4" aria-hidden />
          Add meetings
        </button>
      </header>

      {isPending && <CardSkeletons />}
      {isError && (
        <p className="rounded-xl border border-line bg-surface p-6 text-sm text-danger">
          Could not load meetings. Check that the API is running.
        </p>
      )}
      {meetings?.length === 0 && <EmptyState onUpload={openUpload} />}
      {meetings && meetings.length > 0 && (
        <ul className="grid gap-4 sm:grid-cols-2">
          {meetings.map((meeting) => (
            <li key={meeting.id}>
              <MeetingCard meeting={meeting} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function MeetingCard({ meeting }: { meeting: MeetingSummary }) {
  const date = formatMeetingDate(meeting.occurredAt);
  const duration = formatDuration(meeting.durationSeconds);

  return (
    <Link
      to={`/meetings/${meeting.id}`}
      className="flex h-full flex-col gap-4 rounded-xl border border-line bg-surface p-5 transition hover:border-accent/50 hover:shadow-sm"
    >
      <div className="flex items-start justify-between gap-3">
        <h2 className="font-semibold leading-snug">{meeting.title}</h2>
        <StatusBadge status={meeting.status} />
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
        {date && (
          <span className="inline-flex items-center gap-1">
            <CalendarDays className="size-3.5" aria-hidden />
            {date}
          </span>
        )}
        {duration && (
          <span className="inline-flex items-center gap-1">
            <Clock className="size-3.5" aria-hidden />
            {duration}
          </span>
        )}
        <span className="inline-flex items-center gap-1">
          <MessageSquareText className="size-3.5" aria-hidden />
          {meeting.utteranceCount} turns
        </span>
      </div>
      <div className="mt-auto flex items-center justify-between">
        <SpeakerStack speakers={meeting.speakers} />
        <span className="text-xs text-faint">
          {meeting.speakers.length} speaker
          {meeting.speakers.length === 1 ? '' : 's'}
        </span>
      </div>
    </Link>
  );
}

function EmptyState({ onUpload }: { onUpload: () => void }) {
  return (
    <div className="rounded-2xl border border-dashed border-line bg-surface px-6 py-16 text-center">
      <MessageSquareText className="mx-auto size-10 text-accent" aria-hidden />
      <h2 className="mt-4 text-lg font-semibold">No meetings yet</h2>
      <p className="mx-auto mt-1 max-w-sm text-sm text-muted">
        Add a transcript with speaker labels and timestamps, or load the sample
        meetings of a product team to try it out.
      </p>
      <button
        type="button"
        onClick={onUpload}
        className="mt-6 inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-on-accent hover:opacity-90"
      >
        <Plus className="size-4" aria-hidden />
        Add meetings
      </button>
    </div>
  );
}

function CardSkeletons() {
  return (
    <ul className="grid gap-4 sm:grid-cols-2" aria-label="Loading meetings">
      {[0, 1, 2, 3].map((i) => (
        <li
          key={i}
          className="h-40 animate-pulse rounded-xl border border-line bg-surface"
        />
      ))}
    </ul>
  );
}
