use serde::Deserialize;
use serde_json::Value as JsonValue;
use tauri::{command, State};

use crate::db::Database;

const VALID_TRANSPORTS: &[&str] = &["stdio", "sse", "streamable-http"];

fn validate_transport(t: &str) -> Result<(), String> {
    if VALID_TRANSPORTS.contains(&t) {
        Ok(())
    } else {
        Err(format!(
            "invalid transport '{}': must be one of {:?}",
            t, VALID_TRANSPORTS
        ))
    }
}

#[command]
pub async fn mcp_servers_list(db: State<'_, Database>) -> Result<JsonValue, String> {
    db.query_json(
        "SELECT * FROM mcp_servers ORDER BY createdAt ASC",
        rusqlite::params![],
    )
    .map_err(|e| e.to_string())
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateMcpServerInput {
    pub name: String,
    pub transport: String,
    pub command: Option<String>,
    pub args: Option<String>,
    pub url: Option<String>,
    pub env: Option<String>,
    pub auto_connect: Option<bool>,
    pub enabled: Option<bool>,
}

#[command]
pub async fn mcp_servers_create(
    db: State<'_, Database>,
    data: CreateMcpServerInput,
) -> Result<JsonValue, String> {
    validate_transport(&data.transport)?;

    let id = crate::db::new_id();
    let now = crate::db::now_str();

    db.execute(
        "INSERT INTO mcp_servers (id, name, transport, command, args, url, env, autoConnect, enabled, createdAt, updatedAt) \
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?10)",
        rusqlite::params![
            id,
            data.name,
            data.transport,
            data.command,
            data.args,
            data.url,
            data.env,
            data.auto_connect.unwrap_or(false) as i32,
            data.enabled.unwrap_or(true) as i32,
            now,
        ],
    )
    .map_err(|e| e.to_string())?;

    db.query_one_json(
        "SELECT * FROM mcp_servers WHERE id = ?1",
        rusqlite::params![id],
    )
    .map_err(|e| e.to_string())?
    .ok_or_else(|| "Failed to create MCP server".into())
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateMcpServerInput {
    pub name: Option<String>,
    pub transport: Option<String>,
    pub command: Option<String>,
    pub args: Option<Option<String>>,
    pub url: Option<Option<String>>,
    pub env: Option<Option<String>>,
    pub auto_connect: Option<bool>,
    pub enabled: Option<bool>,
}

#[command]
pub async fn mcp_servers_update(
    db: State<'_, Database>,
    id: String,
    data: UpdateMcpServerInput,
) -> Result<JsonValue, String> {
    {
        if let Some(ref t) = data.transport {
            validate_transport(t)?;
        }

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
        add_field!(transport, "transport");
        add_field!(command, "command");

        if let Some(args) = data.args {
            sets.push(format!("args = ?{}", idx));
            param_values.push(Box::new(args));
            idx += 1;
        }

        if let Some(env) = data.env {
            sets.push(format!("env = ?{}", idx));
            param_values.push(Box::new(env));
            idx += 1;
        }

        if let Some(url) = data.url {
            sets.push(format!("url = ?{}", idx));
            param_values.push(Box::new(url));
            idx += 1;
        }

        if let Some(auto_connect) = data.auto_connect {
            sets.push(format!("autoConnect = ?{}", idx));
            param_values.push(Box::new(auto_connect as i32));
            idx += 1;
        }

        if let Some(enabled) = data.enabled {
            sets.push(format!("enabled = ?{}", idx));
            param_values.push(Box::new(enabled as i32));
            idx += 1;
        }

        if !sets.is_empty() {
            sets.push(format!("updatedAt = ?{}", idx));
            param_values.push(Box::new(crate::db::now_str()));
            idx += 1;

            let sql = format!(
                "UPDATE mcp_servers SET {} WHERE id = ?{}",
                sets.join(", "),
                idx
            );
            param_values.push(Box::new(id.clone()));
            let refs: Vec<&dyn rusqlite::types::ToSql> =
                param_values.iter().map(|p| p.as_ref()).collect();
            db.execute_returning_changes(&sql, &refs)
                .map_err(|e| e.to_string())?;
        }
    }

    db.query_one_json(
        "SELECT * FROM mcp_servers WHERE id = ?1",
        rusqlite::params![id],
    )
    .map_err(|e| e.to_string())?
    .ok_or_else(|| "MCP_SERVER_NOT_FOUND".into())
}

#[command]
pub async fn mcp_servers_delete(db: State<'_, Database>, id: String) -> Result<(), String> {
    db.execute(
        "DELETE FROM mcp_servers WHERE id = ?1",
        rusqlite::params![id],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}
