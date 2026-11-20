import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { AppModule } from './../src/app.module.js';
import { configureApp } from './../src/app.setup.js';
import { PrismaService } from './../src/prisma/prisma.service.js';

// Boots the real HTTP stack with the database swapped for a fake, so this
// suite runs without Postgres. DB-backed integration tests come separately.
describe('API (e2e)', () => {
  let app: INestApplication<App>;
  const prisma = {
    $connect: vi.fn(),
    $disconnect: vi.fn(),
    $queryRaw: vi.fn(),
    // Startup queries: resume unfinished indexing, check the embedding model.
    meeting: { findMany: vi.fn().mockResolvedValue([]) },
    chunk: { findMany: vi.fn().mockResolvedValue([]) },
  };

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .compile();

    app = configureApp(moduleFixture.createNestApplication());
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('GET /api/health returns 200 when the database is up', () => {
    prisma.$queryRaw.mockResolvedValueOnce([1]);

    return request(app.getHttpServer())
      .get('/api/health')
      .expect(200)
      .expect((res) => expect(res.body).toMatchObject({ database: 'up' }));
  });

  it('GET /api/health returns 503 when the database is down', () => {
    prisma.$queryRaw.mockRejectedValueOnce(new Error('connection refused'));

    return request(app.getHttpServer())
      .get('/api/health')
      .expect(503)
      .expect((res) => expect(res.body).toMatchObject({ database: 'down' }));
  });
});
