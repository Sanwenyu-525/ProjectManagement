use serde::Serialize;
use std::fs;
use std::io::Read;
use std::path::Path;
use tauri::command;

// ── Types ──

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FileEntry {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
    pub size: u64,
    pub modified: String,
    pub extension: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FileTreeNode {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
    pub children: Option<Vec<FileTreeNode>>,
    pub size: Option<u64>,
    pub extension: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FileContent {
    pub path: String,
    pub content: String,
    pub language: String,
    pub size: u64,
    pub line_count: usize,
    pub is_binary: bool,
    pub is_writable: bool,
    pub modified: String,
}

// ── Constants ──

const MAX_FILE_SIZE: u64 = 1_048_576; // 1 MB
const BINARY_CHECK_SIZE: usize = 8192; // 8 KB

const SKIP_DIRS: &[&str] = &[
    ".git",
    "node_modules",
    "target",
    ".next",
    "dist",
    ".venv",
    "venv",
    "__pycache__",
    ".idea",
    ".vs",
    "build",
    "out",
    ".cache",
    ".turbo",
];

// ── Commands ──

#[command]
pub async fn files_list_directory(path: String) -> Result<Vec<FileEntry>, String> {
    let dir = Path::new(&path);
    if !dir.is_dir() {
        return Err("Path is not a directory".into());
    }

    let entries = fs::read_dir(dir).map_err(|e| e.to_string())?;

    let mut result: Vec<FileEntry> = Vec::new();
    for entry in entries.flatten() {
        let path = entry.path();
        let metadata = match entry.metadata() {
            Ok(m) => m,
            Err(_) => continue,
        };

        let name = entry.file_name().to_string_lossy().to_string();
        let is_dir = metadata.is_dir();
        let extension = if is_dir {
            None
        } else {
            path.extension().map(|e| e.to_string_lossy().to_string())
        };

        let modified = metadata
            .modified()
            .ok()
            .and_then(|t| {
                let datetime: chrono::DateTime<chrono::Local> = t.into();
                Some(datetime.to_rfc3339())
            })
            .unwrap_or_default();

        result.push(FileEntry {
            name,
            path: path.to_string_lossy().to_string(),
            is_dir,
            size: if is_dir { 0 } else { metadata.len() },
            modified,
            extension,
        });
    }

    // Sort: directories first, then by name
    result.sort_by(|a, b| match (a.is_dir, b.is_dir) {
        (true, false) => std::cmp::Ordering::Less,
        (false, true) => std::cmp::Ordering::Greater,
        _ => a.name.to_lowercase().cmp(&b.name.to_lowercase()),
    });

    Ok(result)
}

#[command]
pub async fn files_read(path: String) -> Result<FileContent, String> {
    let file_path = Path::new(&path);
    if !file_path.is_file() {
        return Err("Path is not a file".into());
    }

    let language = infer_language(file_path);
    let metadata = fs::metadata(file_path).map_err(|e| e.to_string())?;
    let size = metadata.len();
    let writable = !metadata.permissions().readonly();
    let modified = modified_str(&metadata);

    // Check file size
    if size > MAX_FILE_SIZE {
        return Ok(FileContent {
            path,
            content: String::new(),
            language,
            size,
            line_count: 0,
            is_binary: false,
            is_writable: writable,
            modified,
        });
    }

    // Read file
    let mut file = fs::File::open(file_path).map_err(|e| e.to_string())?;
    let mut buf = Vec::new();
    file.read_to_end(&mut buf).map_err(|e| e.to_string())?;

    // Binary check
    let check_len = buf.len().min(BINARY_CHECK_SIZE);
    let is_binary = buf[..check_len].contains(&0);

    if is_binary {
        return Ok(FileContent {
            path,
            content: String::new(),
            language,
            size,
            line_count: 0,
            is_binary: true,
            is_writable: writable,
            modified,
        });
    }

    let content = match std::str::from_utf8(&buf) {
        Ok(s) => s.to_string(),
        Err(_) => {
            // Not valid UTF-8 — try GBK (common on Chinese Windows systems)
            let (decoded, _, had_errors) = encoding_rs::GBK.decode(&buf);
            if had_errors {
                String::from_utf8_lossy(&buf).to_string()
            } else {
                decoded.into_owned()
            }
        }
    };
    let line_count = content.lines().count();

    Ok(FileContent {
        path,
        content,
        language,
        size,
        line_count,
        is_binary: false,
        is_writable: writable,
        modified,
    })
}

#[command]
pub async fn files_write(path: String, content: String) -> Result<(), String> {
    let file_path = Path::new(&path);

    // Atomic write: write to .tmp then rename
    let tmp_path = format!("{}.tmp", path);
    fs::write(&tmp_path, &content).map_err(|e| {
        // Clean up tmp file on failure
        fs::remove_file(&tmp_path).ok();
        e.to_string()
    })?;

    fs::rename(&tmp_path, file_path).map_err(|e| {
        fs::remove_file(&tmp_path).ok();
        e.to_string()
    })
}

#[command]
pub async fn files_write_base64(path: String, data: String) -> Result<(), String> {
    use base64::Engine;
    let file_path = Path::new(&path);

    // Strip data URL prefix if present (e.g., "data:image/png;base64,...")
    let raw = if let Some(idx) = data.find(",") {
        &data[idx + 1..]
    } else {
        &data
    };

    let bytes = base64::engine::general_purpose::STANDARD
        .decode(raw)
        .map_err(|e| format!("Invalid base64: {}", e))?;

    // Create parent dirs if needed
    if let Some(parent) = file_path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }

    // Atomic write
    let tmp_path = format!("{}.tmp", path);
    fs::write(&tmp_path, &bytes).map_err(|e| {
        fs::remove_file(&tmp_path).ok();
        e.to_string()
    })?;

    fs::rename(&tmp_path, file_path).map_err(|e| {
        fs::remove_file(&tmp_path).ok();
        e.to_string()
    })
}

#[command]
pub async fn files_get_tree(root: String, depth: Option<i32>) -> Result<Vec<FileTreeNode>, String> {
    let dir = Path::new(&root);
    if !dir.is_dir() {
        return Err("Path is not a directory".into());
    }

    let max_depth = depth.unwrap_or(4);
    Ok(build_tree(dir, max_depth))
}

#[command]
pub async fn files_open_in_ide(path: String, ide: Option<String>) -> Result<(), String> {
    let target = if Path::new(&path).is_file() {
        // Open file in IDE
        path.clone()
    } else {
        // Open folder
        path.clone()
    };

    let cmd_name = match ide.as_deref() {
        Some("cursor") => "cursor",
        Some("windsurf") => "windsurf",
        _ => "code",
    };

    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("cmd")
            .args(["/C", cmd_name, &target])
            .spawn()
            .map_err(|e| e.to_string())?;
    }

    #[cfg(not(target_os = "windows"))]
    {
        std::process::Command::new(cmd_name)
            .arg(&target)
            .spawn()
            .map_err(|e| e.to_string())?;
    }

    Ok(())
}

