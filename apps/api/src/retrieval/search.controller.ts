import { Controller, Get, Query } from '@nestjs/common';
import { z } from 'zod';
import { RetrievalService } from './retrieval.service.js';
import { SEARCH_MODES, type SearchResult } from './retrieval.types.js';

/** `?speaker=a&speaker=b` arrives as an array, `?speaker=a` as a string. */
const asArray = (value: unknown) =>
  value === undefined || Array.isArray(value) ? value : [value];

const searchQuerySchema = z.object({
  q: z.string().trim().min(1).max(500),
  limit: z.coerce.number().int().min(1).max(50).optional(),
  mode: z.enum(SEARCH_MODES).default('hybrid'),
  meetingId: z.preprocess(asArray, z.array(z.uuid()).max(50).optional()),
  speaker: z.preprocess(
    asArray,
    z.array(z.string().trim().min(1).max(80)).max(20).optional(),
  ),
});

@Controller('search')
export class SearchController {
  constructor(private readonly retrieval: RetrievalService) {}

  /** e.g. GET /api/search?q=why+did+the+launch+move&speaker=Dana+Wu */
  @Get()
  search(
    @Query({ schema: searchQuerySchema })
    query: z.infer<typeof searchQuerySchema>,
  ): Promise<SearchResult> {
    return this.retrieval.search({
      query: query.q,
      limit: query.limit,
      mode: query.mode,
      meetingIds: query.meetingId,
      speakers: query.speaker,
    });
  }
}
