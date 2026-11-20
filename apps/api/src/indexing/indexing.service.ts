import {
  Inject,
  Injectable,
  Logger,
  type OnApplicationBootstrap,
} from '@nestjs/common';
import {
  EMBEDDING_PROVIDER,
  toPgVector,
  type EmbeddingProvider,
} from '../embeddings/embedding-provider.js';
import { PrismaService } from '../prisma/prisma.service.js';

/**
 * Embeds a meeting's chunks in the background and moves the meeting from
 * PENDING through PROCESSING to READY, or to FAILED with the error.
 *
 * The queue is in-process and runs one meeting at a time. Local CPU embedding
 * is the bottleneck, so parallel jobs would only compete for it. Jobs don't
 * survive a restart, but nothing is lost: unfinished meetings are re-queued
 * on startup. A production setup would use a durable queue (see README).
 */
@Injectable()
export class IndexingService implements OnApplicationBootstrap {
  private readonly logger = new Logger(IndexingService.name);
  private tail: Promise<void> = Promise.resolve();
  private readonly queued = new Set<string>();

  constructor(
    private readonly prisma: PrismaService,
    @Inject(EMBEDDING_PROVIDER) private readonly embedder: EmbeddingProvider,
  ) {}

  /** Re-queues meetings left unfinished by a restart or crash. */
  async onApplicationBootstrap(): Promise<void> {
    const unfinished = await this.prisma.meeting.findMany({
      where: { status: { in: ['PENDING', 'PROCESSING'] } },
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    });
    if (unfinished.length > 0) {
      this.logger.log(`Resuming indexing of ${unfinished.length} meeting(s)`);
    }
    unfinished.forEach((m) => this.enqueue(m.id));
  }

  /** Schedules a meeting for embedding. A meeting already queued isn't added twice. */
  enqueue(meetingId: string): void {
    if (this.queued.has(meetingId)) return;
    this.queued.add(meetingId);
    this.tail = this.tail.then(async () => {
      this.queued.delete(meetingId);
      await this.indexMeeting(meetingId);
    });
  }

  /** Resolves once everything queued so far has been processed. */
  whenIdle(): Promise<void> {
    return this.tail;
  }

  /** Never throws: failures are recorded on the meeting instead. */
  async indexMeeting(meetingId: string): Promise<void> {
    const startedAt = Date.now();
    try {
      await this.prisma.meeting.update({
        where: { id: meetingId },
        data: { status: 'PROCESSING', error: null },
      });

      const chunks = await this.prisma.chunk.findMany({
        where: { meetingId },
        orderBy: { sequence: 'asc' },
        select: { id: true, content: true },
      });
      const vectors = await this.embedder.embed(
        chunks.map((c) => c.content),
        'document',
      );

      // One UPDATE for all chunks; the vector type isn't supported by the
      // Prisma client, so this goes through raw SQL with bound parameters.
      await this.prisma.$transaction([
        this.prisma.$executeRaw`
          UPDATE chunks AS c
          SET embedding = v.embedding::vector, embedding_model = ${this.embedder.model}
          FROM unnest(${chunks.map((c) => c.id)}::uuid[], ${vectors.map(toPgVector)}::text[])
            AS v(id, embedding)
          WHERE c.id = v.id`,
        this.prisma.meeting.update({
          where: { id: meetingId },
          data: { status: 'READY' },
        }),
      ]);

      this.logger.log(
        `Indexed meeting ${meetingId}: ${chunks.length} chunks in ${Date.now() - startedAt} ms`,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Indexing meeting ${meetingId} failed: ${message}`);
      await this.prisma.meeting
        .update({
          where: { id: meetingId },
          data: { status: 'FAILED', error: message.slice(0, 1000) },
        })
        // The meeting may have been deleted in the meantime.
        .catch(() => undefined);
    }
  }
}
