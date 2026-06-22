-- Personal notes: user-authored notes in the knowledge base

CREATE TABLE IF NOT EXISTS "personal_notes" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL DEFAULT '',
    "tags" TEXT,
    "isPinned" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "personal_notes_projectId_idx" ON "personal_notes"("projectId");
CREATE INDEX IF NOT EXISTS "personal_notes_isPinned_idx" ON "personal_notes"("isPinned");

-- Unified knowledge view across all knowledge sources
CREATE VIEW IF NOT EXISTS "knowledge_items" AS
SELECT id, projectId, title, content, tags, isPinned, createdAt, updatedAt, 'memory' AS source
  FROM project_memories
UNION ALL
SELECT id, projectId, title, reason AS content, NULL AS tags, 0 AS isPinned, createdAt, updatedAt, 'decision' AS source
  FROM decisions
UNION ALL
SELECT id, projectId, title, content, NULL AS tags, 0 AS isPinned, createdAt, updatedAt, 'document' AS source
  FROM documents
UNION ALL
SELECT id, projectId, title, content, tags, isPinned, createdAt, updatedAt, 'note' AS source
  FROM personal_notes;
