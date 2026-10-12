-- CreateEnum
CREATE TYPE "AppealStatus" AS ENUM ('OPEN', 'GRANTED', 'DENIED', 'MOOT');

-- CreateEnum
CREATE TYPE "CoordinationOutcome" AS ENUM ('PENDING', 'CLEARED', 'CONFIRMED');

-- CreateTable
CREATE TABLE "EnforcementAppeal" (
    "id" UUID NOT NULL,
    "enforcementId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "message" TEXT NOT NULL,
    "status" "AppealStatus" NOT NULL DEFAULT 'OPEN',
    "decidedById" UUID,
    "decidedAt" TIMESTAMP(3),
    "decisionNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EnforcementAppeal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CoordinationFlag" (
    "id" UUID NOT NULL,
    "targetUserId" UUID NOT NULL,
    "reporterIds" JSONB NOT NULL,
    "clusters" JSONB NOT NULL,
    "rawScore" DOUBLE PRECISION NOT NULL,
    "effectiveScore" DOUBLE PRECISION NOT NULL,
    "windowStart" TIMESTAMP(3) NOT NULL,
    "outcome" "CoordinationOutcome" NOT NULL DEFAULT 'PENDING',
    "reviewedAt" TIMESTAMP(3),
    "reviewedById" UUID,
    "reviewNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CoordinationFlag_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EnforcementAppeal_enforcementId_key" ON "EnforcementAppeal"("enforcementId");

-- CreateIndex
CREATE INDEX "EnforcementAppeal_status_createdAt_idx" ON "EnforcementAppeal"("status", "createdAt");

-- CreateIndex
CREATE INDEX "CoordinationFlag_targetUserId_createdAt_idx" ON "CoordinationFlag"("targetUserId", "createdAt");

-- CreateIndex
CREATE INDEX "CoordinationFlag_outcome_createdAt_idx" ON "CoordinationFlag"("outcome", "createdAt");

-- AddForeignKey
ALTER TABLE "EnforcementAppeal" ADD CONSTRAINT "EnforcementAppeal_enforcementId_fkey" FOREIGN KEY ("enforcementId") REFERENCES "AutoEnforcement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnforcementAppeal" ADD CONSTRAINT "EnforcementAppeal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoordinationFlag" ADD CONSTRAINT "CoordinationFlag_targetUserId_fkey" FOREIGN KEY ("targetUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
