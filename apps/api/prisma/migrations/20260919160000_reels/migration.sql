-- D41: a hasher's own short video. At a run, at a meeting, or holding a beer at
-- home — a reel needs no context at all.
ALTER TYPE "MediaTargetType" ADD VALUE IF NOT EXISTS 'REEL';

CREATE TYPE "ReelStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED', 'REMOVED');
CREATE TYPE "ReelVisibility" AS ENUM ('PUBLIC', 'KENNEL_ONLY');

CREATE TABLE "Reel" (
  "id"            UUID NOT NULL DEFAULT gen_random_uuid(),
  "authorId"      UUID NOT NULL,
  "kennelId"      UUID,
  "runId"         UUID,
  "eventId"       UUID,
  "caption"       TEXT,
  "status"        "ReelStatus" NOT NULL DEFAULT 'DRAFT',
  "visibility"    "ReelVisibility" NOT NULL DEFAULT 'PUBLIC',
  "mediaId"       UUID,
  "publishedAt"   TIMESTAMP(3),
  "archivedAt"    TIMESTAMP(3),
  "removedAt"     TIMESTAMP(3),
  "removedById"   UUID,
  "removedReason" TEXT,
  "viewCount"     INTEGER NOT NULL DEFAULT 0,
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"     TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Reel_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Reel_status_publishedAt_idx" ON "Reel"("status", "publishedAt");
CREATE INDEX "Reel_authorId_idx" ON "Reel"("authorId");
CREATE INDEX "Reel_kennelId_idx" ON "Reel"("kennelId");
CREATE INDEX "Reel_runId_idx" ON "Reel"("runId");

ALTER TABLE "Reel" ADD CONSTRAINT "Reel_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Reel" ADD CONSTRAINT "Reel_kennelId_fkey" FOREIGN KEY ("kennelId") REFERENCES "Kennel"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Reel" ADD CONSTRAINT "Reel_runId_fkey" FOREIGN KEY ("runId") REFERENCES "Run"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Reel" ADD CONSTRAINT "Reel_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Reel" ADD CONSTRAINT "Reel_mediaId_fkey" FOREIGN KEY ("mediaId") REFERENCES "MediaAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;
