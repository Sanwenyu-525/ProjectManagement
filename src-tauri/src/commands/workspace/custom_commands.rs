use serde::Deserialize;
use serde_json::Value as JsonValue;
use tauri::{command, State};

use crate::db::Database;

#[command]
pub async fn custom_commands_list(db: State<'_, Database>) -> Result<JsonValue, String> {
    db.query_json(
        "SELECT * FROM custom_commands ORDER BY sortOrder ASC, name ASC",
        rusqlite::params![],
    )
    .map_err(|e| e.to_string())
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateCustomCommandInput {
    pub name: String,
    pub description: Option<String>,
    pub icon: Option<String>,
    pub content: String,
    pub sort_order: Option<i32>,
}

#[command]
pub async fn custom_commands_create(
    db: State<'_, Database>,
    data: CreateCustomCommandInput,
) -> Result<JsonValue, String> {
    if !data.name.starts_with('/') {
        return Err("命令名必须以 / 开头".into());
    }
    if data.content.trim().is_empty() {
        return Err("命令内容不能为空".into());
    }

    let id = crate::db::new_id();
    let now = crate::db::now_str();

    db.execute(
        "INSERT INTO custom_commands (id, name, description, icon, content, sortOrder, createdAt, updatedAt) \
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?7)",
        rusqlite::params![
            id,
            data.name,
            data.description.unwrap_or_default(),
            data.icon.unwrap_or_else(|| "terminal".into()),
            data.content,
            data.sort_order.unwrap_or(0),
            now,
        ],
    )
    .map_err(|e| e.to_string())?;

    db.query_one_json(
        "SELECT * FROM custom_commands WHERE id = ?1",
        rusqlite::params![id],
    )
    .map_err(|e| e.to_string())?
    .ok_or_else(|| "创建自定义命令失败".into())
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateCustomCommandInput {
    pub name: Option<String>,
    pub description: Option<String>,
    pub icon: Option<String>,
    pub content: Option<String>,
    pub sort_order: Option<i32>,
}

#[command]
pub async fn custom_commands_update(
    db: State<'_, Database>,
    id: String,
    data: UpdateCustomCommandInput,
) -> Result<JsonValue, String> {
    if let Some(ref name) = data.name {
        if !name.starts_with('/') {
            return Err("命令名必须以 / 开头".into());
        }
    }

    let mut sets = Vec::new();
    let mut params: Vec<Box<dyn rusqlite::types::ToSql>> = Vec::new();
    let mut idx = 1usize;

    macro_rules! add_field {
        ($field:expr, $col:expr) => {
            if let Some(val) = $field {
                sets.push(format!("{} = ?{}", $col, idx));
                params.push(Box::new(val));
                idx += 1;
            }
        };
    }

    add_field!(data.name, "name");
    add_field!(data.description, "description");
    add_field!(data.icon, "icon");
    add_field!(data.content, "content");
    add_field!(data.sort_order, "sortOrder");

    if sets.is_empty() {
        return Err("没有需要更新的字段".into());
    }

    sets.push(format!("updatedAt = ?{}", idx));
    params.push(Box::new(crate::db::now_str()));
    idx += 1;

    params.push(Box::new(id.clone()));
    let sql = format!(
        "UPDATE custom_commands SET {} WHERE id = ?{}",
        sets.join(", "),
        idx
    );

    let refs: Vec<&dyn rusqlite::types::ToSql> =
        params.iter().map(|p| p.as_ref()).collect();
    db.execute(&sql, &refs)
        .map_err(|e| e.to_string())?;

    db.query_one_json(
        "SELECT * FROM custom_commands WHERE id = ?1",
        rusqlite::params![id],
    )
    .map_err(|e| e.to_string())?
    .ok_or_else(|| "COMMAND_NOT_FOUND".into())
}

#[command]
pub async fn custom_commands_delete(db: State<'_, Database>, id: String) -> Result<(), String> {
    db.execute(
        "DELETE FROM custom_commands WHERE id = ?1",
        rusqlite::params![id],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}
