import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  UnsupportedMediaTypeException,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { z } from 'zod';
import { MeetingsService } from './meetings.service.js';
import type {
  IngestResult,
  MeetingDetail,
  MeetingSummary,
} from './meetings.types.js';

/** A two-hour transcript is ~150 KB; 1 MB leaves headroom without inviting abuse. */
export const MAX_TRANSCRIPT_BYTES = 1024 * 1024;
const ALLOWED_EXTENSIONS = ['.txt', '.md'];

const uploadBodySchema = z.object({
  title: z
    .string()
    .trim()
    .max(200)
    .optional()
    .transform((title) => title || undefined),
});

const meetingIdSchema = z.uuid();

@Controller('meetings')
export class MeetingsController {
  constructor(private readonly meetings: MeetingsService) {}

  /** multipart/form-data: `file` (required), `title` (optional). */
  @Post()
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: MAX_TRANSCRIPT_BYTES, files: 1 },
    }),
  )
  upload(
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body({ schema: uploadBodySchema }) body: z.infer<typeof uploadBodySchema>,
  ): Promise<IngestResult> {
    if (!file) {
      throw new BadRequestException(
        'A transcript file is required (field "file")',
      );
    }
    return this.meetings.ingest({
      content: decodeTranscript(file),
      filename: file.originalname,
      title: body.title,
    });
  }

  @Get()
  list(): Promise<MeetingSummary[]> {
    return this.meetings.list();
  }

  @Get(':id')
  get(
    @Param('id', { schema: meetingIdSchema }) id: string,
  ): Promise<MeetingDetail> {
    return this.meetings.get(id);
  }
}

/** Accepts only UTF-8 text files; rejects binaries renamed to .txt. */
function decodeTranscript(file: Express.Multer.File): string {
  const name = file.originalname.toLowerCase();
  if (!ALLOWED_EXTENSIONS.some((ext) => name.endsWith(ext))) {
    throw new UnsupportedMediaTypeException(
      `Unsupported file type. Allowed: ${ALLOWED_EXTENSIONS.join(', ')}`,
    );
  }
  try {
    const text = new TextDecoder('utf-8', { fatal: true }).decode(file.buffer);
    if (text.includes('\u0000')) throw new Error('NUL byte');
    return text;
  } catch {
    throw new UnsupportedMediaTypeException('File is not valid UTF-8 text');
  }
}
