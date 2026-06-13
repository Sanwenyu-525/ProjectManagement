use std::path::Path;
use thiserror::Error;
use r2d2::Pool;
use std::sync::Mutex;
use rusqlite::Connection;

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

// Single-user, no auth needed. Removed DEFAULT_USER_ID.

struct ConnectionManager {
    db_path: std::path::PathBuf,
}

impl r2d2::ManageConnection for ConnectionManager {
    type Error = rusqlite::Error;
    type Connection = Connection;

    fn connect(&self) -> Result<Connection, Self::Error> {
        let conn = Connection::open(&self.db_path)?;
        conn.execute_batch("PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout = 5000;")?;
        Ok(conn)
    }

    fn is_valid(&self, conn: &mut Connection) -> Result<(), Self::Error> {
        conn.execute_batch("SELECT 1").map(|_| ())
    }

    fn has_broken(&self, _conn: &mut Connection) -> bool {
        false
    }
}

/// Execute a migration SQL file as a single batch (handles multi-line statements).
fn run_migration_sql(conn: &Connection, sql: &str) {
    let _ = conn.execute_batch(sql);
}

/// Thread-safe SQLite database wrapper with connection pool.
pub struct Database {
    pool: Pool<ConnectionManager>,
}

unsafe impl Send for Database {}
unsafe impl Sync for Database {}

impl Database {
    pub fn new(path: &Path) -> Result<Self, DbError> {
        let manager = ConnectionManager {
            db_path: path.to_path_buf(),
        };
        let pool = Pool::builder()
            .max_size(10)
            .build(manager)
            .map_err(|e| DbError::Lock(e.to_string()))?;

        let db = Self { pool };
        db.run_migrations()?;
        Ok(db)
    }

    fn get_conn(&self) -> Result<r2d2::PooledConnection<ConnectionManager>, DbError> {
        self.pool.get().map_err(|e| DbError::Lock(e.to_string()))
    }

    fn run_migrations(&self) -> Result<(), DbError> {
        let conn = self.get_conn()?;
        let sql = include_str!("../migrations/001_init.sql");
        conn.execute_batch(sql)?;

        // Incremental migrations for existing databases
        let alters = [
            "ALTER TABLE projects ADD COLUMN frontendCommand TEXT",
            "ALTER TABLE projects ADD COLUMN backendCommand TEXT",
            "ALTER TABLE projects ADD COLUMN frontendCwd TEXT",
            "ALTER TABLE projects ADD COLUMN backendCwd TEXT",
        ];
        for stmt in &alters {
            let _ = conn.execute_batch(stmt);
        }

        // Health check table
        conn.execute_batch(
            "CREATE TABLE IF NOT EXISTS \"project_health_checks\" (
                \"id\" TEXT NOT NULL PRIMARY KEY,
                \"projectId\" TEXT NOT NULL,
                \"checkDate\" TEXT NOT NULL,
                \"dirtyFileCount\" INTEGER NOT NULL DEFAULT 0,
                \"currentBranch\" TEXT,
                \"aheadCount\" INTEGER NOT NULL DEFAULT 0,
                \"behindCount\" INTEGER NOT NULL DEFAULT 0,
                \"outdatedDeps\" TEXT NOT NULL DEFAULT '[]',
                \"outdatedDepCount\" INTEGER NOT NULL DEFAULT 0,
                \"hasChanges\" INTEGER NOT NULL DEFAULT 0,
                \"createdAt\" TEXT NOT NULL,
                CONSTRAINT \"project_health_checks_projectId_fkey\"
                    FOREIGN KEY (\"projectId\") REFERENCES \"projects\" (\"id\") ON DELETE CASCADE
            );
            CREATE INDEX IF NOT EXISTS \"project_health_checks_projectId_idx\"
                ON \"project_health_checks\"(\"projectId\");
            CREATE INDEX IF NOT EXISTS \"project_health_checks_checkDate_idx\"
                ON \"project_health_checks\"(\"checkDate\");"
        )?;

        // Safety check: if migration 002 partially ran and left projects table missing,
        // recover by renaming projects_new back to projects.
        let projects_exists: bool = conn
            .prepare("SELECT count(*) FROM sqlite_master WHERE type='table' AND name='projects'")
            .and_then(|mut s| s.query_row([], |r| r.get::<_, i64>(0)))
            .unwrap_or(0) > 0;
        let projects_new_exists: bool = conn
            .prepare("SELECT count(*) FROM sqlite_master WHERE type='table' AND name='projects_new'")
            .and_then(|mut s| s.query_row([], |r| r.get::<_, i64>(0)))
            .unwrap_or(0) > 0;

        if !projects_exists && projects_new_exists {
            let _ = conn.execute_batch("ALTER TABLE \"projects_new\" RENAME TO \"projects\"");
        } else if !projects_exists && !projects_new_exists {
            // Both missing — recreate from init schema (data is lost)
            conn.execute_batch(sql)?;
        }

        // Remove users table and simplify schema
        run_migration_sql(&conn, include_str!("../migrations/002_remove_users.sql"));

        // Safety check again after 002: if projects is still missing but projects_new exists
        let projects_exists: bool = conn
            .prepare("SELECT count(*) FROM sqlite_master WHERE type='table' AND name='projects'")
            .and_then(|mut s| s.query_row([], |r| r.get::<_, i64>(0)))
            .unwrap_or(0) > 0;
        let projects_new_exists: bool = conn
            .prepare("SELECT count(*) FROM sqlite_master WHERE type='table' AND name='projects_new'")
            .and_then(|mut s| s.query_row([], |r| r.get::<_, i64>(0)))
            .unwrap_or(0) > 0;

        if !projects_exists && projects_new_exists {
            let _ = conn.execute_batch("ALTER TABLE \"projects_new\" RENAME TO \"projects\"");
        }

        // Add runtime status fields
        run_migration_sql(&conn, include_str!("../migrations/003_runtime_status.sql"));

        // Add health score fields
        run_migration_sql(&conn, include_str!("../migrations/004_health_score.sql"));

        // Workspaces
        run_migration_sql(&conn, include_str!("../migrations/005_workspaces.sql"));

        // Workspace layout persistence
        run_migration_sql(&conn, include_str!("../migrations/006_workspace_layout.sql"));

        Ok(())
    }

    pub fn query_json(&self, sql: &str, params: &[&dyn rusqlite::types::ToSql]) -> Result<serde_json::Value, DbError> {
        let conn = self.get_conn()?;
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

    pub fn query_one_json(&self, sql: &str, params: &[&dyn rusqlite::types::ToSql]) -> Result<Option<serde_json::Value>, DbError> {
        let conn = self.get_conn()?;
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

    pub fn execute(&self, sql: &str, params: &[&dyn rusqlite::types::ToSql]) -> Result<i64, DbError> {
        let conn = self.get_conn()?;
        conn.execute(sql, params)?;
        Ok(conn.last_insert_rowid())
    }

    pub fn execute_returning_changes(&self, sql: &str, params: &[&dyn rusqlite::types::ToSql]) -> Result<usize, DbError> {
        let conn = self.get_conn()?;
        let changes = conn.execute(sql, params)?;
        Ok(changes)
    }

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

    #[allow(dead_code)]
    pub fn insert_and_fetch(&self, insert_sql: &str, insert_params: &[&dyn rusqlite::types::ToSql], fetch_sql: &str, fetch_id: &str) -> Result<serde_json::Value, DbError> {
        self.execute(insert_sql, insert_params)?;
        self.query_one_json(fetch_sql, &[&fetch_id])?
            .ok_or_else(|| DbError::Lock("Insert succeeded but row not found".into()))
    }

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
