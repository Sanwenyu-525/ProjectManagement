use serde::Deserialize;
use serde_json::Value as JsonValue;
use tauri::{command, State};

use crate::db::{Database, DEFAULT_USER_ID};

#[command]
pub async fn repos_list(db: State<'_, Database>, project_id: String) -> Result<JsonValue, String> {
    db.query_json(
        "SELECT r.*,
            (SELECT COUNT(*) FROM tasks WHERE repoScope = r.id) as taskCount
         FROM remote_repos r WHERE r.projectId = ?1 ORDER BY r.createdAt DESC",
        rusqlite::params![project_id],
    )
    .map_err(|e| e.to_string())
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AddRepoInput {
    pub platform: String,
    pub repo_full_name: String,
    pub repo_url: String,
    pub default_branch: Option<String>,
}

#[command]
pub async fn repos_add(
    db: State<'_, Database>,
    project_id: String,
    data: AddRepoInput,
) -> Result<JsonValue, String> {
    let id = crate::db::new_id();
    let now = crate::db::now_str();

    db.execute(
        "INSERT INTO remote_repos (id, projectId, platform, repoUrl, repoFullName, defaultBranch, repoStatus, createdAt, updatedAt)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, 'Synced', ?7, ?7)",
        rusqlite::params![id, project_id, data.platform, data.repo_url, data.repo_full_name, data.default_branch, now],
    )
    .map_err(|e| e.to_string())?;

    // Auto-upgrade project source to Hybrid if it was Local
    db.execute(
        "UPDATE projects SET source = 'Hybrid', updatedAt = ?1 WHERE id = ?2 AND source = 'Local'",
        rusqlite::params![now, project_id],
    )
    .ok();

    db.query_one_json("SELECT * FROM remote_repos WHERE id = ?1", rusqlite::params![id])
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "Failed to create repo".into())
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateRepoInput {
    pub default_branch: Option<String>,
    pub repo_status: Option<String>,
    pub extra_config: Option<serde_json::Value>,
}

#[command]
pub async fn repos_update(
    db: State<'_, Database>,
    id: String,
    data: UpdateRepoInput,
) -> Result<JsonValue, String> {
    {
        let mut sets = Vec::new();
        let mut param_values: Vec<Box<dyn rusqlite::types::ToSql>> = Vec::new();
        let mut idx = 1u32;

        if let Some(v) = data.default_branch {
            sets.push(format!("defaultBranch = ?{}", idx));
            param_values.push(Box::new(v));
            idx += 1;
        }
        if let Some(v) = data.repo_status {
            sets.push(format!("repoStatus = ?{}", idx));
            param_values.push(Box::new(v));
            idx += 1;
        }
        if let Some(v) = data.extra_config {
            sets.push(format!("extraConfig = ?{}", idx));
            param_values.push(Box::new(v.to_string()));
            idx += 1;
        }

        if !sets.is_empty() {
            let now = crate::db::now_str();
            sets.push(format!("updatedAt = ?{}", idx));
            param_values.push(Box::new(now));
            idx += 1;

            let sql = format!("UPDATE remote_repos SET {} WHERE id = ?{}", sets.join(", "), idx);
            param_values.push(Box::new(id.clone()));
            let refs: Vec<&dyn rusqlite::types::ToSql> = param_values.iter().map(|p| p.as_ref()).collect();
            db.execute_returning_changes(&sql, &refs).map_err(|e| e.to_string())?;
        }
    }

    db.query_one_json("SELECT * FROM remote_repos WHERE id = ?1", rusqlite::params![id])
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "REPO_NOT_FOUND".into())
}

#[command]
pub async fn repos_remove(db: State<'_, Database>, id: String) -> Result<(), String> {
    db.delete_by_id("remote_repos", &id).map_err(|e| e.to_string())
}

#[command]
pub async fn repos_sync(db: State<'_, Database>, id: String) -> Result<JsonValue, String> {
    // Stub: just update lastSyncAt
    let now = crate::db::now_str();
    db.execute(
        "UPDATE remote_repos SET lastSyncAt = ?1, updatedAt = ?1 WHERE id = ?2",
        rusqlite::params![now, id],
    )
    .map_err(|e| e.to_string())?;

    // Get projectId for activity log
    let repo = db
        .query_one_json("SELECT projectId, repoFullName FROM remote_repos WHERE id = ?1", rusqlite::params![id])
        .map_err(|e| e.to_string())?;

    if let Some(ref r) = repo {
        if let Some(project_id) = r.get("projectId").and_then(|v| v.as_str()) {
            let details = serde_json::json!({ "repo": r.get("repoFullName").and_then(|v| v.as_str()).unwrap_or("") });
            db.log_activity("repo_synced", "repo", &id, Some(&details), project_id).ok();
        }
    }

    repo.ok_or_else(|| "REPO_NOT_FOUND".into())
}
