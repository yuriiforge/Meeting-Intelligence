import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../config/env.js';
import { EmbeddingModelCheck } from './embedding-model.check.js';
import {
  EMBEDDING_PROVIDER,
  type EmbeddingProvider,
} from './embedding-provider.js';
import { OllamaEmbeddingProvider } from './ollama-embedding.provider.js';

@Module({
  providers: [
    {
      provide: EMBEDDING_PROVIDER,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>): EmbeddingProvider => {
        const provider = config.get('EMBEDDING_PROVIDER', { infer: true });
        switch (provider) {
          case 'ollama':
            return new OllamaEmbeddingProvider({
              baseUrl: config.get('OLLAMA_BASE_URL', { infer: true }),
              model: config.get('EMBEDDING_MODEL', { infer: true }),
            });
        }
      },
    },
    EmbeddingModelCheck,
  ],
  exports: [EMBEDDING_PROVIDER],
})
export class EmbeddingsModule {}
