-- Add evidence-backed indexes from query-plan audit (perf/query-plan-index-audit)
-- Approved indexes only:
-- 1. Notification(userId, isRead, createdAt)
-- 2. AuditLog(createdAt)
-- 3. AuditLog(actorUserId, createdAt)

-- Notification: supports unread lists and counts filtered by user + read state + recency
CREATE INDEX "Notification_userId_isRead_createdAt_idx" ON "Notification"("userId", "isRead", "createdAt");

-- AuditLog: supports global recent activity views (admin)
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- AuditLog: supports per-actor recent activity queries
CREATE INDEX "AuditLog_actorUserId_createdAt_idx" ON "AuditLog"("actorUserId", "createdAt");
