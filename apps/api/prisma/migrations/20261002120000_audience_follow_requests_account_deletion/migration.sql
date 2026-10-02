-- D57: one audience scale for a profile and for each reel, follow requests, and
-- account deletion.
--
-- ProfileVisibility (PUBLIC | MEMBERS_ONLY | PRIVATE) and ReelVisibility
-- (PUBLIC | KENNEL_ONLY) become one Audience (PUBLIC | FOLLOWERS | ONLY_ME).
-- MEMBERS_ONLY only ever governed biodata, which stays private anyway, so those
-- profiles were already publicly readable and become PUBLIC. PRIVATE becomes
-- ONLY_ME. A kennel-only reel becomes FOLLOWERS.

CREATE TYPE "Audience" AS ENUM ('PUBLIC', 'FOLLOWERS', 'ONLY_ME');
CREATE TYPE "FollowStatus" AS ENUM ('PENDING', 'ACTIVE');

ALTER TABLE "User" ALTER COLUMN "profileVisibility" DROP DEFAULT;
ALTER TABLE "User" ALTER COLUMN "profileVisibility" TYPE "Audience"
  USING (CASE "profileVisibility"::text WHEN 'PRIVATE' THEN 'ONLY_ME' ELSE 'PUBLIC' END)::"Audience";
ALTER TABLE "User" ALTER COLUMN "profileVisibility" SET DEFAULT 'PUBLIC';

ALTER TABLE "Reel" ALTER COLUMN "visibility" DROP DEFAULT;
ALTER TABLE "Reel" ALTER COLUMN "visibility" TYPE "Audience"
  USING (CASE "visibility"::text WHEN 'KENNEL_ONLY' THEN 'FOLLOWERS' ELSE 'PUBLIC' END)::"Audience";
ALTER TABLE "Reel" ALTER COLUMN "visibility" SET DEFAULT 'PUBLIC';

DROP TYPE "ProfileVisibility";
DROP TYPE "ReelVisibility";

ALTER TABLE "User" ADD COLUMN "deletedAt" TIMESTAMP(3);

ALTER TABLE "Follow" ADD COLUMN "status" "FollowStatus" NOT NULL DEFAULT 'ACTIVE';
DROP INDEX "Follow_targetType_targetId_unfollowedAt_idx";
CREATE INDEX "Follow_targetType_targetId_status_unfollowedAt_idx" ON "Follow"("targetType", "targetId", "status", "unfollowedAt");
