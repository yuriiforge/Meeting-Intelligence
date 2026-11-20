import { ChevronDown } from 'lucide-react';
import { Link } from 'react-router';
import type { ChatSource } from '../../api/chat';
import { formatClock, formatMeetingDate } from '../../lib/format';
import { rangeToParams } from '../../lib/range';

/** Chunk lines look like "[00:12:34] Speaker: text"; show the first turns. */
function preview(content: string): string {
  return content
    .split('\n')
    .slice(0, 2)
    .map((line) => line.replace(/^\[[\d:]+\]\s*/, ''))
    .join(' ');
}

export function SourceList({
  sources,
  cited,
}: {
  sources: ChatSource[];
  cited: number[];
}) {
  if (sources.length === 0) return null;
  const citedSet = new Set(cited);

  return (
    <details className="group mt-4 rounded-lg border border-line" open={false}>
      <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2 text-xs font-medium text-muted">
        <ChevronDown
          className="size-3.5 transition group-open:rotate-180"
          aria-hidden
        />
        {cited.length > 0
          ? `Based on ${cited.length} of ${sources.length} retrieved excerpts`
          : `${sources.length} retrieved excerpts`}
      </summary>
      <ol className="divide-y divide-line border-t border-line">
        {sources.map((s) => (
          <li
            key={s.chunkId}
            className={citedSet.has(s.number) ? '' : 'opacity-60'}
          >
            <Link
              to={`/meetings/${s.meetingId}?${rangeToParams({ from: s.startUtterance, to: s.endUtterance })}`}
              className="flex gap-3 px-3 py-2 text-sm hover:bg-raised"
            >
              <span
                className={`mt-0.5 flex size-5 shrink-0 items-center justify-center rounded text-[11px] font-semibold ${
                  citedSet.has(s.number)
                    ? 'bg-accent-soft text-accent-ink'
                    : 'bg-raised text-faint'
                }`}
              >
                {s.number}
              </span>
              <span className="min-w-0">
                <span className="block font-medium">
                  {s.meetingTitle}{' '}
                  <span className="text-xs font-normal text-muted">
                    {formatMeetingDate(s.occurredAt)} ·{' '}
                    {formatClock(s.startSeconds)}
                  </span>
                </span>
                <span className="line-clamp-2 text-xs text-muted">
                  {preview(s.content)}
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ol>
    </details>
  );
}
