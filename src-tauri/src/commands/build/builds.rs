use serde::Deserialize;
use serde_json::Value as JsonValue;
use tauri::{command, State};

use crate::db::{Database, new_id, now_str};

// ── Builds ──

#[command]
pub async fn builds_list(db: State<'_, Database>, project_id: Option<String>) -> Result<JsonValue, String> {
    let sql = match project_id {
        Some(_) => "SELECT * FROM builds WHERE projectId = ?1 ORDER BY createdAt DESC".to_string(),
        None => "SELECT * FROM builds ORDER BY createdAt DESC LIMIT 50".to_string(),
    };
    let pid = project_id.unwrap_or_default();
    let params: Vec<&dyn rusqlite::types::ToSql> = if pid.is_empty() { vec![] } else { vec![&pid] };
    db.query_json(&sql, &params).map_err(|e| e.to_string())
}

#[command]
pub async fn builds_get_by_id(db: State<'_, Database>, id: String) -> Result<JsonValue, String> {
    db.query_one_json("SELECT * FROM builds WHERE id = ?1", rusqlite::params![id])
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "BUILD_NOT_FOUND".into())
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateBuildInput {
    pub project_id: Option<String>,
    pub commit_sha: Option<String>,
    pub commit_message: Option<String>,
    pub branch: Option<String>,
    pub triggered_by: Option<String>,
    pub platforms: Option<String>,
}

#[command]
pub async fn builds_create(db: State<'_, Database>, data: CreateBuildInput) -> Result<JsonValue, String> {
    let id = new_id();
    let now = now_str();

    db.execute(
        "INSERT INTO builds (id, projectId, commitSha, commitMessage, branch, status, triggeredBy, platforms, createdAt, updatedAt) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?9)",
        rusqlite::params![
            id,
            data.project_id,
            data.commit_sha,
            data.commit_message,
            data.branch.unwrap_or_else(|| "main".into()),
            "pending",
            data.triggered_by.unwrap_or_else(|| "manual".into()),
            data.platforms.unwrap_or_else(|| "[]".into()),
            now,
        ],
    ).map_err(|e| e.to_string())?;

    db.query_one_json("SELECT * FROM builds WHERE id = ?1", rusqlite::params![id])
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "Failed to create build".into())
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateBuildInput {
    pub status: Option<String>,
    pub duration: Option<i64>,
    pub platforms: Option<String>,
    pub artifacts: Option<String>,
}

#[command]
pub async fn builds_update(db: State<'_, Database>, id: String, data: UpdateBuildInput) -> Result<JsonValue, String> {
    {
        let mut sets = Vec::new();
        let mut param_values: Vec<Box<dyn rusqlite::types::ToSql>> = Vec::new();
        let mut idx = 1u32;

        macro_rules! add_field {
            ($col:expr, $value:expr) => {
                if let Some(v) = $value {
                    sets.push(format!("{} = ?{}", $col, idx));
                    param_values.push(Box::new(v));
                    idx += 1;
                }
            };
        }

        add_field!("status", data.status);
        add_field!("platforms", data.platforms);
        add_field!("artifacts", data.artifacts);
        if let Some(v) = data.duration {
            sets.push(format!("duration = ?{}", idx));
            param_values.push(Box::new(v));
            idx += 1;
        }

        if !sets.is_empty() {
            let now = now_str();
            sets.push(format!("updatedAt = ?{}", idx));
            param_values.push(Box::new(now));
            idx += 1;

            let sql = format!("UPDATE builds SET {} WHERE id = ?{}", sets.join(", "), idx);
            param_values.push(Box::new(id.clone()));
            let refs: Vec<&dyn rusqlite::types::ToSql> = param_values.iter().map(|p| p.as_ref()).collect();
            db.execute_returning_changes(&sql, &refs).map_err(|e| e.to_string())?;
        }
    }

    builds_get_by_id(db, id).await
}

#[command]
pub async fn builds_delete(db: State<'_, Database>, id: String) -> Result<(), String> {
    db.execute("DELETE FROM build_logs WHERE buildId = ?1", rusqlite::params![id])
        .map_err(|e| e.to_string())?;
    db.execute("DELETE FROM builds WHERE id = ?1", rusqlite::params![id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

// ── Build Logs ──

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateBuildLogInput {
    pub level: Option<String>,
    pub message: String,
}

#[command]
pub async fn builds_add_log(db: State<'_, Database>, build_id: String, data: CreateBuildLogInput) -> Result<JsonValue, String> {
    let now = now_str();
    db.execute(
        "INSERT INTO build_logs (buildId, timestamp, level, message) VALUES (?1, ?2, ?3, ?4)",
        rusqlite::params![build_id, now, data.level.unwrap_or_else(|| "info".into()), data.message],
    ).map_err(|e| e.to_string())?;

    db.query_one_json(
        "SELECT * FROM build_logs WHERE buildId = ?1 ORDER BY id DESC LIMIT 1",
        rusqlite::params![build_id],
    ).map_err(|e| e.to_string())?
     .ok_or_else(|| "Failed to create log".into())
}

#[command]
pub async fn builds_get_logs(db: State<'_, Database>, build_id: String) -> Result<JsonValue, String> {
    db.query_json(
        "SELECT * FROM build_logs WHERE buildId = ?1 ORDER BY id ASC",
        rusqlite::params![build_id],
    ).map_err(|e| e.to_string())
}
