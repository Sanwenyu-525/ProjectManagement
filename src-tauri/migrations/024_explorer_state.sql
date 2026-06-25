CREATE TABLE IF NOT EXISTS "explorer_state" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'default',
    "paths" TEXT NOT NULL DEFAULT '[]',
    "expandedPaths" TEXT NOT NULL DEFAULT '[]',
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT OR IGNORE INTO "explorer_state" ("id") VALUES ('default');
