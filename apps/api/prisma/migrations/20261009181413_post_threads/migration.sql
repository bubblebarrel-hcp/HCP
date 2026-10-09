-- AlterTable
ALTER TABLE "Post" ADD COLUMN     "threadPosition" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "threadRootId" UUID;

-- CreateIndex
CREATE INDEX "Post_threadRootId_threadPosition_idx" ON "Post"("threadRootId", "threadPosition");

-- AddForeignKey
ALTER TABLE "Post" ADD CONSTRAINT "Post_threadRootId_fkey" FOREIGN KEY ("threadRootId") REFERENCES "Post"("id") ON DELETE SET NULL ON UPDATE CASCADE;
