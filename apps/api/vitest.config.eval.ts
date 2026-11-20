import { defineConfig } from 'vitest/config';

// Quality evaluation with real models, against the integration test database.
// Needs Postgres and Ollama running (`npm run deps:up`).
const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  'postgresql://mi:mi@localhost:5432/meeting_intelligence_test';
process.env.TEST_DATABASE_URL = TEST_DATABASE_URL;

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    globals: true,
    root: './',
    include: ['eval/**/*.eval.ts'],
    globalSetup: ['./test/integration/global-setup.ts'],
    env: { NODE_ENV: 'test', DATABASE_URL: TEST_DATABASE_URL },
    fileParallelism: false,
    // Cases run in order: the last one checks results of the earlier ones.
    sequence: { concurrent: false },
    hookTimeout: 300_000,
    testTimeout: 300_000,
  },
});
