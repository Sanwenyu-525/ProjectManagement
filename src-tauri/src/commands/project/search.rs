use serde_json::Value as JsonValue;
use tauri::{command, State};

use crate::db::Database;

#[command]
pub async fn global_search(db: State<'_, Database>, q: String) -> Result<JsonValue, String> {
    let pattern = format!("%{}%", q);

    let projects = db
        .query_json(
            "SELECT id, name, description, status, iconType, iconUrl, iconColor, techStack FROM projects
             WHERE name LIKE ?1 OR description LIKE ?1
             LIMIT 10",
            rusqlite::params![pattern],
        )
        .unwrap_or(serde_json::json!([]));

    let tasks = db
        .query_json(
            "SELECT t.id, t.title, t.description, t.status, t.projectId, p.name as projectName
             FROM tasks t
             INNER JOIN projects p ON t.projectId = p.id
             WHERE t.title LIKE ?1 OR t.description LIKE ?1
             LIMIT 10",
            rusqlite::params![pattern],
        )
        .unwrap_or(serde_json::json!([]));

    let documents = db
        .query_json(
            "SELECT d.id, d.title, d.type, d.projectId, p.name as projectName
             FROM documents d
             INNER JOIN projects p ON d.projectId = p.id
             WHERE d.title LIKE ?1 OR d.content LIKE ?1
             LIMIT 10",
            rusqlite::params![pattern],
        )
        .unwrap_or(serde_json::json!([]));

    Ok(serde_json::json!({
        "projects": projects,
        "tasks": tasks,
        "documents": documents,
    }))
}
