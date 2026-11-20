import { z } from 'zod';

/**
 * Every environment variable the API reads, validated once at startup.
 * A missing or malformed value stops the process with a readable error
 * instead of failing later on the first request that needs it.
 */
export const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z
    .string()
    .regex(/^postgres(ql)?:\/\//, 'must be a postgres:// or postgresql:// URL'),

  /** Which embedding backend to use. Only Ollama for now; the interface allows more. */
  EMBEDDING_PROVIDER: z.enum(['ollama']).default('ollama'),
  /**
   * Must produce 768-dim vectors (the `chunks.embedding` column type).
   * Changing it requires re-embedding; startup refuses a mismatch.
   */
  EMBEDDING_MODEL: z.string().min(1).default('nomic-embed-text'),
  OLLAMA_BASE_URL: z.url().default('http://localhost:11434'),
});

export type Env = z.infer<typeof envSchema>;

export function validateEnv(raw: Record<string, unknown>): Env {
  const result = envSchema.safeParse(raw);
  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  return result.data;
}
