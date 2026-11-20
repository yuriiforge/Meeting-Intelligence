import {
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import type { Meeting } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { chunkUtterances } from '../transcripts/chunker.js';
import {
  parseTranscript,
  TranscriptParseError,
  type ParsedTranscript,
} from '../transcripts/transcript-parser.js';
import type {
  IngestResult,
  MeetingDetail,
  MeetingSummary,
} from './meetings.types.js';

export interface IngestInput {
  content: string;
  filename: string;
  /** Overrides the title from the transcript header and the filename. */
  title?: string;
}

@Injectable()
export class MeetingsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Parses and stores a transcript: the meeting, every utterance and every
   * chunk, in one transaction, so a failure never leaves a half-saved meeting.
   *
   * Embedding is a separate step, so meetings start as PENDING.
   */
  async ingest(input: IngestInput): Promise<IngestResult> {
    const parsed = this.parse(input.content);
    const chunks = chunkUtterances(parsed.utterances);
    const lastTurn = parsed.utterances.at(-1);

    const meeting = await this.prisma.meeting.create({
      data: {
        title:
          input.title ??
          parsed.metadata.title ??
          titleFromFilename(input.filename),
        occurredAt: parsed.metadata.occurredAt ?? null,
        durationSeconds: lastTurn?.startSeconds ?? null,
        sourceFilename: input.filename,
        utterances: { createMany: { data: parsed.utterances } },
        chunks: { createMany: { data: chunks } },
      },
    });

    return {
      ...toSummary(meeting, {
        speakers: distinctSpeakers(parsed.utterances),
        utteranceCount: parsed.utterances.length,
        chunkCount: chunks.length,
      }),
      warnings: parsed.warnings,
    };
  }

  /** Newest meetings first, by when they happened (then by upload time). */
  async list(): Promise<MeetingSummary[]> {
    const meetings = await this.prisma.meeting.findMany({
      orderBy: [
        { occurredAt: { sort: 'desc', nulls: 'last' } },
        { createdAt: 'desc' },
      ],
      include: { _count: { select: { utterances: true, chunks: true } } },
    });
    const speakers = await this.speakersByMeeting(meetings.map((m) => m.id));

    return meetings.map((m) =>
      toSummary(m, {
        speakers: speakers.get(m.id) ?? [],
        utteranceCount: m._count.utterances,
        chunkCount: m._count.chunks,
      }),
    );
  }

  async get(id: string): Promise<MeetingDetail> {
    const meeting = await this.prisma.meeting.findUnique({
      where: { id },
      include: {
        utterances: {
          orderBy: { sequence: 'asc' },
          select: {
            sequence: true,
            speaker: true,
            startSeconds: true,
            text: true,
          },
        },
        _count: { select: { chunks: true } },
      },
    });
    if (!meeting) {
      throw new NotFoundException(`Meeting ${id} not found`);
    }

    return {
      ...toSummary(meeting, {
        speakers: distinctSpeakers(meeting.utterances),
        utteranceCount: meeting.utterances.length,
        chunkCount: meeting._count.chunks,
      }),
      utterances: meeting.utterances,
    };
  }

  private parse(content: string): ParsedTranscript {
    try {
      return parseTranscript(content);
    } catch (error) {
      if (error instanceof TranscriptParseError) {
        throw new UnprocessableEntityException({
          message: error.message,
          issues: error.issues,
        });
      }
      throw error;
    }
  }

  /** Speakers per meeting in order of first appearance, in one query. */
  private async speakersByMeeting(
    meetingIds: string[],
  ): Promise<Map<string, string[]>> {
    const rows = await this.prisma.utterance.groupBy({
      by: ['meetingId', 'speaker'],
      where: { meetingId: { in: meetingIds } },
      _min: { sequence: true },
      orderBy: { _min: { sequence: 'asc' } },
    });

    const result = new Map<string, string[]>();
    for (const row of rows) {
      const list = result.get(row.meetingId) ?? [];
      list.push(row.speaker);
      result.set(row.meetingId, list);
    }
    return result;
  }
}

function toSummary(
  meeting: Meeting,
  extra: Pick<MeetingSummary, 'speakers' | 'utteranceCount' | 'chunkCount'>,
): MeetingSummary {
  return {
    id: meeting.id,
    title: meeting.title,
    status: meeting.status,
    occurredAt: meeting.occurredAt?.toISOString() ?? null,
    durationSeconds: meeting.durationSeconds,
    sourceFilename: meeting.sourceFilename,
    createdAt: meeting.createdAt.toISOString(),
    ...extra,
  };
}

function distinctSpeakers(utterances: { speaker: string }[]): string[] {
  return [...new Set(utterances.map((u) => u.speaker))];
}

/** "2026-11-03-weekly_sync.txt" -> "2026 11 03 weekly sync" */
export function titleFromFilename(filename: string): string {
  const base = filename
    .replace(/\.[^.]+$/, '')
    .replace(/[-_]+/g, ' ')
    .trim();
  return base || 'Untitled meeting';
}
