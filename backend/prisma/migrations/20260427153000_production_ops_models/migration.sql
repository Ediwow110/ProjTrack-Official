-- Production operations, authorization, and audit-support models.

CREATE TABLE IF NOT EXISTS "SubjectSection" (
  "id" TEXT NOT NULL,
  "subjectId" TEXT NOT NULL,
  "sectionId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SubjectSection_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "SubjectSection_subjectId_sectionId_key"
ON "SubjectSection"("subjectId", "sectionId");

CREATE INDEX IF NOT EXISTS "SubjectSection_sectionId_idx"
ON "SubjectSection"("sectionId");

ALTER TABLE "SubjectSection"
ADD CONSTRAINT "SubjectSection_subjectId_fkey"
FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SubjectSection"
ADD CONSTRAINT "SubjectSection_sectionId_fkey"
FOREIGN KEY ("sectionId") REFERENCES "Section"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "SubjectSection" ("id", "subjectId", "sectionId", "createdAt")
SELECT 'ss_' || md5(e."subjectId" || ':' || e."sectionId"), e."subjectId", e."sectionId", CURRENT_TIMESTAMP
FROM "Enrollment" e
WHERE e."sectionId" IS NOT NULL
ON CONFLICT ("subjectId", "sectionId") DO NOTHING;

CREATE TABLE IF NOT EXISTS "SubmissionEvent" (
  "id" TEXT NOT NULL,
  "submissionId" TEXT NOT NULL,
  "actorUserId" TEXT,
  "action" TEXT NOT NULL,
  "fromStatus" TEXT,
  "toStatus" TEXT,
  "details" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SubmissionEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "SubmissionEvent_submissionId_createdAt_idx"
ON "SubmissionEvent"("submissionId", "createdAt");

CREATE INDEX IF NOT EXISTS "SubmissionEvent_actorUserId_idx"
ON "SubmissionEvent"("actorUserId");

ALTER TABLE "SubmissionEvent"
ADD CONSTRAINT "SubmissionEvent_submissionId_fkey"
FOREIGN KEY ("submissionId") REFERENCES "Submission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SubmissionEvent"
ADD CONSTRAINT "SubmissionEvent_actorUserId_fkey"
FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "BackupRun" (
  "id" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "trigger" TEXT NOT NULL,
  "backupType" TEXT NOT NULL,
  "fileName" TEXT,
  "artifactPath" TEXT,
  "storage" TEXT NOT NULL DEFAULT 'local',
  "driveFileId" TEXT,
  "sizeBytes" BIGINT,
  "sha256" TEXT,
  "recordCounts" JSONB,
  "isProtected" BOOLEAN NOT NULL DEFAULT false,
  "retentionClass" TEXT,
  "expiresAt" TIMESTAMP(3),
  "error" TEXT,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),
  "deletedAt" TIMESTAMP(3),
  "createdById" TEXT,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BackupRun_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "BackupRun_status_completedAt_idx"
ON "BackupRun"("status", "completedAt");

CREATE INDEX IF NOT EXISTS "BackupRun_trigger_idx"
ON "BackupRun"("trigger");

CREATE INDEX IF NOT EXISTS "BackupRun_deletedAt_idx"
ON "BackupRun"("deletedAt");

CREATE INDEX IF NOT EXISTS "BackupRun_createdById_idx"
ON "BackupRun"("createdById");

ALTER TABLE "BackupRun"
ADD CONSTRAINT "BackupRun_createdById_fkey"
FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "ImportBatch" (
  "id" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "fileName" TEXT,
  "payload" JSONB NOT NULL,
  "createdById" TEXT,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "consumedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ImportBatch_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ImportBatch_type_status_idx"
ON "ImportBatch"("type", "status");

CREATE INDEX IF NOT EXISTS "ImportBatch_expiresAt_idx"
ON "ImportBatch"("expiresAt");

CREATE INDEX IF NOT EXISTS "ImportBatch_createdById_idx"
ON "ImportBatch"("createdById");

ALTER TABLE "ImportBatch"
ADD CONSTRAINT "ImportBatch_createdById_fkey"
FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "SubmissionFile"
ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "SubmissionFile_relativePath_idx"
ON "SubmissionFile"("relativePath");

CREATE INDEX IF NOT EXISTS "SubmissionFile_submissionId_deletedAt_idx"
ON "SubmissionFile"("submissionId", "deletedAt");
