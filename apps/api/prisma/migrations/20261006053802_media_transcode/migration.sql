-- CreateEnum
CREATE TYPE "TranscodeState" AS ENUM ('NONE', 'PENDING', 'PROCESSING', 'DONE', 'SKIPPED', 'FAILED');

-- AlterTable
ALTER TABLE "MediaAsset" ADD COLUMN     "originalStorageKey" TEXT,
ADD COLUMN     "transcodeAttempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "transcodeError" TEXT,
ADD COLUMN     "transcodeState" "TranscodeState" NOT NULL DEFAULT 'NONE',
ADD COLUMN     "transcodedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "MediaAsset_transcodeState_createdAt_idx" ON "MediaAsset"("transcodeState", "createdAt");
