CREATE TABLE IF NOT EXISTS "AcademicYearLevel" (
  "id" TEXT NOT NULL,
  "academicYearId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "sortOrder" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "AcademicYearLevel_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "AcademicYearLevel_academicYearId_name_key" ON "AcademicYearLevel"("academicYearId", "name");
CREATE INDEX IF NOT EXISTS "AcademicYearLevel_academicYearId_sortOrder_idx" ON "AcademicYearLevel"("academicYearId", "sortOrder");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'AcademicYearLevel_academicYearId_fkey'
  ) THEN
    ALTER TABLE "AcademicYearLevel"
      ADD CONSTRAINT "AcademicYearLevel_academicYearId_fkey"
      FOREIGN KEY ("academicYearId")
      REFERENCES "AcademicYear"("id")
      ON DELETE RESTRICT
      ON UPDATE CASCADE;
  END IF;
END $$;

ALTER TABLE "StudentProfile" ADD COLUMN IF NOT EXISTS "academicYearLevelId" TEXT;
ALTER TABLE "StudentProfile" ADD COLUMN IF NOT EXISTS "yearLevelName" TEXT;

CREATE INDEX IF NOT EXISTS "StudentProfile_academicYearLevelId_idx" ON "StudentProfile"("academicYearLevelId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'StudentProfile_academicYearLevelId_fkey'
  ) THEN
    ALTER TABLE "StudentProfile"
      ADD CONSTRAINT "StudentProfile_academicYearLevelId_fkey"
      FOREIGN KEY ("academicYearLevelId")
      REFERENCES "AcademicYearLevel"("id")
      ON DELETE SET NULL
      ON UPDATE CASCADE;
  END IF;
END $$;
