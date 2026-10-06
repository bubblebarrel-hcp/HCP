-- CreateEnum
CREATE TYPE "DigestFrequency" AS ENUM ('IMMEDIATE', 'HOURLY', 'MORNING', 'EVENING', 'WEEKLY');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "DeliveryStatus" ADD VALUE 'HELD';
ALTER TYPE "DeliveryStatus" ADD VALUE 'SKIPPED';

-- AlterTable
ALTER TABLE "Notification" ADD COLUMN     "groupCount" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "groupKey" TEXT;

-- CreateTable
CREATE TABLE "NotificationGroupMember" (
    "id" UUID NOT NULL,
    "notificationId" UUID NOT NULL,
    "domainEventId" UUID NOT NULL,
    "actorId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NotificationGroupMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationDigestPreference" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "category" "NotificationCategory" NOT NULL,
    "frequency" "DigestFrequency" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotificationDigestPreference_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "NotificationGroupMember_domainEventId_key" ON "NotificationGroupMember"("domainEventId");

-- CreateIndex
CREATE INDEX "NotificationGroupMember_notificationId_idx" ON "NotificationGroupMember"("notificationId");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationDigestPreference_userId_category_key" ON "NotificationDigestPreference"("userId", "category");

-- CreateIndex
CREATE INDEX "Notification_recipientUserId_groupKey_idx" ON "Notification"("recipientUserId", "groupKey");

-- AddForeignKey
ALTER TABLE "NotificationGroupMember" ADD CONSTRAINT "NotificationGroupMember_notificationId_fkey" FOREIGN KEY ("notificationId") REFERENCES "Notification"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationDigestPreference" ADD CONSTRAINT "NotificationDigestPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
