use serde::Deserialize;
use serde_json::Value as JsonValue;
use tauri::{command, State};

use crate::db::{Database, DEFAULT_USER_ID};

#[derive(Debug, Deserialize)]
pub struct TimelineParams {
    pub limit: Option<i64>,
    pub offset: Option<i64>,
}

#[command]
pub async fn get_timeline(
    db: State<'_, Database>,
    params: Option<TimelineParams>,
) -> Result<JsonValue, String> {
    let limit = params.as_ref().and_then(|p| p.limit).unwrap_or(50);
    let offset = params.as_ref().and_then(|p| p.offset).unwrap_or(0);

    db.query_json(
        "SELECT a.*, p.name as projectName
         FROM activity_logs a
         INNER JOIN projects p ON a.projectId = p.id
         WHERE p.ownerId = ?1
         ORDER BY a.createdAt DESC
         LIMIT ?2 OFFSET ?3",
        rusqlite::params![DEFAULT_USER_ID, limit, offset],
    )
    .map_err(|e| e.to_string())
}

#[command]
pub async fn get_project_timeline(
    db: State<'_, Database>,
    project_id: String,
    params: Option<TimelineParams>,
) -> Result<JsonValue, String> {
    let limit = params.as_ref().and_then(|p| p.limit).unwrap_or(50);
    let offset = params.as_ref().and_then(|p| p.offset).unwrap_or(0);

    db.query_json(
        "SELECT * FROM activity_logs
         WHERE projectId = ?1
         ORDER BY createdAt DESC
         LIMIT ?2 OFFSET ?3",
        rusqlite::params![project_id, limit, offset],
    )
    .map_err(|e| e.to_string())
}
