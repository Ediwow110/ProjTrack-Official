-- Add database indexes for Submission model to support admin list queries
-- These indexes cover the most common WHERE/ORDER BY patterns

CREATE INDEX IF NOT EXISTS "Submission_subjectId_idx"
  ON "Submission" ("subjectId");

CREATE INDEX IF NOT EXISTS "Submission_studentId_idx"
  ON "Submission" ("studentId")
  WHERE "studentId" IS NOT NULL;

CREATE INDEX IF NOT EXISTS "Submission_taskId_idx"
  ON "Submission" ("taskId");

CREATE INDEX IF NOT EXISTS "Submission_status_subjectId_idx"
  ON "Submission" ("status", "subjectId");

CREATE INDEX IF NOT EXISTS "Submission_submittedAt_idx"
  ON "Submission" ("submittedAt")
  WHERE "submittedAt" IS NOT NULL;