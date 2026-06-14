CREATE TABLE IF NOT EXISTS "agent_sessions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "agentTabId" TEXT NOT NULL,
    "runtimeId" TEXT NOT NULL DEFAULT 'claude',
    "startedAt" TEXT NOT NULL,
    "endedAt" TEXT,
    "status" TEXT NOT NULL DEFAULT 'running',
    "projectId" TEXT,
    "cwd" TEXT,
    CONSTRAINT "agent_sessions_projectId_fkey"
        FOREIGN KEY ("projectId") REFERENCES "projects" ("id") ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS "agent_sessions_agentTabId_idx" ON "agent_sessions"("agentTabId");

CREATE TABLE IF NOT EXISTS "agent_messages" (
    "id" INTEGER PRIMARY KEY AUTOINCREMENT,
    "sessionId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "timestamp" TEXT NOT NULL,
    CONSTRAINT "agent_messages_sessionId_fkey"
        FOREIGN KEY ("sessionId") REFERENCES "agent_sessions" ("id") ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "agent_messages_sessionId_idx" ON "agent_messages"("sessionId");