#[command]
pub async fn files_create(path: String, is_dir: Option<bool>) -> Result<(), String> {
    let target = Path::new(&path);
    if target.exists() {
        return Err("File or directory already exists".into());
    }

    if is_dir.unwrap_or(false) {
        fs::create_dir_all(target).map_err(|e| e.to_string())?;
    } else {
        // Create parent dirs if needed
        if let Some(parent) = target.parent() {
            fs::create_dir_all(parent).map_err(|e| e.to_string())?;
        }
        fs::write(target, "").map_err(|e| e.to_string())?;
    }

    Ok(())
}

#[command]
pub async fn files_rename(old_path: String, new_path: String) -> Result<(), String> {
    let src = Path::new(&old_path);
    let dst = Path::new(&new_path);

    if !src.exists() {
        return Err("Source path does not exist".into());
    }
    if dst.exists() {
        return Err("Destination already exists".into());
    }

    fs::rename(src, dst).map_err(|e| e.to_string())
}

#[command]
pub async fn files_delete(path: String) -> Result<(), String> {
    let target = Path::new(&path);
    if !target.exists() {
        return Err("Path does not exist".into());
    }

    if target.is_dir() {
        fs::remove_dir_all(target).map_err(|e| e.to_string())?;
    } else {
        fs::remove_file(target).map_err(|e| e.to_string())?;
    }

    Ok(())
}

