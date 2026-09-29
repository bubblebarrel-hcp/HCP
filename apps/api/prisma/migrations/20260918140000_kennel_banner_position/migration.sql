-- Kennel branding (D37): where the banner's crop sits, as a CSS
-- background-position pair. Null is centred, which is the old behaviour.
ALTER TABLE "Kennel" ADD COLUMN "bannerPosition" TEXT;
