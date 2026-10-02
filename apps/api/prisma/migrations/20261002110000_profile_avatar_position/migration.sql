-- Profile picture reposition (D56): where the round crop sits, as a CSS
-- object-position pair, mirroring bannerPosition. Null is centred.
ALTER TABLE "User" ADD COLUMN "avatarPosition" TEXT;
