CREATE TABLE IF NOT EXISTS "browser_visits" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tabId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "title" TEXT,
    "visitedAt" TEXT NOT NULL,
    "domAnalysis" TEXT,
    "projectId" TEXT,
    CONSTRAINT "browser_visits_projectId_fkey"
        FOREIGN KEY ("projectId") REFERENCES "projects" ("id") ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS "browser_visits_tabId_idx" ON "browser_visits"("tabId");
CREATE INDEX IF NOT EXISTS "browser_visits_url_idx" ON "browser_visits"("url");
