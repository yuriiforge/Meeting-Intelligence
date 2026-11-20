import { Fragment } from 'react';
import { Link } from 'react-router';
import type { ChatSource } from '../../api/chat';
import { parseAnswer, type Inline } from '../../lib/answer';
import { formatClock } from '../../lib/format';
import { rangeToParams } from '../../lib/range';

interface Props {
  text: string;
  sources: ChatSource[];
  streaming: boolean;
}

/** The answer text, with each [n] rendered as a link to the cited lines. */
export function Answer({ text, sources, streaming }: Props) {
  const byNumber = new Map(sources.map((s) => [s.number, s]));
  const blocks = parseAnswer(text);

  return (
    <div className="space-y-3 text-[15px] leading-relaxed">
      {blocks.map((block, index) =>
        block.kind === 'paragraph' ? (
          <p key={index}>
            <InlineParts parts={block.inline} sources={byNumber} />
          </p>
        ) : (
          <ul key={index} className="list-disc space-y-1 pl-5">
            {block.items.map((item, i) => (
              <li key={i}>
                <InlineParts parts={item} sources={byNumber} />
              </li>
            ))}
          </ul>
        ),
      )}
      {streaming && (
        <span
          className="inline-block h-4 w-1.5 animate-pulse rounded-sm bg-accent align-middle"
          aria-hidden
        />
      )}
    </div>
  );
}

function InlineParts({
  parts,
  sources,
}: {
  parts: Inline[];
  sources: Map<number, ChatSource>;
}) {
  return (
    <>
      {parts.map((part, index) => {
        if (part.kind === 'text')
          return <Fragment key={index}>{part.text}</Fragment>;
        if (part.kind === 'bold')
          return <strong key={index}>{part.text}</strong>;
        return (
          <span
            key={index}
            className="ml-0.5 inline-flex gap-0.5 align-baseline"
          >
            {part.numbers.map((n) => (
              <CitationChip key={n} number={n} source={sources.get(n)} />
            ))}
          </span>
        );
      })}
    </>
  );
}

export function CitationChip({
  number,
  source,
}: {
  number: number;
  source?: ChatSource;
}) {
  if (!source) {
    // The model cited a source it was never given; show it, but as unverified.
    return (
      <span
        className="rounded px-1 text-[11px] font-medium text-faint line-through"
        title="This citation doesn't match any source"
      >
        {number}
      </span>
    );
  }
  const label = `${source.meetingTitle}, ${formatClock(source.startSeconds)}`;
  return (
    <Link
      to={`/meetings/${source.meetingId}?${rangeToParams({ from: source.startUtterance, to: source.endUtterance })}`}
      className="rounded bg-accent-soft px-1.5 text-[11px] font-semibold leading-5 text-accent-ink hover:bg-accent hover:text-on-accent"
      title={label}
      aria-label={`Source ${number}: ${label}`}
    >
      {number}
    </Link>
  );
}
