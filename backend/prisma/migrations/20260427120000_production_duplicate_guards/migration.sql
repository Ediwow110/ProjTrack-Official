-- Duplicate protection hardening for production readiness.
-- Run the duplicate scan script before applying this migration to shared environments.

DROP INDEX IF EXISTS "SubmissionTask_title_key";

CREATE UNIQUE INDEX IF NOT EXISTS "SubmissionTask_subjectId_title_key"
ON "SubmissionTask"("subjectId", "title");

ALTER TABLE "Notification"
ADD COLUMN IF NOT EXISTS "dedupeKey" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "Notification_dedupeKey_key"
ON "Notification"("dedupeKey");

CREATE UNIQUE INDEX IF NOT EXISTS "Submission_task_student_unique_idx"
ON "Submission"("taskId", "studentId")
WHERE "studentId" IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "Submission_task_group_unique_idx"
ON "Submission"("taskId", "groupId")
WHERE "groupId" IS NOT NULL;
