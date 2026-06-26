use serde::Deserialize;
use serde_json::Value as JsonValue;
use tauri::{command, AppHandle, State};

use crate::db::Database;
use crate::path_guard;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectListParams {
    pub status: Option<String>,
    pub search: Option<String>,
    pub priority: Option<String>,
    pub source: Option<String>,
    pub sort_by: Option<String>,
    pub sort_order: Option<String>,
    pub workspace_id: Option<String>,
}

#[command]
pub async fn projects_list(
    db: State<'_, Database>,
    params: Option<ProjectListParams>,
) -> Result<JsonValue, String> {
    let mut sql = String::from(
        "SELECT p.*,
            COUNT(DISTINCT t.id) as taskCount,
            COUNT(DISTINCT CASE WHEN t.status = 'Done' THEN t.id END) as completedTaskCount,
            COUNT(DISTINCT d.id) as docCount,
            COUNT(DISTINCT r.id) as repoCount
         FROM projects p
         LEFT JOIN tasks t ON t.projectId = p.id
         LEFT JOIN documents d ON d.projectId = p.id
         LEFT JOIN remote_repos r ON r.projectId = p.id
         WHERE p.deletedAt IS NULL",
    );
    let mut param_values: Vec<Box<dyn rusqlite::types::ToSql>> = vec![];
    let mut param_idx = 1u32;

    if let Some(ref p) = params {
        if let Some(ref status) = p.status {
            sql.push_str(&format!(" AND p.status = ?{}", param_idx));
            param_values.push(Box::new(status.clone()));
            param_idx += 1;
        }
        if let Some(ref search) = p.search {
            sql.push_str(&format!(
                " AND (p.name LIKE '%' || ?{} || '%' OR p.description LIKE '%' || ?{} || '%' OR p.techStack LIKE '%' || ?{} || '%' OR p.localPath LIKE '%' || ?{} || '%')",
                param_idx, param_idx, param_idx, param_idx
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
        if let Some(ref workspace_id) = p.workspace_id {
            if workspace_id == "none" {
                sql.push_str(" AND p.workspaceId IS NULL");
            } else {
                sql.push_str(&format!(" AND p.workspaceId = ?{}", param_idx));
                param_values.push(Box::new(workspace_id.clone()));
                param_idx += 1;
            }
        }
    }

    let sort = params.as_ref().and_then(|p| p.sort_by.as_deref()).unwrap_or("updatedAt");
    let order = params.as_ref().and_then(|p| p.sort_order.as_deref()).unwrap_or("DESC");
    let valid_sorts = ["name", "status", "priority", "createdAt", "updatedAt"];
    let sort_col = if valid_sorts.contains(&sort) { sort } else { "updatedAt" };
    let order_dir = if order.eq_ignore_ascii_case("ASC") { "ASC" } else { "DESC" };
    sql.push_str(" GROUP BY p.id");
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
             FROM projects p WHERE p.id = ?1",
            rusqlite::params![id],
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
    pub frontend_command: Option<String>,
    pub backend_command: Option<String>,
    pub frontend_cwd: Option<String>,
    pub backend_cwd: Option<String>,
    pub live_url: Option<String>,
    pub domain_name: Option<String>,
    pub tech_stack: Option<Vec<String>>,
    pub start_date: Option<String>,
    pub target_date: Option<String>,
    pub icon_type: Option<String>,
    pub icon_url: Option<String>,
    pub icon_color: Option<String>,
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

    // Auto-detect icon if not provided
    let (icon_type, icon_url, icon_color) = match (&data.icon_type, &data.icon_url) {
        (Some(t), url) if t == "Custom" && url.is_some() => {
            (t.clone(), url.clone(), data.icon_color.clone())
        }
        _ => {
            if let Some(ref path) = data.local_path {
                if let Ok(detected) = super::detect::detect_local_project(path.clone()).await {
                    (
                        detected.icon_type.unwrap_or_else(|| "Auto".into()),
                        detected.icon_url,
                        detected.icon_color,
                    )
                } else {
                    ("Auto".into(), None, None)
                }
            } else {
                ("Auto".into(), None, None)
            }
        }
    };

    db.execute(
        "INSERT INTO projects (id, name, description, status, priority, source, localPath, openCommand, frontendCommand, backendCommand, frontendCwd, backendCwd, liveUrl, domainName, techStack, startDate, targetDate, iconType, iconUrl, iconColor, createdAt, updatedAt)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18, ?19, ?20, ?21, ?21)",
        rusqlite::params![
            id,
            data.name,
            data.description,
            data.status.unwrap_or_else(|| "Idea".into()),
            data.priority.unwrap_or_else(|| "Medium".into()),
            data.source.unwrap_or_else(|| "Local".into()),
            data.local_path,
            data.open_command,
            data.frontend_command,
            data.backend_command,
            data.frontend_cwd,
            data.backend_cwd,
            data.live_url,
            data.domain_name,
            tech_stack,
            data.start_date,
            data.target_date,
            icon_type,
            icon_url,
            icon_color,
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
    pub frontend_command: Option<String>,
    pub backend_command: Option<String>,
    pub frontend_cwd: Option<String>,
    pub backend_cwd: Option<String>,
    pub live_url: Option<String>,
    pub domain_name: Option<String>,
    pub tech_stack: Option<Vec<String>>,
    pub start_date: Option<String>,
    pub target_date: Option<String>,
    pub icon_type: Option<String>,
    pub icon_url: Option<String>,
    pub icon_color: Option<String>,
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
        add_field!(frontend_command, "frontendCommand");
        add_field!(backend_command, "backendCommand");
        add_field!(frontend_cwd, "frontendCwd");
        add_field!(backend_cwd, "backendCwd");
        add_field!(live_url, "liveUrl");
        add_field!(domain_name, "domainName");
        add_field!(start_date, "startDate");
        add_field!(target_date, "targetDate");
        add_field!(icon_type, "iconType");
        add_field!(icon_url, "iconUrl");
        add_field!(icon_color, "iconColor");

        if let Some(ts) = data.tech_stack {
            sets.push(format!("techStack = ?{}", idx));
            param_values.push(Box::new(serde_json::to_string(&ts).unwrap_or_else(|_| "[]".into())));
            idx += 1;
        }

        if sets.is_empty() {
        } else {
            let now = crate::db::now_str();
            sets.push(format!("updatedAt = ?{}", idx));
            param_values.push(Box::new(now));
            idx += 1;

            let id_idx = idx;
            sets.push(format!("id = ?{}", idx));
            param_values.push(Box::new(id.clone()));

            let sql = format!("UPDATE projects SET {} WHERE id = ?{}", sets.join(", "), id_idx);
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
        "UPDATE projects SET deletedAt = datetime('now') WHERE id = ?1 AND deletedAt IS NULL",
        rusqlite::params![id],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

#[command]
pub async fn projects_restore(
    db: State<'_, Database>,
    id: String,
) -> Result<JsonValue, String> {
    db.execute_returning_changes(
        "UPDATE projects SET deletedAt = NULL WHERE id = ?1",
        rusqlite::params![id],
    )
    .map_err(|e| e.to_string())?;
    projects_get_by_id(db, id).await
}

#[command]
pub async fn projects_refresh(
    db: State<'_, Database>,
    id: String,
) -> Result<JsonValue, String> {
    let project = db
        .query_one_json(
            "SELECT localPath, techStack, frontendCommand, backendCommand, openCommand, frontendCwd, backendCwd FROM projects WHERE id = ?1",
            rusqlite::params![id],
        )
        .map_err(|e| e.to_string())?
        .ok_or("PROJECT_NOT_FOUND")?;

    let local_path = project.get("localPath").and_then(|v| v.as_str());
    let current_frontend = project.get("frontendCommand").and_then(|v| v.as_str());
    let current_backend = project.get("backendCommand").and_then(|v| v.as_str());
    let current_open = project.get("openCommand").and_then(|v| v.as_str());
    let current_fe_cwd = project.get("frontendCwd").and_then(|v| v.as_str());
    let current_be_cwd = project.get("backendCwd").and_then(|v| v.as_str());

    let path = local_path.ok_or("NO_LOCAL_PATH: 项目没有本地路径，无法检测")?;

    // Re-detect project info
    let detected = super::detect::detect_local_project(path.to_string()).await
        .map_err(|e| format!("检测失败: {}", e))?;

    // Preserve existing commands, only use detected if empty
    let final_frontend = current_frontend
        .map(|s| s.to_string())
        .or(detected.frontend_command);
    let final_backend = current_backend
        .map(|s| s.to_string())
        .or(detected.backend_command);
    let final_open = current_open
        .map(|s| s.to_string())
        .or(detected.open_command);

    // Auto-detect cwd for commands that don't have one configured
    let final_fe_cwd = current_fe_cwd
        .map(|s| s.to_string())
        .or_else(|| {
            final_frontend.as_deref().and_then(|cmd| {
                detect_project_cwd_inner(path, cmd).ok().flatten()
            })
        });
    let final_be_cwd = current_be_cwd
        .map(|s| s.to_string())
        .or_else(|| {
            final_backend.as_deref().and_then(|cmd| {
                detect_project_cwd_inner(path, cmd).ok().flatten()
            })
        });

    let now = crate::db::now_str();
    let tech_stack = serde_json::to_string(&detected.tech_stack).unwrap_or_else(|_| "[]".into());

    db.execute(
        "UPDATE projects SET
            name = COALESCE(?1, name),
            description = COALESCE(?2, description),
            techStack = ?3,
            openCommand = ?4,
            frontendCommand = ?5,
            backendCommand = ?6,
            frontendCwd = ?12,
            backendCwd = ?13,
            iconType = ?7,
            iconUrl = ?8,
            iconColor = ?9,
            updatedAt = ?10
         WHERE id = ?11",
        rusqlite::params![
            detected.name,
            detected.description,
            tech_stack,
            final_open,
            final_frontend,
            final_backend,
            detected.icon_type.unwrap_or_else(|| "Auto".into()),
            detected.icon_url,
            detected.icon_color,
            now,
            id,
            final_fe_cwd,
            final_be_cwd,
        ],
    )
    .map_err(|e| e.to_string())?;

    projects_get_by_id(db, id).await
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
            "SELECT status FROM projects WHERE id = ?1",
            rusqlite::params![id],
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
            "SELECT localPath, openCommand, frontendCommand, backendCommand FROM projects WHERE id = ?1",
            rusqlite::params![id],
        )
        .map_err(|e| e.to_string())?
        .ok_or("PROJECT_NOT_FOUND")?;

    let local_path = project.get("localPath").and_then(|v| v.as_str());
    let open_command = project.get("openCommand").and_then(|v| v.as_str());
    let frontend_command = project.get("frontendCommand").and_then(|v| v.as_str());
    let backend_command = project.get("backendCommand").and_then(|v| v.as_str());

    let path = local_path.ok_or("NO_LOCAL_PATH: 请先设置本地路径")?;

    // 校验路径不含 shell 元字符，防止命令注入
    if path_guard::contains_shell_metachars(path) {
        return Err("项目路径包含不允许的字符".into());
    }

    let effective = frontend_command.or(backend_command).or(open_command).unwrap_or("explorer {path}");
    let command_str = effective.replace("{path}", path);

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

fn detect_project_cwd_inner(project_path: &str, command: &str) -> Result<Option<String>, String> {
    use std::fs;

    let root = std::path::PathBuf::from(project_path);
    if !root.exists() {
        return Err("Project path does not exist".into());
    }

    // Extract script name from command (e.g. "npm run dev" -> "dev", "pnpm start" -> "start")
    let parts: Vec<&str> = command.trim().split_whitespace().collect();
    let skip_prefixes = ["npx", "pnpm", "yarn"];
    let filtered: Vec<&str> = parts.iter()
        .copied()
        .skip_while(|s| skip_prefixes.contains(s))
        .collect();

    let script_name = if filtered.len() >= 2 && (filtered[0] == "run" || filtered[0] == "start") {
        filtered.last().map_or(String::new(), |s| s.to_string())
    } else {
        filtered.last().or(parts.first()).map_or(String::new(), |s| s.to_string())
    };

    if script_name.is_empty() {
        return Ok(None);
    }

    // Check root package.json first
    let root_pkg = root.join("package.json");
    if let Ok(content) = fs::read_to_string(&root_pkg) {
        if let Ok(pkg) = serde_json::from_str::<serde_json::Value>(&content) {
            if let Some(scripts) = pkg.get("scripts").and_then(|s| s.as_object()) {
                if scripts.contains_key(&script_name) {
                    return Ok(Some(".".into()));
                }
            }
        }
    }

    // Scan first-level subdirectories
    if let Ok(entries) = fs::read_dir(&root) {
        for entry in entries.flatten() {
            if !entry.file_type().map(|ft| ft.is_dir()).unwrap_or(false) {
                continue;
            }
            let dir_name = entry.file_name().to_string_lossy().to_string();
            if dir_name.starts_with('.') || dir_name == "node_modules" {
                continue;
            }
            let pkg_path = entry.path().join("package.json");
            if let Ok(content) = fs::read_to_string(pkg_path) {
                if let Ok(pkg) = serde_json::from_str::<serde_json::Value>(&content) {
                    if let Some(scripts) = pkg.get("scripts").and_then(|s| s.as_object()) {
                        if scripts.contains_key(&script_name) {
                            return Ok(Some(dir_name));
                        }
                    }
                }
            }
        }
    }

    Ok(None)
}

#[command]
pub async fn detect_project_cwd(project_path: String, command: String) -> Result<Option<String>, String> {
    detect_project_cwd_inner(&project_path, &command)
}

/// Debug: return raw DB columns to verify cwd fields exist and have values.
#[command]
pub async fn debug_project_raw(db: State<'_, Database>, id: String) -> Result<JsonValue, String> {
    db.query_one_json(
        "SELECT id, frontendCommand, backendCommand, frontendCwd, backendCwd, localPath FROM projects WHERE id = ?1",
        rusqlite::params![id],
    )
    .map_err(|e| e.to_string())?
    .ok_or("NOT_FOUND".into())
}

/// Launch frontend and/or backend for a project.
/// Returns the commands that were started.
#[command]
pub async fn projects_launch(
    db: State<'_, Database>,
    app: AppHandle,
    id: String,
    components: Option<Vec<String>>, // ["frontend", "backend", "open"], None = all available
) -> Result<JsonValue, String> {
    let project = db
        .query_one_json(
            "SELECT id, name, localPath, frontendCommand, backendCommand, openCommand, frontendCwd, backendCwd FROM projects WHERE id = ?1",
            rusqlite::params![id],
        )
        .map_err(|e| e.to_string())?
        .ok_or("PROJECT_NOT_FOUND")?;

    let local_path = project.get("localPath").and_then(|v| v.as_str()).ok_or("NO_LOCAL_PATH")?;

    // 校验路径不含 shell 元字符，防止命令注入
    if path_guard::contains_shell_metachars(local_path) {
        return Err("项目路径包含不允许的字符".into());
    }

    let frontend_cmd = project.get("frontendCommand").and_then(|v| v.as_str());
    let backend_cmd = project.get("backendCommand").and_then(|v| v.as_str());
    let open_cmd = project.get("openCommand").and_then(|v| v.as_str());
    let frontend_cwd = project.get("frontendCwd").and_then(|v| v.as_str());
    let backend_cwd = project.get("backendCwd").and_then(|v| v.as_str());

    let requested = components.unwrap_or_else(|| {
        let mut v = Vec::new();
        if frontend_cmd.is_some() { v.push("frontend".into()); }
        if backend_cmd.is_some() { v.push("backend".into()); }
        v
    });

    let mut launched: Vec<String> = Vec::new();
    let now = crate::db::now_str();

    let resolve_cwd = |cwd_opt: Option<&str>| -> String {
        cwd_opt.map(|c| {
            if c.starts_with('/') || c.contains(":\\") { c.to_string() }
            else { format!("{}/{}", local_path, c) }
        }).unwrap_or_else(|| local_path.to_string())
    };

    for comp in &requested {
        match comp.as_str() {
            "frontend" => {
                if let Some(cmd) = frontend_cmd {
                    let cwd = resolve_cwd(frontend_cwd);
                    let terminal_id = crate::commands::workspace::terminal::terminal_start(app.clone(), id.clone(), cmd.to_string(), cwd).await?;
                    launched.push(terminal_id);
                    db.execute(
                        "UPDATE projects SET frontendStatus = 'running', lastLaunchTime = ?1 WHERE id = ?2",
                        rusqlite::params![now, id],
                    ).map_err(|e| e.to_string())?;
                }
            }
            "backend" => {
                if let Some(cmd) = backend_cmd {
                    let cwd = resolve_cwd(backend_cwd);
                    let terminal_id = crate::commands::workspace::terminal::terminal_start(app.clone(), id.clone(), cmd.to_string(), cwd).await?;
                    launched.push(terminal_id);
                    db.execute(
                        "UPDATE projects SET backendStatus = 'running', lastLaunchTime = ?1 WHERE id = ?2",
                        rusqlite::params![now, id],
                    ).map_err(|e| e.to_string())?;
                }
            }
            "open" => {
                if let Some(cmd) = open_cmd {
                    let effective = cmd.replace("{path}", local_path);
                    #[cfg(target_os = "windows")]
                    let result = std::process::Command::new("cmd").args(["/C", &effective]).current_dir(local_path).spawn();
                    #[cfg(not(target_os = "windows"))]
                    let result = std::process::Command::new("sh").args(["-c", &effective]).current_dir(local_path).spawn();
                    if result.is_ok() {
                        launched.push("open".into());
                    }
                }
            }
            _ => {}
        }
    }

    Ok(serde_json::json!({
        "projectId": id,
        "launched": launched,
    }))
}

/// Stop running processes for a project.
#[command]
pub async fn projects_stop(
    db: State<'_, Database>,
    id: String,
    components: Option<Vec<String>>,
) -> Result<JsonValue, String> {
    let processes = crate::commands::workspace::terminal::get_terminal_ids_for_project(&id);

    let requested = components.unwrap_or_else(|| vec!["frontend".into(), "backend".into()]);
    let mut stopped: Vec<String> = Vec::new();

    for terminal_id in &processes {
        let _ = crate::commands::workspace::terminal::terminal_stop(terminal_id.clone()).await;
        stopped.push(terminal_id.clone());
    }

    for comp in &requested {
        // Column name is constrained to fixed values by the match — no SQL injection risk
        let col = match comp.as_str() {
            "frontend" => "frontendStatus",
            "backend" => "backendStatus",
            _ => continue,
        };
        db.execute(
            &format!("UPDATE projects SET {} = 'stopped' WHERE id = ?1", col),
            rusqlite::params![id],
        ).map_err(|e| e.to_string())?;
    }

    Ok(serde_json::json!({
        "projectId": id,
        "stopped": stopped,
    }))
}

/// Check environment for a project: Node version, ports, .env, dependencies.
#[command]
pub async fn projects_check_environment(
    db: State<'_, Database>,
    id: String,
) -> Result<JsonValue, String> {
    let project = db
        .query_one_json(
            "SELECT id, name, localPath, frontendCommand, backendCommand FROM projects WHERE id = ?1",
            rusqlite::params![id],
        )
        .map_err(|e| e.to_string())?
        .ok_or("PROJECT_NOT_FOUND")?;

    let local_path = project.get("localPath").and_then(|v| v.as_str());
    let frontend_cmd = project.get("frontendCommand").and_then(|v| v.as_str());
    let backend_cmd = project.get("backendCommand").and_then(|v| v.as_str());

    let mut checks: Vec<serde_json::Value> = Vec::new();

    // Check if local path exists
    if let Some(path) = local_path {
        let path_exists = std::path::Path::new(path).exists();
        checks.push(serde_json::json!({
            "name": "项目路径",
            "status": if path_exists { "ok" } else { "error" },
            "message": if path_exists { path.to_string() } else { format!("路径不存在: {}", path) }
        }));

        if path_exists {
            // Check node_modules
            let has_node_modules = std::path::Path::new(path).join("node_modules").exists();
            if frontend_cmd.is_some() || backend_cmd.is_some() {
                let needs_install = if let Some(cmd) = frontend_cmd {
                    cmd.contains("npm") || cmd.contains("yarn") || cmd.contains("pnpm")
                } else if let Some(cmd) = backend_cmd {
                    cmd.contains("npm") || cmd.contains("yarn") || cmd.contains("pnpm")
                } else {
                    false
                };
                if needs_install {
                    checks.push(serde_json::json!({
                        "name": "依赖安装",
                        "status": if has_node_modules { "ok" } else { "warning" },
                        "message": if has_node_modules { "node_modules 已存在".to_string() } else { "需要运行 npm install".to_string() }
                    }));
                }
            }

            // Check .env file
            let has_env = std::path::Path::new(path).join(".env").exists();
            let has_env_example = std::path::Path::new(path).join(".env.example").exists();
            if has_env_example && !has_env {
                checks.push(serde_json::json!({
                    "name": "环境变量",
                    "status": "warning",
                    "message": "缺少 .env 文件，但存在 .env.example"
                }));
            } else if has_env {
                checks.push(serde_json::json!({
                    "name": "环境变量",
                    "status": "ok",
                    "message": ".env 文件已存在"
                }));
            }

            // Check git status
            let git_dir = std::path::Path::new(path).join(".git");
            if git_dir.exists() {
                let dirty = std::process::Command::new("git")
                    .args(["status", "--porcelain"])
                    .current_dir(path)
                    .output()
                    .ok()
                    .map(|o| String::from_utf8_lossy(&o.stdout).lines().count())
                    .unwrap_or(0);
                checks.push(serde_json::json!({
                    "name": "Git 状态",
                    "status": if dirty == 0 { "ok" } else { "info" },
                    "message": format!("{} 个未提交的变更", dirty)
                }));
            }
        }
    } else {
        checks.push(serde_json::json!({
            "name": "项目路径",
            "status": "error",
            "message": "未设置本地路径"
        }));
    }

    // Check Node.js version
    let node_ok = std::process::Command::new("node")
        .args(["--version"])
        .output()
        .ok()
        .and_then(|o| if o.status.success() { Some(String::from_utf8_lossy(&o.stdout).trim().to_string()) } else { None });
    if frontend_cmd.is_some() || backend_cmd.is_some() {
        checks.push(serde_json::json!({
            "name": "Node.js",
            "status": if node_ok.is_some() { "ok" } else { "error" },
            "message": node_ok.unwrap_or_else(|| "未安装 Node.js".to_string())
        }));
    }

    // Check common ports
    if let Some(cmd) = frontend_cmd {
        let port = if cmd.contains("5173") { Some(5173) }
            else if cmd.contains("3000") { Some(3000) }
            else if cmd.contains("8080") { Some(8080) }
            else { None };
        if let Some(port) = port {
            let in_use = check_port_in_use(port);
            checks.push(serde_json::json!({
                "name": format!("端口 {}", port),
                "status": if in_use { "warning" } else { "ok" },
                "message": if in_use { format!("端口 {} 已被占用", port) } else { format!("端口 {} 可用", port) }
            }));
        }
    }

    let has_errors = checks.iter().any(|c| c.get("status").and_then(|s| s.as_str()) == Some("error"));
    let has_warnings = checks.iter().any(|c| c.get("status").and_then(|s| s.as_str()) == Some("warning"));

    Ok(serde_json::json!({
        "projectId": id,
        "checks": checks,
        "overallStatus": if has_errors { "error" } else if has_warnings { "warning" } else { "ok" }
    }))
}

fn check_port_in_use(port: u16) -> bool {
    std::net::TcpListener::bind(("127.0.0.1", port)).is_err()
}

/// Batch import detected projects. Skips projects whose localPath already exists.
#[command]
pub async fn projects_batch_import(
    db: State<'_, Database>,
    projects: Vec<JsonValue>,
) -> Result<JsonValue, String> {
    let mut imported = 0;
    let mut skipped = 0;
    let mut errors: Vec<String> = Vec::new();

    // Get existing localPaths for dedup
    let existing = db.query_json(
        "SELECT localPath FROM projects WHERE localPath IS NOT NULL",
        rusqlite::params![],
    ).unwrap_or(serde_json::json!([]));
    let existing_paths: std::collections::HashSet<String> = match &existing {
        JsonValue::Array(arr) => arr.iter()
            .filter_map(|v| v.get("localPath").and_then(|p| p.as_str()).map(|s| s.to_lowercase()))
            .collect(),
        _ => std::collections::HashSet::new(),
    };

    for p in &projects {
        // Validate: name is required and must be non-empty
        let name = match p.get("name").and_then(|v| v.as_str()) {
            Some(n) if !n.trim().is_empty() => n.trim(),
            _ => {
                errors.push("跳过：缺少有效 name 字段".into());
                continue;
            }
        };

        let local_path = p.get("localPath").and_then(|v| v.as_str());
        if let Some(path) = local_path {
            if existing_paths.contains(&path.to_lowercase()) {
                skipped += 1;
                continue;
            }
        }

        let id = crate::db::new_id();
        let description = p.get("description").and_then(|v| v.as_str()).unwrap_or("");
        let tech_stack = p.get("techStack").map(|v| serde_json::to_string(v).unwrap_or_else(|_| "[]".into())).unwrap_or_else(|| "[]".into());
        let source = p.get("source").and_then(|v| v.as_str()).unwrap_or("Local");
        let frontend_cmd = p.get("frontendCommand").and_then(|v| v.as_str());
        let backend_cmd = p.get("backendCommand").and_then(|v| v.as_str());
        let open_cmd = p.get("openCommand").and_then(|v| v.as_str());
        let icon_type = p.get("iconType").and_then(|v| v.as_str()).unwrap_or("Auto");
        let icon_url = p.get("iconUrl").and_then(|v| v.as_str());
        let icon_color = p.get("iconColor").and_then(|v| v.as_str());
        let now = crate::db::now_str();

        match db.execute(
            "INSERT INTO projects (id, name, description, status, priority, source, localPath, openCommand, frontendCommand, backendCommand, techStack, iconType, iconUrl, iconColor, createdAt, updatedAt) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?15)",
            rusqlite::params![
                id, name, description, "Idea", "Medium", source, local_path,
                open_cmd, frontend_cmd, backend_cmd, tech_stack, icon_type, icon_url, icon_color, now,
            ],
        ) {
            Ok(_) => {
                imported += 1;
                if let Err(e) = db.log_activity("project_created", "project", &id, None, &id) {
                    errors.push(format!("Activity log failed for {}: {}", name, e));
                }
            }
            Err(e) => errors.push(format!("Failed to import {}: {}", name, e)),
        }
    }

    Ok(serde_json::json!({
        "imported": imported,
        "skipped": skipped,
        "errors": errors,
    }))
}

/// Resolve a cwd path to a project ID.
/// Used by Agent to map its working directory to a registered project.
#[command]
pub async fn projects_resolve_id(
    db: State<'_, Database>,
    cwd: String,
) -> Result<Option<String>, String> {
    let rows = db.query_json(
        "SELECT id FROM projects WHERE localPath = ?1 AND deletedAt IS NULL",
        rusqlite::params![cwd],
    ).map_err(|e| e.to_string())?;
    Ok(rows.as_array()
        .and_then(|arr| arr.first())
        .and_then(|v| v.get("id").and_then(|x| x.as_str()))
        .map(|s| s.to_string()))
}
