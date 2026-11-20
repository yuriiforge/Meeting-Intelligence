import type { EmbeddingProvider } from '../embeddings/embedding-provider.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import { IndexingService } from './indexing.service.js';

// Queue behaviour only; the database work is covered by integration tests.
function service() {
  const indexing = new IndexingService(
    {} as PrismaService,
    {} as EmbeddingProvider,
  );
  const order: string[] = [];
  let running = 0;
  let maxRunning = 0;
  vi.spyOn(indexing, 'indexMeeting').mockImplementation(async (id) => {
    running++;
    maxRunning = Math.max(maxRunning, running);
    await new Promise((resolve) => setTimeout(resolve, 5));
    order.push(id);
    running--;
  });
  return { indexing, order, maxRunning: () => maxRunning };
}

describe('IndexingService queue', () => {
  it('processes meetings one at a time, in order', async () => {
    const { indexing, order, maxRunning } = service();

    ['a', 'b', 'c'].forEach((id) => indexing.enqueue(id));
    await indexing.whenIdle();

    expect(order).toEqual(['a', 'b', 'c']);
    expect(maxRunning()).toBe(1);
  });

  it('does not queue the same meeting twice while it is waiting', async () => {
    const { indexing, order } = service();

    indexing.enqueue('a');
    indexing.enqueue('a');
    await indexing.whenIdle();

    expect(order).toEqual(['a']);
  });

  it('allows a meeting to be queued again once it has started', async () => {
    const { indexing, order } = service();

    indexing.enqueue('a');
    await indexing.whenIdle();
    indexing.enqueue('a');
    await indexing.whenIdle();

    expect(order).toEqual(['a', 'a']);
  });
});
