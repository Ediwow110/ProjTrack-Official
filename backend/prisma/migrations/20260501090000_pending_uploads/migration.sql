-- Pending uploads prevent students from attaching arbitrary storage paths to submissions.

CREATE TABLE IF NOT EXISTS "PendingUpload" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "scope" TEXT NOT NULL,
  "storageKey" TEXT NOT NULL,
  "originalFilename" TEXT NOT NULL,
  "sanitizedFilename" TEXT NOT NULL,
  "mimeType" TEXT,
  "detectedExtension" TEXT,
  "sizeBytes" INTEGER NOT NULL,
  "sha256" TEXT,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "consumedAt" TIMESTAMP(3),
  "consumedBySubmissionId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "PendingUpload_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "PendingUpload_storageKey_key"
ON "PendingUpload"("storageKey");

CREATE INDEX IF NOT EXISTS "PendingUpload_userId_status_expiresAt_idx"
ON "PendingUpload"("userId", "status", "expiresAt");

CREATE INDEX IF NOT EXISTS "PendingUpload_expiresAt_idx"
ON "PendingUpload"("expiresAt");

CREATE INDEX IF NOT EXISTS "PendingUpload_consumedBySubmissionId_idx"
ON "PendingUpload"("consumedBySubmissionId");

CREATE INDEX IF NOT EXISTS "PendingUpload_scope_status_idx"
ON "PendingUpload"("scope", "status");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'PendingUpload_userId_fkey'
      AND table_name = 'PendingUpload'
  ) THEN
    ALTER TABLE "PendingUpload"
    ADD CONSTRAINT "PendingUpload_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
