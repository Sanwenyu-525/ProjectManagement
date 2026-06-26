-- Migration 026: Project audit reports (5-dimension scoring)

CREATE TABLE IF NOT EXISTS project_audits (
  id TEXT PRIMARY KEY,
  projectId TEXT NOT NULL,
  auditDate TEXT NOT NULL,
  -- 5 dimensions, each 0-20, total 0-100
  scoreArchitecture INTEGER NOT NULL DEFAULT 0,
  scoreCodeQuality INTEGER NOT NULL DEFAULT 0,
  scoreDependencies INTEGER NOT NULL DEFAULT 0,
  scoreChangeImpact INTEGER NOT NULL DEFAULT 0,
  scoreKnowledgeGap INTEGER NOT NULL DEFAULT 0,
  totalScore INTEGER NOT NULL DEFAULT 0,
  -- JSON arrays
  riskItems TEXT,       -- [{ dimension, label, severity, detail }]
  recommendations TEXT, -- [{ dimension, label, priority, detail }]
  triggerSource TEXT DEFAULT 'manual',  -- 'manual' | 'slash' | 'auto'
  durationMs INTEGER,
  createdAt TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (projectId) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_project_audits_project ON project_audits(projectId);
CREATE INDEX IF NOT EXISTS idx_project_audits_date ON project_audits(auditDate DESC);

CREATE TABLE IF NOT EXISTS project_audit_items (
  id TEXT PRIMARY KEY,
  auditId TEXT NOT NULL,
  dimension TEXT NOT NULL, -- 'architecture' | 'code_quality' | 'dependencies' | 'change_impact' | 'knowledge_gap'
  itemKey TEXT NOT NULL,
  label TEXT NOT NULL,
  score INTEGER NOT NULL,
  maxScore INTEGER NOT NULL,
  status TEXT NOT NULL, -- 'good' | 'warning' | 'critical'
  details TEXT,
  FOREIGN KEY (auditId) REFERENCES project_audits(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_audit_items_audit ON project_audit_items(auditId);
