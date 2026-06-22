-- Migration 018: Recreate project_tags table
-- project_tags was dropped in 002_remove_users.sql but is still used by
-- tags_assign_to_project, tags_remove_from_project, tags_list, and projects_get_by_id.

CREATE TABLE IF NOT EXISTS "project_tags" (
    "projectId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,
    PRIMARY KEY ("projectId", "tagId"),
    CONSTRAINT "project_tags_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "project_tags_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "tags" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
