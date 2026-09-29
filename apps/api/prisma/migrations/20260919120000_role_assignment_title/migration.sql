-- D40: a kennel names its own jobs. The role stays the authority; the title is
-- what this kennel calls it. Null means the platform's default wording.
ALTER TABLE "RoleAssignment" ADD COLUMN "title" TEXT;
