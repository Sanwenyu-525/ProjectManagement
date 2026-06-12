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

-- Remove ownerId column from projects
ALTER TABLE "projects" DROP COLUMN IF EXISTS "ownerId";

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
