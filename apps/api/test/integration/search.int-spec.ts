import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { IndexingService } from '../../src/indexing/indexing.service.js';
import type { IngestResult } from '../../src/meetings/meetings.types.js';
import { PrismaService } from '../../src/prisma/prisma.service.js';
import type { SearchResult } from '../../src/retrieval/retrieval.types.js';
import { createTestApp, resetDatabase } from '../support/test-app.js';

const SAMPLES = join(import.meta.dirname, '../../../../samples/transcripts');

describe('Search API (integration, real database)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const meetings = new Map<string, IngestResult>(); // by title

  const search = async (query: Record<string, string | string[]>) =>
    (
      await request(app.getHttpServer())
        .get('/api/search')
        .query(query)
        .expect(200)
    ).body as SearchResult;

  const meetingId = (titlePart: string) =>
    [...meetings.values()].find((m) => m.title.includes(titlePart))!.id;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    await resetDatabase(app);

    for (const file of readdirSync(SAMPLES)) {
      const res = await request(app.getHttpServer())
        .post('/api/meetings')
        .attach('file', readFileSync(join(SAMPLES, file)), file)
        .expect(201);
      meetings.set(res.body.title, res.body);
    }
    await app.get(IndexingService).whenIdle();
  });

  afterAll(async () => {
    await resetDatabase(app);
    await app.close();
  });

  describe('keyword retrieval', () => {
    it('finds exact jargon, ranking the densest matches first', async () => {
      const { hits } = await search({ q: 'payments SDK', mode: 'keyword' });

      // Both meetings discuss the SDK upgrade equally; their chunks tie.
      expect(
        hits
          .slice(0, 2)
          .map((h) => h.meetingTitle)
          .sort(),
      ).toEqual([
        'Mobile 2.0 engineering sync',
        'Mobile 2.0 launch go/no-go review',
      ]);
      expect(hits[0].content).toMatch(/payments SDK/);
      expect(hits[0].ranks).toEqual({ keyword: 1 });
    });

    it('breaks ties in favour of the more recent meeting', async () => {
      const { hits } = await search({ q: 'payments SDK', mode: 'keyword' });

      expect(hits[0].meetingTitle).toBe('Mobile 2.0 launch go/no-go review');
    });

    it('matches any of the words, not all of them', async () => {
      // No chunk contains every word; an AND query would return nothing.
      const { hits } = await search({
        q: 'what did the technicians say about the company code',
        mode: 'keyword',
      });

      expect(hits[0].meetingTitle).toBe('Onboarding usability review');
    });

    it('returns no keyword hits for a stopword-only query', async () => {
      const { hits } = await search({ q: 'what is the', mode: 'keyword' });

      expect(hits).toEqual([]);
    });
  });

  describe('semantic retrieval', () => {
    it('ranks the chunk with the most similar embedding first', async () => {
      // The fake embedder maps identical text to identical vectors, so a
      // query equal to a chunk's content must rank that chunk first.
      const res = await request(app.getHttpServer())
        .post('/api/meetings')
        .attach(
          'file',
          Buffer.from('[00:00:01] Zed: Kumquat forecast.'),
          'tiny.txt',
        )
        .expect(201);
      await app.get(IndexingService).whenIdle();
      const target = await prisma.chunk.findFirstOrThrow({
        where: { meetingId: res.body.id },
      });

      const { hits } = await search({ q: target.content, mode: 'semantic' });
      await prisma.meeting.delete({ where: { id: res.body.id } });

      expect(hits[0]).toMatchObject({
        chunkId: target.id,
        ranks: { semantic: 1 },
      });
    });
  });

  describe('hybrid retrieval', () => {
    it('combines both retrievers and returns full hit details', async () => {
      const { hits, mode } = await search({ q: 'payments SDK upgrade' });

      expect(mode).toBe('hybrid');
      expect(hits.length).toBeGreaterThan(0);
      expect(hits.some((h) => h.ranks.semantic && h.ranks.keyword)).toBe(true);
      expect(hits[0]).toMatchObject({
        meetingId: expect.any(String),
        startSeconds: expect.any(Number),
        startUtterance: expect.any(Number),
        speakers: expect.any(Array),
      });
    });

    it('still returns semantic hits when keyword search finds nothing', async () => {
      const { hits } = await search({ q: 'what is the' });

      expect(hits.length).toBeGreaterThan(0);
      expect(hits.every((h) => h.ranks.keyword === undefined)).toBe(true);
    });

    it('respects the limit', async () => {
      const { hits } = await search({ q: 'launch', limit: '2' });

      expect(hits).toHaveLength(2);
    });
  });

  describe('filters', () => {
    it('restricts results to the given meetings', async () => {
      const kickoff = meetingId('kickoff');

      const { hits } = await search({ q: 'launch date', meetingId: kickoff });

      expect(hits.length).toBeGreaterThan(0);
      expect(hits.every((h) => h.meetingId === kickoff)).toBe(true);
    });

    it('restricts results to chunks where a speaker talks', async () => {
      const { hits } = await search({ q: 'launch date', speaker: 'Dana Wu' });

      expect(hits.length).toBeGreaterThan(0);
      expect(hits.every((h) => h.speakers.includes('Dana Wu'))).toBe(true);
    });

    it('accepts several speakers', async () => {
      const { hits } = await search({
        q: 'onboarding',
        speaker: ['Dana Wu', 'Jin Park'],
      });

      expect(
        hits.every((h) =>
          h.speakers.some((s) => ['Dana Wu', 'Jin Park'].includes(s)),
        ),
      ).toBe(true);
    });

    it('never returns chunks of meetings that are not READY', async () => {
      const syncId = meetingId('engineering sync');
      await prisma.meeting.update({
        where: { id: syncId },
        data: { status: 'PROCESSING' },
      });
      try {
        const { hits } = await search({ q: 'payments SDK' });
        expect(hits.some((h) => h.meetingId === syncId)).toBe(false);
      } finally {
        await prisma.meeting.update({
          where: { id: syncId },
          data: { status: 'READY' },
        });
      }
    });
  });

  describe('validation', () => {
    it.each([
      [{}],
      [{ q: '   ' }],
      [{ q: 'x', mode: 'fuzzy' }],
      [{ q: 'x', limit: '0' }],
      [{ q: 'x', meetingId: 'not-a-uuid' }],
    ])('rejects %j with 400', async (query) => {
      await request(app.getHttpServer())
        .get('/api/search')
        .query(query)
        .expect(400);
    });
  });
});
