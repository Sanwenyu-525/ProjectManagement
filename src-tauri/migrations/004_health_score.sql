-- Migration 004: Add health score fields

ALTER TABLE project_health_checks ADD COLUMN healthScore INTEGER;
ALTER TABLE project_health_checks ADD COLUMN healthStatus TEXT;
