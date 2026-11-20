import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { App } from 'supertest/types.js';
import { AppModule } from '../../src/app.module.js';
import { configureApp } from '../../src/app.setup.js';
import { EMBEDDING_PROVIDER } from '../../src/embeddings/embedding-provider.js';
import { IndexingService } from '../../src/indexing/indexing.service.js';
import { PrismaService } from '../../src/prisma/prisma.service.js';
import { FakeEmbeddingProvider } from './fake-embedding.provider.js';

/**
 * Boots the full app against the real (test) database, with the embedding
 * model replaced by a deterministic fake so no Ollama is needed.
 */
export async function createTestApp(
  embedder: FakeEmbeddingProvider = new FakeEmbeddingProvider(),
): Promise<INestApplication<App>> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(EMBEDDING_PROVIDER)
    .useValue(embedder)
    .compile();
  const app = configureApp(moduleRef.createNestApplication());
  await app.init();
  return app as INestApplication<App>;
}

/** Waits for background indexing, then empties every table. */
export async function resetDatabase(app: INestApplication): Promise<void> {
  await app.get(IndexingService).whenIdle();
  await app.get(PrismaService).$executeRaw`TRUNCATE TABLE meetings CASCADE`;
}
