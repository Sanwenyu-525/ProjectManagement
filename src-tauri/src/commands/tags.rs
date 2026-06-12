use serde::Deserialize;
use serde_json::Value as JsonValue;
use tauri::{command, State};

use crate::db::Database;

#[command]
pub async fn tags_list(db: State<'_, Database>) -> Result<JsonValue, String> {
    db.query_json(
        "SELECT t.*,
            (SELECT COUNT(*) FROM project_tags WHERE tagId = t.id) as projectCount
         FROM tags t ORDER BY t.name ASC",
        rusqlite::params![],
    )
    .map_err(|e| e.to_string())
}

#[derive(Debug, Deserialize)]
pub struct CreateTagInput {
    pub name: String,
    pub color: Option<String>,
}

#[command]
pub async fn tags_create(db: State<'_, Database>, data: CreateTagInput) -> Result<JsonValue, String> {
    let id = crate::db::new_id();

    db.execute(
        "INSERT INTO tags (id, name, color) VALUES (?1, ?2, ?3)",
        rusqlite::params![id, data.name, data.color.unwrap_or_else(|| "#6366F1".into())],
    )
    .map_err(|e| e.to_string())?;

    db.query_one_json("SELECT * FROM tags WHERE id = ?1", rusqlite::params![id])
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "Failed to create tag".into())
}

#[derive(Debug, Deserialize)]
pub struct UpdateTagInput {
    pub name: Option<String>,
    pub color: Option<String>,
}

#[command]
pub async fn tags_update(db: State<'_, Database>, id: String, data: UpdateTagInput) -> Result<JsonValue, String> {
    {
        let mut sets = Vec::new();
        let mut param_values: Vec<Box<dyn rusqlite::types::ToSql>> = Vec::new();
        let mut idx = 1u32;

        if let Some(v) = data.name {
            sets.push(format!("name = ?{}", idx));
            param_values.push(Box::new(v));
            idx += 1;
        }
        if let Some(v) = data.color {
            sets.push(format!("color = ?{}", idx));
            param_values.push(Box::new(v));
            idx += 1;
        }

        if !sets.is_empty() {
            let sql = format!("UPDATE tags SET {} WHERE id = ?{}", sets.join(", "), idx);
            param_values.push(Box::new(id.clone()));
            let refs: Vec<&dyn rusqlite::types::ToSql> = param_values.iter().map(|p| p.as_ref()).collect();
            db.execute_returning_changes(&sql, &refs).map_err(|e| e.to_string())?;
        }
    }

    db.query_one_json("SELECT * FROM tags WHERE id = ?1", rusqlite::params![id])
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "TAG_NOT_FOUND".into())
}

#[command]
pub async fn tags_delete(db: State<'_, Database>, id: String) -> Result<(), String> {
    db.delete_by_id("tags", &id).map_err(|e| e.to_string())
}

#[command]
pub async fn tags_assign_to_project(
    db: State<'_, Database>,
    project_id: String,
    tag_id: String,
) -> Result<(), String> {
    db.execute(
        "INSERT OR IGNORE INTO project_tags (projectId, tagId) VALUES (?1, ?2)",
        rusqlite::params![project_id, tag_id],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

#[command]
pub async fn tags_remove_from_project(
    db: State<'_, Database>,
    project_id: String,
    tag_id: String,
) -> Result<(), String> {
    db.execute(
        "DELETE FROM project_tags WHERE projectId = ?1 AND tagId = ?2",
        rusqlite::params![project_id, tag_id],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}
