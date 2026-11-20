import { useEffect, useRef } from 'react';
import type { Utterance } from '../../api/types';
import { SpeakerAvatar } from '../../components/Speakers';
import { formatClock } from '../../lib/format';
import type { UtteranceRange } from '../../lib/range';

interface Props {
  utterances: Utterance[];
  /** Turns to highlight and scroll to, e.g. the lines a search hit points at. */
  highlight?: UtteranceRange | null;
}

export function Transcript({ utterances, highlight }: Props) {
  const firstHighlighted = useRef<HTMLLIElement>(null);

  useEffect(() => {
    firstHighlighted.current?.scrollIntoView({
      behavior: 'smooth',
      block: 'center',
    });
  }, [highlight?.from, highlight?.to]);

  return (
    <ol className="space-y-1" aria-label="Transcript">
      {utterances.map((u, index) => {
        const isHighlighted =
          highlight != null &&
          u.sequence >= highlight.from &&
          u.sequence <= highlight.to;
        // Consecutive turns by the same person are grouped visually.
        const sameSpeaker = utterances[index - 1]?.speaker === u.speaker;

        return (
          <li
            key={u.sequence}
            id={`turn-${u.sequence}`}
            ref={
              isHighlighted && u.sequence === highlight.from
                ? firstHighlighted
                : undefined
            }
            data-highlighted={isHighlighted || undefined}
            className={`group flex gap-3 rounded-lg px-3 py-2 ${
              isHighlighted ? 'bg-highlight/70' : 'hover:bg-raised'
            } ${sameSpeaker ? '' : 'mt-3'}`}
          >
            <div className="w-8 shrink-0">
              {!sameSpeaker && <SpeakerAvatar name={u.speaker} />}
            </div>
            <div className="min-w-0 flex-1">
              {!sameSpeaker && (
                <div className="mb-0.5 text-sm font-semibold">{u.speaker}</div>
              )}
              <p className="text-[15px] leading-relaxed">{u.text}</p>
            </div>
            <a
              href={`#turn-${u.sequence}`}
              className="shrink-0 pt-0.5 font-mono text-xs text-faint hover:text-accent"
              title="Link to this moment"
            >
              {formatClock(u.startSeconds)}
            </a>
          </li>
        );
      })}
    </ol>
  );
}
