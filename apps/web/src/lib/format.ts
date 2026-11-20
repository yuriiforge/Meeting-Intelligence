/** 754 -> "12:34", 3723 -> "1:02:03" (short form for UI labels). */
export function formatClock(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const ss = String(seconds).padStart(2, '0');
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, '0')}:${ss}`
    : `${minutes}:${ss}`;
}

/** 330 -> "6 min", 3900 -> "1 h 5 min". Null when unknown. */
export function formatDuration(totalSeconds: number | null): string | null {
  if (totalSeconds === null) return null;
  const minutes = Math.max(1, Math.round(totalSeconds / 60));
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`;
}

/**
 * "Nov 3, 2026". Transcript dates are calendar dates without a time zone,
 * stored as midnight UTC, so they are formatted in UTC to avoid showing the
 * previous day west of Greenwich.
 */
export function formatMeetingDate(iso: string | null): string | null {
  if (!iso) return null;
  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(iso));
}

/** "Priya Shah" -> "PS", "Participant 3" -> "P3". */
export function initials(name: string): string {
  const words = name
    .replace(/\(.*?\)/g, '')
    .trim()
    .split(/\s+/);
  const letters = words.map((w) => w[0] ?? '').join('');
  return letters.slice(0, 2).toUpperCase();
}