// ── Helpers ──

fn build_tree(dir: &Path, remaining: i32) -> Vec<FileTreeNode> {
    if remaining <= 0 {
        return Vec::new();
    }

    let entries = match fs::read_dir(dir) {
        Ok(e) => e,
        Err(_) => return Vec::new(),
    };

    let mut result: Vec<FileTreeNode> = Vec::new();

    for entry in entries.flatten() {
        let path = entry.path();
        let name = entry.file_name().to_string_lossy().to_string();

        // Skip hidden and ignored directories
        if path.is_dir() && SKIP_DIRS.contains(&name.as_str()) {
            continue;
        }
        // Skip hidden files/dirs (starting with .)
        if name.starts_with('.') && name != ".env" && name != ".gitignore" && name != ".eslintrc" {
            continue;
        }

        let is_dir = path.is_dir();
        let extension = if is_dir {
            None
        } else {
            path.extension().map(|e| e.to_string_lossy().to_string())
        };

        let size = if is_dir {
            None
        } else {
            fs::metadata(&path).ok().map(|m| m.len())
        };

        let children = if is_dir {
            Some(build_tree(&path, remaining - 1))
        } else {
            None
        };

        result.push(FileTreeNode {
            name,
            path: path.to_string_lossy().to_string(),
            is_dir,
            children,
            size,
            extension,
        });
    }

    // Sort: directories first, then by name
    result.sort_by(|a, b| match (a.is_dir, b.is_dir) {
        (true, false) => std::cmp::Ordering::Less,
        (false, true) => std::cmp::Ordering::Greater,
        _ => a.name.to_lowercase().cmp(&b.name.to_lowercase()),
    });

    result
}

fn infer_language(path: &Path) -> String {
    match path.extension().and_then(|e| e.to_str()) {
        Some("ts") | Some("tsx") => "typescript",
        Some("js") | Some("jsx") | Some("mjs") | Some("cjs") => "javascript",
        Some("json") | Some("jsonc") => "json",
        Some("md") | Some("mdx") => "markdown",
        Some("rs") => "rust",
        Some("py") => "python",
        Some("css") => "css",
        Some("scss") | Some("sass") => "scss",
        Some("less") => "less",
        Some("html") | Some("htm") => "html",
        Some("xml") | Some("svg") => "xml",
        Some("yaml") | Some("yml") => "yaml",
        Some("toml") => "toml",
        Some("sql") => "sql",
        Some("sh") | Some("bash") | Some("zsh") => "shell",
        Some("ps1") => "powershell",
        Some("go") => "go",
        Some("java") | Some("kt") | Some("kts") => "java",
        Some("c") | Some("h") => "c",
        Some("cpp") | Some("cc") | Some("cxx") | Some("hpp") => "cpp",
        Some("cs") => "csharp",
        Some("rb") => "ruby",
        Some("php") => "php",
        Some("swift") => "swift",
        Some("dart") => "dart",
        Some("lua") => "lua",
        Some("r") => "r",
        Some("dockerfile") => "dockerfile",
        Some("graphql") | Some("gql") => "graphql",
        Some("ini") | Some("cfg") | Some("conf") => "ini",
        Some("env") => "dotenv",
        Some("gitignore") => "gitignore",
        Some("lock") => "text",
        _ => "text",
    }
    .to_string()
}

fn modified_str(metadata: &fs::Metadata) -> String {
    metadata
        .modified()
        .ok()
        .and_then(|t| {
            let datetime: chrono::DateTime<chrono::Local> = t.into();
            Some(datetime.to_rfc3339())
        })
        .unwrap_or_default()
}
