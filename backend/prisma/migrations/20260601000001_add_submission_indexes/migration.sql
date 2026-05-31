-- CreateIndex
CREATE INDEX IF NOT EXISTS "Submission_studentId_status_idx" ON "Submission"("studentId", "status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Submission_taskId_studentId_idx" ON "Submission"("taskId", "studentId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Submission_taskId_groupId_idx" ON "Submission"("taskId", "groupId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Submission_subjectId_status_idx" ON "Submission"("subjectId", "status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Submission_reviewerId_status_idx" ON "Submission"("reviewerId", "status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Submission_subjectId_studentId_idx" ON "Submission"("subjectId", "studentId");
