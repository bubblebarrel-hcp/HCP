-- AlterTable
ALTER TABLE "DirectMessage" ADD COLUMN     "forwarded" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "pinnedAt" TIMESTAMP(3),
ADD COLUMN     "pinnedById" UUID,
ADD COLUMN     "replyToId" UUID;

-- CreateIndex
CREATE INDEX "DirectMessage_conversationId_pinnedAt_idx" ON "DirectMessage"("conversationId", "pinnedAt");

-- CreateIndex
CREATE INDEX "DirectMessage_replyToId_idx" ON "DirectMessage"("replyToId");

-- AddForeignKey
ALTER TABLE "DirectMessage" ADD CONSTRAINT "DirectMessage_replyToId_fkey" FOREIGN KEY ("replyToId") REFERENCES "DirectMessage"("id") ON DELETE SET NULL ON UPDATE CASCADE;
