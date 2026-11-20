import type { PrismaService } from '../prisma/prisma.service.js';
import { EmbeddingModelCheck } from './embedding-model.check.js';
import type { EmbeddingProvider } from './embedding-provider.js';

function check(storedModels: string[]) {
  const prisma = {
    chunk: {
      findMany: vi.fn(() =>
        Promise.resolve(
          storedModels.map((embeddingModel) => ({ embeddingModel })),
        ),
      ),
    },
  } as unknown as PrismaService;
  const embedder = { model: 'nomic-embed-text' } as EmbeddingProvider;
  return new EmbeddingModelCheck(prisma, embedder);
}

describe('EmbeddingModelCheck', () => {
  it('passes when nothing is embedded yet', async () => {
    await expect(check([]).onApplicationBootstrap()).resolves.toBeUndefined();
  });

  it('passes when stored vectors match the configured model', async () => {
    await expect(
      check(['nomic-embed-text']).onApplicationBootstrap(),
    ).resolves.toBeUndefined();
  });

  it('refuses to start when stored vectors come from another model', async () => {
    await expect(
      check(['nomic-embed-text', 'mxbai-embed-large']).onApplicationBootstrap(),
    ).rejects.toThrow(
      /"mxbai-embed-large".*EMBEDDING_MODEL is "nomic-embed-text"/,
    );
  });
});
