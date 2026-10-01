-- AlterEnum
ALTER TYPE "MediaTargetType" ADD VALUE 'PROFILE';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "bannerUrl" TEXT;
