-- CreateEnum
CREATE TYPE "DirectMessageKind" AS ENUM ('TEXT', 'MEDIA', 'STICKER', 'VOICE');

-- CreateEnum
CREATE TYPE "DirectAttachmentState" AS ENUM ('PENDING', 'READY');

-- AlterTable
ALTER TABLE "DirectMessage" ADD COLUMN     "editedAt" TIMESTAMP(3),
ADD COLUMN     "kind" "DirectMessageKind" NOT NULL DEFAULT 'TEXT',
ADD COLUMN     "stickerId" UUID;

-- AlterTable
ALTER TABLE "DirectParticipant" ADD COLUMN     "deliveredAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "readReceipts" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "DirectMessageEdit" (
    "id" UUID NOT NULL,
    "messageId" UUID NOT NULL,
    "previousBody" TEXT NOT NULL,
    "editedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DirectMessageEdit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DirectAttachment" (
    "id" UUID NOT NULL,
    "uploaderId" UUID NOT NULL,
    "conversationId" UUID NOT NULL,
    "messageId" UUID,
    "kind" "MediaKind" NOT NULL,
    "storageKey" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "durationSec" DOUBLE PRECISION,
    "position" INTEGER NOT NULL DEFAULT 0,
    "state" "DirectAttachmentState" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confirmedAt" TIMESTAMP(3),

    CONSTRAINT "DirectAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Sticker" (
    "id" UUID NOT NULL,
    "ownerId" UUID NOT NULL,
    "storageKey" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confirmedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Sticker_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StickerFavorite" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "stickerId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StickerFavorite_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DirectMessageEdit_messageId_editedAt_idx" ON "DirectMessageEdit"("messageId", "editedAt");

-- CreateIndex
CREATE INDEX "DirectAttachment_messageId_position_idx" ON "DirectAttachment"("messageId", "position");

-- CreateIndex
CREATE INDEX "DirectAttachment_uploaderId_state_createdAt_idx" ON "DirectAttachment"("uploaderId", "state", "createdAt");

-- CreateIndex
CREATE INDEX "Sticker_ownerId_deletedAt_idx" ON "Sticker"("ownerId", "deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "StickerFavorite_userId_stickerId_key" ON "StickerFavorite"("userId", "stickerId");

-- AddForeignKey
ALTER TABLE "DirectMessage" ADD CONSTRAINT "DirectMessage_stickerId_fkey" FOREIGN KEY ("stickerId") REFERENCES "Sticker"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DirectMessageEdit" ADD CONSTRAINT "DirectMessageEdit_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "DirectMessage"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DirectAttachment" ADD CONSTRAINT "DirectAttachment_uploaderId_fkey" FOREIGN KEY ("uploaderId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DirectAttachment" ADD CONSTRAINT "DirectAttachment_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "DirectMessage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sticker" ADD CONSTRAINT "Sticker_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StickerFavorite" ADD CONSTRAINT "StickerFavorite_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StickerFavorite" ADD CONSTRAINT "StickerFavorite_stickerId_fkey" FOREIGN KEY ("stickerId") REFERENCES "Sticker"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
