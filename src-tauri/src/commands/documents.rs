use serde::Deserialize;
use serde_json::Value as JsonValue;
use tauri::{command, State};

use crate::db::Database;

#[command]
pub async fn documents_list(db: State<'_, Database>, project_id: String) -> Result<JsonValue, String> {
    db.query_json(
        "SELECT id, title, type, projectId, createdAt, updatedAt FROM documents WHERE projectId = ?1 ORDER BY updatedAt DESC",
        rusqlite::params![project_id],
    )
    .map_err(|e| e.to_string())
}

#[command]
pub async fn documents_get_by_id(db: State<'_, Database>, id: String) -> Result<JsonValue, String> {
    db.query_one_json("SELECT * FROM documents WHERE id = ?1", rusqlite::params![id])
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "DOCUMENT_NOT_FOUND".into())
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateDocumentInput {
    pub title: String,
    pub content: Option<String>,
    #[serde(rename = "type")]
    pub doc_type: Option<String>,
}

#[command]
pub async fn documents_create(
    db: State<'_, Database>,
    project_id: String,
    data: CreateDocumentInput,
) -> Result<JsonValue, String> {
    let id = crate::db::new_id();
    let now = crate::db::now_str();

    db.execute(
        "INSERT INTO documents (id, title, content, type, projectId, createdAt, updatedAt) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?6)",
        rusqlite::params![
            id,
            data.title,
            data.content.unwrap_or_default(),
            data.doc_type.unwrap_or_else(|| "Doc".into()),
            project_id,
            now,
        ],
    )
    .map_err(|e| e.to_string())?;

    db.query_one_json("SELECT * FROM documents WHERE id = ?1", rusqlite::params![id])
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "Failed to create document".into())
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateDocumentInput {
    pub title: Option<String>,
    pub content: Option<String>,
    #[serde(rename = "type")]
    pub doc_type: Option<String>,
}

#[command]
pub async fn documents_update(
    db: State<'_, Database>,
    id: String,
    data: UpdateDocumentInput,
) -> Result<JsonValue, String> {
    {
        let mut sets = Vec::new();
        let mut param_values: Vec<Box<dyn rusqlite::types::ToSql>> = Vec::new();
        let mut idx = 1u32;

        if let Some(v) = data.title {
            sets.push(format!("title = ?{}", idx));
            param_values.push(Box::new(v));
            idx += 1;
        }
        if let Some(v) = data.content {
            sets.push(format!("content = ?{}", idx));
            param_values.push(Box::new(v));
            idx += 1;
        }
        if let Some(v) = data.doc_type {
            sets.push(format!("type = ?{}", idx));
            param_values.push(Box::new(v));
            idx += 1;
        }

        if !sets.is_empty() {
            let now = crate::db::now_str();
            sets.push(format!("updatedAt = ?{}", idx));
            param_values.push(Box::new(now));
            idx += 1;

            let sql = format!("UPDATE documents SET {} WHERE id = ?{}", sets.join(", "), idx);
            param_values.push(Box::new(id.clone()));
            let refs: Vec<&dyn rusqlite::types::ToSql> = param_values.iter().map(|p| p.as_ref()).collect();
            db.execute_returning_changes(&sql, &refs).map_err(|e| e.to_string())?;
        }
    }

    documents_get_by_id(db, id).await
}

#[command]
pub async fn documents_delete(db: State<'_, Database>, id: String) -> Result<(), String> {
    db.delete_by_id("documents", &id).map_err(|e| e.to_string())
}
