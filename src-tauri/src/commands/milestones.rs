use serde::Deserialize;
use serde_json::Value as JsonValue;
use tauri::{command, State};

use crate::db::Database;

#[command]
pub async fn milestones_list(db: State<'_, Database>, project_id: String) -> Result<JsonValue, String> {
    db.query_json(
        "SELECT m.*,
            (SELECT COUNT(*) FROM tasks WHERE milestoneId = m.id) as taskCount
         FROM milestones m WHERE m.projectId = ?1 ORDER BY m.dueDate ASC",
        rusqlite::params![project_id],
    )
    .map_err(|e| e.to_string())
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateMilestoneInput {
    pub name: String,
    pub description: Option<String>,
    pub due_date: Option<String>,
    pub status: Option<String>,
}

#[command]
pub async fn milestones_create(
    db: State<'_, Database>,
    project_id: String,
    data: CreateMilestoneInput,
) -> Result<JsonValue, String> {
    let id = crate::db::new_id();

    db.execute(
        "INSERT INTO milestones (id, name, description, dueDate, status, projectId) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        rusqlite::params![
            id,
            data.name,
            data.description,
            data.due_date,
            data.status.unwrap_or_else(|| "Pending".into()),
            project_id,
        ],
    )
    .map_err(|e| e.to_string())?;

    db.query_one_json("SELECT * FROM milestones WHERE id = ?1", rusqlite::params![id])
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "Failed to create milestone".into())
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateMilestoneInput {
    pub name: Option<String>,
    pub description: Option<String>,
    pub due_date: Option<String>,
    pub status: Option<String>,
}

#[command]
pub async fn milestones_update(
    db: State<'_, Database>,
    id: String,
    data: UpdateMilestoneInput,
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
        add_field!(due_date, "dueDate");
        add_field!(status, "status");

        if !sets.is_empty() {
            let sql = format!("UPDATE milestones SET {} WHERE id = ?{}", sets.join(", "), idx);
            param_values.push(Box::new(id.clone()));
            let refs: Vec<&dyn rusqlite::types::ToSql> = param_values.iter().map(|p| p.as_ref()).collect();
            db.execute_returning_changes(&sql, &refs).map_err(|e| e.to_string())?;
        }
    }

    db.query_one_json("SELECT * FROM milestones WHERE id = ?1", rusqlite::params![id])
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "MILESTONE_NOT_FOUND".into())
}

#[command]
pub async fn milestones_delete(db: State<'_, Database>, id: String) -> Result<(), String> {
    db.delete_by_id("milestones", &id).map_err(|e| e.to_string())
}
