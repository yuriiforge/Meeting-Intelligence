/*
  Warnings:

  - Added the required column `end_utterance` to the `chunks` table without a default value. This is not possible if the table is not empty.
  - Added the required column `start_utterance` to the `chunks` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "chunks" ADD COLUMN     "end_utterance" INTEGER NOT NULL,
ADD COLUMN     "start_utterance" INTEGER NOT NULL;
