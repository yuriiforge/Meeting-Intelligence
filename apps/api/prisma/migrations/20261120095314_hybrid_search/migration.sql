-- Hybrid search support. Written by hand because Prisma can't express a
-- generated column; schema.prisma mirrors it with @default(dbgenerated(...)).

-- Full-text representation of each chunk, kept in sync by Postgres itself.
-- Includes speaker names and timestamps, since they are part of `content`.
ALTER TABLE "chunks"
  ADD COLUMN "search_vector" tsvector
  GENERATED ALWAYS AS (to_tsvector('english', "content")) STORED;

CREATE INDEX "chunks_search_vector_idx" ON "chunks" USING gin ("search_vector");

-- No vector (HNSW) index on purpose: at this scale an exact scan is fast and
-- has perfect recall, and Prisma can't represent HNSW indexes (it would try
-- to drop one in every later migration). See README, "Scaling".
