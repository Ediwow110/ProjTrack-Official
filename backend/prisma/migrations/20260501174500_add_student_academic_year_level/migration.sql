ALTER TABLE "StudentProfile" ADD COLUMN IF NOT EXISTS "academicYearLevelId" TEXT;

CREATE INDEX IF NOT EXISTS "StudentProfile_academicYearLevelId_idx" ON "StudentProfile"("academicYearLevelId");

ALTER TABLE "StudentProfile"
  ADD CONSTRAINT "StudentProfile_academicYearLevelId_fkey"
  FOREIGN KEY ("academicYearLevelId")
  REFERENCES "AcademicYearLevel"("id")
  ON DELETE SET NULL
  ON UPDATE CASCADE;
