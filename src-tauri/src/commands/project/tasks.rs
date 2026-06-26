use serde::Deserialize;
use serde_json::Value as JsonValue;
use tauri::{command, State};

use crate::db::Database;

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

            let id_idx = idx;
            sets.push(format!("id = ?{}", idx));
            param_values.push(Box::new(id.clone()));

            let sql = format!("UPDATE tasks SET {} WHERE id = ?{}", sets.join(", "), id_idx);
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

// ── Task-Commit Association ──

#[command]
pub async fn tasks_get_commits(db: State<'_, Database>, task_id: String) -> Result<JsonValue, String> {
    db.query_json(
        "SELECT tc.commitHash, tc.linkedAt, tc.linkSource FROM task_commits tc WHERE tc.taskId = ?1 ORDER BY tc.linkedAt DESC",
        rusqlite::params![task_id],
    )
    .map_err(|e| e.to_string())
}

#[command]
pub async fn tasks_link_commit(
    db: State<'_, Database>,
    task_id: String,
    commit_hash: String,
) -> Result<(), String> {
    let now = crate::db::now_str();
    db.execute(
        "INSERT OR IGNORE INTO task_commits (taskId, commitHash, linkedAt, linkSource) VALUES (?1, ?2, ?3, 'manual')",
        rusqlite::params![task_id, commit_hash, now],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

#[command]
pub async fn tasks_unlink_commit(
    db: State<'_, Database>,
    task_id: String,
    commit_hash: String,
) -> Result<(), String> {
    db.execute(
        "DELETE FROM task_commits WHERE taskId = ?1 AND commitHash = ?2",
        rusqlite::params![task_id, commit_hash],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

#[command]
pub async fn tasks_scan_commits(
    db: State<'_, Database>,
    project_id: String,
    repo_path: String,
) -> Result<JsonValue, String> {
    let tasks_json = db.query_json(
        "SELECT id FROM tasks WHERE projectId = ?1",
        rusqlite::params![project_id],
    ).map_err(|e| e.to_string())?;

    let task_ids: Vec<String> = match &tasks_json {
        JsonValue::Array(arr) => arr.iter()
            .filter_map(|v| v.get("id").and_then(|id| id.as_str()).map(|s| s.to_string()))
            .collect(),
        _ => Vec::new(),
    };

    if task_ids.is_empty() {
        return Ok(serde_json::json!({ "linked": 0 }));
    }

    let output = std::process::Command::new("git")
        .args(&["log", "--all", "--format=%H %s", "--no-merges", "-500"])
        .current_dir(&repo_path)
        .output()
        .map_err(|e| format!("执行 git log 失败: {}", e))?;

    if !output.status.success() {
        return Err("git log 执行失败".into());
    }

    let log_text = String::from_utf8_lossy(&output.stdout);
    let now = crate::db::now_str();
    let mut linked_count = 0i32;

    let re = regex::Regex::new(
        r"(?i)(?:fix(?:es)?|close[sd]?|resolve[sd]?|refs?)\s+#([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})"
    ).map_err(|e| format!("正则编译失败: {}", e))?;

    for line in log_text.lines() {
        let line = line.trim();
        if line.is_empty() { continue; }
        let parts: Vec<&str> = line.splitn(2, ' ').collect();
        if parts.len() < 2 { continue; }
        let commit_hash = parts[0];
        let message = parts[1];

        for cap in re.captures_iter(message) {
            if let Some(task_id_match) = cap.get(1) {
                let task_id_str = task_id_match.as_str();
                if task_ids.iter().any(|tid| tid == task_id_str) {
                    let _ = db.execute(
                        "INSERT OR IGNORE INTO task_commits (taskId, commitHash, linkedAt, linkSource) VALUES (?1, ?2, ?3, 'auto')",
                        rusqlite::params![task_id_str, commit_hash, now],
                    );
                    linked_count += 1;
                }
            }
        }
    }

    Ok(serde_json::json!({ "linked": linked_count }))
}
