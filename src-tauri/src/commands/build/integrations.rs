use serde::Deserialize;
use serde_json::Value as JsonValue;
use tauri::{command, State};

use crate::db::{Database, new_id, now_str};

#[command]
pub async fn integrations_list(db: State<'_, Database>) -> Result<JsonValue, String> {
    db.query_json("SELECT * FROM integrations ORDER BY platform ASC", rusqlite::params![])
        .map_err(|e| e.to_string())
}

#[command]
pub async fn integrations_get_by_id(db: State<'_, Database>, id: String) -> Result<JsonValue, String> {
    db.query_one_json("SELECT * FROM integrations WHERE id = ?1", rusqlite::params![id])
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "INTEGRATION_NOT_FOUND".into())
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateIntegrationInput {
    pub platform: String,
    pub access_token: Option<String>,
    pub username: Option<String>,
    pub settings: Option<String>,
}

#[command]
pub async fn integrations_create(db: State<'_, Database>, data: CreateIntegrationInput) -> Result<JsonValue, String> {
    let id = new_id();
    let now = now_str();

    db.execute(
        "INSERT INTO integrations (id, platform, accessToken, username, settings, connectedAt, createdAt, updatedAt) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?7)",
        rusqlite::params![
            id,
            data.platform,
            data.access_token,
            data.username,
            data.settings.unwrap_or_else(|| "{}".into()),
            now,
            now,
        ],
    ).map_err(|e| e.to_string())?;

    db.query_one_json("SELECT * FROM integrations WHERE id = ?1", rusqlite::params![id])
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "Failed to create integration".into())
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateIntegrationInput {
    pub access_token: Option<String>,
    pub username: Option<String>,
    pub settings: Option<String>,
}

#[command]
pub async fn integrations_update(db: State<'_, Database>, id: String, data: UpdateIntegrationInput) -> Result<JsonValue, String> {
    {
        let mut sets = Vec::new();
        let mut param_values: Vec<Box<dyn rusqlite::types::ToSql>> = Vec::new();
        let mut idx = 1u32;

        macro_rules! add_field {
            ($col:expr, $value:expr) => {
                if let Some(v) = $value {
                    sets.push(format!("{} = ?{}", $col, idx));
                    param_values.push(Box::new(v));
                    idx += 1;
                }
            };
        }

        add_field!("accessToken", data.access_token);
        add_field!("username", data.username);
        add_field!("settings", data.settings);

        if !sets.is_empty() {
            let now = now_str();
            sets.push(format!("updatedAt = ?{}", idx));
            param_values.push(Box::new(now.clone()));
            idx += 1;
            sets.push(format!("connectedAt = ?{}", idx));
            param_values.push(Box::new(now));
            idx += 1;

            let sql = format!("UPDATE integrations SET {} WHERE id = ?{}", sets.join(", "), idx);
            param_values.push(Box::new(id.clone()));
            let refs: Vec<&dyn rusqlite::types::ToSql> = param_values.iter().map(|p| p.as_ref()).collect();
            db.execute_returning_changes(&sql, &refs).map_err(|e| e.to_string())?;
        }
    }

    integrations_get_by_id(db, id).await
}

#[command]
pub async fn integrations_delete(db: State<'_, Database>, id: String) -> Result<(), String> {
    db.execute("DELETE FROM integrations WHERE id = ?1", rusqlite::params![id])
        .map_err(|e| e.to_string())?;
    Ok(())
}
