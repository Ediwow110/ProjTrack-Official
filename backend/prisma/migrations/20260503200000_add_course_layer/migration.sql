-- Add Course layer: Academic Year -> Course -> Year Level -> Section

CREATE TABLE IF NOT EXISTS "Course" (
  "id"             TEXT NOT NULL,
  "academicYearId" TEXT NOT NULL,
  "name"           TEXT NOT NULL,
  "code"           TEXT,
  "description"    TEXT,
  "sortOrder"      INTEGER,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Course_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Course_academicYearId_name_key"
  ON "Course"("academicYearId", "name");

CREATE INDEX IF NOT EXISTS "Course_academicYearId_sortOrder_idx"
  ON "Course"("academicYearId", "sortOrder");

ALTER TABLE "Course"
  ADD CONSTRAINT "Course_academicYearId_fkey"
  FOREIGN KEY ("academicYearId") REFERENCES "AcademicYear"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AcademicYearLevel"
  ADD COLUMN IF NOT EXISTS "courseId" TEXT;

CREATE INDEX IF NOT EXISTS "AcademicYearLevel_courseId_idx"
  ON "AcademicYearLevel"("courseId");

ALTER TABLE "AcademicYearLevel"
  ADD CONSTRAINT IF NOT EXISTS "AcademicYearLevel_courseId_fkey"
  FOREIGN KEY ("courseId") REFERENCES "Course"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
