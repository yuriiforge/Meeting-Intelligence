// Mirrors apps/api/src/meetings/meetings.types.ts and retrieval.types.ts.
// Kept by hand for now; a shared package (or OpenAPI codegen) would remove
// the duplication once the API stabilises.

export type MeetingStatus = 'PENDING' | 'PROCESSING' | 'READY' | 'FAILED';

export interface MeetingSummary {
  id: string;
  title: string;
  status: MeetingStatus;
  error: string | null;
  occurredAt: string | null;
  durationSeconds: number | null;
  sourceFilename: string | null;
  speakers: string[];
  utteranceCount: number;
  chunkCount: number;
  createdAt: string;
}

export interface Utterance {
  sequence: number;
  speaker: string;
  startSeconds: number;
  text: string;
}

export interface MeetingDetail extends MeetingSummary {
  utterances: Utterance[];
}

export interface ParseIssue {
  line: number;
  message: string;
}

export interface IngestResult extends MeetingSummary {
  warnings: ParseIssue[];
}

export type SearchMode = 'hybrid' | 'semantic' | 'keyword';

export interface SearchHit {
  chunkId: string;
  meetingId: string;
  meetingTitle: string;
  occurredAt: string | null;
  sequence: number;
  content: string;
  speakers: string[];
  startSeconds: number;
  endSeconds: number;
  startUtterance: number;
  endUtterance: number;
  score: number;
  ranks: { semantic?: number; keyword?: number };
}

export interface SearchResult {
  query: string;
  mode: SearchMode;
  hits: SearchHit[];
  tookMs: number;
}

export interface SearchParams {
  q: string;
  meetingId?: string;
  speaker?: string;
  mode?: SearchMode;
}
