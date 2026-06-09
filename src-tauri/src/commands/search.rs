use serde_json::Value as JsonValue;
use tauri::{command, State};

use crate::db::{Database, DEFAULT_USER_ID};

#[command]
pub async fn global_search(db: State<'_, Database>, q: String) -> Result<JsonValue, String> {
    let pattern = format!("%{}%", q);

    let projects = db
        .query_json(
            "SELECT id, name, description, status FROM projects
             WHERE ownerId = ?1 AND (name LIKE ?2 OR description LIKE ?2)
             LIMIT 10",
            rusqlite::params![DEFAULT_USER_ID, pattern],
        )
        .unwrap_or(serde_json::json!([]));

    let tasks = db
        .query_json(
            "SELECT t.id, t.title, t.description, t.status, t.projectId, p.name as projectName
             FROM tasks t
             INNER JOIN projects p ON t.projectId = p.id
             WHERE p.ownerId = ?1 AND (t.title LIKE ?2 OR t.description LIKE ?2)
             LIMIT 10",
            rusqlite::params![DEFAULT_USER_ID, pattern],
        )
        .unwrap_or(serde_json::json!([]));

    let documents = db
        .query_json(
            "SELECT d.id, d.title, d.type, d.projectId, p.name as projectName
             FROM documents d
             INNER JOIN projects p ON d.projectId = p.id
             WHERE p.ownerId = ?1 AND (d.title LIKE ?2 OR d.content LIKE ?2)
             LIMIT 10",
            rusqlite::params![DEFAULT_USER_ID, pattern],
        )
        .unwrap_or(serde_json::json!([]));

    Ok(serde_json::json!({
        "projects": projects,
        "tasks": tasks,
        "documents": documents,
    }))
}
