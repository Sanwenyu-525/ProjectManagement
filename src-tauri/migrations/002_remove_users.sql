-- Migration 002: Remove users table (single-user, no auth needed)

-- Drop foreign key constraints referencing users
ALTER TABLE "projects" DROP CONSTRAINT IF EXISTS "projects_ownerId_fkey";
ALTER TABLE "remote_repos" DROP CONSTRAINT IF EXISTS "remote_repos_integrationId_fkey";
ALTER TABLE "integrations" DROP CONSTRAINT IF EXISTS "integrations_userId_fkey";
ALTER TABLE "tags" DROP CONSTRAINT IF EXISTS "tags_userId_fkey";

-- Drop indexes on users table
DROP INDEX IF EXISTS "users_username_key";
DROP INDEX IF EXISTS "users_email_key";

-- Drop indexes that reference ownerId
DROP INDEX IF EXISTS "projects_ownerId_idx";

-- Remove ownerId column from projects via table rebuild
-- (SQLite cannot DROP COLUMN when foreign key constraints reference it,
--  and ALTER TABLE DROP CONSTRAINT does not work for FK constraints)
-- Include all columns from initial schema + later migrations (003, 005)
CREATE TABLE IF NOT EXISTS "projects_new" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Idea',
    "priority" TEXT NOT NULL DEFAULT 'Medium',
    "source" TEXT NOT NULL DEFAULT 'Local',
    "iconType" TEXT NOT NULL DEFAULT 'Auto',
    "iconUrl" TEXT,
    "iconColor" TEXT,
    "localPath" TEXT,
    "openCommand" TEXT,
    "frontendCommand" TEXT,
    "backendCommand" TEXT,
    "frontendCwd" TEXT,
    "backendCwd" TEXT,
    "liveUrl" TEXT,
    "domainName" TEXT,
    "techStack" TEXT NOT NULL DEFAULT '[]',
    "startDate" DATETIME,
    "targetDate" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT OR IGNORE INTO "projects_new" (
    "id", "name", "description", "status", "priority", "source",
    "iconType", "iconUrl", "iconColor", "localPath", "openCommand",
    "frontendCommand", "backendCommand", "frontendCwd", "backendCwd",
    "liveUrl", "domainName", "techStack", "startDate", "targetDate",
    "createdAt", "updatedAt"
) SELECT
    "id", "name", "description", "status", "priority", "source",
    "iconType", "iconUrl", "iconColor", "localPath", "openCommand",
    "frontendCommand", "backendCommand", "frontendCwd", "backendCwd",
    "liveUrl", "domainName", "techStack", "startDate", "targetDate",
    "createdAt", "updatedAt"
FROM "projects";
DROP TABLE IF EXISTS "projects";
ALTER TABLE "projects_new" RENAME TO "projects";
CREATE INDEX IF NOT EXISTS "projects_status_idx" ON "projects"("status");

-- Remove userId column from integrations
ALTER TABLE "integrations" DROP COLUMN IF EXISTS "userId";

-- Remove userId column from tags
ALTER TABLE "tags" DROP COLUMN IF EXISTS "userId";

-- Drop users table
DROP TABLE IF EXISTS "users";

-- Drop integrations table (not needed for single-user)
DROP TABLE IF EXISTS "integrations";

-- Drop project_tags table (can be reimplemented later if needed)
DROP TABLE IF EXISTS "project_tags";
