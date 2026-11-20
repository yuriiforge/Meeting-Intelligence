import type { MeetingStatus } from '../generated/prisma/client.js';
import type { ParseIssue } from '../transcripts/transcript-parser.js';

export interface MeetingSummary {
  id: string;
  title: string;
  status: MeetingStatus;
  /** Why indexing failed, when status is FAILED. */
  error: string | null;
  occurredAt: string | null;
  durationSeconds: number | null;
  sourceFilename: string | null;
  speakers: string[];
  utteranceCount: number;
  chunkCount: number;
  createdAt: string;
}

export interface UtteranceView {
  sequence: number;
  speaker: string;
  startSeconds: number;
  text: string;
}

export interface MeetingDetail extends MeetingSummary {
  utterances: UtteranceView[];
}

export interface IngestResult extends MeetingSummary {
  /** Non-fatal parser warnings, so the uploader can see what was skipped. */
  warnings: ParseIssue[];
}
