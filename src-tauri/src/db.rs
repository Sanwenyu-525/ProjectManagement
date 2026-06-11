use std::sync::Mutex;
use rusqlite::Connection;
use std::path::Path;
use thiserror::Error;

/// Generate a new UUID string.
pub fn new_id() -> String {
    uuid::Uuid::new_v4().to_string()
}

/// Current UTC time as "YYYY-MM-DD HH:MM:SS".
pub fn now_str() -> String {
    chrono::Utc::now().format("%Y-%m-%d %H:%M:%S").to_string()
}

#[derive(Debug, Error)]
pub enum DbError {
    #[error("Database error: {0}")]
    Sqlite(#[from] rusqlite::Error),
    #[error("Serialization error: {0}")]
    Serde(#[from] serde_json::Error),
    #[error("Lock error: {0}")]
    Lock(String),
}

impl serde::Serialize for DbError {
    fn serialize<S: serde::Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        serializer.serialize_str(&self.to_string())
    }
}

pub const DEFAULT_USER_ID: &str = "default-user";

/// Thread-safe SQLite database wrapper.
/// Uses std::sync::Mutex whose guards implement Send, making Database Send + Sync.
pub struct Database {
    conn: Mutex<Connection>,
}

// Safety: rusqlite::Connection is Send. std::sync::Mutex<Connection> is Send + Sync.
unsafe impl Send for Database {}
unsafe impl Sync for Database {}

impl Database {
    pub fn new(path: &Path) -> Result<Self, DbError> {
        let conn = Connection::open(path)?;
        conn.execute_batch("PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;")?;
        let db = Self {
            conn: Mutex::new(conn),
        };
        db.run_migrations()?;
        Ok(db)
    }

    fn lock_conn(&self) -> Result<std::sync::MutexGuard<'_, Connection>, DbError> {
        self.conn.lock().map_err(|e| DbError::Lock(e.to_string()))
    }

    fn run_migrations(&self) -> Result<(), DbError> {
        let sql = include_str!("../migrations/001_init.sql");
        let conn = self.lock_conn()?;
        conn.execute_batch(sql)?;

        // Incremental migrations for existing databases
        let alters = [
            "ALTER TABLE projects ADD COLUMN frontendCommand TEXT",
            "ALTER TABLE projects ADD COLUMN backendCommand TEXT",
        ];
        for stmt in &alters {
            let _ = conn.execute_batch(stmt); // ignore "duplicate column" errors
        }

        Ok(())
    }

    /// Execute a query that returns rows (SELECT). Returns rows as JSON array.
    pub fn query_json(&self, sql: &str, params: &[&dyn rusqlite::types::ToSql]) -> Result<serde_json::Value, DbError> {
        let conn = self.lock_conn()?;
        let mut stmt = conn.prepare(sql)?;
        let column_count = stmt.column_count();
        let column_names: Vec<String> = (0..column_count)
            .map(|i| stmt.column_name(i).unwrap_or("").to_string())
            .collect();

        let rows = stmt.query_map(params, |row| {
            let mut map = serde_json::Map::new();
            for i in 0..column_count {
                let value: rusqlite::types::Value = row.get(i)?;
                let json_value = rusqlite_value_to_json(value);
                map.insert(column_names[i].clone(), json_value);
            }
            Ok(serde_json::Value::Object(map))
        })?;

        let mut result = Vec::new();
        for row in rows {
            result.push(row?);
        }
        Ok(serde_json::Value::Array(result))
    }

    /// Execute a query that returns a single row.
    pub fn query_one_json(&self, sql: &str, params: &[&dyn rusqlite::types::ToSql]) -> Result<Option<serde_json::Value>, DbError> {
        let conn = self.lock_conn()?;
        let mut stmt = conn.prepare(sql)?;
        let column_count = stmt.column_count();
        let column_names: Vec<String> = (0..column_count)
            .map(|i| stmt.column_name(i).unwrap_or("").to_string())
            .collect();

        let mut rows = stmt.query_map(params, |row| {
            let mut map = serde_json::Map::new();
            for i in 0..column_count {
                let value: rusqlite::types::Value = row.get(i)?;
                let json_value = rusqlite_value_to_json(value);
                map.insert(column_names[i].clone(), json_value);
            }
            Ok(serde_json::Value::Object(map))
        })?;

        match rows.next() {
            Some(row) => Ok(Some(row?)),
            None => Ok(None),
        }
    }

    /// Execute a statement that doesn't return rows (INSERT/UPDATE/DELETE).
    /// Returns the last inserted row id.
    pub fn execute(&self, sql: &str, params: &[&dyn rusqlite::types::ToSql]) -> Result<i64, DbError> {
        let conn = self.lock_conn()?;
        conn.execute(sql, params)?;
        Ok(conn.last_insert_rowid())
    }

    /// Execute a statement that changes rows, returning changes count.
    pub fn execute_returning_changes(&self, sql: &str, params: &[&dyn rusqlite::types::ToSql]) -> Result<usize, DbError> {
        let conn = self.lock_conn()?;
        let changes = conn.execute(sql, params)?;
        Ok(changes)
    }

    /// Log an activity entry.
    pub fn log_activity(
        &self,
        action: &str,
        entity_type: &str,
        entity_id: &str,
        details: Option<&serde_json::Value>,
        project_id: &str,
    ) -> Result<(), DbError> {
        let id = new_id();
        let details_str = details
            .map(|d| serde_json::to_string(d).unwrap_or_default())
            .unwrap_or_default();
        let now = now_str();

        self.execute(
            "INSERT INTO activity_logs (id, action, entityType, entityId, details, projectId, createdAt) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            rusqlite::params![id, action, entity_type, entity_id, details_str, project_id, now],
        )?;
        Ok(())
    }

    /// Insert a row and return it as JSON. Caller provides the full INSERT SQL and params.
    /// `fetch_sql` should be a SELECT * WHERE id = ?1 query; `fetch_id` is the new row's id.
    pub fn insert_and_fetch(&self, insert_sql: &str, insert_params: &[&dyn rusqlite::types::ToSql], fetch_sql: &str, fetch_id: &str) -> Result<serde_json::Value, DbError> {
        self.execute(insert_sql, insert_params)?;
        self.query_one_json(fetch_sql, &[&fetch_id])?
            .ok_or_else(|| DbError::Lock("Insert succeeded but row not found".into()))
    }

    /// Delete a row by id. Returns Ok(()) regardless of whether the row existed.
    pub fn delete_by_id(&self, table: &str, id: &str) -> Result<(), DbError> {
        let sql = format!("DELETE FROM \"{}\" WHERE id = ?1", table);
        self.execute_returning_changes(&sql, &[&id])?;
        Ok(())
    }
}

fn rusqlite_value_to_json(value: rusqlite::types::Value) -> serde_json::Value {
    match value {
        rusqlite::types::Value::Null => serde_json::Value::Null,
        rusqlite::types::Value::Integer(i) => serde_json::Value::Number(i.into()),
        rusqlite::types::Value::Real(f) => {
            serde_json::Number::from_f64(f)
                .map(serde_json::Value::Number)
                .unwrap_or(serde_json::Value::Null)
        }
        rusqlite::types::Value::Text(s) => serde_json::Value::String(s),
        rusqlite::types::Value::Blob(b) => {
            serde_json::Value::Array(b.into_iter().map(|x| serde_json::Value::Number(x.into())).collect())
        }
    }
}
