-- AlterEnum
ALTER TYPE "ReelStatus" ADD VALUE 'DELETED';

-- AlterTable
ALTER TABLE "Reel" ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "pinnedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Reel_authorId_pinnedAt_idx" ON "Reel"("authorId", "pinnedAt");
