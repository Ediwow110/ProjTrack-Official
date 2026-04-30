CREATE INDEX IF NOT EXISTS "User_role_status_idx" ON "User"("role", "status");
CREATE INDEX IF NOT EXISTS "User_status_updatedAt_idx" ON "User"("status", "updatedAt");
CREATE INDEX IF NOT EXISTS "StudentProfile_sectionId_idx" ON "StudentProfile"("sectionId");
CREATE INDEX IF NOT EXISTS "StudentProfile_academicYearId_idx" ON "StudentProfile"("academicYearId");
CREATE INDEX IF NOT EXISTS "TeacherProfile_department_idx" ON "TeacherProfile"("department");
CREATE INDEX IF NOT EXISTS "SubmissionFile_deletedAt_createdAt_idx" ON "SubmissionFile"("deletedAt", "createdAt");

-- CreateIndex
CREATE INDEX "AcademicStructure_academicYearId_idx" ON "AcademicStructure"("academicYearId");

-- CreateIndex
CREATE INDEX "AcademicStructure_departmentId_idx" ON "AcademicStructure"("departmentId");

-- CreateIndex
CREATE INDEX "AcademicStructure_programId_idx" ON "AcademicStructure"("programId");

-- CreateIndex
CREATE INDEX "AcademicStructure_sectionId_idx" ON "AcademicStructure"("sectionId");

-- CreateIndex
CREATE INDEX "AcademicStructureBatch_academicYearId_idx" ON "AcademicStructureBatch"("academicYearId");

-- CreateIndex
CREATE INDEX "AcademicStructureBatch_departmentId_idx" ON "AcademicStructureBatch"("departmentId");

-- CreateIndex
CREATE INDEX "AcademicStructureBatch_programId_idx" ON "AcademicStructureBatch"("programId");

-- CreateIndex
CREATE INDEX "AcademicStructureBatch_batchId_idx" ON "AcademicStructureBatch"("batchId");

-- CreateIndex
CREATE INDEX "Project_academicYearId_idx" ON "Project"("academicYearId");

-- CreateIndex
CREATE INDEX "Project_departmentId_idx" ON "Project"("departmentId");

-- CreateIndex
CREATE INDEX "Project_programId_idx" ON "Project"("programId");

-- CreateIndex
CREATE INDEX "Project_sectionId_idx" ON "Project"("sectionId");

-- CreateIndex
CREATE INDEX "Project_batchId_idx" ON "Project"("batchId");

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
CREATE INDEX "ProjectReview_departmentId_idx" ON "ProjectReview"("departmentId");

-- CreateIndex
CREATE INDEX "ProjectReview_programId_idx" ON "ProjectReview"("programId");

-- CreateIndex
CREATE INDEX "ProjectReview_sectionId_idx" ON "ProjectReview"("sectionId");

-- CreateIndex
CREATE INDEX "ProjectReview_batchId_idx" ON "ProjectReview"("batchId");

-- CreateIndex
CREATE INDEX "ProjectReview_projectId_idx" ON "ProjectReview"("projectId");

-- CreateIndex
CREATE INDEX "ProjectReview_submissionId_idx" ON "ProjectReview"("submissionId");

-- CreateIndex
CREATE INDEX "ProjectReview_reviewerId_idx" ON "ProjectReview"("reviewerId");
