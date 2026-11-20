import { Module } from '@nestjs/common';
import { EmbeddingsModule } from '../embeddings/embeddings.module.js';
import { RetrievalService } from './retrieval.service.js';
import { SearchController } from './search.controller.js';

@Module({
  imports: [EmbeddingsModule],
  controllers: [SearchController],
  providers: [RetrievalService],
  exports: [RetrievalService],
})
export class RetrievalModule {}
