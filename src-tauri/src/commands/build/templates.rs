use serde::Deserialize;
use serde_json::Value as JsonValue;
use tauri::{command, State};

use crate::db::{Database, new_id, now_str};

#[command]
pub async fn templates_list(db: State<'_, Database>, category: Option<String>) -> Result<JsonValue, String> {
    match category {
        Some(cat) => db.query_json(
            "SELECT * FROM templates WHERE category = ?1 ORDER BY name ASC",
            rusqlite::params![cat],
        ),
        None => db.query_json(
            "SELECT * FROM templates ORDER BY category ASC, name ASC",
            rusqlite::params![],
        ),
    }
    .map_err(|e| e.to_string())
}

#[command]
pub async fn templates_get_by_id(db: State<'_, Database>, id: String) -> Result<JsonValue, String> {
    db.query_one_json("SELECT * FROM templates WHERE id = ?1", rusqlite::params![id])
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "TEMPLATE_NOT_FOUND".into())
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateTemplateInput {
    pub name: String,
    pub description: Option<String>,
    pub category: Option<String>,
    pub icon: Option<String>,
    pub tags: Option<String>,
    pub data: Option<String>,
}

#[command]
pub async fn templates_create(db: State<'_, Database>, data: CreateTemplateInput) -> Result<JsonValue, String> {
    let id = new_id();
    let now = now_str();

    db.execute(
        "INSERT INTO templates (id, name, description, category, icon, tags, data, createdAt) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
        rusqlite::params![
            id,
            data.name,
            data.description,
            data.category.unwrap_or_else(|| "project".into()),
            data.icon,
            data.tags.unwrap_or_else(|| "[]".into()),
            data.data.unwrap_or_else(|| "{}".into()),
            now,
        ],
    ).map_err(|e| e.to_string())?;

    db.query_one_json("SELECT * FROM templates WHERE id = ?1", rusqlite::params![id])
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "Failed to create template".into())
}

#[command]
pub async fn templates_delete(db: State<'_, Database>, id: String) -> Result<(), String> {
    db.execute("DELETE FROM templates WHERE id = ?1", rusqlite::params![id])
        .map_err(|e| e.to_string())?;
    Ok(())
}
