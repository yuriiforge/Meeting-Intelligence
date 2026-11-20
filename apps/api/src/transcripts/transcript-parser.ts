import { parseTimestamp } from './timestamp.js';

export interface ParsedUtterance {
  /** 0-based position in the transcript. */
  sequence: number;
  speaker: string;
  startSeconds: number;
  text: string;
}

export interface TranscriptMetadata {
  title?: string;
  occurredAt?: Date;
}

export interface ParseIssue {
  /** 1-based line number in the source file. */
  line: number;
  message: string;
}

export interface ParsedTranscript {
  metadata: TranscriptMetadata;
  utterances: ParsedUtterance[];
  /** Non-fatal problems: the transcript is usable, but something was skipped. */
  warnings: ParseIssue[];
}

/** Internal: keeps the source line so later checks can report it. */
interface SourcedUtterance extends ParsedUtterance {
  line: number;
}

export class TranscriptParseError extends Error {
  constructor(
    message: string,
    readonly issues: ParseIssue[] = [],
  ) {
    super(message);
    this.name = 'TranscriptParseError';
  }
}

/**
 * Matches one speaker turn. Accepted forms:
 *   [00:12:34] Alice: text
 *   [12:34] Alice Smith (PM): text
 *   00:12:34 Alice: text
 * The speaker label cannot contain ":" so the first colon after it ends it.
 */
const UTTERANCE_LINE =
  /^\[?(?<timestamp>\d{1,2}(?::\d{1,2}){1,2})\]?\s+(?<speaker>[^:[\]]{1,80}?)\s*:\s*(?<text>.*)$/;

/** Optional header lines before the first turn, e.g. "Title: Weekly sync". */
const HEADER_LINE = /^(?<key>title|date)\s*:\s*(?<value>.+)$/i;
const MARKDOWN_TITLE = /^#\s+(?<value>.+)$/;

/**
 * Parses a plain-text meeting transcript into speaker turns.
 *
 * Lines without a timestamp after the first turn are treated as a
 * continuation of the previous turn (transcripts often wrap long speech).
 * Throws TranscriptParseError when no speaker turns can be found.
 */
export function parseTranscript(source: string): ParsedTranscript {
  // Drop a UTF-8 byte order mark, which some editors put at the file start.
  const text = source.charCodeAt(0) === 0xfeff ? source.slice(1) : source;
  const lines = text.split(/\r?\n/);
  const metadata: TranscriptMetadata = {};
  const utterances: SourcedUtterance[] = [];
  const warnings: ParseIssue[] = [];

  lines.forEach((rawLine, index) => {
    const lineNumber = index + 1;
    const line = rawLine.trim();
    if (line === '') return;

    const turn = UTTERANCE_LINE.exec(line)?.groups;
    if (turn) {
      const startSeconds = parseTimestamp(turn.timestamp);
      if (startSeconds === null) {
        warnings.push({
          line: lineNumber,
          message: `Invalid timestamp "${turn.timestamp}"; line skipped`,
        });
        return;
      }
      const previous = utterances.at(-1);
      if (previous && startSeconds < previous.startSeconds) {
        warnings.push({
          line: lineNumber,
          message: 'Timestamp is earlier than the previous line',
        });
      }
      utterances.push({
        sequence: utterances.length,
        speaker: turn.speaker.replace(/\s+/g, ' '),
        startSeconds,
        text: turn.text.trim(),
        line: lineNumber,
      });
      return;
    }

    const current = utterances.at(-1);
    if (current) {
      current.text = current.text ? `${current.text} ${line}` : line;
      return;
    }

    if (readHeader(line, lineNumber, metadata, warnings)) return;

    warnings.push({
      line: lineNumber,
      message: 'Not a speaker turn or header; line ignored',
    });
  });

  const spoken = dropEmptyTurns(utterances, warnings);
  if (spoken.length === 0) {
    throw new TranscriptParseError(
      'No speaker turns found. Expected lines like "[00:12:34] Alice: ..."',
      warnings,
    );
  }

  return { metadata, utterances: spoken, warnings };
}

function readHeader(
  line: string,
  lineNumber: number,
  metadata: TranscriptMetadata,
  warnings: ParseIssue[],
): boolean {
  const markdownTitle = MARKDOWN_TITLE.exec(line)?.groups;
  if (markdownTitle) {
    metadata.title ??= markdownTitle.value.trim();
    return true;
  }

  const header = HEADER_LINE.exec(line)?.groups;
  if (!header) return false;

  const value = header.value.trim();
  if (header.key.toLowerCase() === 'title') {
    metadata.title = value;
  } else {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      warnings.push({
        line: lineNumber,
        message: `Unrecognised date "${value}"`,
      });
    } else {
      metadata.occurredAt = date;
    }
  }
  return true;
}

/** Removes turns with no text (e.g. "[00:01:00] Bob:") and renumbers the rest. */
function dropEmptyTurns(
  utterances: SourcedUtterance[],
  warnings: ParseIssue[],
): ParsedUtterance[] {
  for (const u of utterances) {
    if (u.text === '') {
      warnings.push({
        line: u.line,
        message: 'Speaker turn has no text; skipped',
      });
    }
  }
  return utterances
    .filter((u) => u.text !== '')
    .map(({ speaker, startSeconds, text }, sequence) => ({
      sequence,
      speaker,
      startSeconds,
      text,
    }));
}
