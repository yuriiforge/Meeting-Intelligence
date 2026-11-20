-- pgvector: required for the chunks.embedding column. Added by hand; Prisma
-- does not manage extensions.
CREATE EXTENSION IF NOT EXISTS vector;

-- CreateEnum
CREATE TYPE "MeetingStatus" AS ENUM ('PENDING', 'PROCESSING', 'READY', 'FAILED');

-- CreateTable
CREATE TABLE "meetings" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "title" TEXT NOT NULL,
    "occurred_at" TIMESTAMP(3),
    "duration_seconds" INTEGER,
    "source_filename" TEXT,
    "status" "MeetingStatus" NOT NULL DEFAULT 'PENDING',
    "error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "meetings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "utterances" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "meeting_id" UUID NOT NULL,
    "sequence" INTEGER NOT NULL,
    "speaker" TEXT NOT NULL,
    "start_seconds" INTEGER NOT NULL,
    "text" TEXT NOT NULL,

    CONSTRAINT "utterances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chunks" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "meeting_id" UUID NOT NULL,
    "sequence" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "speakers" TEXT[],
    "start_seconds" INTEGER NOT NULL,
    "end_seconds" INTEGER NOT NULL,
    "token_count" INTEGER NOT NULL,
    "embedding" vector(768),
    "embedding_model" TEXT,

    CONSTRAINT "chunks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "meetings_created_at_idx" ON "meetings"("created_at");

-- CreateIndex
CREATE INDEX "utterances_meeting_id_speaker_idx" ON "utterances"("meeting_id", "speaker");

-- CreateIndex
CREATE UNIQUE INDEX "utterances_meeting_id_sequence_key" ON "utterances"("meeting_id", "sequence");

-- CreateIndex
CREATE UNIQUE INDEX "chunks_meeting_id_sequence_key" ON "chunks"("meeting_id", "sequence");

-- AddForeignKey
ALTER TABLE "utterances" ADD CONSTRAINT "utterances_meeting_id_fkey" FOREIGN KEY ("meeting_id") REFERENCES "meetings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chunks" ADD CONSTRAINT "chunks_meeting_id_fkey" FOREIGN KEY ("meeting_id") REFERENCES "meetings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
