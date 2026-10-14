-- CreateEnum
CREATE TYPE "BroadcastAudience" AS ENUM ('EVERYONE', 'KENNEL');

-- CreateTable
CREATE TABLE "Broadcast" (
    "id" UUID NOT NULL,
    "authorId" UUID NOT NULL,
    "audience" "BroadcastAudience" NOT NULL,
    "kennelId" UUID,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "push" BOOLEAN NOT NULL DEFAULT false,
    "urgent" BOOLEAN NOT NULL DEFAULT false,
    "recipientCount" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Broadcast_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Broadcast_createdAt_idx" ON "Broadcast"("createdAt");

-- AddForeignKey
ALTER TABLE "Broadcast" ADD CONSTRAINT "Broadcast_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Broadcast" ADD CONSTRAINT "Broadcast_kennelId_fkey" FOREIGN KEY ("kennelId") REFERENCES "Kennel"("id") ON DELETE SET NULL ON UPDATE CASCADE;
