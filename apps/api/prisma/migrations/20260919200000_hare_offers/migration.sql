-- D44: a hasher offers to hare a run the kennel has dated but not yet hared.
-- Offering is not haring — an officer still answers — so the offer is its own
-- record, kept whatever the answer.
CREATE TYPE "HareOfferStatus" AS ENUM ('OFFERED', 'ACCEPTED', 'DECLINED', 'WITHDRAWN');

CREATE TABLE "HareOffer" (
  "id"          UUID NOT NULL DEFAULT gen_random_uuid(),
  "runId"       UUID NOT NULL,
  "userId"      UUID NOT NULL,
  "message"     TEXT,
  "wantsLead"   BOOLEAN NOT NULL DEFAULT false,
  "status"      "HareOfferStatus" NOT NULL DEFAULT 'OFFERED',
  "decidedById" UUID,
  "decidedAt"   TIMESTAMP(3),
  "reason"      TEXT,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL,
  CONSTRAINT "HareOffer_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "HareOffer_runId_status_idx" ON "HareOffer"("runId", "status");
CREATE INDEX "HareOffer_userId_idx" ON "HareOffer"("userId");

ALTER TABLE "HareOffer" ADD CONSTRAINT "HareOffer_runId_fkey" FOREIGN KEY ("runId") REFERENCES "Run"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HareOffer" ADD CONSTRAINT "HareOffer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
