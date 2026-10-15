-- AlterEnum
ALTER TYPE "BroadcastAudience" ADD VALUE 'USER';

-- AlterTable
ALTER TABLE "Broadcast" ADD COLUMN     "recipientId" UUID;

-- AddForeignKey
ALTER TABLE "Broadcast" ADD CONSTRAINT "Broadcast_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
