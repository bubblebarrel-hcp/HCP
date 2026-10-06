-- CreateEnum
CREATE TYPE "CircleVisibility" AS ENUM ('PUBLIC', 'MEMBERS', 'ATTENDEES', 'OFFICERS');

-- AlterTable
ALTER TABLE "Kennel" ADD COLUMN     "circleVisibility" "CircleVisibility" NOT NULL DEFAULT 'MEMBERS';

-- CreateTable
CREATE TABLE "CircleAttendee" (
    "id" UUID NOT NULL,
    "circleId" UUID NOT NULL,
    "userId" UUID,
    "guestId" UUID,
    "recordedById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CircleAttendee_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CircleAttendee_userId_idx" ON "CircleAttendee"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "CircleAttendee_circleId_userId_key" ON "CircleAttendee"("circleId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "CircleAttendee_circleId_guestId_key" ON "CircleAttendee"("circleId", "guestId");

-- AddForeignKey
ALTER TABLE "CircleAttendee" ADD CONSTRAINT "CircleAttendee_circleId_fkey" FOREIGN KEY ("circleId") REFERENCES "Circle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CircleAttendee" ADD CONSTRAINT "CircleAttendee_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CircleAttendee" ADD CONSTRAINT "CircleAttendee_guestId_fkey" FOREIGN KEY ("guestId") REFERENCES "GuestProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CircleAttendee" ADD CONSTRAINT "CircleAttendee_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
