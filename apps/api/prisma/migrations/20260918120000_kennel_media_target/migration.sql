-- Kennel branding (D37): a kennel's logo and banner are media assets linked to
-- the kennel itself, so BR-RUN-007 still holds — nothing is orphaned.
ALTER TYPE "MediaTargetType" ADD VALUE IF NOT EXISTS 'KENNEL';
