use serde::Deserialize;
use serde_json::{Value as JsonValue};
use tauri::{command, State};

use crate::db::Database;

// ── Personal Notes ──

#[command]
pub async fn notes_list(
    db: State<'_, Database>,
    project_id: Option<String>,
) -> Result<JsonValue, String> {
    if let Some(pid) = project_id {
        db.query_json(
            "SELECT * FROM personal_notes WHERE projectId = ?1 ORDER BY isPinned DESC, createdAt DESC",
            rusqlite::params![pid],
        )
        .map_err(|e| e.to_string())
    } else {
        db.query_json(
            "SELECT * FROM personal_notes ORDER BY isPinned DESC, createdAt DESC",
            rusqlite::params![],
        )
        .map_err(|e| e.to_string())
    }
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateNoteInput {
    pub project_id: Option<String>,
    pub title: String,
    pub content: Option<String>,
    pub tags: Option<String>,
}

#[command]
pub async fn notes_create(
    db: State<'_, Database>,
    data: CreateNoteInput,
) -> Result<JsonValue, String> {
    let id = crate::db::new_id();
    let now = crate::db::now_str();

    db.execute(
        "INSERT INTO personal_notes (id, projectId, title, content, tags, createdAt, updatedAt) \
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?6)",
        rusqlite::params![
            id,
            data.project_id,
            data.title,
            data.content.unwrap_or_default(),
            data.tags,
            now,
        ],
    )
    .map_err(|e| e.to_string())?;

    db.query_one_json(
        "SELECT * FROM personal_notes WHERE id = ?1",
        rusqlite::params![id],
    )
    .map_err(|e| e.to_string())?
    .ok_or_else(|| "Failed to create note".into())
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateNoteInput {
    pub id: String,
    pub title: Option<String>,
    pub content: Option<String>,
    pub tags: Option<String>,
}

#[command]
pub async fn notes_update(
    db: State<'_, Database>,
    data: UpdateNoteInput,
) -> Result<JsonValue, String> {
    let now = crate::db::now_str();
    let mut sets: Vec<String> = Vec::new();
    let mut params: Vec<Box<dyn rusqlite::types::ToSql>> = Vec::new();
    let mut idx = 1;

    if let Some(ref t) = data.title {
        sets.push(format!("title = ?{}", idx));
        params.push(Box::new(t.clone()));
        idx += 1;
    }
    if let Some(ref c) = data.content {
        sets.push(format!("content = ?{}", idx));
        params.push(Box::new(c.clone()));
        idx += 1;
    }
    if let Some(ref t) = data.tags {
        sets.push(format!("tags = ?{}", idx));
        params.push(Box::new(t.clone()));
        idx += 1;
    }

    if sets.is_empty() {
        return Err("No fields to update".into());
    }

    sets.push(format!("updatedAt = ?{}", idx));
    params.push(Box::new(now));
    idx += 1;

    let sql = format!(
        "UPDATE personal_notes SET {} WHERE id = ?{}",
        sets.join(", "),
        idx
    );
    params.push(Box::new(data.id.clone()));

    let param_refs: Vec<&dyn rusqlite::types::ToSql> = params.iter().map(|p| p.as_ref()).collect();
    db.execute(&sql, &param_refs)
        .map_err(|e| e.to_string())?;

    db.query_one_json(
        "SELECT * FROM personal_notes WHERE id = ?1",
        rusqlite::params![data.id],
    )
    .map_err(|e| e.to_string())?
    .ok_or_else(|| "Note not found".into())
}

#[command]
pub async fn notes_delete(db: State<'_, Database>, id: String) -> Result<(), String> {
    db.execute(
        "DELETE FROM personal_notes WHERE id = ?1",
        rusqlite::params![id],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

#[command]
pub async fn notes_pin(db: State<'_, Database>, id: String) -> Result<JsonValue, String> {
    let now = crate::db::now_str();
    db.execute(
        "UPDATE personal_notes SET isPinned = CASE WHEN isPinned = 1 THEN 0 ELSE 1 END, updatedAt = ?1 WHERE id = ?2",
        rusqlite::params![now, id],
    )
    .map_err(|e| e.to_string())?;

    db.query_one_json(
        "SELECT * FROM personal_notes WHERE id = ?1",
        rusqlite::params![id],
    )
    .map_err(|e| e.to_string())?
    .ok_or_else(|| "Note not found".into())
}
