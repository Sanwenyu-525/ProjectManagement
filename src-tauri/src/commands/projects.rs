use serde::Deserialize;
use serde_json::Value as JsonValue;
use tauri::{command, State};

use crate::db::{Database, DEFAULT_USER_ID};

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectListParams {
    pub status: Option<String>,
    pub search: Option<String>,
    pub priority: Option<String>,
    pub source: Option<String>,
    pub sort_by: Option<String>,
    pub sort_order: Option<String>,
}

#[command]
pub async fn projects_list(
    db: State<'_, Database>,
    params: Option<ProjectListParams>,
) -> Result<JsonValue, String> {
    let mut sql = String::from(
        "SELECT p.*,
            (SELECT COUNT(*) FROM tasks WHERE projectId = p.id) as taskCount,
            (SELECT COUNT(*) FROM documents WHERE projectId = p.id) as docCount,
            (SELECT COUNT(*) FROM remote_repos WHERE projectId = p.id) as repoCount
         FROM projects p WHERE p.ownerId = ?1",
    );
    let mut param_values: Vec<Box<dyn rusqlite::types::ToSql>> = vec![Box::new(DEFAULT_USER_ID.to_string())];
    let mut param_idx = 2u32;

    if let Some(ref p) = params {
        if let Some(ref status) = p.status {
            sql.push_str(&format!(" AND p.status = ?{}", param_idx));
            param_values.push(Box::new(status.clone()));
            param_idx += 1;
        }
        if let Some(ref search) = p.search {
            sql.push_str(&format!(
                " AND (p.name LIKE '%' || ?{} || '%' OR p.description LIKE '%' || ?{} || '%')",
                param_idx, param_idx
            ));
            param_values.push(Box::new(search.clone()));
            param_idx += 1;
        }
        if let Some(ref priority) = p.priority {
            sql.push_str(&format!(" AND p.priority = ?{}", param_idx));
            param_values.push(Box::new(priority.clone()));
            param_idx += 1;
        }
        if let Some(ref source) = p.source {
            sql.push_str(&format!(" AND p.source = ?{}", param_idx));
            param_values.push(Box::new(source.clone()));
            param_idx += 1;
        }
    }

    let sort = params.as_ref().and_then(|p| p.sort_by.as_deref()).unwrap_or("updatedAt");
    let order = params.as_ref().and_then(|p| p.sort_order.as_deref()).unwrap_or("DESC");
    let valid_sorts = ["name", "status", "priority", "createdAt", "updatedAt"];
    let sort_col = if valid_sorts.contains(&sort) { sort } else { "updatedAt" };
    let order_dir = if order.eq_ignore_ascii_case("ASC") { "ASC" } else { "DESC" };
    sql.push_str(&format!(" ORDER BY p.{} {}", sort_col, order_dir));

    let refs: Vec<&dyn rusqlite::types::ToSql> = param_values.iter().map(|p| p.as_ref()).collect();
    db.query_json(&sql, &refs).map_err(|e| e.to_string())
}

