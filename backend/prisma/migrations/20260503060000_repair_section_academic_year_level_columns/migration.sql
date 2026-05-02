ALTER TABLE "Section"
  ADD COLUMN IF NOT EXISTS "academicYearLevelId" TEXT,
  ADD COLUMN IF NOT EXISTS "yearLevelName" TEXT,
  ADD COLUMN IF NOT EXISTS "adviserName" TEXT,
  ADD COLUMN IF NOT EXISTS "description" TEXT;

CREATE INDEX IF NOT EXISTS "Section_academicYearLevelId_idx"
  ON "Section"("academicYearLevelId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'Section_academicYearLevelId_fkey'
  ) THEN
    ALTER TABLE "Section"
      ADD CONSTRAINT "Section_academicYearLevelId_fkey"
      FOREIGN KEY ("academicYearLevelId")
      REFERENCES "AcademicYearLevel"("id")
      ON DELETE SET NULL
      ON UPDATE CASCADE;
  END IF;
END $$;

WITH matched_levels AS (
  SELECT
    section."id" AS "sectionId",
    level."id" AS "levelId",
    level."name" AS "levelName"
  FROM "Section" AS section
  JOIN "AcademicYearLevel" AS level
    ON level."academicYearId" = section."academicYearId"
   AND (
     (section."yearLevel" IS NOT NULL AND level."sortOrder" = section."yearLevel")
     OR lower(trim(level."name")) = lower(trim(COALESCE(section."yearLevelName", '')))
   )
)
UPDATE "Section" AS section
SET
  "academicYearLevelId" = matched_levels."levelId",
  "yearLevelName" = COALESCE(NULLIF(trim(section."yearLevelName"), ''), matched_levels."levelName")
FROM matched_levels
WHERE section."id" = matched_levels."sectionId"
  AND (
    section."academicYearLevelId" IS NULL
    OR NULLIF(trim(section."yearLevelName"), '') IS NULL
  );

UPDATE "Section"
SET "yearLevelName" = CASE
  WHEN "yearLevel" = 1 THEN '1st Year'
  WHEN "yearLevel" = 2 THEN '2nd Year'
  WHEN "yearLevel" = 3 THEN '3rd Year'
  WHEN "yearLevel" = 4 THEN '4th Year'
  WHEN "yearLevel" = 5 THEN '5th Year'
  ELSE "yearLevelName"
END
WHERE NULLIF(trim(COALESCE("yearLevelName", '')), '') IS NULL
  AND "yearLevel" IS NOT NULL;
