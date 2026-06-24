CREATE TABLE IF NOT EXISTS "feature_groups" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "color" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "feature_groups_projectId_fkey"
        FOREIGN KEY ("projectId") REFERENCES "projects" ("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "feature_groups_projectId_idx"
    ON "feature_groups"("projectId");

CREATE TABLE IF NOT EXISTS "feature_group_files" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "groupId" TEXT NOT NULL,
    "nodeId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "feature_group_files_groupId_fkey"
        FOREIGN KEY ("groupId") REFERENCES "feature_groups" ("id") ON DELETE CASCADE,
    CONSTRAINT "feature_group_files_nodeId_fkey"
        FOREIGN KEY ("nodeId") REFERENCES "graph_nodes" ("id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "feature_group_files_group_node_uidx"
    ON "feature_group_files"("groupId", "nodeId");

CREATE INDEX IF NOT EXISTS "feature_group_files_groupId_idx"
    ON "feature_group_files"("groupId");
CREATE INDEX IF NOT EXISTS "feature_group_files_nodeId_idx"
    ON "feature_group_files"("nodeId");
