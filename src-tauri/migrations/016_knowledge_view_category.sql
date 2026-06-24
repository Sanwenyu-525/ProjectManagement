-- Add isPinned to decisions (align with other knowledge tables)
-- Note: wrapped in run_migration_safe() in db.rs for idempotency
ALTER TABLE "decisions" ADD COLUMN "isPinned" INTEGER NOT NULL DEFAULT 0;

-- Add isPinned to documents (required by knowledge_items VIEW)
ALTER TABLE "documents" ADD COLUMN "isPinned" INTEGER NOT NULL DEFAULT 0;

-- Rebuild knowledge_items VIEW with category column
DROP VIEW IF EXISTS "knowledge_items";

CREATE VIEW "knowledge_items" AS
SELECT id, projectId, title, content, tags, type AS category, isPinned, createdAt, updatedAt, 'memory' AS source
  FROM project_memories
UNION ALL
SELECT id, projectId, title, reason AS content, NULL AS tags, 'decision' AS category, isPinned, createdAt, COALESCE(updatedAt, createdAt), 'decision' AS source
  FROM decisions
UNION ALL
SELECT id, projectId, title, content, NULL AS tags, type AS category, isPinned, createdAt, updatedAt, 'document' AS source
  FROM documents
UNION ALL
SELECT id, projectId, title, content, tags, 'note' AS category, isPinned, createdAt, updatedAt, 'note' AS source
  FROM personal_notes;
