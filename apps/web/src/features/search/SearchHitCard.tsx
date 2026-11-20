import { ArrowUpRight } from 'lucide-react';
import { Link } from 'react-router';
import type { SearchHit } from '../../api/types';
import { formatClock, formatMeetingDate } from '../../lib/format';
import { highlightTerms } from '../../lib/highlight';
import { rangeToParams } from '../../lib/range';

/** Chunk lines look like "[00:12:34] Speaker: text". */
const LINE = /^\[(?<time>[\d:]+)\]\s+(?<speaker>[^:]+):\s*(?<text>.*)$/;

export function SearchHitCard({
  hit,
  query,
}: {
  hit: SearchHit;
  query: string;
}) {
  const lines = hit.content.split('\n').map((line) => LINE.exec(line)?.groups);
  const link = `/meetings/${hit.meetingId}?${rangeToParams({ from: hit.startUtterance, to: hit.endUtterance })}`;

  return (
    <article className="rounded-xl border border-line bg-surface p-4">
      <header className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1">
        <Link to={link} className="font-semibold hover:text-accent">
          {hit.meetingTitle}
        </Link>
        <span className="text-xs text-muted">
          {formatMeetingDate(hit.occurredAt)} · {formatClock(hit.startSeconds)}–
          {formatClock(hit.endSeconds)}
        </span>
        <span className="ml-auto flex gap-1">
          <RankBadge label="semantic" rank={hit.ranks.semantic} />
          <RankBadge label="keyword" rank={hit.ranks.keyword} />
        </span>
      </header>

      <div className="space-y-1.5 border-l-2 border-line pl-3 text-sm">
        {lines.map((line, index) =>
          line ? (
            <p key={index} className="leading-relaxed">
              <span className="font-semibold">{line.speaker}:</span>{' '}
              <Highlighted text={line.text} query={query} />
            </p>
          ) : null,
        )}
      </div>

      <Link
        to={link}
        className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-accent hover:underline"
      >
        Open in transcript
        <ArrowUpRight className="size-3.5" aria-hidden />
      </Link>
    </article>
  );
}

/** Shows which retriever found the hit; this is what "hybrid" means in practice. */
function RankBadge({ label, rank }: { label: string; rank?: number }) {
  if (rank === undefined) return null;
  return (
    <span
      className="rounded-full bg-raised px-2 py-0.5 text-[11px] font-medium text-muted"
      title={`Ranked #${rank} by ${label} search`}
    >
      {label} #{rank}
    </span>
  );
}

function Highlighted({ text, query }: { text: string; query: string }) {
  return (
    <>
      {highlightTerms(text, query).map((part, index) =>
        part.match ? (
          <mark key={index}>{part.text}</mark>
        ) : (
          <span key={index}>{part.text}</span>
        ),
      )}
    </>
  );
}
