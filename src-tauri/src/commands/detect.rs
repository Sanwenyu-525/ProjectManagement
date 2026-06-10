use serde::{Deserialize, Serialize};
use serde_json::Value as JsonValue;
use std::fs;
use std::path::{Path, PathBuf};
use tauri::command;

#[derive(Debug, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct DetectedProject {
    pub name: Option<String>,
    pub description: Option<String>,
    pub tech_stack: Vec<String>,
    pub source: String,
    pub local_path: Option<String>,
    pub repo_url: Option<String>,
    pub repo_platform: Option<String>,
    pub open_command: Option<String>,
    pub live_url: Option<String>,
    pub git_root: Option<String>,
    pub group_id: Option<String>,
    pub parent_path: Option<String>,
    pub icon_type: Option<String>,
    pub icon_url: Option<String>,
    pub icon_color: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectGroup {
    pub id: String,
    pub label: String,
    pub group_type: String,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScanResult {
    pub projects: Vec<DetectedProject>,
    pub groups: Vec<ProjectGroup>,
}

/// Detect project info from a local directory path.
#[command]
pub async fn detect_local_project(path: String) -> Result<DetectedProject, String> {
    detect_local_project_inner(&path)
}

/// Synchronous project detection logic (used by both single detect and scan).
fn detect_local_project_inner(path: &str) -> Result<DetectedProject, String> {
    let dir = Path::new(&path);
    if !dir.is_dir() {
        return Err("Path is not a directory".into());
    }

    let mut detected = DetectedProject {
        local_path: Some(path.to_string()),
        source: "Local".into(),
        ..Default::default()
    };

    // 1. Name from directory name
    detected.name = dir
        .file_name()
        .and_then(|n| n.to_str())
        .map(|s| s.to_string());

    // 2. Scan for project files
    let mut tech_stack = Vec::new();

    // package.json (Node.js)
    if let Some(info) = detect_node_project(dir) {
        if let Some(name) = info.name {
            detected.name = Some(name);
        }
        if let Some(desc) = info.description {
            detected.description = Some(desc);
        }
        tech_stack.extend(info.tech_stack);
    }

    // Cargo.toml (Rust)
    if dir.join("Cargo.toml").exists() {
        tech_stack.push("Rust".into());
        if let Some(info) = detect_cargo_project(dir) {
            if detected.name.as_deref() == dir.file_name().and_then(|n| n.to_str()) {
                if let Some(name) = info.name {
                    detected.name = Some(name);
                }
            }
            if detected.description.is_none() {
                detected.description = info.description;
            }
        }
    }

    // go.mod (Go)
    if dir.join("go.mod").exists() {
        tech_stack.push("Go".into());
    }

    // Python
    if dir.join("pyproject.toml").exists() || dir.join("requirements.txt").exists() || dir.join("setup.py").exists() {
        tech_stack.push("Python".into());
        if let Some(info) = detect_python_project(dir) {
            if detected.description.is_none() {
                detected.description = info.description;
            }
        }
    }

    // Java
    if dir.join("pom.xml").exists() {
        tech_stack.push("Java".into());
        tech_stack.push("Maven".into());
    }
    if dir.join("build.gradle").exists() || dir.join("build.gradle.kts").exists() {
        tech_stack.push("Java".into());
        tech_stack.push("Gradle".into());
    }

    // C# / .NET
    if has_file_extension(dir, "csproj") {
        tech_stack.push("C#".into());
        tech_stack.push(".NET".into());
    }

    // Ruby
    if dir.join("Gemfile").exists() {
        tech_stack.push("Ruby".into());
    }

    // PHP
    if dir.join("composer.json").exists() {
        tech_stack.push("PHP".into());
    }

    // Swift / iOS
    if has_file_extension(dir, "xcodeproj") || has_file_extension(dir, "xcworkspace") {
        tech_stack.push("Swift".into());
        tech_stack.push("iOS".into());
    }

    // Kotlin / Android
    if dir.join("build.gradle.kts").exists() && dir.join("app").join("src").exists() {
        tech_stack.push("Kotlin".into());
        tech_stack.push("Android".into());
    }

    // Docker
    if dir.join("Dockerfile").exists() || dir.join("docker-compose.yml").exists() || dir.join("docker-compose.yaml").exists() {
        tech_stack.push("Docker".into());
    }

    // TypeScript detection (tsconfig.json)
    if dir.join("tsconfig.json").exists() && !tech_stack.contains(&"TypeScript".to_string()) {
        tech_stack.push("TypeScript".into());
    }

    // 3. Git info
    if let Some(git_info) = detect_git_info(dir) {
        if let Some(url) = git_info.remote_url {
            detected.repo_url = Some(url.clone());
            detected.repo_platform = detect_platform(&url);
            if detected.source == "Local" {
                detected.source = "Hybrid".into();
            }
        }
    }

    // 4. README description fallback
    if detected.description.is_none() {
        detected.description = extract_readme_description(dir);
    }

    // Deduplicate tech stack
    tech_stack.sort();
    tech_stack.dedup();
    detected.tech_stack = tech_stack;

    // 5. Detect open command (dev server) from project config
    detected.open_command = detect_open_command(dir);

    // 6. Detect icon from project files (pass tech_stack for smart directory search)
    let icon_info = detect_project_icon(dir, &detected.tech_stack);
    detected.icon_type = Some(icon_info.icon_type);
    detected.icon_url = icon_info.icon_url;
    detected.icon_color = icon_info.icon_color;

    Ok(detected)
}

/// Detect project info from a git repository URL.
/// Clones to a temp directory, scans, then cleans up.
#[command]
pub async fn detect_git_repo(repo_url: String) -> Result<DetectedProject, String> {
    let temp_dir = std::env::temp_dir().join(format!("devhub_detect_{}", uuid::Uuid::new_v4()));

    // Clone (shallow, single branch)
    let output = std::process::Command::new("git")
        .args(["clone", "--depth", "1", "--single-branch", &repo_url, temp_dir.to_str().unwrap()])
        .output()
        .map_err(|e| format!("Failed to run git: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("Git clone failed: {}", stderr));
    }

    // Detect
    let mut detected = detect_local_project_inner(&temp_dir.to_string_lossy())?;

    // Set source to Remote
    detected.source = "Remote".into();
    detected.local_path = None;
    detected.repo_url = Some(repo_url.clone());
    detected.repo_platform = detect_platform(&repo_url);

    // Cleanup
    let _ = fs::remove_dir_all(&temp_dir);

    Ok(detected)
}

/// Scan a directory for all projects within it, with relationship detection.
#[command]
pub async fn detect_scan_directory(path: String, max_depth: Option<usize>) -> Result<ScanResult, String> {
    let root = PathBuf::from(&path);
    if !root.is_dir() {
        return Err("Path is not a directory".into());
    }

    let depth = max_depth.unwrap_or(1);
    let mut projects = Vec::new();

    scan_directory(&root, depth, &mut projects);

    // Detect relationships
    let groups = detect_relationships(&mut projects);

    Ok(ScanResult { projects, groups })
}

/// Recursively scan for project directories.
fn scan_directory(dir: &Path, remaining_depth: usize, results: &mut Vec<DetectedProject>) {
    if remaining_depth == 0 {
        return;
    }

    let entries = match fs::read_dir(dir) {
        Ok(e) => e,
        Err(_) => return,
    };

    for entry in entries.flatten() {
        let path = entry.path();
        if !path.is_dir() {
            continue;
        }

        let name = entry.file_name();
        let name_str = name.to_string_lossy();

        // Skip hidden/system dirs
        if name_str.starts_with('.') {
            continue;
        }

        // Skip known non-project dirs
        if should_skip_dir(&name_str) {
            continue;
        }

        // Check if this dir is a project
        if is_project_dir(&path) {
            let path_str = path.to_string_lossy().to_string();
            if let Ok(mut detected) = detect_local_project_inner(&path_str) {
                detected.git_root = find_git_root(&path).map(|p| p.to_string_lossy().to_string());
                results.push(detected);
            }
            // Don't recurse into project directories
        } else if count_project_subdirs(&path) >= 2 {
            // Monorepo: multiple project subdirectories → treat this dir as one project
            let path_str = path.to_string_lossy().to_string();
            if let Ok(mut detected) = detect_local_project_inner(&path_str) {
                detected.git_root = find_git_root(&path).map(|p| p.to_string_lossy().to_string());
                results.push(detected);
            }
        } else {
            // Not a project, recurse deeper
            scan_directory(&path, remaining_depth - 1, results);
        }
    }
}

fn should_skip_dir(name: &str) -> bool {
    matches!(
        name,
        "node_modules"
            | "target"
            | "dist"
            | "build"
            | ".git"
            | ".svn"
            | ".hg"
            | "__pycache__"
            | ".venv"
            | "venv"
            | ".idea"
            | ".vscode"
            | ".cache"
            | ".next"
            | ".nuxt"
            | "coverage"
            | ".turbo"
            | ".parcel-cache"
    )
}

/// Walk up from `dir` to find the nearest ancestor containing a `.git` directory.
fn find_git_root(dir: &Path) -> Option<PathBuf> {
    let mut current = Some(dir);
    while let Some(d) = current {
        if d.join(".git").exists() {
            return Some(d.to_path_buf());
        }
        current = d.parent();
    }
    None
}

/// Analyze scanned projects and assign group_id / parent_path based on relationships.
/// Returns the list of discovered groups.
fn detect_relationships(projects: &mut [DetectedProject]) -> Vec<ProjectGroup> {
    let mut groups: Vec<ProjectGroup> = Vec::new();
    let mut next_group_idx: usize = 0;

    // --- Phase 1: Group by shared git root ---
    // Collect (git_root, index) pairs
    let mut git_groups: std::collections::HashMap<String, Vec<usize>> = std::collections::HashMap::new();
    for (i, p) in projects.iter().enumerate() {
        if let Some(ref root) = p.git_root {
            git_groups.entry(root.clone()).or_default().push(i);
        }
    }

    // Only create groups where multiple projects share the same git root
    for (root, indices) in &git_groups {
        if indices.len() > 1 {
            let group_id = format!("git_{}", next_group_idx);
            next_group_idx += 1;
            let label = Path::new(root)
                .file_name()
                .map(|n| n.to_string_lossy().to_string())
                .unwrap_or_else(|| root.clone());
            groups.push(ProjectGroup {
                id: group_id.clone(),
                label,
                group_type: "git".into(),
            });
            for &i in indices {
                projects[i].group_id = Some(group_id.clone());
            }
        }
    }

    // --- Phase 2: Detect nested (parent-child) relationships ---
    // Sort by path depth so shorter (parent) paths come first
    let mut sorted_indices: Vec<usize> = (0..projects.len()).collect();
    sorted_indices.sort_by_key(|&i| {
        projects[i]
            .local_path
            .as_ref()
            .map(|p| p.chars().filter(|c| *c == '\\' || *c == '/').count())
            .unwrap_or(0)
    });

    for &i in &sorted_indices {
        let child_path = match projects[i].local_path.as_ref() {
            Some(p) => Path::new(p),
            None => continue,
        };
        // Check if any already-grouped parent contains this child
        for &j in &sorted_indices {
            if i == j {
                continue;
            }
            let parent_path = match projects[j].local_path.as_ref() {
                Some(p) => Path::new(p),
                None => continue,
            };
            if child_path.starts_with(parent_path) && child_path != parent_path {
                // Child is nested inside parent
                projects[i].parent_path = Some(parent_path.to_string_lossy().to_string());
                // Inherit parent's group_id, or create a new "nested" group
                if let Some(ref parent_group) = projects[j].group_id {
                    projects[i].group_id = Some(parent_group.clone());
                } else if projects[i].group_id.is_none() {
                    let group_id = format!("nest_{}", next_group_idx);
                    next_group_idx += 1;
                    let label = projects[j]
                        .name
                        .clone()
                        .unwrap_or_else(|| "未命名".into());
                    groups.push(ProjectGroup {
                        id: group_id.clone(),
                        label,
                        group_type: "nested".into(),
                    });
                    projects[i].group_id = Some(group_id.clone());
                    projects[j].group_id = Some(group_id);
                }
                break; // Only one direct parent
            }
        }
    }

    groups
}

/// Check if a directory looks like a project root by looking for marker files.
fn is_project_dir(dir: &Path) -> bool {
    let markers = [
        "package.json",
        "Cargo.toml",
        "go.mod",
        "pyproject.toml",
        "requirements.txt",
        "setup.py",
        "pom.xml",
        "build.gradle",
        "build.gradle.kts",
        "Gemfile",
        "composer.json",
        "Dockerfile",
        "docker-compose.yml",
        "docker-compose.yaml",
    ];

    for marker in &markers {
        if dir.join(marker).exists() {
            return true;
        }
    }

    // Check for .csproj, .xcodeproj, .xcworkspace (extension-based)
    if has_file_extension(dir, "csproj")
        || has_file_extension(dir, "xcodeproj")
        || has_file_extension(dir, "xcworkspace")
    {
        return true;
    }

    false
}

/// Count how many immediate subdirectories are project directories.
/// Used to detect monorepos (e.g. frontend/ + backend/ inside one repo).
fn count_project_subdirs(dir: &Path) -> usize {
    let entries = match fs::read_dir(dir) {
        Ok(e) => e,
        Err(_) => return 0,
    };

    entries
        .flatten()
        .filter(|e| {
            let name = e.file_name();
            let name_str = name.to_string_lossy();
            e.path().is_dir()
                && !name_str.starts_with('.')
                && !should_skip_dir(&name_str)
                && is_project_dir(&e.path())
        })
        .count()
}

// ==================== Internal Helpers ====================

struct NodeProjectInfo {
    name: Option<String>,
    description: Option<String>,
    tech_stack: Vec<String>,
}

fn detect_node_project(dir: &Path) -> Option<NodeProjectInfo> {
    let pkg_path = dir.join("package.json");
    let content = fs::read_to_string(&pkg_path).ok()?;
    let pkg: JsonValue = serde_json::from_str(&content).ok()?;

    let name = pkg.get("name").and_then(|v| v.as_str()).map(|s| s.to_string());
    let description = pkg.get("description").and_then(|v| v.as_str()).map(|s| s.to_string());

    let mut tech_stack = vec!["Node.js".into()];

    // Collect all dependencies
    let mut all_deps = Vec::new();
    for section in &["dependencies", "devDependencies"] {
        if let Some(deps) = pkg.get(section).and_then(|v| v.as_object()) {
            all_deps.extend(deps.keys().cloned());
        }
    }

    // Framework detection
    let dep_set: std::collections::HashSet<&str> = all_deps.iter().map(|s| s.as_str()).collect();

    if dep_set.contains("react") || dep_set.contains("react-dom") {
        tech_stack.push("React".into());
    }
    if dep_set.contains("vue") {
        tech_stack.push("Vue".into());
    }
    if dep_set.contains("@angular/core") {
        tech_stack.push("Angular".into());
    }
    if dep_set.contains("svelte") {
        tech_stack.push("Svelte".into());
    }
    if dep_set.contains("next") {
        tech_stack.push("Next.js".into());
    }
    if dep_set.contains("nuxt") || dep_set.contains("@nuxt/kit") {
        tech_stack.push("Nuxt".into());
    }
    if dep_set.contains("@nestjs/core") {
        tech_stack.push("NestJS".into());
    }
    if dep_set.contains("express") {
        tech_stack.push("Express".into());
    }
    if dep_set.contains("fastify") {
        tech_stack.push("Fastify".into());
    }
    if dep_set.contains("electron") || dep_set.contains("@electron-forge/cli") {
        tech_stack.push("Electron".into());
    }
    if dep_set.contains("@tauri-apps/cli") || dep_set.contains("@tauri-apps/api") {
        tech_stack.push("Tauri".into());
    }
    if dep_set.contains("vite") {
        tech_stack.push("Vite".into());
    }
    if dep_set.contains("webpack") {
        tech_stack.push("Webpack".into());
    }
    if dep_set.contains("tailwindcss") {
        tech_stack.push("Tailwind CSS".into());
    }
    if dep_set.contains("antd") || dep_set.contains("ant-design") {
        tech_stack.push("Ant Design".into());
    }
    if dep_set.contains("prisma") || dep_set.contains("@prisma/client") {
        tech_stack.push("Prisma".into());
    }
    if dep_set.contains("zustand") {
        tech_stack.push("Zustand".into());
    }
    if dep_set.contains("typescript") || dep_set.contains("ts-node") {
        tech_stack.push("TypeScript".into());
    }
    if dep_set.contains("jest") || dep_set.contains("vitest") {
        tech_stack.push("Testing".into());
    }

    Some(NodeProjectInfo { name, description, tech_stack })
}

struct CargoProjectInfo {
    name: Option<String>,
    description: Option<String>,
}

fn detect_cargo_project(dir: &Path) -> Option<CargoProjectInfo> {
    let content = fs::read_to_string(dir.join("Cargo.toml")).ok()?;
    let name = extract_toml_value(&content, "name");
    let description = extract_toml_value(&content, "description");
    Some(CargoProjectInfo { name, description })
}

struct PythonProjectInfo {
    description: Option<String>,
}

fn detect_python_project(dir: &Path) -> Option<PythonProjectInfo> {
    // Try pyproject.toml first
    if let Ok(content) = fs::read_to_string(dir.join("pyproject.toml")) {
        let description = extract_toml_value(&content, "description");
        return Some(PythonProjectInfo { description });
    }
    None
}

struct GitInfo {
    remote_url: Option<String>,
}

fn detect_git_info(dir: &Path) -> Option<GitInfo> {
    let git_config = dir.join(".git").join("config");
    let content = fs::read_to_string(&git_config).ok()?;

    let mut remote_url = None;
    for line in content.lines() {
        let trimmed = line.trim();
        if trimmed.starts_with("url") && trimmed.contains('=') {
            if let Some(url) = trimmed.split('=').nth(1) {
                remote_url = Some(url.trim().to_string());
                break;
            }
        }
    }

    Some(GitInfo { remote_url })
}

fn detect_platform(url: &str) -> Option<String> {
    if url.contains("github.com") {
        Some("GitHub".into())
    } else if url.contains("gitlab.com") || url.contains("gitlab") {
        Some("GitLab".into())
    } else if url.contains("gitee.com") {
        Some("Gitee".into())
    } else if url.contains("bitbucket.org") {
        Some("Bitbucket".into())
    } else {
        None
    }
}

fn extract_readme_description(dir: &Path) -> Option<String> {
    for name in &["README.md", "readme.md", "README.MD", "Readme.md"] {
        if let Ok(content) = fs::read_to_string(dir.join(name)) {
            // Find first non-empty, non-heading paragraph
            let mut found_heading = false;
            for line in content.lines() {
                let trimmed = line.trim();
                if trimmed.is_empty() {
                    if found_heading {
                        continue;
                    }
                    continue;
                }
                if trimmed.starts_with('#') {
                    found_heading = true;
                    continue;
                }
                if found_heading && !trimmed.starts_with('<') && !trimmed.starts_with('[') {
                    return Some(trimmed.to_string());
                }
            }
        }
    }
    None
}

fn extract_toml_value(content: &str, key: &str) -> Option<String> {
    for line in content.lines() {
        let trimmed = line.trim();
        if trimmed.starts_with(key) && trimmed.contains('=') {
            let val = trimmed.split('=').nth(1)?.trim();
            let val = val.trim_matches('"').trim_matches('\'');
            if !val.is_empty() {
                return Some(val.to_string());
            }
        }
    }
    None
}

fn has_file_extension(dir: &Path, ext: &str) -> bool {
    fs::read_dir(dir)
        .ok()
        .and_then(|mut entries| {
            entries.find_map(|e| {
                let e = e.ok()?;
                let name = e.file_name();
                let name_str = name.to_string_lossy();
                if name_str.ends_with(&format!(".{}", ext)) {
                    Some(true)
                } else {
                    None
                }
            })
        })
        .unwrap_or(false)
}

fn detect_open_command(dir: &Path) -> Option<String> {
    // 1. Node.js: package.json scripts (dev > start > serve)
    if let Some(cmd) = detect_npm_script(dir) {
        return Some(cmd);
    }
    // 2. Rust
    if dir.join("Cargo.toml").exists() {
        return Some("cargo run".into());
    }
    // 3. Go
    if dir.join("go.mod").exists() {
        return Some("go run .".into());
    }
    // 4. Python with manage.py (Django)
    if dir.join("manage.py").exists() {
        return Some("python manage.py runserver".into());
    }
    None
}

fn detect_npm_script(dir: &Path) -> Option<String> {
    let pkg_path = dir.join("package.json");
    let content = fs::read_to_string(&pkg_path).ok()?;
    let pkg: JsonValue = serde_json::from_str(&content).ok()?;
    let scripts = pkg.get("scripts")?.as_object()?;

    // Priority: dev > start > serve
    for name in &["dev", "start", "serve"] {
        if scripts.get(*name).and_then(|v| v.as_str()).is_some() {
            // Determine package manager
            let pm = if dir.join("pnpm-lock.yaml").exists() {
                "pnpm"
            } else if dir.join("yarn.lock").exists() {
                "yarn"
            } else {
                "npm run"
            };
            // Extract the script name (e.g. "vite" -> "dev", "next dev" -> "dev")
            return Some(format!("{} {}", pm, name));
        }
    }
    None
}

struct ProjectIconInfo {
    icon_type: String,
    icon_url: Option<String>,
    icon_color: Option<String>,
}

/// Convert a local file to a base64 data URI.
fn file_to_data_uri(path: &Path) -> Option<String> {
    let content = fs::read(path).ok()?;
    let mime_type = match path.extension().and_then(|e| e.to_str())? {
        "ico" => "image/x-icon",
        "png" => "image/png",
        "jpg" | "jpeg" => "image/jpeg",
        "svg" => "image/svg+xml",
        "gif" => "image/gif",
        _ => "image/png",
    };
    use base64::Engine as _;
    let base64 = base64::engine::general_purpose::STANDARD.encode(&content);
    Some(format!("data:{};base64,{}", mime_type, base64))
}

/// Detect project icon from local files or infer from tech stack.
fn detect_project_icon(dir: &Path, tech_stack: &[String]) -> ProjectIconInfo {
    // Common icon filenames to search for (case-insensitive matching)
    let icon_filenames = [
        "favicon.ico",
        "favicon.png",
        "icon.png",
        "icon.ico",
        "logo.png",
        "logo.svg",
        "logo.ico",
        "app.ico",
        "app.png",
        "logo192.png",
        "logo512.png",
        "apple-touch-icon.png",
        "android-chrome-192x192.png",
        "android-chrome-512x512.png",
    ];

    // Default priority directories to search
    let default_dirs = ["", "public", "assets", "static", "src/assets"];

    // Tech-stack specific search directories (prioritized higher)
    let tech_dirs = get_tech_specific_dirs(tech_stack);

    // Combine: tech-specific dirs first, then default dirs
    let mut all_dirs = tech_dirs.clone();
    for d in default_dirs {
        if !all_dirs.contains(&d.to_string()) {
            all_dirs.push(d.to_string());
        }
    }

    // Priority 1: Search in priority directories (up to 4 levels deep)
    for priority_dir in &all_dirs {
        let search_root = if priority_dir.is_empty() {
            dir.to_path_buf()
        } else {
            dir.join(priority_dir)
        };

        if !search_root.exists() {
            continue;
        }

        if let Some(icon_path) = find_icon_file(&search_root, &icon_filenames, 4) {
            if let Some(data_uri) = file_to_data_uri(&icon_path) {
                return ProjectIconInfo {
                    icon_type: "Custom".into(),
                    icon_url: Some(data_uri),
                    icon_color: None,
                };
            }
        }
    }

    // Priority 2: Recursively search entire project directory (limit depth to 5)
    if let Some(icon_path) = find_icon_file(dir, &icon_filenames, 5) {
        if let Some(data_uri) = file_to_data_uri(&icon_path) {
            return ProjectIconInfo {
                icon_type: "Custom".into(),
                icon_url: Some(data_uri),
                icon_color: None,
            };
        }
    }

    // Priority 3: Extract from package.json (npm packages often have icon field)
    if let Some(icon_info) = detect_icon_from_package_json(dir) {
        return icon_info;
    }

    // Priority 4: Extract from .exe if exists (Windows)
    if cfg!(target_os = "windows") {
        if let Some(icon_info) = detect_icon_from_exe(dir) {
            return icon_info;
        }
    }

    // Fallback: Use tech stack color
    ProjectIconInfo {
        icon_type: "Auto".into(),
        icon_url: None,
        icon_color: None,
    }
}

/// Get tech-stack specific search directories.
fn get_tech_specific_dirs(tech_stack: &[String]) -> Vec<String> {
    let mut dirs = Vec::new();

    let stack_lower: Vec<String> = tech_stack.iter().map(|s| s.to_lowercase()).collect();

    if stack_lower.iter().any(|t| t.contains("react") || t.contains("vue") || t.contains("angular") || t.contains("next") || t.contains("nuxt")) {
        dirs.push("public".into());
        dirs.push("src/assets".into());
    }

    if stack_lower.iter().any(|t| t.contains("flutter")) {
        dirs.push("assets".into());
        dirs.push("ios".into());
        dirs.push("android".into());
    }

    if stack_lower.iter().any(|t| t.contains("django") || t.contains("flask") || t.contains("rails")) {
        dirs.push("static".into());
        dirs.push("templates".into());
    }

    if stack_lower.iter().any(|t| t.contains(".net") || t.contains("c#")) {
        dirs.push("wwwroot".into());
        dirs.push("Resources".into());
    }

    if stack_lower.iter().any(|t| t.contains("spring") || t.contains("java")) {
        dirs.push("src/main/resources".into());
        dirs.push("resources".into());
    }

    if stack_lower.iter().any(|t| t.contains("swift") || t.contains("ios")) {
        dirs.push("Assets.xcassets".into());
        dirs.push("Sources".into());
    }

    if stack_lower.iter().any(|t| t.contains("kotlin") || t.contains("android")) {
        dirs.push("app/src/main/res".into());
    }

    dirs
}

/// Recursively find an icon file in the directory tree.
fn find_icon_file(dir: &Path, icon_filenames: &[&str], max_depth: usize) -> Option<PathBuf> {
    if max_depth == 0 {
        return None;
    }

    let entries = match fs::read_dir(dir) {
        Ok(e) => e,
        Err(_) => return None,
    };

    // First pass: check files in current directory (fastest)
    for entry in entries.flatten() {
        let path = entry.path();
        if path.is_file() {
            let name = entry.file_name();
            let name_str = name.to_string_lossy().to_lowercase();

            // Check if this file matches any icon filename
            if icon_filenames.iter().any(|icon| name_str == icon.to_lowercase()) {
                // Verify file is a reasonable size for an icon (< 5MB)
                if let Ok(metadata) = fs::metadata(&path) {
                    if metadata.len() < 5 * 1024 * 1024 {
                        return Some(path);
                    }
                }
            }
        }
    }

    // Second pass: recurse into subdirectories
    for entry in fs::read_dir(dir).ok()?.flatten() {
        let path = entry.path();
        if path.is_dir() {
            let dir_name = entry.file_name();
            let dir_name_str = dir_name.to_string_lossy();

            // Skip non-relevant directories to speed up search
            if should_skip_dir(&dir_name_str) {
                continue;
            }

            if let Some(icon_path) = find_icon_file(&path, icon_filenames, max_depth - 1) {
                return Some(icon_path);
            }
        }
    }

    None
}

/// Extract icon path from package.json "icon" field.
fn detect_icon_from_package_json(dir: &Path) -> Option<ProjectIconInfo> {
    let pkg_path = dir.join("package.json");
    let content = fs::read_to_string(&pkg_path).ok()?;
    let pkg: JsonValue = serde_json::from_str(&content).ok()?;

    // Check "icon" field in package.json
    let icon_path = pkg.get("icon")?.as_str()?;

    // Resolve relative path
    let full_path = dir.join(icon_path);
    if full_path.exists() {
        if let Some(data_uri) = file_to_data_uri(&full_path) {
            return Some(ProjectIconInfo {
                icon_type: "Custom".into(),
                icon_url: Some(data_uri),
                icon_color: None,
            });
        }
    }

    None
}

/// Detect icon from executable files (.exe, .dll) in the project.
/// Only on Windows - uses Windows API to extract icon.
#[cfg(target_os = "windows")]
fn detect_icon_from_exe(dir: &Path) -> Option<ProjectIconInfo> {
    // Look for .exe files in common build directories
    let build_dirs = [
        "target/release",
        "target/debug",
        "bin",
        "build",
        "out",
        "dist",
        "release",
    ];

    for build_dir in &build_dirs {
        let build_path = dir.join(build_dir);
        if !build_path.exists() {
            continue;
        }

        // Find .exe files
        if let Ok(entries) = fs::read_dir(&build_path) {
            for entry in entries.flatten() {
                let path = entry.path();
                if path.extension().and_then(|e| e.to_str()) == Some("exe") {
                    // Found an .exe file - use it as icon source
                    // Note: We store the exe path but frontend won't be able to render it
                    // as an image. For now, we'll skip exe icons and fall back to Auto.
                    break;
                }
            }
        }
    }

    None
}

#[cfg(not(target_os = "windows"))]
fn detect_icon_from_exe(_dir: &Path) -> Option<ProjectIconInfo> {
    None
}
