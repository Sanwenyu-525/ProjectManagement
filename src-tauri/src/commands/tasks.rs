use serde::Deserialize;
use serde_json::Value as JsonValue;
use tauri::{command, State};

use crate::db::{Database, DEFAULT_USER_ID};

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TaskListParams {
    pub status: Option<String>,
    pub repo_scope: Option<String>,
}

#[command]
pub async fn tasks_list(
    db: State<'_, Database>,
    project_id: String,
    params: Option<TaskListParams>,
) -> Result<JsonValue, String> {
    let mut sql = String::from(
        "SELECT t.*, r.repoFullName as repoScopeName
         FROM tasks t
         LEFT JOIN remote_repos r ON t.repoScope = r.id
         WHERE t.projectId = ?1",
    );
    let mut param_values: Vec<Box<dyn rusqlite::types::ToSql>> = vec![Box::new(project_id)];
    let mut idx = 2u32;

    if let Some(ref p) = params {
        if let Some(ref status) = p.status {
            sql.push_str(&format!(" AND t.status = ?{}", idx));
            param_values.push(Box::new(status.clone()));
            idx += 1;
        }
        if let Some(ref repo_scope) = p.repo_scope {
            if repo_scope == "null" {
                sql.push_str(" AND t.repoScope IS NULL");
            } else {
                sql.push_str(&format!(" AND t.repoScope = ?{}", idx));
                param_values.push(Box::new(repo_scope.clone()));
                idx += 1;
            }
        }
    }

    sql.push_str(" ORDER BY t.createdAt DESC");

    let refs: Vec<&dyn rusqlite::types::ToSql> = param_values.iter().map(|p| p.as_ref()).collect();
    db.query_json(&sql, &refs).map_err(|e| e.to_string())
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateTaskInput {
    pub title: String,
    pub description: Option<String>,
    pub priority: Option<String>,
    pub due_date: Option<String>,
    pub repo_scope: Option<String>,
    pub milestone_id: Option<String>,
    pub parent_id: Option<String>,
}

#[command]
pub async fn tasks_create(
    db: State<'_, Database>,
    project_id: String,
    data: CreateTaskInput,
) -> Result<JsonValue, String> {
    let id = crate::db::new_id();
    let now = crate::db::now_str();

    db.execute(
        "INSERT INTO tasks (id, title, description, status, priority, dueDate, projectId, repoScope, milestoneId, parentId, createdAt, updatedAt)
         VALUES (?1, ?2, ?3, 'Todo', ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?10)",
        rusqlite::params![
            id,
            data.title,
            data.description,
            data.priority.unwrap_or_else(|| "Medium".into()),
            data.due_date,
            project_id,
            data.repo_scope,
            data.milestone_id,
            data.parent_id,
            now,
        ],
    )
    .map_err(|e| e.to_string())?;

    // Log activity
    let details = serde_json::json!({ "title": data.title });
    db.log_activity("task_created", "task", &id, Some(&details), &project_id)
        .map_err(|e| e.to_string())?;

    db.query_one_json("SELECT * FROM tasks WHERE id = ?1", rusqlite::params![id])
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "Failed to create task".into())
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateTaskInput {
    pub title: Option<String>,
    pub description: Option<String>,
    pub priority: Option<String>,
    pub status: Option<String>,
    pub due_date: Option<String>,
    pub repo_scope: Option<String>,
    pub milestone_id: Option<String>,
}

#[command]
pub async fn tasks_update(
    db: State<'_, Database>,
    id: String,
    data: UpdateTaskInput,
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
        add_field!(description, "description");
        add_field!(priority, "priority");
        add_field!(status, "status");
        add_field!(due_date, "dueDate");
        add_field!(repo_scope, "repoScope");
        add_field!(milestone_id, "milestoneId");

        if !sets.is_empty() {
            let now = crate::db::now_str();
            sets.push(format!("updatedAt = ?{}", idx));
            param_values.push(Box::new(now));
            idx += 1;

            sets.push(format!("id = ?{}", idx));
            param_values.push(Box::new(id.clone()));

            let sql = format!("UPDATE tasks SET {} WHERE id = ?{}", sets.join(", "), idx - 1);
            let refs: Vec<&dyn rusqlite::types::ToSql> = param_values.iter().map(|p| p.as_ref()).collect();
            db.execute_returning_changes(&sql, &refs).map_err(|e| e.to_string())?;
        }
    }

    db.query_one_json("SELECT * FROM tasks WHERE id = ?1", rusqlite::params![id])
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "TASK_NOT_FOUND".into())
}

#[command]
pub async fn tasks_delete(db: State<'_, Database>, id: String) -> Result<(), String> {
    db.delete_by_id("tasks", &id).map_err(|e| e.to_string())
}

#[command]
pub async fn tasks_update_status(
    db: State<'_, Database>,
    id: String,
    status: String,
) -> Result<JsonValue, String> {
    let current = db
        .query_one_json(
            "SELECT status, projectId FROM tasks WHERE id = ?1",
            rusqlite::params![id],
        )
        .map_err(|e| e.to_string())?
        .ok_or("TASK_NOT_FOUND")?;

    let old_status = current
        .get("status")
        .and_then(|v| v.as_str())
        .unwrap_or("Unknown")
        .to_string();
    let project_id = current
        .get("projectId")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();

    let now = crate::db::now_str();
    db.execute(
        "UPDATE tasks SET status = ?1, updatedAt = ?2 WHERE id = ?3",
        rusqlite::params![status, now, id],
    )
    .map_err(|e| e.to_string())?;

    // Log activity
    let details = serde_json::json!({ "from": old_status, "to": status });
    db.log_activity("task_status_change", "task", &id, Some(&details), &project_id)
        .map_err(|e| e.to_string())?;

    db.query_one_json("SELECT * FROM tasks WHERE id = ?1", rusqlite::params![id])
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "TASK_NOT_FOUND".into())
}
