-- Restore center fields for soft-delete and restore functionality
-- Applied to Announcement, Department, Section, and Subject tables

-- Add soft-delete and restore tracking columns to Announcement
ALTER TABLE "Announcement" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMPTZ;
ALTER TABLE "Announcement" ADD COLUMN IF NOT EXISTS "deletedById" TEXT;
ALTER TABLE "Announcement" ADD COLUMN IF NOT EXISTS "purgeAfter" TIMESTAMPTZ;
ALTER TABLE "Announcement" ADD COLUMN IF NOT EXISTS "restoredAt" TIMESTAMPTZ;
ALTER TABLE "Announcement" ADD COLUMN IF NOT EXISTS "restoredById" TEXT;
CREATE INDEX IF NOT EXISTS "Announcement_deletedAt_idx" ON "Announcement"("deletedAt");
CREATE INDEX IF NOT EXISTS "Announcement_purgeAfter_idx" ON "Announcement"("purgeAfter");

-- Add soft-delete and restore tracking columns to Department
ALTER TABLE "Department" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMPTZ;
ALTER TABLE "Department" ADD COLUMN IF NOT EXISTS "deletedById" TEXT;
ALTER TABLE "Department" ADD COLUMN IF NOT EXISTS "purgeAfter" TIMESTAMPTZ;
ALTER TABLE "Department" ADD COLUMN IF NOT EXISTS "restoredAt" TIMESTAMPTZ;
ALTER TABLE "Department" ADD COLUMN IF NOT EXISTS "restoredById" TEXT;
CREATE INDEX IF NOT EXISTS "Department_deletedAt_idx" ON "Department"("deletedAt");
CREATE INDEX IF NOT EXISTS "Department_purgeAfter_idx" ON "Department"("purgeAfter");

-- Add soft-delete and restore tracking columns to Section
ALTER TABLE "Section" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMPTZ;
ALTER TABLE "Section" ADD COLUMN IF NOT EXISTS "deletedById" TEXT;
ALTER TABLE "Section" ADD COLUMN IF NOT EXISTS "purgeAfter" TIMESTAMPTZ;
ALTER TABLE "Section" ADD COLUMN IF NOT EXISTS "restoredAt" TIMESTAMPTZ;
ALTER TABLE "Section" ADD COLUMN IF NOT EXISTS "restoredById" TEXT;
CREATE INDEX IF NOT EXISTS "Section_deletedAt_idx" ON "Section"("deletedAt");
CREATE INDEX IF NOT EXISTS "Section_purgeAfter_idx" ON "Section"("purgeAfter");

-- Add soft-delete and restore tracking columns to Subject
ALTER TABLE "Subject" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMPTZ;
ALTER TABLE "Subject" ADD COLUMN IF NOT EXISTS "deletedById" TEXT;
ALTER TABLE "Subject" ADD COLUMN IF NOT EXISTS "purgeAfter" TIMESTAMPTZ;
ALTER TABLE "Subject" ADD COLUMN IF NOT EXISTS "restoredAt" TIMESTAMPTZ;
ALTER TABLE "Subject" ADD COLUMN IF NOT EXISTS "restoredById" TEXT;
CREATE INDEX IF NOT EXISTS "Subject_deletedAt_idx" ON "Subject"("deletedAt");
CREATE INDEX IF NOT EXISTS "Subject_purgeAfter_idx" ON "Subject"("purgeAfter");
