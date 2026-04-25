-- CreateEnum
CREATE TYPE "EmailJobType" AS ENUM ('transactional', 'bulk');

-- CreateEnum
CREATE TYPE "EmailJobStatus" AS ENUM ('queued', 'processing', 'sent', 'failed', 'dead', 'cancelled');

-- Normalize existing mail job statuses before converting to enums.
UPDATE "EmailJob"
SET "status" = 'processing'
WHERE "status" = 'sending';

UPDATE "EmailJob"
SET "status" = 'failed'
WHERE "status" NOT IN ('queued', 'processing', 'sent', 'failed', 'dead', 'cancelled');

-- AlterTable
ALTER TABLE "EmailJob"
ADD COLUMN "type" "EmailJobType" NOT NULL DEFAULT 'transactional',
ADD COLUMN "recipientName" TEXT,
ADD COLUMN "subject" TEXT,
ADD COLUMN "lockedAt" TIMESTAMP(3),
ADD COLUMN "lockedBy" TEXT,
ADD COLUMN "campaignId" TEXT,
ADD COLUMN "batchKey" TEXT,
ADD COLUMN "provider" TEXT,
ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "EmailJob"
ALTER COLUMN "status" DROP DEFAULT;

ALTER TABLE "EmailJob"
ALTER COLUMN "status" TYPE "EmailJobStatus"
USING ("status"::text::"EmailJobStatus");

ALTER TABLE "EmailJob"
ALTER COLUMN "status" SET DEFAULT 'queued';

-- CreateTable
CREATE TABLE "EmailSuppression" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "reason" TEXT,
    "source" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "suppressedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailSuppression_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailUnsubscribe" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "campaignId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "unsubscribedAt" TIMESTAMP(3),

    CONSTRAINT "EmailUnsubscribe_pkey" PRIMARY KEY ("id")
);

-- DropIndex
DROP INDEX "EmailJob_status_nextAttemptAt_idx";

-- CreateIndex
CREATE INDEX "EmailJob_status_nextAttemptAt_type_idx" ON "EmailJob"("status", "nextAttemptAt", "type");

-- CreateIndex
CREATE INDEX "EmailJob_userEmail_idx" ON "EmailJob"("userEmail");

-- CreateIndex
CREATE INDEX "EmailJob_campaignId_idx" ON "EmailJob"("campaignId");

-- CreateIndex
CREATE UNIQUE INDEX "EmailSuppression_email_key" ON "EmailSuppression"("email");

-- CreateIndex
CREATE UNIQUE INDEX "EmailUnsubscribe_token_key" ON "EmailUnsubscribe"("token");

-- CreateIndex
CREATE INDEX "EmailUnsubscribe_email_idx" ON "EmailUnsubscribe"("email");

-- CreateIndex
CREATE INDEX "EmailUnsubscribe_campaignId_idx" ON "EmailUnsubscribe"("campaignId");
