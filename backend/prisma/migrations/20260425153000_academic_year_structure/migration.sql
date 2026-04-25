-- CreateEnum
DO $$
BEGIN
  CREATE TYPE "AcademicYearStatus" AS ENUM ('ACTIVE', 'ARCHIVED', 'UPCOMING');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- AlterEnum
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum
    WHERE enumlabel = 'PENDING_SETUP'
      AND enumtypid = to_regtype('"UserStatus"')
  ) THEN
    ALTER TYPE "UserStatus" ADD VALUE 'PENDING_SETUP';
  END IF;
END $$;

-- CreateTable
CREATE TABLE "AcademicYear" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "status" "AcademicYearStatus" NOT NULL DEFAULT 'UPCOMING',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "AcademicYear_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "Section"
  ADD COLUMN "academicYearId" TEXT,
  ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "StudentProfile"
  ADD COLUMN "academicYearId" TEXT;

-- Backfill academic years from settings or current calendar year
INSERT INTO "AcademicYear" ("id", "name", "status", "createdAt", "updatedAt")
SELECT
  concat('ay_', substring(md5(random()::text || clock_timestamp()::text) from 1 for 24)),
  trim(source."name"),
  'ACTIVE'::"AcademicYearStatus",
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM (
  SELECT COALESCE(
    NULLIF((SELECT trim("schoolYear") FROM "AcademicSetting" ORDER BY "updatedAt" DESC LIMIT 1), ''),
    concat(
      EXTRACT(YEAR FROM CURRENT_DATE)::text,
      '-',
      EXTRACT(YEAR FROM CURRENT_DATE + interval '1 year')::text
    )
  ) AS "name"
) AS source
WHERE NOT EXISTS (
  SELECT 1
  FROM "AcademicYear"
  WHERE "name" = source."name"
);

WITH target AS (
  SELECT "id"
  FROM "AcademicYear"
  WHERE "name" = COALESCE(
    NULLIF((SELECT trim("schoolYear") FROM "AcademicSetting" ORDER BY "updatedAt" DESC LIMIT 1), ''),
    concat(
      EXTRACT(YEAR FROM CURRENT_DATE)::text,
      '-',
      EXTRACT(YEAR FROM CURRENT_DATE + interval '1 year')::text
    )
  )
  ORDER BY "createdAt" DESC
  LIMIT 1
)
UPDATE "AcademicYear"
SET "status" = CASE
  WHEN "AcademicYear"."id" = (SELECT "id" FROM target)
    THEN 'ACTIVE'::"AcademicYearStatus"
  WHEN "AcademicYear"."status" = 'ACTIVE'::"AcademicYearStatus"
    THEN 'UPCOMING'::"AcademicYearStatus"
  ELSE "AcademicYear"."status"
END,
    "updatedAt" = CURRENT_TIMESTAMP;

WITH active_year AS (
  SELECT "id"
  FROM "AcademicYear"
  WHERE "status" = 'ACTIVE'::"AcademicYearStatus"
  ORDER BY "updatedAt" DESC, "createdAt" DESC
  LIMIT 1
)
UPDATE "Section"
SET "academicYearId" = active_year."id",
    "updatedAt" = CURRENT_TIMESTAMP
FROM active_year
WHERE "Section"."academicYearId" IS NULL;

UPDATE "StudentProfile" AS profile
SET "academicYearId" = section."academicYearId",
    "course" = COALESCE(profile."course", section."course"),
    "yearLevel" = COALESCE(profile."yearLevel", section."yearLevel")
FROM "Section" AS section
WHERE profile."sectionId" = section."id"
  AND (
    profile."academicYearId" IS NULL
    OR profile."course" IS NULL
    OR profile."yearLevel" IS NULL
  );

WITH active_year AS (
  SELECT "id"
  FROM "AcademicYear"
  WHERE "status" = 'ACTIVE'::"AcademicYearStatus"
  ORDER BY "updatedAt" DESC, "createdAt" DESC
  LIMIT 1
)
UPDATE "StudentProfile"
SET "academicYearId" = active_year."id"
FROM active_year
WHERE "StudentProfile"."academicYearId" IS NULL;

-- DropIndex
DROP INDEX IF EXISTS "Section_name_key";

-- CreateIndex
CREATE UNIQUE INDEX "AcademicYear_name_key" ON "AcademicYear"("name");
CREATE UNIQUE INDEX "Section_academicYearId_name_key" ON "Section"("academicYearId", "name");
CREATE INDEX "Section_academicYearId_course_yearLevel_idx" ON "Section"("academicYearId", "course", "yearLevel");

-- AddForeignKey
ALTER TABLE "Section"
  ADD CONSTRAINT "Section_academicYearId_fkey"
  FOREIGN KEY ("academicYearId")
  REFERENCES "AcademicYear"("id")
  ON DELETE SET NULL
  ON UPDATE CASCADE;

ALTER TABLE "StudentProfile"
  ADD CONSTRAINT "StudentProfile_academicYearId_fkey"
  FOREIGN KEY ("academicYearId")
  REFERENCES "AcademicYear"("id")
  ON DELETE SET NULL
  ON UPDATE CASCADE;
