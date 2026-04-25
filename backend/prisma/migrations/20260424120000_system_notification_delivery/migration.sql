-- AlterTable
ALTER TABLE "SystemSetting"
  ADD COLUMN "accountAccessEmailsEnabled" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "classroomActivityEmailsEnabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "classroomActivitySystemNotificationsEnabled" BOOLEAN NOT NULL DEFAULT true;
