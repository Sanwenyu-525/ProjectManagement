-- Project memories: AI-callable engineering knowledge
CREATE TABLE IF NOT EXISTS "project_memories" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT,
    "type" TEXT NOT NULL DEFAULT 'session',
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "tags" TEXT,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "sessionId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "project_memories_projectId_idx" ON "project_memories"("projectId");
CREATE INDEX IF NOT EXISTS "project_memories_type_idx" ON "project_memories"("type");

-- Decisions: design decision log
CREATE TABLE IF NOT EXISTS "decisions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT,
    "title" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "alternatives" TEXT,
    "sessionId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "decisions_projectId_idx" ON "decisions"("projectId");
