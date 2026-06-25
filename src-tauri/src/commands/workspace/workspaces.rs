use serde::Deserialize;
use serde_json::Value as JsonValue;
use tauri::{command, State};

use crate::db::{Database, new_id, now_str};

#[command]
pub async fn workspaces_list(db: State<'_, Database>) -> Result<JsonValue, String> {
    db.query_json(
        "SELECT w.*,
            (SELECT COUNT(*) FROM projects WHERE workspaceId = w.id) as projectCount
         FROM workspaces w ORDER BY w.sortOrder ASC, w.name ASC",
        rusqlite::params![],
    ).map_err(|e| e.to_string())
}

#[derive(Debug, Deserialize)]
pub struct CreateWorkspaceInput {
    pub name: String,
    pub description: Option<String>,
    pub color: Option<String>,
}

#[command]
pub async fn workspaces_create(db: State<'_, Database>, data: CreateWorkspaceInput) -> Result<JsonValue, String> {
    let id = new_id();
    let now = now_str();
    let color = data.color.unwrap_or_else(|| "#6366F1".into());

    db.execute(
        "INSERT INTO workspaces (id, name, description, color, createdAt, updatedAt) VALUES (?1, ?2, ?3, ?4, ?5, ?5)",
        rusqlite::params![id, data.name, data.description, color, now],
    ).map_err(|e| e.to_string())?;

    db.query_one_json("SELECT * FROM workspaces WHERE id = ?1", rusqlite::params![id])
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "Failed to create workspace".into())
}

#[derive(Debug, Deserialize)]
pub struct UpdateWorkspaceInput {
    pub name: Option<String>,
    pub description: Option<String>,
    pub color: Option<String>,
    pub sort_order: Option<i32>,
}

#[command]
pub async fn workspaces_update(db: State<'_, Database>, id: String, data: UpdateWorkspaceInput) -> Result<JsonValue, String> {
    let mut sets = Vec::new();
    let mut param_values: Vec<Box<dyn rusqlite::types::ToSql>> = Vec::new();
    let mut idx = 1u32;

    macro_rules! add_field {
        ($key:expr, $value:expr) => {
            if let Some(v) = $value {
                sets.push(format!("{} = ?{}", $key, idx));
                param_values.push(Box::new(v));
                idx += 1;
            }
        };
    }

    add_field!("name", data.name);
    add_field!("description", data.description);
    add_field!("color", data.color);
    add_field!("sortOrder", data.sort_order);

    if sets.is_empty() {
        return db.query_one_json("SELECT * FROM workspaces WHERE id = ?1", rusqlite::params![id])
            .map_err(|e| e.to_string())?
            .ok_or_else(|| "NOT_FOUND".into());
    }

    sets.push(format!("updatedAt = ?{}", idx));
    param_values.push(Box::new(now_str()));

    let sql = format!("UPDATE workspaces SET {} WHERE id = ?{}", sets.join(", "), idx + 1);
    param_values.push(Box::new(id.clone()));
    let refs: Vec<&dyn rusqlite::types::ToSql> = param_values.iter().map(|p| p.as_ref()).collect();
    db.execute(&sql, &refs).map_err(|e| e.to_string())?;

    db.query_one_json("SELECT * FROM workspaces WHERE id = ?1", rusqlite::params![id])
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "NOT_FOUND".into())
}

#[command]
pub async fn workspaces_delete(db: State<'_, Database>, id: String) -> Result<(), String> {
    // Unassign projects from this workspace first
    db.execute("UPDATE projects SET workspaceId = NULL WHERE workspaceId = ?1", rusqlite::params![id])
        .map_err(|e| e.to_string())?;
    db.delete_by_id("workspaces", &id).map_err(|e| e.to_string())?;
    Ok(())
}

#[command]
pub async fn workspaces_assign_project(db: State<'_, Database>, project_id: String, workspace_id: Option<String>) -> Result<(), String> {
    let now = now_str();
    db.execute(
        "UPDATE projects SET workspaceId = ?1, updatedAt = ?2 WHERE id = ?3",
        rusqlite::params![workspace_id, now, project_id],
    ).map_err(|e| e.to_string())?;
    Ok(())
}

#[command]
pub async fn workspaces_save_layout(db: State<'_, Database>, id: String, layout: String) -> Result<(), String> {
    let now = now_str();
    db.execute(
        "UPDATE workspaces SET layout = ?1, updatedAt = ?2 WHERE id = ?3",
        rusqlite::params![layout, now, id],
    ).map_err(|e| e.to_string())?;
    Ok(())
}

#[command]
pub async fn workspaces_load_layout(db: State<'_, Database>, id: String) -> Result<Option<String>, String> {
    let val = db.query_json(
        "SELECT layout FROM workspaces WHERE id = ?1",
        rusqlite::params![id],
    ).map_err(|e| e.to_string())?;

    match val {
        serde_json::Value::Array(rows) if !rows.is_empty() => {
            match rows[0].get("layout") {
                Some(serde_json::Value::String(s)) if !s.is_empty() => Ok(Some(s.clone())),
                _ => Ok(None),
            }
        }
        _ => Ok(None),
    }
}

#[command]
pub async fn explorer_load_state(db: State<'_, Database>) -> Result<JsonValue, String> {
    let val = db.query_json(
        "SELECT paths, expandedPaths FROM explorer_state WHERE id = 'default'",
        rusqlite::params![],
    ).map_err(|e| e.to_string())?;

    match val {
        serde_json::Value::Array(rows) if !rows.is_empty() => {
            let row = &rows[0];
            let paths: Vec<String> = row.get("paths")
                .and_then(|v| serde_json::from_value(v.clone()).ok())
                .unwrap_or_default();
            let expanded: Vec<String> = row.get("expandedPaths")
                .and_then(|v| serde_json::from_value(v.clone()).ok())
                .unwrap_or_default();
            Ok(serde_json::json!({ "paths": paths, "expandedPaths": expanded }))
        }
        _ => Ok(serde_json::json!({ "paths": [], "expandedPaths": [] })),
    }
}

#[command]
pub async fn explorer_save_state(
    db: State<'_, Database>,
    paths: Vec<String>,
    expanded_paths: Vec<String>,
) -> Result<(), String> {
    let now = now_str();
    let paths_json = serde_json::to_string(&paths).map_err(|e| e.to_string())?;
    let expanded_json = serde_json::to_string(&expanded_paths).map_err(|e| e.to_string())?;
    db.execute(
        "UPDATE explorer_state SET paths = ?1, expandedPaths = ?2, updatedAt = ?3 WHERE id = 'default'",
        rusqlite::params![paths_json, expanded_json, now],
    ).map_err(|e| e.to_string())?;
    Ok(())
}

#[command]
pub async fn workspaces_stats(db: State<'_, Database>) -> Result<JsonValue, String> {
    db.query_one_json(
        "SELECT
            (SELECT COUNT(*) FROM tasks) as tasks,
            (SELECT COUNT(*) FROM tasks WHERE status != 'Done' AND status != 'Completed') as issues,
            (SELECT COUNT(*) FROM documents) as docs",
        rusqlite::params![],
    )
    .map_err(|e| e.to_string())?
    .ok_or_else(|| "Failed to get stats".into())
}
