import { ServiceUnavailableException } from '@nestjs/common';
import type { PrismaService } from '../prisma/prisma.service.js';
import { HealthController } from './health.controller.js';

function controllerWith(queryRaw: () => Promise<unknown>) {
  const prisma = { $queryRaw: vi.fn(queryRaw) } as unknown as PrismaService;
  return new HealthController(prisma);
}

describe('HealthController', () => {
  it('reports ok when the database answers', async () => {
    const result = await controllerWith(() => Promise.resolve([1])).check();

    expect(result.status).toBe('ok');
    expect(result.database).toBe('up');
    expect(result.uptimeSeconds).toBeGreaterThanOrEqual(0);
  });

  it('returns 503 when the database is unreachable', async () => {
    const controller = controllerWith(() =>
      Promise.reject(new Error('connection refused')),
    );

    await expect(controller.check()).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });
});
