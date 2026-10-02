-- D57: a post carries its own audience, which can only narrow its author's profile.
ALTER TABLE "Post" ADD COLUMN "visibility" "Audience" NOT NULL DEFAULT 'PUBLIC';
