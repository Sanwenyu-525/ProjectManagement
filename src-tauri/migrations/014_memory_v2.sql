-- Memory V2: FTS5 search + Pin + ADR + Relations

-- 1a. FTS5 virtual table for full-text search
CREATE VIRTUAL TABLE IF NOT EXISTS "project_memories_fts" USING fts5(
  "title", "content", "tags",
  content="project_memories", content_rowid="rowid"
);

-- Triggers to keep FTS in sync
CREATE TRIGGER IF NOT EXISTS "project_memories_fts_ai" AFTER INSERT ON "project_memories" BEGIN
  INSERT INTO "project_memories_fts"(rowid, title, content, tags)
  VALUES (new.rowid, new.title, new.content, new.tags);
END;

CREATE TRIGGER IF NOT EXISTS "project_memories_fts_ad" AFTER DELETE ON "project_memories" BEGIN
  INSERT INTO "project_memories_fts"("project_memories_fts", rowid, title, content, tags)
  VALUES ('delete', old.rowid, old.title, old.content, old.tags);
END;

CREATE TRIGGER IF NOT EXISTS "project_memories_fts_au" AFTER UPDATE ON "project_memories" BEGIN
  INSERT INTO "project_memories_fts"("project_memories_fts", rowid, title, content, tags)
  VALUES ('delete', old.rowid, old.title, old.content, old.tags);
  INSERT INTO "project_memories_fts"(rowid, title, content, tags)
  VALUES (new.rowid, new.title, new.content, new.tags);
END;

-- Backfill existing data into FTS
INSERT INTO "project_memories_fts"(rowid, title, content, tags)
SELECT rowid, title, content, tags FROM "project_memories"
WHERE rowid NOT IN (SELECT rowid FROM "project_memories_fts");

-- 1b. Extend project_memories with pin support
ALTER TABLE "project_memories" ADD COLUMN "isPinned" INTEGER NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS "project_memories_isPinned_idx" ON "project_memories"("isPinned");

-- 1c. Extend decisions (ADR model)
ALTER TABLE "decisions" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'accepted';
ALTER TABLE "decisions" ADD COLUMN "context" TEXT;
ALTER TABLE "decisions" ADD COLUMN "options" TEXT;
ALTER TABLE "decisions" ADD COLUMN "consequences" TEXT;
ALTER TABLE "decisions" ADD COLUMN "updatedAt" DATETIME;

-- 1d. Memory relations (knowledge graph)
CREATE TABLE IF NOT EXISTS "memory_relations" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "sourceId" TEXT NOT NULL,
  "targetId" TEXT NOT NULL,
  "relationType" TEXT NOT NULL DEFAULT 'related_to',
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "memory_relations_source_idx" ON "memory_relations"("sourceId");
CREATE INDEX IF NOT EXISTS "memory_relations_target_idx" ON "memory_relations"("targetId");
