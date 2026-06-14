use serde_json::Value as JsonValue;
use tauri::{command, State};
use crate::db::Database;

// ── Agent Sessions ──

/// Create a new agent session record. Returns the session ID.
#[command]
pub async fn sessions_start(
    db: State<'_, Database>,
    agent_tab_id: String,
    runtime_id: String,
    project_id: Option<String>,
    cwd: Option<String>,
) -> Result<String, String> {
    let id = uuid::Uuid::new_v4().to_string();
    let now = chrono::Utc::now().format("%Y-%m-%d %H:%M:%S").to_string();

    db.execute(
        "INSERT INTO agent_sessions (id, agentTabId, runtimeId, startedAt, status, projectId, cwd) VALUES (?1, ?2, ?3, ?4, 'running', ?5, ?6)",
        rusqlite::params![id, agent_tab_id, runtime_id, now, project_id, cwd],
    ).map_err(|e| e.to_string())?;

    Ok(id)
}

/// Append a message to an agent session.
#[command]
pub async fn sessions_append_message(
    db: State<'_, Database>,
    session_id: String,
    role: String,
    content: String,
) -> Result<(), String> {
    let now = chrono::Utc::now().format("%Y-%m-%d %H:%M:%S").to_string();

    db.execute(
        "INSERT INTO agent_messages (sessionId, role, content, timestamp) VALUES (?1, ?2, ?3, ?4)",
        rusqlite::params![session_id, role, content, now],
    ).map_err(|e| e.to_string())?;

    Ok(())
}

/// End an agent session.
#[command]
pub async fn sessions_end(
    db: State<'_, Database>,
    session_id: String,
) -> Result<(), String> {
    let now = chrono::Utc::now().format("%Y-%m-%d %H:%M:%S").to_string();

    db.execute(
        "UPDATE agent_sessions SET endedAt = ?1, status = 'ended' WHERE id = ?2",
        rusqlite::params![now, session_id],
    ).map_err(|e| e.to_string())?;

    Ok(())
}

/// List recent agent sessions.
#[command]
pub async fn sessions_list(
    db: State<'_, Database>,
    limit: Option<usize>,
) -> Result<Vec<JsonValue>, String> {
    let lim = limit.unwrap_or(50);
    db.query_json(
        "SELECT * FROM agent_sessions ORDER BY startedAt DESC LIMIT ?1",
        rusqlite::params![lim as i64],
    ).map_err(|e| e.to_string())
        .and_then(|v| v.as_array().cloned().ok_or("unexpected".into()))
}

/// Get messages for an agent session.
#[command]
pub async fn sessions_messages(
    db: State<'_, Database>,
    session_id: String,
) -> Result<Vec<JsonValue>, String> {
    db.query_json(
        "SELECT * FROM agent_messages WHERE sessionId = ?1 ORDER BY id ASC",
        rusqlite::params![session_id],
    ).map_err(|e| e.to_string())
        .and_then(|v| v.as_array().cloned().ok_or("unexpected".into()))
}

// ── Browser Visits ──

/// Record a browser visit.
#[command]
pub async fn browser_record_visit(
    db: State<'_, Database>,
    tab_id: String,
    url: String,
    title: Option<String>,
    dom_analysis: Option<String>,
    project_id: Option<String>,
) -> Result<(), String> {
    let id = uuid::Uuid::new_v4().to_string();
    let now = chrono::Utc::now().format("%Y-%m-%d %H:%M:%S").to_string();

    db.execute(
        "INSERT INTO browser_visits (id, tabId, url, title, visitedAt, domAnalysis, projectId) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
        rusqlite::params![id, tab_id, url, title, now, dom_analysis, project_id],
    ).map_err(|e| e.to_string())?;

    Ok(())
}

/// List recent browser visits, optionally filtered by tab.
#[command]
pub async fn browser_list_visits(
    db: State<'_, Database>,
    tab_id: Option<String>,
    limit: Option<usize>,
) -> Result<Vec<JsonValue>, String> {
    let lim = limit.unwrap_or(100);
    match tab_id {
        Some(tid) => db.query_json(
            "SELECT * FROM browser_visits WHERE tabId = ?1 ORDER BY visitedAt DESC LIMIT ?2",
            rusqlite::params![tid, lim as i64],
        ),
        None => db.query_json(
            "SELECT * FROM browser_visits ORDER BY visitedAt DESC LIMIT ?1",
            rusqlite::params![lim as i64],
        ),
    }.map_err(|e| e.to_string())
        .and_then(|v| v.as_array().cloned().ok_or("unexpected".into()))
}

/// Find all visits to a specific URL.
#[command]
pub async fn browser_find_visits_by_url(
    db: State<'_, Database>,
    url: String,
) -> Result<Vec<JsonValue>, String> {
    db.query_json(
        "SELECT * FROM browser_visits WHERE url = ?1 ORDER BY visitedAt DESC",
        rusqlite::params![url],
    ).map_err(|e| e.to_string())
        .and_then(|v| v.as_array().cloned().ok_or("unexpected".into()))
}
