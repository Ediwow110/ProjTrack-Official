-- School-scale performance indexes for active high-volume read paths.
-- These indexes support 20k-50k registered-user data volume gates.

-- Student submission list: WHERE studentId = ? ORDER BY createdAt DESC
CREATE INDEX IF NOT EXISTS "Submission_studentId_createdAt_idx"
  ON "Submission" ("studentId", "createdAt" DESC)
  WHERE "studentId" IS NOT NULL;

-- Group submission lookup/list support.
CREATE INDEX IF NOT EXISTS "Submission_groupId_createdAt_idx"
  ON "Submission" ("groupId", "createdAt" DESC)
  WHERE "groupId" IS NOT NULL;

-- Teacher list/export scoped by task -> subject -> teacher, and ordered by createdAt.
CREATE INDEX IF NOT EXISTS "Submission_taskId_createdAt_idx"
  ON "Submission" ("taskId", "createdAt" DESC);

-- Teacher and admin filters by subject/status with createdAt ordering.
CREATE INDEX IF NOT EXISTS "Submission_subjectId_createdAt_idx"
  ON "Submission" ("subjectId", "createdAt" DESC);

CREATE INDEX IF NOT EXISTS "Submission_subjectId_status_createdAt_idx"
  ON "Submission" ("subjectId", "status", "createdAt" DESC);

CREATE INDEX IF NOT EXISTS "Submission_status_createdAt_idx"
  ON "Submission" ("status", "createdAt" DESC);

-- Subject ownership and status filters.
CREATE INDEX IF NOT EXISTS "Subject_teacherId_status_idx"
  ON "Subject" ("teacherId", "status")
  WHERE "teacherId" IS NOT NULL;

-- Task lookup through teacher-owned subjects and ordering/filtering by subject.
CREATE INDEX IF NOT EXISTS "SubmissionTask_subjectId_createdAt_idx"
  ON "SubmissionTask" ("subjectId", "createdAt" DESC);

-- Enrollment and section-scoped teacher/student views.
CREATE INDEX IF NOT EXISTS "Enrollment_subjectId_sectionId_idx"
  ON "Enrollment" ("subjectId", "sectionId");

CREATE INDEX IF NOT EXISTS "Enrollment_sectionId_subjectId_idx"
  ON "Enrollment" ("sectionId", "subjectId");

-- Group and group-member authorization/list paths.
CREATE INDEX IF NOT EXISTS "Group_subjectId_sectionId_status_idx"
  ON "Group" ("subjectId", "sectionId", "status");

CREATE INDEX IF NOT EXISTS "GroupMember_studentId_status_idx"
  ON "GroupMember" ("studentId", "status");

CREATE INDEX IF NOT EXISTS "GroupMember_subjectId_status_idx"
  ON "GroupMember" ("subjectId", "status");

-- Notification list/read-state paths at large user counts.
CREATE INDEX IF NOT EXISTS "Notification_userId_createdAt_idx"
  ON "Notification" ("userId", "createdAt" DESC);

CREATE INDEX IF NOT EXISTS "Notification_userId_isRead_createdAt_idx"
  ON "Notification" ("userId", "isRead", "createdAt" DESC);

-- Audit log review paths by actor/module/time.
CREATE INDEX IF NOT EXISTS "AuditLog_actorUserId_createdAt_idx"
  ON "AuditLog" ("actorUserId", "createdAt" DESC)
  WHERE "actorUserId" IS NOT NULL;

CREATE INDEX IF NOT EXISTS "AuditLog_module_createdAt_idx"
  ON "AuditLog" ("module", "createdAt" DESC);
