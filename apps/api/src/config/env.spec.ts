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
