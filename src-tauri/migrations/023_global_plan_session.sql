-- Global plan session: shared across all agent tabs so plan tasks
-- survive tab switches. Uses a fixed, well-known id.
INSERT OR IGNORE INTO agent_sessions (id, agentTabId, runtimeId, startedAt, status)
VALUES ('__global_plan__', '__global_plan__', 'plan', '2026-01-01T00:00:00Z', 'ended');
