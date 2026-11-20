import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { chunkUtterances } from './chunker.js';
import { parseTranscript } from './transcript-parser.js';

// The demo transcripts in /samples must always parse cleanly.
const SAMPLES_DIR = join(
  import.meta.dirname,
  '../../../../samples/transcripts',
);
const files = readdirSync(SAMPLES_DIR).filter((f) => /\.(txt|md)$/.test(f));

describe('sample transcripts', () => {
  it('exist', () => {
    expect(files.length).toBeGreaterThanOrEqual(3);
  });

  it.each(files)('%s parses without warnings', (file) => {
    const parsed = parseTranscript(
      readFileSync(join(SAMPLES_DIR, file), 'utf8'),
    );

    expect(parsed.warnings).toEqual([]);
    expect(parsed.metadata.title).toBeTruthy();
    expect(parsed.metadata.occurredAt).toBeInstanceOf(Date);
    expect(chunkUtterances(parsed.utterances).length).toBeGreaterThan(0);
  });
});