#[command]
pub async fn projects_get_by_id(
    db: State<'_, Database>,
    id: String,
) -> Result<JsonValue, String> {
    let project = db
        .query_one_json(
            "SELECT p.*,
                (SELECT COUNT(*) FROM tasks WHERE projectId = p.id) as taskCount,
                (SELECT COUNT(*) FROM documents WHERE projectId = p.id) as docCount,
                (SELECT COUNT(*) FROM remote_repos WHERE projectId = p.id) as repoCount
             FROM projects p WHERE p.id = ?1 AND p.ownerId = ?2",
            rusqlite::params![id, DEFAULT_USER_ID],
        )
        .map_err(|e| e.to_string())?;

    match project {
        Some(mut p) => {
            // Attach related entities
            let repos = db
                .query_json(
                    "SELECT * FROM remote_repos WHERE projectId = ?1",
                    rusqlite::params![id],
                )
                .unwrap_or(serde_json::json!([]));
            let milestones = db
                .query_json(
                    "SELECT * FROM milestones WHERE projectId = ?1 ORDER BY dueDate ASC",
                    rusqlite::params![id],
                )
                .unwrap_or(serde_json::json!([]));
            let tags = db
                .query_json(
                    "SELECT t.* FROM tags t INNER JOIN project_tags pt ON t.id = pt.tagId WHERE pt.projectId = ?1",
                    rusqlite::params![id],
                )
                .unwrap_or(serde_json::json!([]));

            if let Some(obj) = p.as_object_mut() {
                obj.insert("remoteRepos".into(), repos);
                obj.insert("milestones".into(), milestones);
                obj.insert("tags".into(), tags);
            }
            Ok(p)
        }
        None => Err("PROJECT_NOT_FOUND".into()),
    }
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateProjectInput {
    pub name: String,
    pub description: Option<String>,
    pub status: Option<String>,
    pub priority: Option<String>,
    pub source: Option<String>,
    pub local_path: Option<String>,
    pub open_command: Option<String>,
    pub live_url: Option<String>,
    pub domain_name: Option<String>,
    pub tech_stack: Option<Vec<String>>,
    pub start_date: Option<String>,
    pub target_date: Option<String>,
}

#[command]
pub async fn projects_create(
    db: State<'_, Database>,
    data: CreateProjectInput,
) -> Result<JsonValue, String> {
    let id = crate::db::new_id();
    let now = crate::db::now_str();

    // Auto-detect tech stack from local path if not provided
    let tech_stack_vec = match data.tech_stack {
        Some(ts) if !ts.is_empty() => ts,
        _ => {
            if let Some(ref path) = data.local_path {
                if let Ok(detected) = super::detect::detect_local_project(path.clone()).await {
                    detected.tech_stack
                } else {
                    vec![]
                }
            } else {
                vec![]
            }
        }
    };
    let tech_stack = serde_json::to_string(&tech_stack_vec).unwrap_or_else(|_| "[]".into());

    db.execute(
        "INSERT INTO projects (id, name, description, status, priority, source, localPath, openCommand, liveUrl, domainName, techStack, startDate, targetDate, ownerId, createdAt, updatedAt)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?15)",
        rusqlite::params![
            id,
            data.name,
            data.description,
            data.status.unwrap_or_else(|| "Idea".into()),
            data.priority.unwrap_or_else(|| "Medium".into()),
            data.source.unwrap_or_else(|| "Local".into()),
            data.local_path,
            data.open_command,
            data.live_url,
            data.domain_name,
            tech_stack,
            data.start_date,
            data.target_date,
            DEFAULT_USER_ID,
            now,
        ],
    )
    .map_err(|e| e.to_string())?;

    db.query_one_json("SELECT * FROM projects WHERE id = ?1", rusqlite::params![id])
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "Failed to create project".into())
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateProjectInput {
    pub name: Option<String>,
    pub description: Option<String>,
    pub status: Option<String>,
    pub priority: Option<String>,
    pub source: Option<String>,
    pub local_path: Option<String>,
    pub open_command: Option<String>,
    pub live_url: Option<String>,
    pub domain_name: Option<String>,
    pub tech_stack: Option<Vec<String>>,
    pub start_date: Option<String>,
    pub target_date: Option<String>,
}

#[command]
pub async fn projects_update(
    db: State<'_, Database>,
    id: String,
    data: UpdateProjectInput,
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

        add_field!(name, "name");
        add_field!(description, "description");
        add_field!(status, "status");
        add_field!(priority, "priority");
        add_field!(source, "source");
        add_field!(local_path, "localPath");
        add_field!(open_command, "openCommand");
        add_field!(live_url, "liveUrl");
        add_field!(domain_name, "domainName");
        add_field!(start_date, "startDate");
        add_field!(target_date, "targetDate");

        if let Some(ts) = data.tech_stack {
            sets.push(format!("techStack = ?{}", idx));
            param_values.push(Box::new(serde_json::to_string(&ts).unwrap_or_else(|_| "[]".into())));
            idx += 1;
        }

        if sets.is_empty() {
            // param_values dropped here, no .await after
        } else {
            let now = crate::db::now_str();
            sets.push(format!("updatedAt = ?{}", idx));
            param_values.push(Box::new(now));
            idx += 1;

            sets.push(format!("id = ?{}", idx));
            param_values.push(Box::new(id.clone()));

            let sql = format!("UPDATE projects SET {} WHERE id = ?{}", sets.join(", "), idx - 1);
            let refs: Vec<&dyn rusqlite::types::ToSql> = param_values.iter().map(|p| p.as_ref()).collect();
            db.execute_returning_changes(&sql, &refs).map_err(|e| e.to_string())?;
        }
        // param_values and refs dropped here, before .await
    }

    projects_get_by_id(db, id).await
}

