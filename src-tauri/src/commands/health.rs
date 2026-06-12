use serde::{Deserialize, Serialize};
use serde_json::Value as JsonValue;
use std::collections::HashMap;
use std::process::Command;
use tauri::{command, State};

use crate::db::Database;

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct OutdatedDep {
    pub name: String,
    pub current: String,
    pub wanted: String,
    pub latest: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ProjectHealthResult {
    pub project_id: String,
    pub project_name: String,
    pub dirty_file_count: i32,
    pub current_branch: Option<String>,
    pub ahead_count: i32,
    pub behind_count: i32,
    pub outdated_deps: Vec<OutdatedDep>,
    pub outdated_dep_count: i32,
    pub has_changes: bool,
    pub health_score: Option<i32>,
    pub health_status: Option<String>,
    pub error: Option<String>,
}

/// Compute a 100-point health score based on available signals.
///
/// Scoring breakdown:
/// - Git cleanliness (25): 0 dirty = 25, 1-5 = 20, 6-15 = 12, 16+ = 5
/// - Branch sync (20): synced = 20, ahead only = 15, behind only = 10, diverged = 5
/// - Dependencies (20): 0 outdated = 20, 1-3 = 15, 4-10 = 8, 11+ = 3
/// - Structure (20): has README = 7, has src/ = 7, has .gitignore = 6
/// - Code signals (15): has package.json scripts = 5, has tests = 5, has CI = 5
fn calculate_health_score(result: &ProjectHealthResult, local_path: &str) -> (i32, String) {
    let mut score: i32 = 0;

    // 1. Git cleanliness (25 points)
    if result.error.is_some() && result.error.as_ref().unwrap().contains("不是 Git 仓库") {
        score += 10; // Partial credit for non-git
    } else {
        score += match result.dirty_file_count {
            0 => 25,
            1..=5 => 20,
            6..=15 => 12,
            _ => 5,
        };
    }

    // 2. Branch sync (20 points)
    let is_ahead = result.ahead_count > 0;
    let is_behind = result.behind_count > 0;
    score += match (is_ahead, is_behind) {
        (false, false) => 20, // synced
        (true, false) => 15,  // ahead only
        (false, true) => 10,  // behind only
        (true, true) => 5,    // diverged
    };

    // 3. Dependencies (20 points)
    score += match result.outdated_dep_count {
        0 => 20,
        1..=3 => 15,
        4..=10 => 8,
        _ => 3,
    };

    // 4. Project structure (20 points)
    let root = std::path::Path::new(local_path);
    if root.join("README.md").exists() || root.join("README").exists() || root.join("readme.md").exists() {
        score += 7;
    }
    if root.join("src").exists() {
        score += 7;
    }
    if root.join(".gitignore").exists() {
        score += 6;
    }

    // 5. Code quality signals (15 points)
    // Has meaningful package.json scripts
    if let Ok(content) = std::fs::read_to_string(root.join("package.json")) {
        if let Ok(pkg) = serde_json::from_str::<serde_json::Value>(&content) {
            if let Some(scripts) = pkg.get("scripts").and_then(|s| s.as_object()) {
                if scripts.len() >= 3 { score += 5; }
                else if scripts.len() >= 1 { score += 3; }
            }
        }
    }
    // Has test files
    let has_tests = root.join("tests").exists()
        || root.join("__tests__").exists()
        || root.join("src").join("__tests__").exists()
        || root.join("test").exists();
    if has_tests { score += 5; }
    // Has CI config
    let has_ci = root.join(".github").join("workflows").exists()
        || root.join(".gitlab-ci.yml").exists()
        || root.join(".circleci").exists();
    if has_ci { score += 5; }

    let status = match score {
        80..=100 => "healthy",
        50..=79 => "needs_attention",
        _ => "critical",
    };

    (score, status.to_string())
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HealthCheckSummary {
    pub results: Vec<ProjectHealthResult>,
    pub changed_projects: Vec<ProjectHealthResult>,
}

// ── Internal helpers ────────────────────────────────────────────────────────

/// Run an external process, returning stdout. On non-zero exit, returns stdout
/// if non-empty (some tools like `npm outdated` write to stdout on "failure"),
/// otherwise returns stderr as Err.
fn run_cmd(bin: &str, args: &[&str], cwd: &str) -> Result<String, String> {
    let output = Command::new(bin)
        .args(args)
        .current_dir(cwd)
        .output()
        .map_err(|e| format!("执行 {} 失败: {}", bin, e))?;

    if output.status.success() {
        Ok(String::from_utf8_lossy(&output.stdout).to_string())
    } else {
        let stdout = String::from_utf8_lossy(&output.stdout).to_string();
        if stdout.is_empty() {
            Err(String::from_utf8_lossy(&output.stderr).to_string())
        } else {
            Ok(stdout)
        }
    }
}

/// Synchronous health check for a single project. Call via `spawn_blocking`.
fn check_project_health(project_id: &str, project_name: &str, local_path: &str) -> ProjectHealthResult {
    let mut error: Option<String> = None;

    // Git status — count dirty files
    let dirty_file_count = match run_cmd("git", &["status", "--porcelain"], local_path) {
        Ok(output) => output.lines().filter(|l| !l.trim().is_empty()).count() as i32,
        Err(e) => {
            let msg = if e.contains("not a git repository") || e.contains("不是 Git 仓库") {
                "不是 Git 仓库".into()
            } else {
                e
            };
            // Non-git repo — still try npm outdated below
            error = Some(msg);
            0
        }
    };

    let mut current_branch: Option<String> = None;
    let mut ahead_count: i32 = 0;
    let mut behind_count: i32 = 0;

    // Only run git commands if the repo check didn't fail with "not a git repo"
    if error.is_none() {
        // Current branch
        if let Ok(branch) = run_cmd("git", &["rev-parse", "--abbrev-ref", "HEAD"], local_path) {
            current_branch = Some(branch.trim().to_string());
        }

        // Ahead/behind upstream
        match run_cmd("git", &["rev-list", "--left-right", "--count", "@{upstream}...HEAD"], local_path) {
            Ok(output) => {
                let parts: Vec<&str> = output.trim().split_whitespace().collect();
                if parts.len() >= 2 {
                    behind_count = parts[0].parse().unwrap_or(0);
                    ahead_count = parts[1].parse().unwrap_or(0);
                }
            }
            Err(_) => {
                // No upstream configured — leave both at 0
            }
        }
    }

    // npm outdated — check for dependency updates
    let mut outdated_deps: Vec<OutdatedDep> = Vec::new();
    match run_cmd("npm", &["outdated", "--json"], local_path) {
        Ok(output) => {
            if let Ok(obj) = serde_json::from_str::<serde_json::Map<String, serde_json::Value>>(&output) {
                for (name, info) in &obj {
                    if let Some(info_obj) = info.as_object() {
                        let current = info_obj.get("current").and_then(|v| v.as_str()).unwrap_or("-").to_string();
                        let wanted = info_obj.get("wanted").and_then(|v| v.as_str()).unwrap_or("-").to_string();
                        let latest = info_obj.get("latest").and_then(|v| v.as_str()).unwrap_or("-").to_string();
                        if current != latest && current != "-" {
                            outdated_deps.push(OutdatedDep { name: name.clone(), current, wanted, latest });
                        }
                    }
                }
            }
        }
        Err(e) => {
            // Only report npm errors if it's not simply "no package.json"
            if !e.contains("no such file") && !e.contains("ENOENT") {
                let msg = format!("npm outdated 失败: {}", e.trim());
                error = Some(match error {
                    Some(existing) => format!("{}; {}", existing, msg),
                    None => msg,
                });
            }
        }
    }

    let mut result = ProjectHealthResult {
        project_id: project_id.to_string(),
        project_name: project_name.to_string(),
        dirty_file_count,
        current_branch,
        ahead_count,
        behind_count,
        outdated_dep_count: outdated_deps.len() as i32,
        outdated_deps,
        has_changes: false,
        health_score: None,
        health_status: None,
        error,
    };

    // Calculate health score
    let (score, status) = calculate_health_score(&result, local_path);
    result.health_score = Some(score);
    result.health_status = Some(status);

    result
}

/// Build a lookup map from the most recent health check BEFORE today.
fn load_previous_results(db: &Database, today: &str) -> HashMap<String, serde_json::Value> {
    let prev_json = db.query_json(
        "SELECT h.projectId, h.dirtyFileCount, h.currentBranch, h.aheadCount, h.behindCount, h.outdatedDepCount
         FROM project_health_checks h
         WHERE h.checkDate < ?1
         AND h.checkDate = (SELECT MAX(h2.checkDate) FROM project_health_checks h2 WHERE h2.projectId = h.projectId AND h2.checkDate < ?1)",
        rusqlite::params![today],
    );

    match prev_json {
        Ok(JsonValue::Array(arr)) => arr.into_iter().filter_map(|v| {
            let pid = v.get("projectId")?.as_str()?.to_string();
            Some((pid, v))
        }).collect(),
        _ => HashMap::new(),
    }
}

fn compute_has_changes(result: &ProjectHealthResult, prev_map: &HashMap<String, serde_json::Value>) -> bool {
    match prev_map.get(&result.project_id) {
        Some(prev) => {
            let prev_dirty = prev.get("dirtyFileCount").and_then(|v| v.as_i64()).unwrap_or(0) as i32;
            let prev_ahead = prev.get("aheadCount").and_then(|v| v.as_i64()).unwrap_or(0) as i32;
            let prev_behind = prev.get("behindCount").and_then(|v| v.as_i64()).unwrap_or(0) as i32;
            let prev_outdated = prev.get("outdatedDepCount").and_then(|v| v.as_i64()).unwrap_or(0) as i32;
            result.dirty_file_count != prev_dirty
                || result.ahead_count != prev_ahead
                || result.behind_count != prev_behind
                || result.outdated_dep_count != prev_outdated
        }
        None => {
            // First-ever check — treat as baseline, not a change
            false
        }
    }
}

fn save_result(db: &Database, result: &ProjectHealthResult, today: &str) {
    let id = format!("{}-{}", result.project_id, today);
    let outdated_json = serde_json::to_string(&result.outdated_deps).unwrap_or_default();
    let now = chrono::Local::now().format("%Y-%m-%d %H:%M:%S").to_string();

    let _ = db.execute(
        "INSERT OR REPLACE INTO project_health_checks (id, projectId, checkDate, dirtyFileCount, currentBranch, aheadCount, behindCount, outdatedDeps, outdatedDepCount, hasChanges, healthScore, healthStatus, createdAt) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13)",
        rusqlite::params![
            id,
            result.project_id,
            today,
            result.dirty_file_count,
            result.current_branch,
            result.ahead_count,
            result.behind_count,
            outdated_json,
            result.outdated_dep_count,
            result.has_changes as i32,
            result.health_score,
            result.health_status,
            now,
        ],
    );
}

// ── Commands ────────────────────────────────────────────────────────────────

/// Run health checks for all projects with a localPath.
/// Uses `spawn_blocking` per project to avoid blocking the async runtime.
#[command]
pub async fn run_all_health_checks(db: State<'_, Database>) -> Result<HealthCheckSummary, String> {
    let today = chrono::Local::now().format("%Y-%m-%d").to_string();

    let projects_json = db.query_json(
        "SELECT id, name, localPath FROM projects WHERE localPath IS NOT NULL",
        rusqlite::params![],
    ).map_err(|e| e.to_string())?;

    let projects: Vec<serde_json::Value> = match projects_json {
        JsonValue::Array(arr) => arr,
        _ => Vec::new(),
    };

    let prev_map = load_previous_results(&db, &today);

    // Run health checks in parallel via spawn_blocking
    let mut handles = Vec::new();
    for p in &projects {
        let project_id = p.get("id").and_then(|v| v.as_str()).unwrap_or("").to_string();
        let project_name = p.get("name").and_then(|v| v.as_str()).unwrap_or("").to_string();
        let local_path = p.get("localPath").and_then(|v| v.as_str()).unwrap_or("").to_string();

        if local_path.is_empty() {
            continue;
        }

        handles.push(tokio::task::spawn_blocking(move || {
            check_project_health(&project_id, &project_name, &local_path)
        }));
    }

    let mut results = Vec::new();
    let mut changed_projects = Vec::new();

    for handle in handles {
        if let Ok(mut result) = handle.await {
            let has_changes = compute_has_changes(&result, &prev_map);
            result.has_changes = has_changes;
            save_result(&db, &result, &today);

            if has_changes {
                changed_projects.push(result.clone());
            }
            results.push(result);
        }
    }

    Ok(HealthCheckSummary { results, changed_projects })
}

/// Run health check for a single project (used by the per-project "re-check" button).
#[command]
pub async fn run_health_check_for_project(
    db: State<'_, Database>,
    project_id: String,
) -> Result<ProjectHealthResult, String> {
    let today = chrono::Local::now().format("%Y-%m-%d").to_string();

    let project = db.query_one_json(
        "SELECT id, name, localPath FROM projects WHERE id = ?1",
        rusqlite::params![project_id],
    ).map_err(|e| e.to_string())?
        .ok_or("项目不存在")?;

    let project_name = project.get("name").and_then(|v| v.as_str()).unwrap_or("").to_string();
    let local_path = project.get("localPath").and_then(|v| v.as_str()).unwrap_or("").to_string();

    if local_path.is_empty() {
        return Err("项目没有设置本地路径".into());
    }

    let prev_map = load_previous_results(&db, &today);

    let mut result = tokio::task::spawn_blocking(move || {
        check_project_health(&project_id, &project_name, &local_path)
    }).await.map_err(|e| e.to_string())?;

    let has_changes = compute_has_changes(&result, &prev_map);
    result.has_changes = has_changes;
    save_result(&db, &result, &today);

    Ok(result)
}

/// Get health check history for a specific project.
#[command]
pub async fn get_project_health_history(
    db: State<'_, Database>,
    project_id: String,
    limit: Option<i32>,
) -> Result<JsonValue, String> {
    let n = limit.unwrap_or(7);
    db.query_json(
        "SELECT * FROM project_health_checks WHERE projectId = ?1 ORDER BY checkDate DESC LIMIT ?2",
        rusqlite::params![project_id, n],
    ).map_err(|e| e.to_string())
}

/// Get the latest health check for every project.
#[command]
pub async fn get_all_latest_health(db: State<'_, Database>) -> Result<JsonValue, String> {
    db.query_json(
        "SELECT h.* FROM project_health_checks h
         INNER JOIN (SELECT projectId, MAX(checkDate) as maxDate FROM project_health_checks GROUP BY projectId) latest
         ON h.projectId = latest.projectId AND h.checkDate = latest.maxDate",
        rusqlite::params![],
    ).map_err(|e| e.to_string())
}
