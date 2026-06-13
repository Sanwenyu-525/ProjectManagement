-- Migration 006: Workspace layout persistence

ALTER TABLE workspaces ADD COLUMN layout TEXT;
