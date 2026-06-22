use std::fs;
use std::path::PathBuf;

use serde::Deserialize;
use serde_json::{json, Value as JsonValue};
use tauri::{command, AppHandle, Manager, State};

use crate::db::Database;

fn vault_dir(app: &AppHandle) -> PathBuf {
    app.path()
        .app_data_dir()
        .expect("failed to resolve app data dir")
        .join("knowledge_vault")
}

fn ensure_dir(path: &PathBuf) -> Result<(), String> {
    fs::create_dir_all(path).map_err(|e| e.to_string())
}

#[command]
pub async fn knowledge_import_files(
    app: AppHandle,
    db: State<'_, Database>,
    file_paths: Vec<String>,
    project_id: Option<String>,
) -> Result<JsonValue, String> {
    if file_paths.is_empty() {
        return Err("No files provided".into());
    }

    let vault = vault_dir(&app);
    let target_dir = vault.join(project_id.as_deref().unwrap_or("_default"));
    ensure_dir(&target_dir)?;

    let mut results = Vec::new();

    for path_str in &file_paths {
        let src = PathBuf::from(path_str);
        if !src.exists() {
            continue;
        }

        let ext = src
            .extension()
            .and_then(|e| e.to_str())
            .unwrap_or("md");
        if !matches!(ext, "md" | "txt") {
            continue;
        }

        let content = fs::read_to_string(&src).map_err(|e| format!("{}: {}", path_str, e))?;
        let id = crate::db::new_id();
        let now = crate::db::now_str();
        let file_name = format!("{}.{}", id, ext);
        let dest = target_dir.join(&file_name);
        let relative_path = format!(
            "{}/{}",
            project_id.as_deref().unwrap_or("_default"),
            file_name
        );

        fs::write(&dest, &content).map_err(|e| e.to_string())?;

        let title = src
            .file_stem()
            .and_then(|s| s.to_str())
            .unwrap_or("未命名")
            .to_string();

        db.execute(
            "INSERT INTO personal_notes (id, projectId, title, content, tags, filePath, createdAt, updatedAt) \
             VALUES (?1, ?2, ?3, ?4, NULL, ?5, ?6, ?6)",
            rusqlite::params![id, project_id, title, content, relative_path, now],
        )
        .map_err(|e| e.to_string())?;

        results.push(json!({
            "id": id,
            "title": title,
            "filePath": relative_path,
        }));
    }

    if results.is_empty() {
        return Err("No valid .md/.txt files found".into());
    }

    Ok(JsonValue::Array(results))
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateKnowledgeNoteInput {
    pub title: String,
    pub content: String,
    pub project_id: Option<String>,
    pub tags: Option<String>,
}

#[command]
pub async fn knowledge_create_note(
    app: AppHandle,
    db: State<'_, Database>,
    data: CreateKnowledgeNoteInput,
) -> Result<JsonValue, String> {
    let vault = vault_dir(&app);
    let target_dir = vault.join(data.project_id.as_deref().unwrap_or("_default"));
    ensure_dir(&target_dir)?;

    let id = crate::db::new_id();
    let now = crate::db::now_str();
    let file_name = format!("{}.md", id);
    let dest = target_dir.join(&file_name);
    let relative_path = format!(
        "{}/{}",
        data.project_id.as_deref().unwrap_or("_default"),
        file_name
    );

    fs::write(&dest, &data.content).map_err(|e| e.to_string())?;

    db.execute(
        "INSERT INTO personal_notes (id, projectId, title, content, tags, filePath, createdAt, updatedAt) \
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?7)",
        rusqlite::params![
            id,
            data.project_id,
            data.title,
            data.content,
            data.tags,
            relative_path,
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
