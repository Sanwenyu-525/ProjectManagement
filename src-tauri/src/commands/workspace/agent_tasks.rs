use serde::Deserialize;
use serde_json::Value as JsonValue;
use tauri::{command, State};

use crate::db::Database;

#[command]
pub async fn agent_tasks_list(
    db: State<'_, Database>,
    session_id: String,
) -> Result<JsonValue, String> {
    db.query_json(
        "SELECT * FROM agent_tasks WHERE sessionId = ?1 ORDER BY sortOrder ASC, createdAt ASC",
        rusqlite::params![session_id],
    )
    .map_err(|e| e.to_string())
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateAgentTaskInput {
    pub title: String,
    pub parent_id: Option<String>,
    pub priority: Option<String>,
    pub sort_order: Option<i32>,
}

#[command]
pub async fn agent_tasks_create(
    db: State<'_, Database>,
    session_id: String,
    data: CreateAgentTaskInput,
) -> Result<JsonValue, String> {
    let id = crate::db::new_id();
    let now = crate::db::now_str();

    db.execute(
        "INSERT INTO agent_tasks (id, sessionId, parentId, title, status, priority, sortOrder, createdAt, updatedAt) \
         VALUES (?1, ?2, ?3, ?4, 'pending', ?5, ?6, ?7, ?7)",
        rusqlite::params![
            id,
            session_id,
            data.parent_id,
            data.title,
            data.priority.unwrap_or_else(|| "medium".into()),
            data.sort_order.unwrap_or(0),
            now,
        ],
    )
    .map_err(|e| e.to_string())?;

    db.query_one_json(
        "SELECT * FROM agent_tasks WHERE id = ?1",
        rusqlite::params![id],
    )
    .map_err(|e| e.to_string())?
    .ok_or_else(|| "Failed to create agent task".into())
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateAgentTaskInput {
    pub title: Option<String>,
    pub status: Option<String>,
    pub priority: Option<String>,
    pub sort_order: Option<i32>,
}

#[command]
pub async fn agent_tasks_update(
    db: State<'_, Database>,
    id: String,
    data: UpdateAgentTaskInput,
) -> Result<JsonValue, String> {
    {
        let mut sets = Vec::new();
        let mut param_values: Vec<Box<dyn rusqlite::types::ToSql>> = Vec::new();
        let mut idx = 1u32;

        macro_rules! add_field {
            ($field:ident, $col:expr) => {
                if let Some(v) = data.$field {
                    sets.push(format!("{} = ?{}", $col, idx));
                    param_values.push(Box::new(v));
                    idx += 1;
                }
            };
        }

        add_field!(title, "title");
        add_field!(status, "status");
        add_field!(priority, "priority");

        if let Some(v) = data.sort_order {
            sets.push(format!("sortOrder = ?{}", idx));
            param_values.push(Box::new(v));
            idx += 1;
        }

        if !sets.is_empty() {
            sets.push(format!("updatedAt = ?{}", idx));
            param_values.push(Box::new(crate::db::now_str()));
            idx += 1;

            let sql = format!("UPDATE agent_tasks SET {} WHERE id = ?{}", sets.join(", "), idx);
            param_values.push(Box::new(id.clone()));
            let refs: Vec<&dyn rusqlite::types::ToSql> =
                param_values.iter().map(|p| p.as_ref()).collect();
            db.execute_returning_changes(&sql, &refs)
                .map_err(|e| e.to_string())?;
        }
    }

    db.query_one_json(
        "SELECT * FROM agent_tasks WHERE id = ?1",
        rusqlite::params![id],
    )
    .map_err(|e| e.to_string())?
    .ok_or_else(|| "AGENT_TASK_NOT_FOUND".into())
}

#[command]
pub async fn agent_tasks_delete(db: State<'_, Database>, id: String) -> Result<(), String> {
    db.execute(
        "DELETE FROM agent_tasks WHERE id = ?1",
        rusqlite::params![id],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

#[command]
pub async fn agent_tasks_bulk_create(
    db: State<'_, Database>,
    session_id: String,
    tasks: Vec<CreateAgentTaskInput>,
) -> Result<JsonValue, String> {
    let now = crate::db::now_str();
    let mut ids = Vec::new();

    for (i, task) in tasks.iter().enumerate() {
        let id = crate::db::new_id();
        db.execute(
            "INSERT INTO agent_tasks (id, sessionId, parentId, title, status, priority, sortOrder, createdAt, updatedAt) \
             VALUES (?1, ?2, ?3, ?4, 'pending', ?5, ?6, ?7, ?7)",
            rusqlite::params![
                id,
                session_id,
                task.parent_id,
                task.title,
                task.priority.as_deref().unwrap_or("medium"),
                task.sort_order.unwrap_or(i as i32),
                now,
            ],
        )
        .map_err(|e| e.to_string())?;
        ids.push(id);
    }

    // Return all tasks for the session
    db.query_json(
        "SELECT * FROM agent_tasks WHERE sessionId = ?1 ORDER BY sortOrder ASC, createdAt ASC",
        rusqlite::params![session_id],
    )
    .map_err(|e| e.to_string())
}
