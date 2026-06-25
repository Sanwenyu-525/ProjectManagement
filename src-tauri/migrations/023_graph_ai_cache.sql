CREATE TABLE IF NOT EXISTS graph_ai_cache (
  id TEXT PRIMARY KEY,
  projectId TEXT NOT NULL,
  cacheKey TEXT NOT NULL,
  resultJson TEXT NOT NULL,
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (projectId) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_graph_ai_cache_project ON graph_ai_cache(projectId);
CREATE UNIQUE INDEX IF NOT EXISTS idx_graph_ai_cache_key ON graph_ai_cache(projectId, cacheKey);
