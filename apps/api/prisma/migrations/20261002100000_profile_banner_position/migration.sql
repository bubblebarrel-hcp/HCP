-- Profile banner reposition (D56), mirroring Kennel.bannerPosition (D37): where
-- the banner's crop sits, as a CSS background-position pair. Null is centred.
ALTER TABLE "User" ADD COLUMN "bannerPosition" TEXT;
