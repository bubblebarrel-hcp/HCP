-- AlterTable
ALTER TABLE "User" ADD COLUMN     "username" TEXT;

-- Everybody who already exists gets a username (D59): their hash handle, lower-
-- cased and reduced to a-z 0-9 _ when that is 3-30 characters and the first
-- claim on it, otherwise "hasher_" plus the start of their id, which is unique by
-- construction. Nothing private is used: an un-named hasher is not given their
-- first name, which is only ever shown as "Just <firstName>".
WITH base AS (
  SELECT id, "createdAt",
    trim(both '_' from regexp_replace(lower(coalesce("hashHandle", '')), '[^a-z0-9]+', '_', 'g')) AS slug
  FROM "User"
  WHERE "deletedAt" IS NULL
), ranked AS (
  SELECT id, slug, row_number() OVER (PARTITION BY slug ORDER BY "createdAt", id) AS rn FROM base
)
UPDATE "User" u SET "username" = CASE
  WHEN r.rn = 1 AND length(r.slug) BETWEEN 3 AND 30 THEN r.slug
  ELSE 'hasher_' || substr(replace(u.id::text, '-', ''), 1, 8)
END
FROM ranked r WHERE u.id = r.id;

-- CreateTable
CREATE TABLE "Hashtag" (
    "id" UUID NOT NULL,
    "tag" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Hashtag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContentTag" (
    "id" UUID NOT NULL,
    "hashtagId" UUID NOT NULL,
    "subjectType" "SubjectType" NOT NULL,
    "subjectId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContentTag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContentMention" (
    "id" UUID NOT NULL,
    "subjectType" "SubjectType" NOT NULL,
    "subjectId" UUID NOT NULL,
    "mentionedUserId" UUID NOT NULL,
    "authorId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContentMention_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Hashtag_tag_key" ON "Hashtag"("tag");

-- CreateIndex
CREATE INDEX "ContentTag_subjectType_subjectId_idx" ON "ContentTag"("subjectType", "subjectId");

-- CreateIndex
CREATE INDEX "ContentTag_hashtagId_createdAt_idx" ON "ContentTag"("hashtagId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ContentTag_hashtagId_subjectType_subjectId_key" ON "ContentTag"("hashtagId", "subjectType", "subjectId");

-- CreateIndex
CREATE INDEX "ContentMention_subjectType_subjectId_idx" ON "ContentMention"("subjectType", "subjectId");

-- CreateIndex
CREATE INDEX "ContentMention_mentionedUserId_createdAt_idx" ON "ContentMention"("mentionedUserId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ContentMention_subjectType_subjectId_mentionedUserId_key" ON "ContentMention"("subjectType", "subjectId", "mentionedUserId");

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- AddForeignKey
ALTER TABLE "ContentTag" ADD CONSTRAINT "ContentTag_hashtagId_fkey" FOREIGN KEY ("hashtagId") REFERENCES "Hashtag"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentMention" ADD CONSTRAINT "ContentMention_mentionedUserId_fkey" FOREIGN KEY ("mentionedUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

