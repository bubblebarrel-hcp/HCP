-- CreateEnum
CREATE TYPE "FollowTargetType" AS ENUM ('USER', 'KENNEL');

-- CreateEnum
CREATE TYPE "SubjectType" AS ENUM ('REEL', 'TRAIL_REPORT', 'MEDIA_ASSET', 'RUN', 'RUN_CAPSULE', 'COMMENT');

-- CreateEnum
CREATE TYPE "CommentStatus" AS ENUM ('VISIBLE', 'DELETED', 'REMOVED');

-- AlterTable
ALTER TABLE "HareOffer" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Reel" ALTER COLUMN "id" DROP DEFAULT;

-- CreateTable
CREATE TABLE "Follow" (
    "id" UUID NOT NULL,
    "followerId" UUID NOT NULL,
    "targetType" "FollowTargetType" NOT NULL,
    "targetId" UUID NOT NULL,
    "followedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "unfollowedAt" TIMESTAMP(3),

    CONSTRAINT "Follow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContentStats" (
    "subjectType" "SubjectType" NOT NULL,
    "subjectId" UUID NOT NULL,
    "likeCount" INTEGER NOT NULL DEFAULT 0,
    "commentCount" INTEGER NOT NULL DEFAULT 0,
    "reshareCount" INTEGER NOT NULL DEFAULT 0,
    "bookmarkCount" INTEGER NOT NULL DEFAULT 0,
    "viewerCount" INTEGER NOT NULL DEFAULT 0,
    "anonViewCount" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContentStats_pkey" PRIMARY KEY ("subjectType","subjectId")
);

-- CreateTable
CREATE TABLE "ContentLike" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "subjectType" "SubjectType" NOT NULL,
    "subjectId" UUID NOT NULL,
    "likedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "unlikedAt" TIMESTAMP(3),

    CONSTRAINT "ContentLike_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContentComment" (
    "id" UUID NOT NULL,
    "subjectType" "SubjectType" NOT NULL,
    "subjectId" UUID NOT NULL,
    "authorId" UUID NOT NULL,
    "parentId" UUID,
    "body" TEXT NOT NULL,
    "status" "CommentStatus" NOT NULL DEFAULT 'VISIBLE',
    "editedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "removedAt" TIMESTAMP(3),
    "removedById" UUID,
    "removedReason" TEXT,
    "replyCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContentComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContentReshare" (
    "id" UUID NOT NULL,
    "sharerId" UUID NOT NULL,
    "subjectType" "SubjectType" NOT NULL,
    "subjectId" UUID NOT NULL,
    "commentary" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "undoneAt" TIMESTAMP(3),

    CONSTRAINT "ContentReshare_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContentBookmark" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "subjectType" "SubjectType" NOT NULL,
    "subjectId" UUID NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "removedAt" TIMESTAMP(3),

    CONSTRAINT "ContentBookmark_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContentView" (
    "id" UUID NOT NULL,
    "viewerId" UUID NOT NULL,
    "subjectType" "SubjectType" NOT NULL,
    "subjectId" UUID NOT NULL,
    "firstViewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastViewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "viewCount" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "ContentView_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Follow_targetType_targetId_unfollowedAt_idx" ON "Follow"("targetType", "targetId", "unfollowedAt");

-- CreateIndex
CREATE INDEX "Follow_followerId_unfollowedAt_idx" ON "Follow"("followerId", "unfollowedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Follow_followerId_targetType_targetId_key" ON "Follow"("followerId", "targetType", "targetId");

-- CreateIndex
CREATE INDEX "ContentLike_subjectType_subjectId_unlikedAt_idx" ON "ContentLike"("subjectType", "subjectId", "unlikedAt");

-- CreateIndex
CREATE INDEX "ContentLike_userId_unlikedAt_idx" ON "ContentLike"("userId", "unlikedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ContentLike_userId_subjectType_subjectId_key" ON "ContentLike"("userId", "subjectType", "subjectId");

-- CreateIndex
CREATE INDEX "ContentComment_subjectType_subjectId_createdAt_idx" ON "ContentComment"("subjectType", "subjectId", "createdAt");

-- CreateIndex
CREATE INDEX "ContentComment_parentId_createdAt_idx" ON "ContentComment"("parentId", "createdAt");

-- CreateIndex
CREATE INDEX "ContentComment_authorId_idx" ON "ContentComment"("authorId");

-- CreateIndex
CREATE INDEX "ContentReshare_subjectType_subjectId_undoneAt_idx" ON "ContentReshare"("subjectType", "subjectId", "undoneAt");

-- CreateIndex
CREATE INDEX "ContentReshare_sharerId_undoneAt_idx" ON "ContentReshare"("sharerId", "undoneAt");

-- CreateIndex
CREATE UNIQUE INDEX "ContentReshare_sharerId_subjectType_subjectId_key" ON "ContentReshare"("sharerId", "subjectType", "subjectId");

-- CreateIndex
CREATE INDEX "ContentBookmark_userId_removedAt_createdAt_idx" ON "ContentBookmark"("userId", "removedAt", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ContentBookmark_userId_subjectType_subjectId_key" ON "ContentBookmark"("userId", "subjectType", "subjectId");

-- CreateIndex
CREATE INDEX "ContentView_subjectType_subjectId_idx" ON "ContentView"("subjectType", "subjectId");

-- CreateIndex
CREATE UNIQUE INDEX "ContentView_viewerId_subjectType_subjectId_key" ON "ContentView"("viewerId", "subjectType", "subjectId");

-- AddForeignKey
ALTER TABLE "Follow" ADD CONSTRAINT "Follow_followerId_fkey" FOREIGN KEY ("followerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentLike" ADD CONSTRAINT "ContentLike_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentComment" ADD CONSTRAINT "ContentComment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentComment" ADD CONSTRAINT "ContentComment_removedById_fkey" FOREIGN KEY ("removedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentComment" ADD CONSTRAINT "ContentComment_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "ContentComment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentReshare" ADD CONSTRAINT "ContentReshare_sharerId_fkey" FOREIGN KEY ("sharerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentBookmark" ADD CONSTRAINT "ContentBookmark_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentView" ADD CONSTRAINT "ContentView_viewerId_fkey" FOREIGN KEY ("viewerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
