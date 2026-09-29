-- AlterEnum
ALTER TYPE "RunStatus" ADD VALUE 'CANCELLED';

-- AlterTable
ALTER TABLE "Run" ADD COLUMN     "cancelReason" TEXT,
ADD COLUMN     "cancelledAt" TIMESTAMP(3),
ADD COLUMN     "cancelledById" UUID,
ADD COLUMN     "trailReleasedAt" TIMESTAMP(3);
