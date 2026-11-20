import { Module } from '@nestjs/common';
import { EmbeddingsModule } from '../embeddings/embeddings.module.js';
import { IndexingService } from './indexing.service.js';

@Module({
  imports: [EmbeddingsModule],
  providers: [IndexingService],
  exports: [IndexingService],
})
export class IndexingModule {}
