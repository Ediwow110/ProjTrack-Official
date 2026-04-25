ALTER TYPE "EmailJobStatus" ADD VALUE IF NOT EXISTS 'paused_limit_reached';

ALTER TABLE "EmailJob"
  ADD COLUMN "failureReason" TEXT;

CREATE INDEX "EmailJob_failureReason_idx" ON "EmailJob"("failureReason");
