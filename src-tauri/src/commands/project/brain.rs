use serde::{Deserialize, Serialize};
use std::fs;
use std::path::Path;
use tauri::command;
use crate::db::Database;
use tauri::State;

// ── Output types ──

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectBrain {
    pub structure: DirectoryNode,
    pub entry_points: EntryPoints,
    pub directories: Vec<DirectoryInfo>,
    pub environment: EnvironmentInfo,
    pub stats: ProjectStats,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DirectoryNode {
    pub name: String,
    pub node_type: String, // "dir" | "file"
    pub children: Vec<DirectoryNode>,
    pub file_count: usize,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EntryPoints {
    pub main: Option<String>,
    pub config: Option<String>,
    pub test: Option<String>,
    pub lint: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DirectoryInfo {
    pub path: String,
    pub purpose: String, // "source" | "test" | "config" | "build" | "docs" | "assets" | "scripts"
    pub file_count: usize,
    pub description: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EnvironmentInfo {
    pub node_version: Option<String>,
    pub python_version: Option<String>,
    pub required_tools: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectStats {
    pub total_files: usize,
    pub source_files: usize,
    pub test_files: usize,
    pub lines_of_code: Option<usize>,
    pub languages: Vec<LanguageStats>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LanguageStats {
    pub name: String,
    pub file_count: usize,
    pub lines: Option<usize>,
}

// ── Noise directories to skip ──

const SKIP_DIRS: &[&str] = &[
    "node_modules", ".git", "target", "dist", "build", "out",
    "__pycache__", ".venv", "venv", ".env", "coverage",
    ".next", ".nuxt", ".cache", ".gradle", ".idea", ".vscode",
    "Pods", ".pub-cache", ".dart_tool",
];

// ── Entry point candidates ──

const MAIN_CANDIDATES: &[&str] = &[
    "src/main.tsx", "src/main.ts", "src/main.jsx", "src/main.js",
    "src/index.tsx", "src/index.ts", "src/index.jsx", "src/index.js",
    "src/App.tsx", "src/App.ts", "src/App.vue",
    "app/main.py", "app.py", "manage.py",
    "cmd/main.go", "main.go", "cmd/server/main.go",
    "src/main.rs", "src/lib.rs",
    "lib/main.dart",
    "bin/main.rb", "lib/main.rb",
    "index.php", "public/index.php",
    "src/main.rs", "src/bin/main.rs",
];

const CONFIG_CANDIDATES: &[&str] = &[
    "vite.config.ts", "vite.config.js", "vite.config.mts",
    "webpack.config.js", "webpack.config.ts",
    "tsconfig.json", "tsconfig.app.json",
    "next.config.js", "next.config.ts", "next.config.mjs",
    "nuxt.config.ts", "nuxt.config.js",
    "angular.json", "svelte.config.js",
    "Cargo.toml", "go.mod", "pyproject.toml",
    "build.gradle", "build.gradle.kts", "pom.xml",
    "Makefile", "CMakeLists.txt",
    "turbo.json", "nx.json", "lerna.json",
    "pnpm-workspace.yaml",
];

const TEST_CANDIDATES: &[&str] = &[
    "jest.config.js", "jest.config.ts",
    "vitest.config.ts", "vitest.config.js",
    "pytest.ini", "conftest.py",
    ".mocharc.yml", ".mocharc.js",
    "karma.conf.js",
];

const LINT_CANDIDATES: &[&str] = &[
    ".eslintrc.js", ".eslintrc.json", ".eslintrc.yml", ".eslintrc",
    "eslint.config.js", "eslint.config.mjs",
    "biome.json",
    ".flake8", "setup.cfg",
    "clippy.toml", ".clippy.toml",
    ".rubocop.yml",
    ".prettierrc", ".prettierrc.json",
];

// ── Directory purpose inference ──

fn infer_purpose(dir_name: &str) -> &'static str {
    match dir_name {
        "src" | "lib" | "app" | "internal" | "pkg" | "cmd" | "server" | "client" => "source",
        "test" | "tests" | "__tests__" | "spec" | "specs" | "test_*" => "test",
        "config" | "conf" | "cfg" => "config",
        "dist" | "build" | "out" | "target" | "release" | "public" => "build",
        "docs" | "doc" | "wiki" | "documentation" => "docs",
        "assets" | "static" | "images" | "img" | "media" | "fonts" | "styles" => "assets",
        "scripts" | "bin" | "tools" | "dev" => "scripts",
        _ => "source",
    }
}

fn describe_directory(dir_name: &str, purpose: &str, child_dirs: &[String]) -> Option<String> {
    match purpose {
        "source" => {
            if child_dirs.iter().any(|d| d == "components" || d == "pages" || d == "views") {
                Some(format!("{} — UI 资源", dir_name))
            } else if child_dirs.iter().any(|d| d == "routes" || d == "controllers" || d == "handlers") {
                Some(format!("{} — API 层", dir_name))
            } else if child_dirs.iter().any(|d| d == "utils" || d == "helpers" || d == "lib") {
                Some(format!("{} — 核心逻辑", dir_name))
            } else {
                None
            }
        }
        "test" => Some(format!("{} — 测试文件", dir_name)),
        "config" => Some(format!("{} — 配置文件", dir_name)),
        "build" => Some(format!("{} — 构建产物", dir_name)),
        "docs" => Some(format!("{} — 文档", dir_name)),
        "assets" => Some(format!("{} — 静态资源", dir_name)),
        "scripts" => Some(format!("{} — 工具脚本", dir_name)),
        _ => None,
    }
}

// ── Language detection by extension ──

fn ext_to_language(ext: &str) -> Option<&'static str> {
    match ext {
        "ts" | "tsx" | "mts" | "cts" => Some("TypeScript"),
        "js" | "jsx" | "mjs" | "cjs" => Some("JavaScript"),
        "rs" => Some("Rust"),
        "py" => Some("Python"),
        "go" => Some("Go"),
        "java" => Some("Java"),
        "kt" | "kts" => Some("Kotlin"),
        "swift" => Some("Swift"),
        "rb" => Some("Ruby"),
        "php" => Some("PHP"),
        "dart" => Some("Dart"),
        "scala" | "sc" => Some("Scala"),
        "ex" | "exs" => Some("Elixir"),
        "hs" => Some("Haskell"),
        "c" | "h" => Some("C"),
        "cpp" | "cc" | "cxx" | "hpp" => Some("C++"),
        "cs" => Some("C#"),
        "r" | "R" => Some("R"),
        "jl" => Some("Julia"),
        "lua" => Some("Lua"),
        "zig" => Some("Zig"),
        "vue" => Some("Vue"),
        "svelte" => Some("Svelte"),
        "css" | "scss" | "less" | "sass" => Some("CSS"),
        "html" | "htm" | "astro" => Some("HTML"),
        "sql" => Some("SQL"),
        "graphql" | "gql" => Some("GraphQL"),
        "toml" | "yaml" | "yml" | "json" | "jsonc" | "xml" => Some("Config"),
        "md" | "mdx" | "rst" | "txt" => Some("Markdown"),
        "sh" | "bash" | "zsh" | "fish" => Some("Shell"),
        "proto" => Some("Protobuf"),
        _ => None,
    }
}

fn is_source_file(name: &str) -> bool {
    let skip = ["package.json", "tsconfig.json", "README.md", "LICENSE",
        "Dockerfile", "docker-compose.yml", ".gitignore", ".env",
        "Cargo.toml", "go.mod", "pyproject.toml"];
    !skip.contains(&name)
}

fn is_test_file(name: &str) -> bool {
    name.contains(".test.") || name.contains(".spec.") || name.contains("_test.")
        || name.starts_with("test_") || name.starts_with("Test")
}

// ── Core analysis ──

fn count_files_recursive(dir: &Path, depth: usize, max_depth: usize, stats: &mut ScanStats) {
    if depth > max_depth { return; }
    let entries = match fs::read_dir(dir) {
        Ok(e) => e,
        Err(_) => return,
    };

    for entry in entries.flatten() {
        let path = entry.path();
        let name = entry.file_name().to_string_lossy().to_string();

        if path.is_dir() {
            if !SKIP_DIRS.contains(&name.as_str()) && !name.starts_with('.') {
                stats.total_files += 1;
                count_files_recursive(&path, depth + 1, max_depth, stats);
            }
        } else {
            stats.total_files += 1;
            if let Some(ext) = path.extension().and_then(|e| e.to_str()) {
                if let Some(lang) = ext_to_language(ext) {
                    *stats.language_files.entry(lang.to_string()).or_insert(0) += 1;
                }
                let file_name = path.file_name().unwrap_or_default().to_string_lossy();
                if is_source_file(&file_name) {
                    stats.source_files += 1;
                }
                if is_test_file(&file_name) {
                    stats.test_files += 1;
                }
                // Count lines for source files (capped)
                if stats.lines_sampled < 500 {
                    if let Ok(content) = fs::read_to_string(&path) {
                        stats.lines_of_code += content.lines().count();
                        stats.lines_sampled += 1;
                    }
                }
            }
        }
    }
}

struct ScanStats {
    total_files: usize,
    source_files: usize,
    test_files: usize,
    lines_of_code: usize,
    lines_sampled: usize,
    language_files: std::collections::HashMap<String, usize>,
}

fn build_structure_tree(dir: &Path, depth: usize, max_depth: usize) -> DirectoryNode {
    let name = dir.file_name()
        .unwrap_or_default()
        .to_string_lossy()
        .to_string();

    let mut children = Vec::new();
    let mut file_count = 0;

    if depth < max_depth {
        if let Ok(entries) = fs::read_dir(dir) {
            let mut dirs: Vec<_> = entries.flatten()
                .filter(|e| {
                    let n = e.file_name().to_string_lossy().to_string();
                    e.path().is_dir() && !SKIP_DIRS.contains(&n.as_str()) && !n.starts_with('.')
                })
                .collect();
            dirs.sort_by(|a, b| a.file_name().cmp(&b.file_name()));

            for entry in dirs {
                children.push(build_structure_tree(&entry.path(), depth + 1, max_depth));
            }
        }
    }

    // Count direct files
    if let Ok(entries) = fs::read_dir(dir) {
        for entry in entries.flatten() {
            if entry.path().is_file() { file_count += 1; }
        }
    }

    DirectoryNode {
        name,
        node_type: "dir".to_string(),
        children,
        file_count,
    }
}

fn find_entry_point(base: &Path, candidates: &[&str]) -> Option<String> {
    for candidate in candidates {
        if base.join(candidate).exists() {
            return Some(candidate.to_string());
        }
    }
    None
}

fn detect_directories(base: &Path) -> Vec<DirectoryInfo> {
    let mut dirs = Vec::new();
    let entries = match fs::read_dir(base) {
        Ok(e) => e,
        Err(_) => return dirs,
    };

    for entry in entries.flatten() {
        let path = entry.path();
        if !path.is_dir() { continue; }
        let name = entry.file_name().to_string_lossy().to_string();
        if SKIP_DIRS.contains(&name.as_str()) || name.starts_with('.') { continue; }

        let purpose = infer_purpose(&name);
        let file_count = count_direct_files(&path);
        let child_dirs: Vec<String> = fs::read_dir(&path)
            .into_iter()
            .flat_map(|e| e.into_iter())
            .filter_map(|e| e.ok())
            .filter(|e| e.path().is_dir())
            .map(|e| e.file_name().to_string_lossy().to_string())
            .collect();

        let description = describe_directory(&name, purpose, &child_dirs)
            .map(|s| s.to_string());

        dirs.push(DirectoryInfo {
            path: name,
            purpose: purpose.to_string(),
            file_count,
            description,
        });
    }

    dirs.sort_by(|a, b| b.file_count.cmp(&a.file_count));
    dirs
}

fn count_direct_files(dir: &Path) -> usize {
    fs::read_dir(dir)
        .into_iter()
        .flat_map(|e| e.into_iter())
        .filter_map(|e| e.ok())
        .filter(|e| e.path().is_file())
        .count()
}

fn detect_environment(base: &Path) -> EnvironmentInfo {
    let mut node_version = None;
    let mut python_version = None;
    let mut required_tools = Vec::new();

    // Node version
    for f in &[".nvmrc", ".node-version"] {
        if let Ok(v) = fs::read_to_string(base.join(f)) {
            node_version = Some(v.trim().to_string());
            break;
        }
    }
    if node_version.is_none() {
        if let Ok(content) = fs::read_to_string(base.join("package.json")) {
            if let Ok(pkg) = serde_json::from_str::<serde_json::Value>(&content) {
                if let Some(engines) = pkg.get("engines").and_then(|e| e.get("node")) {
                    node_version = engines.as_str().map(|s| s.to_string());
                }
            }
        }
    }

    // Python version
    for f in &[".python-version", "runtime.txt"] {
        if let Ok(v) = fs::read_to_string(base.join(f)) {
            python_version = Some(v.trim().to_string());
            break;
        }
    }

    // Required tools
    if base.join("Dockerfile").exists() || base.join("docker-compose.yml").exists() || base.join("docker-compose.yaml").exists() {
        required_tools.push("docker".to_string());
    }
    if base.join("pnpm-lock.yaml").exists() { required_tools.push("pnpm".to_string()); }
    if base.join("yarn.lock").exists() { required_tools.push("yarn".to_string()); }
    if base.join("Cargo.toml").exists() { required_tools.push("cargo".to_string()); }
    if base.join("go.mod").exists() { required_tools.push("go".to_string()); }
    if base.join("Gemfile").exists() { required_tools.push("bundler".to_string()); }
    if base.join("pubspec.yaml").exists() { required_tools.push("flutter".to_string()); }
    if base.join("mix.exs").exists() { required_tools.push("mix".to_string()); }

    // asdf
    if base.join(".tool-versions").exists() {
        required_tools.push("asdf".to_string());
    }

    EnvironmentInfo {
        node_version,
        python_version,
        required_tools,
    }
}

fn analyze_inner(path: &str) -> Result<ProjectBrain, String> {
    let base = Path::new(path);
    if !base.exists() {
        return Err(format!("路径不存在: {}", path));
    }

    // Directory structure (max 4 levels deep)
    let structure = build_structure_tree(base, 0, 4);

    // Entry points
    let entry_points = EntryPoints {
        main: find_entry_point(base, MAIN_CANDIDATES),
        config: find_entry_point(base, CONFIG_CANDIDATES),
        test: find_entry_point(base, TEST_CANDIDATES),
        lint: find_entry_point(base, LINT_CANDIDATES),
    };

    // Directory purposes
    let directories = detect_directories(base);

    // Environment
    let environment = detect_environment(base);

    // Stats
    let mut stats = ScanStats {
        total_files: 0,
        source_files: 0,
        test_files: 0,
        lines_of_code: 0,
        lines_sampled: 0,
        language_files: std::collections::HashMap::new(),
    };
    count_files_recursive(base, 0, 6, &mut stats);

    let mut languages: Vec<LanguageStats> = stats.language_files.into_iter()
        .map(|(name, file_count)| LanguageStats {
            name,
            file_count,
            lines: None, // Per-language line counts not tracked separately
        })
        .collect();
    languages.sort_by(|a, b| b.file_count.cmp(&a.file_count));

    let project_stats = ProjectStats {
        total_files: stats.total_files,
        source_files: stats.source_files,
        test_files: stats.test_files,
        lines_of_code: if stats.lines_of_code > 0 { Some(stats.lines_of_code) } else { None },
        languages,
    };

    Ok(ProjectBrain {
        structure,
        entry_points,
        directories,
        environment,
        stats: project_stats,
    })
}

// ── Tauri command ──

/// Analyze a project's structure and generate a ProjectBrain summary.
#[command]
pub async fn brain_analyze_project(
    db: State<'_, Database>,
    project_id: String,
) -> Result<ProjectBrain, String> {
    let project = db
        .query_one_json(
            "SELECT localPath FROM projects WHERE id = ?1",
            rusqlite::params![project_id],
        )
        .map_err(|e| e.to_string())?
        .ok_or("PROJECT_NOT_FOUND")?;

    let local_path = project
        .get("localPath")
        .and_then(|v| v.as_str())
        .ok_or("NO_LOCAL_PATH: 项目没有本地路径")?;

    analyze_inner(local_path)
}
