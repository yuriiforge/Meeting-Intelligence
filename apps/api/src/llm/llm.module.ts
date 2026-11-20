import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../config/env.js';
import { AnthropicLlmProvider } from './anthropic-llm.provider.js';
import { LLM_PROVIDER, type LlmProvider } from './llm-provider.js';
import { OllamaLlmProvider } from './ollama-llm.provider.js';

@Module({
  providers: [
    {
      provide: LLM_PROVIDER,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>): LlmProvider => {
        const model = config.get('LLM_MODEL', { infer: true });
        switch (config.get('LLM_PROVIDER', { infer: true })) {
          case 'ollama':
            return new OllamaLlmProvider({
              baseUrl: config.get('OLLAMA_BASE_URL', { infer: true }),
              model,
            });
          case 'anthropic':
            return new AnthropicLlmProvider({
              model,
              effort: config.get('ANTHROPIC_EFFORT', { infer: true }),
            });
        }
      },
    },
  ],
  exports: [LLM_PROVIDER],
})
export class LlmModule {}
