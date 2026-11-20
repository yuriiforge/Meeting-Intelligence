import { z } from 'zod';

/**
 * Every environment variable the API reads, validated once at startup.
 * A missing or malformed value stops the process with a readable error
 * instead of failing later on the first request that needs it.
 */
/**
 * Local dev runs a small model on CPU; production uses Claude. Any model can
 * be set with LLM_MODEL (e.g. qwen2.5:7b locally, claude-sonnet-5-5 to cut cost).
 */
export const DEFAULT_LLM_MODEL = {
  ollama: 'qwen2.5:3b',
  anthropic: 'claude-opus-5-5',
} as const;

/** Unset variables often arrive as "" (e.g. from docker compose); treat as unset. */
const optionalString = z.preprocess(
  (value) => (value === '' ? undefined : value),
  z.string().min(1).optional(),
);

const baseSchema = z.object({
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

  /** Answer generation: local Ollama for development, Claude in production. */
  LLM_PROVIDER: z.enum(['ollama', 'anthropic']).default('ollama'),
  /** Defaults per provider (DEFAULT_LLM_MODEL). */
  LLM_MODEL: optionalString,
  ANTHROPIC_API_KEY: optionalString,
  ANTHROPIC_AUTH_TOKEN: optionalString,
  /** Claude reasoning effort; more effort = slower, costlier, more thorough. */
  ANTHROPIC_EFFORT: z.enum(['low', 'medium', 'high']).default('medium'),
});

export const envSchema = baseSchema
  .superRefine((env, ctx) => {
    if (
      env.LLM_PROVIDER === 'anthropic' &&
      !env.ANTHROPIC_API_KEY &&
      !env.ANTHROPIC_AUTH_TOKEN
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['ANTHROPIC_API_KEY'],
        message:
          'required when LLM_PROVIDER=anthropic (or set ANTHROPIC_AUTH_TOKEN)',
      });
    }
  })
  .transform((env) => ({
    ...env,
    LLM_MODEL: env.LLM_MODEL ?? DEFAULT_LLM_MODEL[env.LLM_PROVIDER],
  }));

export type Env = z.output<typeof envSchema>;

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
