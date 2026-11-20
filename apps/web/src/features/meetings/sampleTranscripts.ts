/**
 * The demo transcripts from /samples, bundled into the app (~20 KB) so a
 * first-time visitor can load them with one click instead of hunting for files.
 */
const sources = import.meta.glob<string>(
  '../../../../../samples/transcripts/*.{txt,md}',
  { query: '?raw', import: 'default', eager: true },
);

export const SAMPLE_COUNT = Object.keys(sources).length;

export function sampleFiles(): File[] {
  return Object.entries(sources).map(([path, content]) => {
    const name = path.split('/').pop() ?? 'sample.txt';
    return new File([content], name, { type: 'text/plain' });
  });
}
