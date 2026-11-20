import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { IndexingService } from '../../src/indexing/indexing.service.js';
import type { MeetingDetail } from '../../src/meetings/meetings.types.js';
import { PrismaService } from '../../src/prisma/prisma.service.js';
import { FakeEmbeddingProvider } from '../support/fake-embedding.provider.js';
import { createTestApp, resetDatabase } from '../support/test-app.js';

const SAMPLE = '2026-11-10-engineering-sync.txt';
const transcript = readFileSync(
  join(import.meta.dirname, '../../../../samples/transcripts', SAMPLE),
);

describe('Indexing (integration, real database)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let indexing: IndexingService;
  const embedder = new FakeEmbeddingProvider();

  const uploadAndWait = async () => {
    const res = await request(app.getHttpServer())
      .post('/api/meetings')
      .attach('file', transcript, SAMPLE)
      .expect(201);
    await indexing.whenIdle();
    return res.body as MeetingDetail;
  };

  const status = async (id: string) =>
    (await request(app.getHttpServer()).get(`/api/meetings/${id}`).expect(200))
      .body as MeetingDetail;

  const embeddedChunks = async (meetingId: string) => {
    const [row] = await prisma.$queryRaw<
      { embedded: number; models: string[] }[]
    >`
      SELECT count(*)::int AS embedded, array_agg(DISTINCT embedding_model) AS models
      FROM chunks
      WHERE meeting_id = ${meetingId}::uuid AND embedding IS NOT NULL`;
    return row;
  };

  beforeAll(async () => {
    app = await createTestApp(embedder);
    prisma = app.get(PrismaService);
    indexing = app.get(IndexingService);
  });

  beforeEach(async () => {
    embedder.failure = null;
    await resetDatabase(app);
  });

  afterAll(async () => {
    await resetDatabase(app);
    await app.close();
  });

  it('embeds every chunk after upload and marks the meeting READY', async () => {
    const meeting = await uploadAndWait();

    expect(meeting.status).toBe('PENDING');
    expect(await status(meeting.id)).toMatchObject({
      status: 'READY',
      error: null,
    });
    expect(await embeddedChunks(meeting.id)).toEqual({
      embedded: meeting.chunkCount,
      models: ['fake-embedding'],
    });
    expect(embedder.calls.at(-1)?.purpose).toBe('document');
  });

  it('marks the meeting FAILED with the reason when embedding fails', async () => {
    embedder.failure = new Error(
      'Ollama is unreachable at http://ollama:11434',
    );

    const meeting = await uploadAndWait();

    expect(await status(meeting.id)).toMatchObject({
      status: 'FAILED',
      error: 'Ollama is unreachable at http://ollama:11434',
    });
    expect((await embeddedChunks(meeting.id)).embedded).toBe(0);
  });

  it('re-indexes a FAILED meeting on request', async () => {
    embedder.failure = new Error('temporarily down');
    const meeting = await uploadAndWait();
    embedder.failure = null;

    const res = await request(app.getHttpServer())
      .post(`/api/meetings/${meeting.id}/index`)
      .expect(202);
    expect(res.body).toMatchObject({ status: 'PENDING', error: null });
    await indexing.whenIdle();

    expect((await status(meeting.id)).status).toBe('READY');
  });

  it('returns 404 when re-indexing an unknown meeting', async () => {
    await request(app.getHttpServer())
      .post('/api/meetings/7a0e6a8e-2f43-4a51-9c86-0c4b8f0e1d2a/index')
      .expect(404);
  });

  it('resumes unfinished meetings when the app starts', async () => {
    // Simulate a crash: the meeting was stored but never embedded.
    embedder.failure = new Error('crash');
    const meeting = await uploadAndWait();
    await prisma.meeting.update({
      where: { id: meeting.id },
      data: { status: 'PROCESSING', error: null },
    });

    const restarted = await createTestApp(new FakeEmbeddingProvider());
    try {
      await restarted.get(IndexingService).whenIdle();
      expect((await status(meeting.id)).status).toBe('READY');
    } finally {
      await restarted.close();
    }
  });

  it('refuses to start when stored vectors come from another model', async () => {
    await uploadAndWait();
    await prisma.$executeRaw`UPDATE chunks SET embedding_model = 'some-other-model'`;

    await expect(createTestApp()).rejects.toThrow(
      /"some-other-model".*EMBEDDING_MODEL is "fake-embedding"/,
    );
  });
});
