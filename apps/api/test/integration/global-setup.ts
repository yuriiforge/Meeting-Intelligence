import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import pg from 'pg';

/**
 * Creates the test database if needed, applies all migrations, and empties it.
 *
 * Emptying here, before any app boots, matters: suites use different
 * embedding models (fake in tests, real in the eval), and the app refuses to
 * start on vectors from another model. No run depends on what the last left.
 */
export default async function setup(): Promise<void> {
  const url = new URL(requireEnv('TEST_DATABASE_URL'));
  const database = url.pathname.slice(1);
  if (!/^[a-z0-9_]+$/.test(database)) {
    throw new Error(`Refusing to use test database name "${database}"`);
  }

  await createDatabaseIfMissing(url, database);

  const prismaCli = createRequire(import.meta.url).resolve(
    'prisma/build/index.js',
  );
  execFileSync(process.execPath, [prismaCli, 'migrate', 'deploy'], {
    env: { ...process.env, DATABASE_URL: url.toString() },
    stdio: 'pipe',
  });

  await truncateAll(url);
}

async function truncateAll(url: URL) {
  const client = new pg.Client({ connectionString: url.toString() });
  await client.connect();
  try {
    await client.query('TRUNCATE TABLE meetings CASCADE');
  } finally {
    await client.end();
  }
}

async function createDatabaseIfMissing(url: URL, database: string) {
  const adminUrl = new URL(url);
  adminUrl.pathname = '/postgres';
  const client = new pg.Client({ connectionString: adminUrl.toString() });

  try {
    await client.connect();
  } catch (error) {
    throw new Error(
      `Cannot reach Postgres at ${url.host}. Start it with \`npm run db:up\`.`,
      { cause: error },
    );
  }
  try {
    const existing = await client.query(
      'SELECT 1 FROM pg_database WHERE datname = $1',
      [database],
    );
    if (existing.rowCount === 0) {
      // Identifiers can't be parameterised; the name is validated above.
      await client.query(`CREATE DATABASE "${database}"`);
    }
  } finally {
    await client.end();
  }
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
}
