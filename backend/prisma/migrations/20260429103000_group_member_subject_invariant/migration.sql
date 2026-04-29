-- Enforce one active group membership per subject per student.
-- Existing rows are backfilled from the owning Group.subjectId before the column is made required.

ALTER TABLE "GroupMember"
ADD COLUMN IF NOT EXISTS "subjectId" TEXT;

UPDATE "GroupMember" gm
SET "subjectId" = g."subjectId"
FROM "Group" g
WHERE gm."groupId" = g."id"
  AND gm."subjectId" IS NULL;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "GroupMember" WHERE "subjectId" IS NULL) THEN
    RAISE EXCEPTION 'Cannot enforce GroupMember.subjectId: existing memberships are missing a matching group subject.';
  END IF;
END $$;

ALTER TABLE "GroupMember"
ALTER COLUMN "subjectId" SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'GroupMember_subjectId_fkey'
      AND table_name = 'GroupMember'
  ) THEN
    ALTER TABLE "GroupMember"
    ADD CONSTRAINT "GroupMember_subjectId_fkey"
    FOREIGN KEY ("subjectId") REFERENCES "Subject"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "GroupMember_subjectId_idx"
ON "GroupMember"("subjectId");

CREATE UNIQUE INDEX IF NOT EXISTS "GroupMember_subjectId_studentId_key"
ON "GroupMember"("subjectId", "studentId");
