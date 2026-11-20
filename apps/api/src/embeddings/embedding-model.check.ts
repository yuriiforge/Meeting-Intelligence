import {
  Inject,
  Injectable,
  type OnApplicationBootstrap,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  EMBEDDING_PROVIDER,
  type EmbeddingProvider,
} from './embedding-provider.js';

/**
 * Refuses to start when stored vectors came from a different model than the
 * configured one. Vectors from different models live in unrelated spaces, so
 * mixing them makes similarity search silently return garbage.
 */
@Injectable()
export class EmbeddingModelCheck implements OnApplicationBootstrap {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(EMBEDDING_PROVIDER) private readonly embedder: EmbeddingProvider,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    const rows = await this.prisma.chunk.findMany({
      where: { embeddingModel: { not: null } },
      distinct: ['embeddingModel'],
      select: { embeddingModel: true },
    });
    const others = rows
      .map((r) => r.embeddingModel)
      .filter((model) => model !== this.embedder.model);

    if (others.length > 0) {
      throw new Error(
        `Stored embeddings were made with ${others.map((m) => `"${m}"`).join(', ')}, ` +
          `but EMBEDDING_MODEL is "${this.embedder.model}". ` +
          'Either set EMBEDDING_MODEL back, or clear the stored embeddings ' +
          "(UPDATE chunks SET embedding = NULL, embedding_model = NULL; UPDATE meetings SET status = 'PENDING') " +
          'and restart: pending meetings are re-embedded on startup.',
      );
    }
  }
}
