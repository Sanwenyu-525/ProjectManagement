-- Add filePath to personal_notes for vault-based file storage
ALTER TABLE "personal_notes" ADD COLUMN "filePath" TEXT;

-- Rebuild knowledge_items VIEW to include filePath for notes
DROP VIEW IF EXISTS "knowledge_items";

CREATE VIEW "knowledge_items" AS
SELECT id, projectId, title, content, tags, type AS category, isPinned, createdAt, updatedAt, 'memory' AS source, NULL AS filePath
  FROM project_memories
UNION ALL
SELECT id, projectId, title, reason AS content, NULL AS tags, 'decision' AS category, isPinned, createdAt, COALESCE(updatedAt, createdAt), 'decision' AS source, NULL AS filePath
  FROM decisions
UNION ALL
SELECT id, projectId, title, content, NULL AS tags, type AS category, isPinned, createdAt, updatedAt, 'document' AS source, NULL AS filePath
  FROM documents
UNION ALL
SELECT id, projectId, title, content, tags, 'note' AS category, isPinned, createdAt, updatedAt, 'note' AS source, filePath
  FROM personal_notes;
