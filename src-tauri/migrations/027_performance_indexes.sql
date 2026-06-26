-- 清理查询性能索引 (P0 性能修复)
CREATE INDEX IF NOT EXISTS "idx_sessions_status_started" ON "agent_sessions"("status", "startedAt");
CREATE INDEX IF NOT EXISTS "idx_messages_session_timestamp" ON "agent_messages"("sessionId", "timestamp");
