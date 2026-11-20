/** Parses "hh:mm:ss", "h:mm:ss" or "mm:ss" into seconds; null if malformed. */
export function parseTimestamp(value: string): number | null {
  const parts = value.split(':').map(Number);
  if (parts.length < 2 || parts.length > 3 || parts.some(Number.isNaN)) {
    return null;
  }
  const [seconds, minutes, hours = 0] = [...parts].reverse();
  if (seconds >= 60 || (parts.length === 3 && minutes >= 60)) {
    return null;
  }
  return hours * 3600 + minutes * 60 + seconds;
}

/** Formats seconds as "hh:mm:ss", the canonical form used in chunks and citations. */
export function formatTimestamp(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return [hours, minutes, seconds]
    .map((n) => String(n).padStart(2, '0'))
    .join(':');
}
