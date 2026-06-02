-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "UserStatus" ADD VALUE 'DISABLED';
ALTER TYPE "UserStatus" ADD VALUE 'ARCHIVED';
ALTER TYPE "UserStatus" ADD VALUE 'GRADUATED';

-- DropForeignKey
ALTER TABLE "Course" DROP CONSTRAINT "Course_academicYearId_fkey";

-- DropIndex
DROP INDEX "AcademicYearLevel_courseId_idx";

-- DropIndex
DROP INDEX "AuditLog_module_createdAt_idx";

-- DropIndex
DROP INDEX "Enrollment_sectionId_subjectId_idx";

-- DropIndex
DROP INDEX "Enrollment_subjectId_sectionId_idx";

-- DropIndex
DROP INDEX "Group_subjectId_sectionId_status_idx";

-- DropIndex
DROP INDEX "GroupMember_studentId_status_idx";

-- DropIndex
DROP INDEX "GroupMember_subjectId_status_idx";

-- DropIndex
DROP INDEX "Notification_userId_createdAt_idx";

-- DropIndex
DROP INDEX "Notification_userId_isRead_createdAt_idx";

-- DropIndex
DROP INDEX "Section_academicYearLevelId_idx";

-- DropIndex
DROP INDEX "Submission_status_createdAt_idx";

-- DropIndex
DROP INDEX "Submission_subjectId_createdAt_idx";

-- DropIndex
DROP INDEX "Submission_subjectId_status_createdAt_idx";

-- DropIndex
DROP INDEX "Submission_taskId_createdAt_idx";

-- DropIndex
DROP INDEX "SubmissionTask_subjectId_createdAt_idx";

-- AlterTable
ALTER TABLE "AcademicYear" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "AcademicYearLevel" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "BackupRun" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Course" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Department" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "EmailJob" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "EmailSuppression" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "EmailUnsubscribe" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "ImportBatch" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Section" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- CreateIndex
CREATE INDEX "AuditLog_actorUserId_createdAt_idx" ON "AuditLog"("actorUserId", "createdAt");

-- CreateIndex
CREATE INDEX "Notification_userId_isRead_createdAt_idx" ON "Notification"("userId", "isRead", "createdAt");

-- AddForeignKey
ALTER TABLE "Course" ADD CONSTRAINT "Course_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "AcademicYear"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
