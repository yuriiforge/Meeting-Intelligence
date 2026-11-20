import { initials } from '../lib/format';
import { speakerColor } from '../lib/speakers';

export function SpeakerAvatar({
  name,
  size = 'md',
}: {
  name: string;
  size?: 'sm' | 'md';
}) {
  const dimensions = size === 'sm' ? 'size-7 text-[10px]' : 'size-8 text-xs';
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-semibold ring-2 ring-surface ${dimensions} ${speakerColor(name)}`}
      title={name}
      aria-hidden
    >
      {initials(name)}
    </span>
  );
}

/** Overlapping avatars, e.g. on meeting cards. */
export function SpeakerStack({
  speakers,
  max = 5,
}: {
  speakers: string[];
  max?: number;
}) {
  const shown = speakers.slice(0, max);
  const hidden = speakers.length - shown.length;
  return (
    <div
      className="flex items-center -space-x-1"
      aria-label={`Speakers: ${speakers.join(', ')}`}
    >
      {shown.map((name) => (
        <SpeakerAvatar key={name} name={name} size="sm" />
      ))}
      {hidden > 0 && (
        <span className="inline-flex size-7 items-center justify-center rounded-full bg-raised text-[10px] font-semibold text-muted ring-2 ring-surface">
          +{hidden}
        </span>
      )}
    </div>
  );
}
