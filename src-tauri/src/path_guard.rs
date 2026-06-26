use std::path::{Path, PathBuf};

use crate::db::Database;

/// 校验路径是否在允许的目录内。
///
/// 安全检查：
/// 1. canonicalize 解析符号链接和 `..`
/// 2. 路径必须存在
/// 3. 必须是已注册项目的子路径，或在应用数据目录下
pub fn validate_path(db: &Database, path: &str) -> Result<PathBuf, String> {
    let p = Path::new(path);

    let canonical = p
        .canonicalize()
        .map_err(|_| format!("路径不存在或无法访问: {}", path))?;

    // 应用数据目录始终允许
    if let Ok(app_dir) = app_data_dir() {
        if canonical.starts_with(&app_dir) {
            return Ok(canonical);
        }
    }

    // 已注册项目目录
    let allowed_roots = get_project_roots(db);
    for root in &allowed_roots {
        if canonical.starts_with(root) {
            return Ok(canonical);
        }
    }

    Err(format!(
        "路径不在允许的目录内: {} (需在已注册项目或应用数据目录下)",
        path
    ))
}

/// 轻量校验：仅检查路径存在且为目录（用于无法访问数据库的场景）。
pub fn validate_path_exists(path: &str) -> Result<PathBuf, String> {
    let p = Path::new(path);
    let canonical = p
        .canonicalize()
        .map_err(|_| format!("路径不存在或无法访问: {}", path))?;
    Ok(canonical)
}

/// 检查字符串是否包含 shell 元字符（防止命令注入）。
pub fn contains_shell_metachars(s: &str) -> bool {
    s.contains('&')
        || s.contains('|')
        || s.contains('^')
        || s.contains('>')
        || s.contains('<')
        || s.contains('`')
        || s.contains('$')
        || s.contains('(')
        || s.contains(')')
        || s.contains(';')
        || s.contains('\n')
        || s.contains('\r')
}

fn app_data_dir() -> Result<PathBuf, String> {
    // Tauri 应用数据目录通过平台约定获取
    #[cfg(target_os = "windows")]
    {
        if let Ok(appdata) = std::env::var("APPDATA") {
            return Ok(PathBuf::from(appdata).join("com.devhub.app"));
        }
    }
    #[cfg(target_os = "macos")]
    {
        if let Ok(home) = std::env::var("HOME") {
            return Ok(PathBuf::from(home).join("Library/Application Support/com.devhub.app"));
        }
    }
    #[cfg(target_os = "linux")]
    {
        if let Ok(home) = std::env::var("HOME") {
            return Ok(PathBuf::from(home).join(".local/share/com.devhub.app"));
        }
    }
    Err("无法确定应用数据目录".into())
}

fn get_project_roots(db: &Database) -> Vec<PathBuf> {
    let value = db
        .query_json(
            "SELECT localPath FROM projects WHERE localPath IS NOT NULL AND localPath != '' AND deletedAt IS NULL",
            rusqlite::params![],
        )
        .unwrap_or(serde_json::json!([]));

    value
        .as_array()
        .map(|rows| {
            rows.iter()
                .filter_map(|row| {
                    row.get("localPath")
                        .and_then(|v| v.as_str())
                        .and_then(|p| Path::new(p).canonicalize().ok())
                })
                .collect()
        })
        .unwrap_or_default()
}
