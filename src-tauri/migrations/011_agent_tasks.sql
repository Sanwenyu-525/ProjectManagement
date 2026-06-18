CREATE TABLE IF NOT EXISTS "agent_tasks" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionId" TEXT NOT NULL,
    "parentId" TEXT,
    "title" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "priority" TEXT NOT NULL DEFAULT 'medium',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "agent_tasks_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "agent_sessions"("id") ON DELETE CASCADE,
    CONSTRAINT "agent_tasks_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "agent_tasks"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "agent_tasks_sessionId_idx" ON "agent_tasks"("sessionId");
CREATE INDEX IF NOT EXISTS "agent_tasks_parentId_idx" ON "agent_tasks"("parentId");
