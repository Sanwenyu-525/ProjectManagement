CREATE TABLE IF NOT EXISTS "graph_nodes" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "language" TEXT NOT NULL,
    "directory" TEXT NOT NULL,
    "lineCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "graph_nodes_projectId_fkey"
        FOREIGN KEY ("projectId") REFERENCES "projects" ("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "graph_nodes_projectId_idx"
    ON "graph_nodes"("projectId");
CREATE INDEX IF NOT EXISTS "graph_nodes_projectId_filePath_idx"
    ON "graph_nodes"("projectId", "filePath");

CREATE TABLE IF NOT EXISTS "graph_edges" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "sourceNodeId" TEXT NOT NULL,
    "targetNodeId" TEXT NOT NULL,
    "importPath" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "graph_edges_projectId_fkey"
        FOREIGN KEY ("projectId") REFERENCES "projects" ("id") ON DELETE CASCADE,
    CONSTRAINT "graph_edges_sourceNodeId_fkey"
        FOREIGN KEY ("sourceNodeId") REFERENCES "graph_nodes" ("id") ON DELETE CASCADE,
    CONSTRAINT "graph_edges_targetNodeId_fkey"
        FOREIGN KEY ("targetNodeId") REFERENCES "graph_nodes" ("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "graph_edges_projectId_idx"
    ON "graph_edges"("projectId");
CREATE INDEX IF NOT EXISTS "graph_edges_sourceNodeId_idx"
    ON "graph_edges"("sourceNodeId");
CREATE INDEX IF NOT EXISTS "graph_edges_targetNodeId_idx"
    ON "graph_edges"("targetNodeId");
