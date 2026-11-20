import { validateEnv } from './env.js';

const DATABASE_URL = 'postgresql://user:pass@localhost:5432/db';

describe('validateEnv', () => {
  it('applies defaults', () => {
    const env = validateEnv({ DATABASE_URL });

    expect(env).toEqual({
      NODE_ENV: 'development',
      PORT: 3000,
      DATABASE_URL,
      EMBEDDING_PROVIDER: 'ollama',
      EMBEDDING_MODEL: 'nomic-embed-text',
      OLLAMA_BASE_URL: 'http://localhost:11434',
      LLM_PROVIDER: 'ollama',
      LLM_MODEL: 'qwen2.5:3b',
      ANTHROPIC_EFFORT: 'medium',
    });
  });

  describe('LLM provider', () => {
    it('defaults the model per provider', () => {
      const env = validateEnv({
        DATABASE_URL,
        LLM_PROVIDER: 'anthropic',
        ANTHROPIC_API_KEY: 'sk-test',
      });

      expect(env.LLM_MODEL).toBe('claude-opus-5-5');
    });

    it('treats empty strings as unset', () => {
      const env = validateEnv({
        DATABASE_URL,
        LLM_MODEL: '',
        ANTHROPIC_API_KEY: '',
      });

      expect(env.LLM_MODEL).toBe('qwen2.5:3b');
      expect(env.ANTHROPIC_API_KEY).toBeUndefined();
    });

    it('keeps an explicit model', () => {
      const env = validateEnv({ DATABASE_URL, LLM_MODEL: 'qwen2.5:7b' });

      expect(env.LLM_MODEL).toBe('qwen2.5:7b');
    });

    it('requires credentials for Anthropic, at startup', () => {
      expect(() =>
        validateEnv({ DATABASE_URL, LLM_PROVIDER: 'anthropic' }),
      ).toThrow(/ANTHROPIC_API_KEY: required when LLM_PROVIDER=anthropic/);
    });

    it('accepts an auth token instead of an API key', () => {
      expect(() =>
        validateEnv({
          DATABASE_URL,
          LLM_PROVIDER: 'anthropic',
          ANTHROPIC_AUTH_TOKEN: 'token',
        }),
      ).not.toThrow();
    });
  });

  it('rejects an unknown EMBEDDING_PROVIDER', () => {
    expect(() =>
      validateEnv({ DATABASE_URL, EMBEDDING_PROVIDER: 'magic' }),
    ).toThrow(/EMBEDDING_PROVIDER/);
  });

  it('rejects a malformed OLLAMA_BASE_URL', () => {
    expect(() =>
      validateEnv({ DATABASE_URL, OLLAMA_BASE_URL: 'not a url' }),
    ).toThrow(/OLLAMA_BASE_URL/);
  });

  it('coerces PORT from a string', () => {
    expect(validateEnv({ DATABASE_URL, PORT: '8080' }).PORT).toBe(8080);
  });

  it('rejects a missing DATABASE_URL with a readable message', () => {
    expect(() => validateEnv({})).toThrow(/DATABASE_URL/);
  });

  it('rejects a non-postgres DATABASE_URL', () => {
    expect(() => validateEnv({ DATABASE_URL: 'mysql://x' })).toThrow(
      /postgres/,
    );
  });

  it('rejects an unknown NODE_ENV', () => {
    expect(() => validateEnv({ DATABASE_URL, NODE_ENV: 'staging' })).toThrow(
      /NODE_ENV/,
    );
  });
});
