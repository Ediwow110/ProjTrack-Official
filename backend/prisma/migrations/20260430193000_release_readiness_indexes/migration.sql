CREATE INDEX IF NOT EXISTS "User_role_status_idx" ON "User"("role", "status");
CREATE INDEX IF NOT EXISTS "User_status_updatedAt_idx" ON "User"("status", "updatedAt");
CREATE INDEX IF NOT EXISTS "StudentProfile_sectionId_idx" ON "StudentProfile"("sectionId");
CREATE INDEX IF NOT EXISTS "StudentProfile_academicYearId_idx" ON "StudentProfile"("academicYearId");
CREATE INDEX IF NOT EXISTS "StudentProfile_academicYearLevelId_idx" ON "StudentProfile"("academicYearLevelId");
CREATE INDEX IF NOT EXISTS "TeacherProfile_department_idx" ON "TeacherProfile"("department");
CREATE INDEX IF NOT EXISTS "SubmissionFile_deletedAt_createdAt_idx" ON "SubmissionFile"("deletedAt", "createdAt");
