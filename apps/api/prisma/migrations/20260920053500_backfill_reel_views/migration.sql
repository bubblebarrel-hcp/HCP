-- D50: views moved from Reel.viewCount to ContentStats. The column is still
-- mirrored, but the number the API reports now comes from ContentStats, so the
-- counts that already exist are carried over rather than dropped to zero.
--
-- They land in anonViewCount because nothing recorded who those viewers were:
-- claiming them as unique signed-in viewers would be inventing a fact.
INSERT INTO "ContentStats" ("subjectType", "subjectId", "anonViewCount", "updatedAt")
SELECT 'REEL'::"SubjectType", "id", "viewCount", NOW()
FROM "Reel"
WHERE "viewCount" > 0
ON CONFLICT ("subjectType", "subjectId") DO UPDATE
  SET "anonViewCount" = "ContentStats"."anonViewCount" + EXCLUDED."anonViewCount";
