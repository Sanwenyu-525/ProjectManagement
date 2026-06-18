-- Extend agent_sessions with provider state tracking.
-- Each ALTER TABLE ADD COLUMN is individually idempotent in SQLite:
-- if the column already exists, it logs a warning but does not fail the batch.
ALTER TABLE "agent_sessions" ADD COLUMN "providerSessionId" TEXT;
ALTER TABLE "agent_sessions" ADD COLUMN "permissionMode" TEXT NOT NULL DEFAULT 'default';
ALTER TABLE "agent_sessions" ADD COLUMN "lastError" TEXT;
ALTER TABLE "agent_sessions" ADD COLUMN "exitCode" INTEGER;
ALTER TABLE "agent_sessions" ADD COLUMN "updatedAt" TEXT;

-- agent_tasks CHECK constraints are enforced in Rust (agent_tasks.rs).
-- SQLite does not support ALTER TABLE ADD CONSTRAINT, so we validate
-- status ∈ {pending, in_progress, completed, cancelled} and
-- priority ∈ {low, medium, high, urgent} on the Rust side before INSERT/UPDATE.
