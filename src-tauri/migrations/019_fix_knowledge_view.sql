-- Migration 019: Fix knowledge_items VIEW
-- The VIEW may be missing or broken because migrations 016/017 referenced
-- documents.isPinned before it was added to the documents table.
-- This migration ensures the column exists and rebuilds the VIEW.

ALTER TABLE "documents" ADD COLUMN "isPinned" INTEGER NOT NULL DEFAULT 0;

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
