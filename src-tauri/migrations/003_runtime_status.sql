-- Migration 003: Add runtime status fields to projects

ALTER TABLE projects ADD COLUMN frontendStatus TEXT DEFAULT 'stopped';
ALTER TABLE projects ADD COLUMN backendStatus TEXT DEFAULT 'stopped';
ALTER TABLE projects ADD COLUMN lastLaunchTime DATETIME;
