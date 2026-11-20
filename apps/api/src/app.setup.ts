import type { INestApplication } from '@nestjs/common';

/** HTTP-level setup shared by main.ts and the e2e/integration tests. */
export function configureApp(app: INestApplication): INestApplication {
  app.setGlobalPrefix('api');
  app.enableShutdownHooks();
  return app;
}
