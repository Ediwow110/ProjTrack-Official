-- Add evidence-backed indexes from query-plan audit (perf/query-plan-index-audit)
-- Approved indexes only:
-- 1. Notification(userId, isRead, createdAt)
-- 2. AuditLog(createdAt)
-- 3. AuditLog(actorUserId, createdAt)
--
-- Note: These indexes may already exist in some environments from the earlier
-- 20260514000100_school_scale_performance_indexes migration (which used IF NOT EXISTS).
-- Using IF NOT EXISTS here makes this migration safe to deploy in CI and production
-- without failing when the indexes are already present.

-- Notification: supports unread lists and counts filtered by user + read state + recency
CREATE INDEX IF NOT EXISTS "Notification_userId_isRead_createdAt_idx" ON "Notification"("userId", "isRead", "createdAt");

-- AuditLog: supports global recent activity views (admin)
CREATE INDEX IF NOT EXISTS "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- AuditLog: supports per-actor recent activity queries
CREATE INDEX IF NOT EXISTS "AuditLog_actorUserId_createdAt_idx" ON "AuditLog"("actorUserId", "createdAt");
