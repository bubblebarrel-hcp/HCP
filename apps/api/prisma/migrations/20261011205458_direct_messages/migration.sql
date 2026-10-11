-- CreateEnum
CREATE TYPE "DmPolicy" AS ENUM ('EVERYONE', 'NOBODY');

-- CreateEnum
CREATE TYPE "ConversationStatus" AS ENUM ('REQUESTED', 'ACTIVE', 'DECLINED');

-- CreateEnum
CREATE TYPE "DirectMessageStatus" AS ENUM ('SENT', 'DELETED', 'REMOVED');

-- AlterEnum
ALTER TYPE "NotificationCategory" ADD VALUE 'MESSAGE';

-- AlterEnum
ALTER TYPE "ReportTargetType" ADD VALUE 'DIRECT_MESSAGE';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "dmPolicy" "DmPolicy" NOT NULL DEFAULT 'EVERYONE';

-- CreateTable
CREATE TABLE "DirectConversation" (
    "id" UUID NOT NULL,
    "userLowId" UUID NOT NULL,
    "userHighId" UUID NOT NULL,
    "initiatorId" UUID NOT NULL,
    "status" "ConversationStatus" NOT NULL DEFAULT 'ACTIVE',
    "acceptedAt" TIMESTAMP(3),
    "declinedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastMessageAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DirectConversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DirectParticipant" (
    "conversationId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "lastReadAt" TIMESTAMP(3),
    "mutedAt" TIMESTAMP(3),
    "archivedAt" TIMESTAMP(3),
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DirectParticipant_pkey" PRIMARY KEY ("conversationId","userId")
);

-- CreateTable
CREATE TABLE "DirectMessage" (
    "id" UUID NOT NULL,
    "conversationId" UUID NOT NULL,
    "senderId" UUID NOT NULL,
    "body" TEXT NOT NULL,
    "status" "DirectMessageStatus" NOT NULL DEFAULT 'SENT',
    "clientKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),
    "removedAt" TIMESTAMP(3),
    "removedReason" TEXT,

    CONSTRAINT "DirectMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DirectConversation_userLowId_lastMessageAt_idx" ON "DirectConversation"("userLowId", "lastMessageAt");

-- CreateIndex
CREATE INDEX "DirectConversation_userHighId_lastMessageAt_idx" ON "DirectConversation"("userHighId", "lastMessageAt");

-- CreateIndex
CREATE UNIQUE INDEX "DirectConversation_userLowId_userHighId_key" ON "DirectConversation"("userLowId", "userHighId");

-- CreateIndex
CREATE INDEX "DirectParticipant_userId_archivedAt_idx" ON "DirectParticipant"("userId", "archivedAt");

-- CreateIndex
CREATE INDEX "DirectMessage_conversationId_createdAt_idx" ON "DirectMessage"("conversationId", "createdAt");

-- CreateIndex
CREATE INDEX "DirectMessage_senderId_createdAt_idx" ON "DirectMessage"("senderId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "DirectMessage_conversationId_senderId_clientKey_key" ON "DirectMessage"("conversationId", "senderId", "clientKey");

-- AddForeignKey
ALTER TABLE "DirectParticipant" ADD CONSTRAINT "DirectParticipant_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "DirectConversation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DirectParticipant" ADD CONSTRAINT "DirectParticipant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DirectMessage" ADD CONSTRAINT "DirectMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "DirectConversation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DirectMessage" ADD CONSTRAINT "DirectMessage_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
