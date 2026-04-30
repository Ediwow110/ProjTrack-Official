CREATE INDEX IF NOT EXISTS "User_role_status_idx" ON "User"("role", "status");
CREATE INDEX IF NOT EXISTS "User_status_updatedAt_idx" ON "User"("status", "updatedAt");
CREATE INDEX IF NOT EXISTS "StudentProfile_sectionId_idx" ON "StudentProfile"("sectionId");
CREATE INDEX IF NOT EXISTS "StudentProfile_academicYearId_idx" ON "StudentProfile"("academicYearId");
CREATE INDEX IF NOT EXISTS "TeacherProfile_department_idx" ON "TeacherProfile"("department");
CREATE INDEX IF NOT EXISTS "SubmissionFile_deletedAt_createdAt_idx" ON "SubmissionFile"("deletedAt", "createdAt");

-- CreateIndex
CREATE INDEX "ProjectSubmission_academicYearId_idx" ON "ProjectSubmission"("academicYearId");

-- CreateIndex
CREATE INDEX "ProjectSubmission_departmentId_idx" ON "ProjectSubmission"("departmentId");

-- CreateIndex
CREATE INDEX "ProjectSubmission_programId_idx" ON "ProjectSubmission"("programId");

-- CreateIndex
CREATE INDEX "ProjectSubmission_sectionId_idx" ON "ProjectSubmission"("sectionId");

-- CreateIndex
CREATE INDEX "ProjectSubmission_batchId_idx" ON "ProjectSubmission"("batchId");

-- CreateIndex
CREATE INDEX "ProjectSubmission_projectId_idx" ON "ProjectSubmission"("projectId");

-- CreateIndex
CREATE INDEX "ProjectSubmission_submitterId_idx" ON "ProjectSubmission"("submitterId");

-- CreateIndex
CREATE INDEX "ProjectReview_academicYearId_idx" ON "ProjectReview"("academicYearId");

-- CreateIndex
CREATE INDEX "ProjectReview_reviewerId_idx" ON "ProjectReview"("reviewerId");
