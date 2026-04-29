ALTER TABLE "EmailJob"
ADD COLUMN     "retryableFailure" BOOLEAN,
ADD COLUMN     "archivedAt" TIMESTAMP(3);

CREATE TABLE "WorkerHeartbeat" (
    "key" TEXT NOT NULL,
    "workerId" TEXT NOT NULL,
    "provider" TEXT,
    "pollMs" INTEGER,
    "heartbeatAt" TIMESTAMP(3) NOT NULL,
    "lastProcessedJobAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkerHeartbeat_pkey" PRIMARY KEY ("key")
);

CREATE INDEX "EmailJob_provider_archivedAt_status_nextAttemptAt_type_idx" ON "EmailJob"("provider", "archivedAt", "status", "nextAttemptAt", "type");
CREATE INDEX "EmailJob_archivedAt_idx" ON "EmailJob"("archivedAt");
CREATE INDEX "WorkerHeartbeat_heartbeatAt_idx" ON "WorkerHeartbeat"("heartbeatAt");
CREATE INDEX "WorkerHeartbeat_provider_idx" ON "WorkerHeartbeat"("provider");