#[command]
pub async fn projects_delete(
    db: State<'_, Database>,
    id: String,
) -> Result<(), String> {
    db.execute_returning_changes(
        "DELETE FROM projects WHERE id = ?1 AND ownerId = ?2",
        rusqlite::params![id, DEFAULT_USER_ID],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

#[command]
pub async fn projects_update_status(
    db: State<'_, Database>,
    id: String,
    status: String,
) -> Result<JsonValue, String> {
    // Get current status for activity log
    let current = db
        .query_one_json(
            "SELECT status FROM projects WHERE id = ?1 AND ownerId = ?2",
            rusqlite::params![id, DEFAULT_USER_ID],
        )
        .map_err(|e| e.to_string())?;

    let old_status = current
        .as_ref()
        .and_then(|c| c.get("status"))
        .and_then(|v| v.as_str())
        .unwrap_or("Unknown")
        .to_string();

    let now = crate::db::now_str();
    db.execute(
        "UPDATE projects SET status = ?1, updatedAt = ?2 WHERE id = ?3",
        rusqlite::params![status, now, id],
    )
    .map_err(|e| e.to_string())?;

    // Log activity
    let details = serde_json::json!({ "from": old_status, "to": status });
    db.log_activity("status_change", "project", &id, Some(&details), &id)
        .map_err(|e| e.to_string())?;

    projects_get_by_id(db, id).await
}

#[command]
pub async fn projects_get_stats(
    db: State<'_, Database>,
    id: String,
) -> Result<JsonValue, String> {
    let stats = db
        .query_one_json(
            "SELECT
                COUNT(*) as total,
                SUM(CASE WHEN status = 'Done' THEN 1 ELSE 0 END) as done,
                SUM(CASE WHEN status = 'InProgress' THEN 1 ELSE 0 END) as inProgress,
                SUM(CASE WHEN status = 'Todo' THEN 1 ELSE 0 END) as todo,
                SUM(CASE WHEN status = 'Cancelled' THEN 1 ELSE 0 END) as cancelled
             FROM tasks WHERE projectId = ?1",
            rusqlite::params![id],
        )
        .map_err(|e| e.to_string())?;

    match stats {
        Some(mut s) => {
            let total = s.get("total").and_then(|v| v.as_i64()).unwrap_or(0);
            let done = s.get("done").and_then(|v| v.as_i64()).unwrap_or(0);
            let rate = if total > 0 { (done as f64 / total as f64) * 100.0 } else { 0.0 };
            if let Some(obj) = s.as_object_mut() {
                obj.insert("completionRate".into(), serde_json::json!(rate));
            }
            Ok(s)
        }
        None => Ok(serde_json::json!({
            "total": 0, "done": 0, "inProgress": 0, "todo": 0, "cancelled": 0, "completionRate": 0.0
        })),
    }
}

#[command]
pub async fn projects_open(
    db: State<'_, Database>,
    id: String,
) -> Result<JsonValue, String> {
    let project = db
        .query_one_json(
            "SELECT localPath, openCommand FROM projects WHERE id = ?1 AND ownerId = ?2",
            rusqlite::params![id, DEFAULT_USER_ID],
        )
        .map_err(|e| e.to_string())?
        .ok_or("PROJECT_NOT_FOUND")?;

    let local_path = project.get("localPath").and_then(|v| v.as_str());
    let open_command = project.get("openCommand").and_then(|v| v.as_str());

    let path = local_path.ok_or("NO_LOCAL_PATH: 请先设置本地路径")?;
    let cmd = open_command.unwrap_or("explorer {path}");
    let command_str = cmd.replace("{path}", path);

    // Execute the command using shell
    #[cfg(target_os = "windows")]
    let result = std::process::Command::new("cmd")
        .args(["/C", &command_str])
        .current_dir(path)
        .spawn();

    #[cfg(not(target_os = "windows"))]
    let result = std::process::Command::new("sh")
        .args(["-c", &command_str])
        .current_dir(path)
        .spawn();

    match result {
        Ok(_) => Ok(serde_json::json!({ "success": true, "command": command_str })),
        Err(e) => Err(format!("Failed to execute command: {}", e)),
    }
}
