CREATE TABLE IF NOT EXISTS "task_commits" (
    "taskId" TEXT NOT NULL,
    "commitHash" TEXT NOT NULL,
    "linkedAt" TEXT NOT NULL,
    "linkSource" TEXT NOT NULL DEFAULT 'auto',
    PRIMARY KEY ("taskId", "commitHash"),
    FOREIGN KEY ("taskId") REFERENCES "tasks"("id") ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "task_commits_hash_idx" ON "task_commits"("commitHash");
