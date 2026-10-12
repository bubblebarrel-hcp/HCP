-- CreateEnum
CREATE TYPE "EnforcementLevel" AS ENUM ('WARN', 'HOLD', 'REVIEW_HOLD');

-- CreateTable
CREATE TABLE "AutoEnforcement" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "level" "EnforcementLevel" NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "reporterCount" INTEGER NOT NULL,
    "reportIds" JSONB NOT NULL,
    "reasons" JSONB NOT NULL,
    "windowStart" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3),
    "liftedAt" TIMESTAMP(3),
    "liftedById" UUID,
    "confirmedAt" TIMESTAMP(3),
    "confirmedById" UUID,
    "reviewNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AutoEnforcement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AutoEnforcement_userId_createdAt_idx" ON "AutoEnforcement"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "AutoEnforcement_endsAt_liftedAt_idx" ON "AutoEnforcement"("endsAt", "liftedAt");

-- AddForeignKey
ALTER TABLE "AutoEnforcement" ADD CONSTRAINT "AutoEnforcement_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
