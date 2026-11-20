import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  EMBEDDING_PROVIDER,
  toPgVector,
  type EmbeddingProvider,
} from '../embeddings/embedding-provider.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { reciprocalRankFusion } from './rank-fusion.js';
import type {
  SearchHit,
  SearchOptions,
  SearchResult,
} from './retrieval.types.js';

/** Candidates taken from each retriever before fusion. */
const CANDIDATES_PER_RETRIEVER = 30;
const DEFAULT_LIMIT = 8;

interface Filters {
  /** null = no filter. Passed as SQL arrays, so the query text stays static. */
  meetingIds: string[] | null;
  speakers: string[] | null;
}

/**
 * Hybrid retrieval over meeting chunks:
 * - semantic: cosine distance between the query embedding and chunk vectors.
 *   Finds paraphrases ("why was the release delayed" ~ "the date moves").
 * - keyword: Postgres full-text search. Finds exact names, numbers and
 *   jargon ("SDK", "Dana", "December 15th") that embeddings often blur.
 * Results are merged with reciprocal rank fusion.
 *
 * Only READY meetings are searched, so half-indexed meetings never appear.
 */
@Injectable()
export class RetrievalService {
  private readonly logger = new Logger(RetrievalService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(EMBEDDING_PROVIDER) private readonly embedder: EmbeddingProvider,
  ) {}

  async search(options: SearchOptions): Promise<SearchResult> {
    const startedAt = Date.now();
    const mode = options.mode ?? 'hybrid';
    const filters: Filters = {
      meetingIds: options.meetingIds?.length ? options.meetingIds : null,
      speakers: options.speakers?.length ? options.speakers : null,
    };

    const [semantic, keyword] = await Promise.all([
      mode === 'keyword' ? [] : this.semanticCandidates(options.query, filters),
      mode === 'semantic' ? [] : this.keywordCandidates(options.query, filters),
    ]);
    const fused = reciprocalRankFusion({ semantic, keyword }).slice(
      0,
      options.limit ?? DEFAULT_LIMIT,
    );
    const hits = await this.loadHits(fused);

    const tookMs = Date.now() - startedAt;
    this.logger.debug(
      `search mode=${mode} semantic=${semantic.length} keyword=${keyword.length} hits=${hits.length} ${tookMs}ms`,
    );
    return { query: options.query, mode, hits, tookMs };
  }

  private async semanticCandidates(
    query: string,
    filters: Filters,
  ): Promise<string[]> {
    const [vector] = await this.embedder.embed([query], 'query');
    const rows = await this.prisma.$queryRaw<{ id: string }[]>`
      SELECT c.id
      FROM chunks c
      JOIN meetings m ON m.id = c.meeting_id
      WHERE m.status = 'READY'
        AND c.embedding_model = ${this.embedder.model}
        AND (${filters.meetingIds}::uuid[] IS NULL OR c.meeting_id = ANY(${filters.meetingIds}::uuid[]))
        AND (${filters.speakers}::text[] IS NULL OR c.speakers && ${filters.speakers}::text[])
      ORDER BY c.embedding <=> ${toPgVector(vector)}::vector
      LIMIT ${CANDIDATES_PER_RETRIEVER}`;
    return rows.map((r) => r.id);
  }

  /**
   * Full-text search with OR semantics: the query's words (stemmed, without
   * stopwords) are joined with `|`. Postgres' websearch_to_tsquery would AND
   * them, so a natural question like "what did users think about the push
   * prompt" would only match chunks containing every word, usually none.
   * ts_rank_cd then favours chunks that match more of the words, close together.
   */
  private async keywordCandidates(
    query: string,
    filters: Filters,
  ): Promise<string[]> {
    const rows = await this.prisma.$queryRaw<{ id: string }[]>`
      WITH q AS (
        SELECT string_agg(quote_literal(lexeme), ' | ')::tsquery AS query
        FROM unnest(to_tsvector('english', ${query}))
      )
      SELECT c.id
      FROM chunks c
      JOIN meetings m ON m.id = c.meeting_id
      CROSS JOIN q
      WHERE q.query IS NOT NULL
        AND c.search_vector @@ q.query
        AND m.status = 'READY'
        AND (${filters.meetingIds}::uuid[] IS NULL OR c.meeting_id = ANY(${filters.meetingIds}::uuid[]))
        AND (${filters.speakers}::text[] IS NULL OR c.speakers && ${filters.speakers}::text[])
      -- Ties (common for short queries) go to the more recent meeting, which
      -- usually reflects the current state; then transcript order.
      ORDER BY ts_rank_cd(c.search_vector, q.query) DESC,
               m.occurred_at DESC NULLS LAST, m.created_at DESC, c.sequence
      LIMIT ${CANDIDATES_PER_RETRIEVER}`;
    return rows.map((r) => r.id);
  }

  private async loadHits(
    fused: ReturnType<typeof reciprocalRankFusion>,
  ): Promise<SearchHit[]> {
    const chunks = await this.prisma.chunk.findMany({
      where: { id: { in: fused.map((f) => f.id) } },
      include: { meeting: { select: { title: true, occurredAt: true } } },
    });
    const byId = new Map(chunks.map((c) => [c.id, c]));

    return fused.flatMap(({ id, score, ranks }) => {
      const chunk = byId.get(id);
      if (!chunk) return []; // deleted between the queries
      return [
        {
          chunkId: chunk.id,
          meetingId: chunk.meetingId,
          meetingTitle: chunk.meeting.title,
          occurredAt: chunk.meeting.occurredAt?.toISOString() ?? null,
          sequence: chunk.sequence,
          content: chunk.content,
          speakers: chunk.speakers,
          startSeconds: chunk.startSeconds,
          endSeconds: chunk.endSeconds,
          startUtterance: chunk.startUtterance,
          endUtterance: chunk.endUtterance,
          score,
          ranks,
        },
      ];
    });
  }
}
