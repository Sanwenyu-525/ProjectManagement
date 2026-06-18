CREATE TABLE IF NOT EXISTS "builds" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT,
    "commitSha" TEXT,
    "commitMessage" TEXT,
    "branch" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "duration" INTEGER,
    "triggeredBy" TEXT,
    "platforms" TEXT NOT NULL DEFAULT '[]',
    "artifacts" TEXT NOT NULL DEFAULT '[]',
    "createdAt" TEXT NOT NULL,
    "updatedAt" TEXT NOT NULL,
    CONSTRAINT "builds_projectId_fkey"
        FOREIGN KEY ("projectId") REFERENCES "projects" ("id") ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS "builds_projectId_idx" ON "builds"("projectId");
CREATE INDEX IF NOT EXISTS "builds_status_idx" ON "builds"("status");

CREATE TABLE IF NOT EXISTS "build_logs" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "buildId" TEXT NOT NULL,
    "timestamp" TEXT NOT NULL,
    "level" TEXT NOT NULL DEFAULT 'info',
    "message" TEXT NOT NULL,
    CONSTRAINT "build_logs_buildId_fkey"
        FOREIGN KEY ("buildId") REFERENCES "builds" ("id") ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "build_logs_buildId_idx" ON "build_logs"("buildId");

CREATE TABLE IF NOT EXISTS "templates" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT NOT NULL DEFAULT 'project',
    "icon" TEXT,
    "tags" TEXT NOT NULL DEFAULT '[]',
    "data" TEXT NOT NULL DEFAULT '{}',
    "createdAt" TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS "templates_category_idx" ON "templates"("category");

CREATE TABLE IF NOT EXISTS "integrations" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "platform" TEXT NOT NULL,
    "accessToken" TEXT,
    "username" TEXT,
    "settings" TEXT NOT NULL DEFAULT '{}',
    "connectedAt" TEXT,
    "createdAt" TEXT NOT NULL,
    "updatedAt" TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "integrations_platform_idx" ON "integrations"("platform");
