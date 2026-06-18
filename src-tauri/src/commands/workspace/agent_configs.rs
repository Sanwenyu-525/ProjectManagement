use serde::Deserialize;
use serde_json::Value as JsonValue;
use tauri::{command, State};

use crate::db::Database;

const VALID_PROVIDER_TYPES: &[&str] = &["claude", "openai", "gemini", "openai-compatible"];

fn validate_provider_type(t: &str) -> Result<(), String> {
    if VALID_PROVIDER_TYPES.contains(&t) {
        Ok(())
    } else {
        Err(format!(
            "invalid provider type '{}': must be one of {:?}",
            t, VALID_PROVIDER_TYPES
        ))
    }
}

// ── Model Providers ──────────────────────────────────────────────

#[command]
pub async fn providers_list(db: State<'_, Database>) -> Result<JsonValue, String> {
    db.query_json(
        "SELECT * FROM model_providers ORDER BY createdAt ASC",
        rusqlite::params![],
    )
    .map_err(|e| e.to_string())
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateProviderInput {
    pub name: String,
    #[serde(rename = "type")]
    pub provider_type: String,
    pub api_key: String,
    pub base_url: Option<String>,
}

#[command]
pub async fn providers_create(
    db: State<'_, Database>,
    data: CreateProviderInput,
) -> Result<JsonValue, String> {
    validate_provider_type(&data.provider_type)?;

    let id = crate::db::new_id();
    let now = crate::db::now_str();

    db.execute(
        "INSERT INTO model_providers (id, name, type, apiKey, baseUrl, createdAt, updatedAt) \
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?6)",
        rusqlite::params![id, data.name, data.provider_type, data.api_key, data.base_url, now],
    )
    .map_err(|e| e.to_string())?;

    db.query_one_json(
        "SELECT * FROM model_providers WHERE id = ?1",
        rusqlite::params![id],
    )
    .map_err(|e| e.to_string())?
    .ok_or_else(|| "Failed to create provider".into())
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateProviderInput {
    pub name: Option<String>,
    pub api_key: Option<String>,
    pub base_url: Option<Option<String>>,
}

#[command]
pub async fn providers_update(
    db: State<'_, Database>,
    id: String,
    data: UpdateProviderInput,
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
        add_field!(api_key, "apiKey");

        if let Some(base_url) = data.base_url {
            sets.push(format!("baseUrl = ?{}", idx));
            param_values.push(Box::new(base_url));
            idx += 1;
        }

        if !sets.is_empty() {
            sets.push(format!("updatedAt = ?{}", idx));
            param_values.push(Box::new(crate::db::now_str()));
            idx += 1;

            let sql = format!(
                "UPDATE model_providers SET {} WHERE id = ?{}",
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
        "SELECT * FROM model_providers WHERE id = ?1",
        rusqlite::params![id],
    )
    .map_err(|e| e.to_string())?
    .ok_or_else(|| "PROVIDER_NOT_FOUND".into())
}

#[command]
pub async fn providers_delete(db: State<'_, Database>, id: String) -> Result<(), String> {
    db.execute(
        "DELETE FROM model_providers WHERE id = ?1",
        rusqlite::params![id],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

// ── Agent Configs ────────────────────────────────────────────────

#[command]
pub async fn agent_configs_list(db: State<'_, Database>) -> Result<JsonValue, String> {
    db.query_json(
        "SELECT * FROM agent_configs ORDER BY createdAt ASC",
        rusqlite::params![],
    )
    .map_err(|e| e.to_string())
}

#[command]
pub async fn agent_configs_list_by_provider(
    db: State<'_, Database>,
    provider_id: String,
) -> Result<JsonValue, String> {
    db.query_json(
        "SELECT * FROM agent_configs WHERE providerId = ?1 ORDER BY createdAt ASC",
        rusqlite::params![provider_id],
    )
    .map_err(|e| e.to_string())
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateAgentConfigInput {
    pub name: String,
    pub icon: Option<String>,
    pub provider_id: String,
    pub model: String,
    pub system_prompt: Option<String>,
    pub temperature: Option<f64>,
    pub max_tokens: Option<i64>,
}

#[command]
pub async fn agent_configs_create(
    db: State<'_, Database>,
    data: CreateAgentConfigInput,
) -> Result<JsonValue, String> {
    let id = crate::db::new_id();
    let now = crate::db::now_str();

    db.execute(
        "INSERT INTO agent_configs (id, name, icon, providerId, model, systemPrompt, temperature, maxTokens, createdAt, updatedAt) \
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?9)",
        rusqlite::params![
            id,
            data.name,
            data.icon.as_deref().unwrap_or("smart_toy"),
            data.provider_id,
            data.model,
            data.system_prompt.as_deref().unwrap_or(""),
            data.temperature.unwrap_or(0.7),
            data.max_tokens.unwrap_or(4096),
            now,
        ],
    )
    .map_err(|e| e.to_string())?;

    db.query_one_json(
        "SELECT * FROM agent_configs WHERE id = ?1",
        rusqlite::params![id],
    )
    .map_err(|e| e.to_string())?
    .ok_or_else(|| "Failed to create agent config".into())
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateAgentConfigInput {
    pub name: Option<String>,
    pub icon: Option<String>,
    pub model: Option<String>,
    pub system_prompt: Option<String>,
    pub temperature: Option<f64>,
    pub max_tokens: Option<i64>,
}

#[command]
pub async fn agent_configs_update(
    db: State<'_, Database>,
    id: String,
    data: UpdateAgentConfigInput,
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
        add_field!(icon, "icon");
        add_field!(model, "model");
        add_field!(system_prompt, "systemPrompt");
        add_field!(temperature, "temperature");
        add_field!(max_tokens, "maxTokens");

        if !sets.is_empty() {
            sets.push(format!("updatedAt = ?{}", idx));
            param_values.push(Box::new(crate::db::now_str()));
            idx += 1;

            let sql = format!(
                "UPDATE agent_configs SET {} WHERE id = ?{}",
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
        "SELECT * FROM agent_configs WHERE id = ?1",
        rusqlite::params![id],
    )
    .map_err(|e| e.to_string())?
    .ok_or_else(|| "AGENT_CONFIG_NOT_FOUND".into())
}

#[command]
pub async fn agent_configs_delete(db: State<'_, Database>, id: String) -> Result<(), String> {
    db.execute(
        "DELETE FROM agent_configs WHERE id = ?1",
        rusqlite::params![id],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}
