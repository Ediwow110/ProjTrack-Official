-- CreateEnum
CREATE TYPE "AccountActionTokenType" AS ENUM ('PASSWORD_RESET', 'ACCOUNT_ACTIVATION');

-- AlterTable
ALTER TABLE "EmailJob"
  ADD COLUMN "deliveredAt" TIMESTAMP(3),
  ADD COLUMN "idempotencyKey" TEXT,
  ADD COLUMN "idempotencyUntil" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "EmailProviderEvent" (
  "id" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "providerEventId" TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  "providerMessageId" TEXT,
  "email" TEXT,
  "payload" JSONB NOT NULL,
  "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "processedAt" TIMESTAMP(3),

  CONSTRAINT "EmailProviderEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccountActionToken" (
  "id" TEXT NOT NULL,
  "type" "AccountActionTokenType" NOT NULL,
  "userId" TEXT NOT NULL,
  "publicRef" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "encryptedToken" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "usedAt" TIMESTAMP(3),
  "revokedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "AccountActionToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EmailJob_idempotencyKey_key" ON "EmailJob"("idempotencyKey");
CREATE INDEX "EmailJob_idempotencyUntil_idx" ON "EmailJob"("idempotencyUntil");
CREATE INDEX "EmailJob_providerMessageId_idx" ON "EmailJob"("providerMessageId");

CREATE UNIQUE INDEX "EmailProviderEvent_provider_providerEventId_key" ON "EmailProviderEvent"("provider", "providerEventId");
CREATE INDEX "EmailProviderEvent_providerMessageId_idx" ON "EmailProviderEvent"("providerMessageId");
CREATE INDEX "EmailProviderEvent_email_idx" ON "EmailProviderEvent"("email");
CREATE INDEX "EmailProviderEvent_eventType_idx" ON "EmailProviderEvent"("eventType");

CREATE UNIQUE INDEX "AccountActionToken_publicRef_key" ON "AccountActionToken"("publicRef");
CREATE INDEX "AccountActionToken_userId_type_expiresAt_idx" ON "AccountActionToken"("userId", "type", "expiresAt");
CREATE INDEX "AccountActionToken_type_publicRef_idx" ON "AccountActionToken"("type", "publicRef");
CREATE INDEX "AccountActionToken_usedAt_idx" ON "AccountActionToken"("usedAt");

-- AddForeignKey
ALTER TABLE "AccountActionToken"
  ADD CONSTRAINT "AccountActionToken_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Legacy token cleanup
ALTER TABLE "User"
  DROP COLUMN IF EXISTS "resetToken",
  DROP COLUMN IF EXISTS "resetExpiresAt",
  DROP COLUMN IF EXISTS "activationToken",
  DROP COLUMN IF EXISTS "activationExpiresAt";
