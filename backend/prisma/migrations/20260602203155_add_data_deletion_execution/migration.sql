-- CreateEnum
CREATE TYPE "DataDeletionExecutionStatus" AS ENUM ('DRY_RUN_PENDING', 'DRY_RUN_STARTED', 'DRY_RUN_COMPLETED', 'BACKUP_REQUIRED', 'BACKUP_VERIFIED', 'EXECUTION_PENDING', 'EXECUTION_STARTED', 'EXECUTION_COMPLETED', 'EXECUTION_FAILED', 'RESTORE_REQUIRED', 'CANCELLED');

-- CreateTable
CREATE TABLE "DataDeletionExecution" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "status" "DataDeletionExecutionStatus" NOT NULL DEFAULT 'DRY_RUN_PENDING',
    "dryRun" BOOLEAN NOT NULL DEFAULT true,
    "backupRunId" TEXT,
    "backupVerifiedAt" TIMESTAMP(3),
    "backupVerificationRef" TEXT,
    "executionStartedAt" TIMESTAMP(3),
    "executionCompletedAt" TIMESTAMP(3),
    "executionError" TEXT,
    "executionPlanJson" JSONB,
    "executionResultJson" JSONB,
    "executedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DataDeletionExecution_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DataDeletionExecution_requestId_key" ON "DataDeletionExecution"("requestId");

-- CreateIndex
CREATE INDEX "DataDeletionExecution_status_createdAt_idx" ON "DataDeletionExecution"("status", "createdAt");

-- CreateIndex
CREATE INDEX "DataDeletionExecution_backupRunId_idx" ON "DataDeletionExecution"("backupRunId");

-- AddForeignKey
ALTER TABLE "DataDeletionExecution" ADD CONSTRAINT "DataDeletionExecution_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "DataDeletionRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
