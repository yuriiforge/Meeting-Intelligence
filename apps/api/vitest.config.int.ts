import { defineConfig } from 'vitest/config';

// Integration tests run against a real Postgres, in a dedicated database so
// they never touch development data. Start it with `npm run db:up`.
const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  'postgresql://mi:mi@localhost:5432/meeting_intelligence_test';

// Read by the global setup, which runs in this process.
process.env.TEST_DATABASE_URL = TEST_DATABASE_URL;

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    globals: true,
    root: './',
    include: ['**/*.int-spec.ts'],
    globalSetup: ['./test/integration/global-setup.ts'],
    // Real env vars win over apps/api/.env, so the app uses the test database.
    env: { NODE_ENV: 'test', DATABASE_URL: TEST_DATABASE_URL },
    // Suites share one database; run them one at a time.
    fileParallelism: false,
    hookTimeout: 60_000,
  },
});
