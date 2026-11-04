-- CreateEnum
CREATE TYPE "ActivityKind" AS ENUM ('HASH_RUN', 'TRAIL_LAYING', 'SOLO');

-- CreateTable
CREATE TABLE "RunActivity" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "kind" "ActivityKind" NOT NULL,
    "runId" UUID,
    "trailId" UUID,
    "clientId" TEXT NOT NULL,
    "title" TEXT,
    "notes" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "endedAt" TIMESTAMP(3) NOT NULL,
    "elapsedTimeS" INTEGER NOT NULL,
    "movingTimeS" INTEGER NOT NULL,
    "distanceM" INTEGER NOT NULL,
    "avgPaceSPerKm" INTEGER,
    "elevationGainM" INTEGER NOT NULL,
    "elevationLossM" INTEGER NOT NULL,
    "track" JSONB NOT NULL,
    "splits" JSONB NOT NULL,
    "audience" "Audience" NOT NULL DEFAULT 'FOLLOWERS',
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RunActivity_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RunActivity_userId_startedAt_idx" ON "RunActivity"("userId", "startedAt");

-- CreateIndex
CREATE INDEX "RunActivity_runId_idx" ON "RunActivity"("runId");

-- CreateIndex
CREATE UNIQUE INDEX "RunActivity_userId_clientId_key" ON "RunActivity"("userId", "clientId");

-- AddForeignKey
ALTER TABLE "RunActivity" ADD CONSTRAINT "RunActivity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RunActivity" ADD CONSTRAINT "RunActivity_runId_fkey" FOREIGN KEY ("runId") REFERENCES "Run"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RunActivity" ADD CONSTRAINT "RunActivity_trailId_fkey" FOREIGN KEY ("trailId") REFERENCES "Trail"("id") ON DELETE SET NULL ON UPDATE CASCADE;
