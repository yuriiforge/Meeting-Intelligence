/**
 * Distinct, readable colours (light and dark mode) for speaker avatars and
 * transcript names. Chosen by hashing the name, so a person keeps the same
 * colour on every page and in every meeting.
 */
const PALETTE = [
  'bg-indigo-100 text-indigo-800 dark:bg-indigo-500/20 dark:text-indigo-200',
  'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-200',
  'bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-200',
  'bg-rose-100 text-rose-800 dark:bg-rose-500/20 dark:text-rose-200',
  'bg-sky-100 text-sky-800 dark:bg-sky-500/20 dark:text-sky-200',
  'bg-violet-100 text-violet-800 dark:bg-violet-500/20 dark:text-violet-200',
  'bg-teal-100 text-teal-800 dark:bg-teal-500/20 dark:text-teal-200',
  'bg-orange-100 text-orange-800 dark:bg-orange-500/20 dark:text-orange-200',
] as const;

export function speakerColor(name: string): string {
  let hash = 0;
  for (const char of name) {
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  }
  return PALETTE[hash % PALETTE.length];
}
