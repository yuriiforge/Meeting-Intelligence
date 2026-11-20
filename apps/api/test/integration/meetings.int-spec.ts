import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { MAX_TRANSCRIPT_BYTES } from '../../src/meetings/meetings.controller.js';
import type {
  IngestResult,
  MeetingDetail,
  MeetingSummary,
} from '../../src/meetings/meetings.types.js';
import { PrismaService } from '../../src/prisma/prisma.service.js';
import { createTestApp, resetDatabase } from '../support/test-app.js';

const SAMPLES = join(import.meta.dirname, '../../../../samples/transcripts');
const KICKOFF = '2026-11-03-mobile-2-0-kickoff.txt';
const ENG_SYNC = '2026-11-10-engineering-sync.txt';

const sample = (file: string) => readFileSync(join(SAMPLES, file));

describe('Meetings API (integration, real database)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  const upload = (content: Buffer | string, filename: string) =>
    request(app.getHttpServer())
      .post('/api/meetings')
      .attach('file', Buffer.from(content), filename);

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
  });

  beforeEach(async () => {
    await resetDatabase(app);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /api/meetings', () => {
    it('stores the meeting, its utterances and chunks', async () => {
      const res = await upload(sample(KICKOFF), KICKOFF).expect(201);
      const body = res.body as IngestResult;

      expect(body).toMatchObject({
        title: 'Mobile 2.0 kickoff and planning',
        status: 'PENDING',
        occurredAt: '2026-11-03T00:00:00.000Z',
        sourceFilename: KICKOFF,
        warnings: [],
      });
      expect(body.speakers).toEqual([
        'Priya Shah',
        'Marcus Chen',
        'Elena Rossi',
        'Tom Becker',
        'Sam Okafor',
      ]);

      const [utterances, chunks] = await Promise.all([
        prisma.utterance.count({ where: { meetingId: body.id } }),
        prisma.chunk.findMany({
          where: { meetingId: body.id },
          orderBy: { sequence: 'asc' },
        }),
      ]);
      expect(utterances).toBe(body.utteranceCount);
      expect(chunks).toHaveLength(body.chunkCount);
      expect(chunks.length).toBeGreaterThan(1);
      // Chunks cover the whole transcript.
      expect(chunks[0].startUtterance).toBe(0);
      expect(chunks.at(-1)?.endUtterance).toBe(utterances - 1);
    });

    it('lets the form field override the title', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/meetings')
        .field('title', 'Custom title')
        .attach('file', sample(KICKOFF), KICKOFF)
        .expect(201);

      expect(res.body.title).toBe('Custom title');
    });

    it('falls back to the filename when there is no title header', async () => {
      const res = await upload(
        '[00:00:01] Alice: hi',
        'weekly_team-sync.txt',
      ).expect(201);

      expect(res.body.title).toBe('weekly team sync');
    });

    it('rejects an unparseable transcript with 422 and stores nothing', async () => {
      const res = await upload(
        'Just some notes, no speakers.',
        'notes.txt',
      ).expect(422);

      expect(res.body.message).toMatch(/No speaker turns/);
      expect(res.body.issues).toEqual([
        { line: 1, message: expect.any(String) },
      ]);
      expect(await prisma.meeting.count()).toBe(0);
    });

    it('rejects a request without a file with 400', async () => {
      await request(app.getHttpServer()).post('/api/meetings').expect(400);
    });

    it('rejects unsupported file types with 415', async () => {
      await upload('[00:00:01] Alice: hi', 'transcript.pdf').expect(415);
    });

    it('rejects binary content disguised as .txt with 415', async () => {
      await upload(Buffer.from([0xff, 0xfe, 0x00, 0x01]), 'fake.txt').expect(
        415,
      );
    });

    it('rejects files over the size limit with 413', async () => {
      const huge = `[00:00:01] Alice: ${'x'.repeat(MAX_TRANSCRIPT_BYTES)}`;
      await upload(huge, 'huge.txt').expect(413);
    });
  });

  describe('GET /api/meetings', () => {
    it('lists meetings, most recent first, with speakers', async () => {
      await upload(sample(KICKOFF), KICKOFF).expect(201);
      await upload(sample(ENG_SYNC), ENG_SYNC).expect(201);

      const res = await request(app.getHttpServer())
        .get('/api/meetings')
        .expect(200);
      const meetings = res.body as MeetingSummary[];

      expect(meetings.map((m) => m.title)).toEqual([
        'Mobile 2.0 engineering sync',
        'Mobile 2.0 kickoff and planning',
      ]);
      expect(meetings[0].speakers[0]).toBe('Marcus Chen');
      expect(meetings[0].utteranceCount).toBeGreaterThan(0);
    });
  });

  describe('GET /api/meetings/:id', () => {
    it('returns the transcript in order', async () => {
      const created = await upload(sample(ENG_SYNC), ENG_SYNC).expect(201);

      const res = await request(app.getHttpServer())
        .get(`/api/meetings/${created.body.id}`)
        .expect(200);
      const meeting = res.body as MeetingDetail;

      expect(meeting.utterances).toHaveLength(created.body.utteranceCount);
      expect(meeting.utterances.map((u) => u.sequence)).toEqual(
        meeting.utterances.map((_, i) => i),
      );
      expect(meeting.utterances[0]).toMatchObject({
        speaker: 'Marcus Chen',
        startSeconds: 2,
      });
    });

    it('returns 404 for an unknown id', async () => {
      await request(app.getHttpServer())
        .get('/api/meetings/7a0e6a8e-2f43-4a51-9c86-0c4b8f0e1d2a')
        .expect(404);
    });

    it('returns 400 for a malformed id', async () => {
      await request(app.getHttpServer())
        .get('/api/meetings/not-a-uuid')
        .expect(400);
    });
  });
});
