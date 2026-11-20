import { formatTimestamp } from './timestamp.js';
import { estimateTokens } from './tokens.js';
import type { ParsedUtterance } from './transcript-parser.js';

export interface ChunkOptions {
  /** Soft upper bound per chunk. A single longer turn becomes its own chunk. */
  maxTokens: number;
  /** How much trailing context to repeat at the start of the next chunk. */
  overlapTokens: number;
}

/**
 * ~400 tokens holds several back-and-forth turns, enough for a question and
 * its answer to land in the same chunk, while staying focused enough to rank
 * well. The overlap keeps a reply attached to what it replies to.
 */
export const DEFAULT_CHUNK_OPTIONS: ChunkOptions = {
  maxTokens: 400,
  overlapTokens: 80,
};

export interface TranscriptChunk {
  sequence: number;
  /** Lines formatted as "[hh:mm:ss] Speaker: text", which is also what gets embedded. */
  content: string;
  /** Distinct speakers, in order of first appearance. */
  speakers: string[];
  startSeconds: number;
  /** Start of the next turn after the chunk (or of its own last turn, at the end). */
  endSeconds: number;
  /** Inclusive range of utterance sequences covered by this chunk. */
  startUtterance: number;
  endUtterance: number;
  tokenCount: number;
}

export function formatUtterance(u: ParsedUtterance): string {
  return `[${formatTimestamp(u.startSeconds)}] ${u.speaker}: ${u.text}`;
}

/**
 * Groups consecutive whole speaker turns into chunks of about `maxTokens`.
 *
 * A turn is never split. That way every chunk maps back to exact transcript
 * lines for citations, and no chunk starts mid-sentence without its speaker.
 * Consecutive chunks overlap by whole turns, up to `overlapTokens`.
 */
export function chunkUtterances(
  utterances: readonly ParsedUtterance[],
  options: ChunkOptions = DEFAULT_CHUNK_OPTIONS,
): TranscriptChunk[] {
  const lines = utterances.map(formatUtterance);
  const lineTokens = lines.map(estimateTokens);
  const chunks: TranscriptChunk[] = [];

  let start = 0;
  // Every chunk must contain at least one turn the previous chunk didn't.
  let minEnd = 1;
  while (start < utterances.length) {
    // Grow the chunk until the next turn would exceed the budget.
    let end = start;
    let tokens = 0;
    while (
      end < utterances.length &&
      (end < minEnd || tokens + lineTokens[end] <= options.maxTokens)
    ) {
      tokens += lineTokens[end];
      end++;
    }

    chunks.push(buildChunk(chunks.length, utterances, lines, start, end));
    if (end === utterances.length) break;

    start = overlapStart(lineTokens, start, end, options.overlapTokens);
    minEnd = end + 1;
  }

  return chunks;
}

/** Where the next chunk starts: step back over whole turns within the overlap budget. */
function overlapStart(
  lineTokens: number[],
  chunkStart: number,
  chunkEnd: number,
  overlapTokens: number,
): number {
  let next = chunkEnd;
  let overlap = 0;
  while (
    next - 1 > chunkStart && // always make progress
    overlap + lineTokens[next - 1] <= overlapTokens
  ) {
    next--;
    overlap += lineTokens[next];
  }
  return next;
}

function buildChunk(
  sequence: number,
  utterances: readonly ParsedUtterance[],
  lines: string[],
  start: number,
  end: number,
): TranscriptChunk {
  const turns = utterances.slice(start, end);
  const content = lines.slice(start, end).join('\n');
  const last = turns[turns.length - 1];

  return {
    sequence,
    content,
    speakers: [...new Set(turns.map((u) => u.speaker))],
    startSeconds: turns[0].startSeconds,
    endSeconds: utterances[end]?.startSeconds ?? last.startSeconds,
    startUtterance: turns[0].sequence,
    endUtterance: last.sequence,
    tokenCount: estimateTokens(content),
  };
}
