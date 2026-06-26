use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet, VecDeque};
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::LazyLock;
use tauri::command;
use tauri::State;

use crate::db::{new_id, Database};

const SKIP_DIRS: &[&str] = &[
    "node_modules", ".git", "target", "dist", "build", "out",
    "__pycache__", ".venv", "venv", ".env", "coverage",
    ".next", ".nuxt", ".cache", ".gradle", ".idea", ".vscode",
    "Pods", ".pub-cache", ".dart_tool", ".turbo", ".parcel-cache",
];

const PARSEABLE_EXTENSIONS: &[&str] = &[
    "ts", "tsx", "mts", "cts", "js", "jsx", "mjs", "cjs",
    "rs", "py", "go",
];

// ── Types ──

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GraphNode {
    pub id: String,
    pub project_id: String,
    pub file_path: String,
    pub file_name: String,
    pub language: String,
    pub directory: String,
    pub line_count: i32,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GraphEdge {
    pub id: String,
    pub project_id: String,
    pub source_node_id: String,
    pub target_node_id: String,
    pub import_path: String,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GraphData {
    pub nodes: Vec<GraphNode>,
    pub edges: Vec<GraphEdge>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GraphSummary {
    pub node_count: usize,
    pub edge_count: usize,
    pub language_counts: HashMap<String, usize>,
    pub scan_duration_ms: u128,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GraphStats {
    pub total_nodes: usize,
    pub total_edges: usize,
    pub orphan_files: Vec<String>,
    pub top_dependencies: Vec<FileDepCount>,
    pub top_importers: Vec<FileDepCount>,
    pub language_breakdown: HashMap<String, usize>,
    pub directory_breakdown: HashMap<String, usize>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FileDepCount {
    pub file_path: String,
    pub file_name: String,
    pub count: usize,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FeatureGroup {
    pub id: String,
    pub project_id: String,
    pub name: String,
    pub description: Option<String>,
    pub color: Option<String>,
    pub created_at: String,
    pub file_count: i64,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GroupMembership {
    pub group_id: String,
    pub node_id: String,
    pub color: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SuggestedGroup {
    pub name: String,
    pub reason: String,
    pub node_ids: Vec<String>,
    pub file_paths: Vec<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateGroupInput {
    pub name: String,
    pub description: Option<String>,
    pub color: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ImpactNode {
    pub id: String,
    pub file_path: String,
    pub file_name: String,
    pub depth: usize,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ImpactResult {
    pub impacted_nodes: Vec<ImpactNode>,
    pub direct_count: usize,
    pub indirect_count: usize,
    pub max_depth: usize,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChainNode {
    pub id: String,
    pub file_path: String,
    pub file_name: String,
    pub depth: usize,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChainEdge {
    pub source_id: String,
    pub target_id: String,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChainResult {
    pub chain_nodes: Vec<ChainNode>,
    pub chain_edges: Vec<ChainEdge>,
    pub max_depth: usize,
    pub direction: String,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LayerNode {
    pub id: String,
    pub file_path: String,
    pub file_name: String,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LayerInfo {
    pub level: usize,
    pub nodes: Vec<LayerNode>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CycleInfo {
    pub node_ids: Vec<String>,
    pub file_paths: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LayerResult {
    pub layers: Vec<LayerInfo>,
    pub cycles: Vec<CycleInfo>,
    pub total_nodes: usize,
}

// ── Language detection ──

fn ext_to_language(ext: &str) -> Option<&'static str> {
    match ext {
        "ts" | "tsx" | "mts" | "cts" => Some("TypeScript"),
        "js" | "jsx" | "mjs" | "cjs" => Some("JavaScript"),
        "rs" => Some("Rust"),
        "py" => Some("Python"),
        "go" => Some("Go"),
        "vue" => Some("Vue"),
        "svelte" => Some("Svelte"),
        "css" | "scss" | "less" => Some("CSS"),
        "html" | "htm" | "astro" => Some("HTML"),
        _ => None,
    }
}

// ── Directory walker ──

struct FileEntry {
    relative_path: String,
    file_name: String,
    language: String,
    directory: String,
    line_count: i32,
}

fn walk_project(root: &Path, dir: &Path, depth: usize, max_depth: usize, out: &mut Vec<FileEntry>) {
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
                walk_project(root, &path, depth + 1, max_depth, out);
            }
        } else if path.is_file() {
            if let Some(ext) = path.extension().and_then(|e| e.to_str()) {
                if PARSEABLE_EXTENSIONS.contains(&ext) {
                    if let Some(lang) = ext_to_language(ext) {
                        let relative = path.strip_prefix(root)
                            .unwrap_or(&path)
                            .to_string_lossy()
                            .replace('\\', "/");
                        let directory = path.parent()
                            .and_then(|p| p.strip_prefix(root).ok())
                            .map(|p| p.to_string_lossy().replace('\\', "/"))
                            .unwrap_or_default();
                        let line_count = fs::read_to_string(&path)
                            .map(|c| c.lines().count() as i32)
                            .unwrap_or(0);

                        out.push(FileEntry {
                            relative_path: relative,
                            file_name: name,
                            language: lang.to_string(),
                            directory,
                            line_count,
                        });
                    }
                }
            }
        }
    }
}

// ── Import extraction ──

// Pre-compiled regex patterns (compiled once at first use)
static RE_TS_IMPORT: LazyLock<regex::Regex> = LazyLock::new(|| {
    regex::Regex::new(r#"(?:(?:import|export)\s+(?:type\s+)?(?:[\s\S]*?\s+from\s+)?['"]([^'"]+)['"])"#).unwrap()
});
static RE_TS_REQUIRE: LazyLock<regex::Regex> = LazyLock::new(|| {
    regex::Regex::new(r#"require\s*\(\s*['"]([^'"]+)['"]\s*\)"#).unwrap()
});
static RE_TS_DYNAMIC: LazyLock<regex::Regex> = LazyLock::new(|| {
    regex::Regex::new(r#"import\s*\(\s*['"]([^'"]+)['"]\s*\)"#).unwrap()
});
static RE_RS_USE: LazyLock<regex::Regex> = LazyLock::new(|| {
    regex::Regex::new(r"(?:use\s+(?:crate|super|self)::([^;]+);)").unwrap()
});
static RE_RS_MOD: LazyLock<regex::Regex> = LazyLock::new(|| {
    regex::Regex::new(r"(?:^|\n)\s*mod\s+(\w+)\s*;").unwrap()
});
static RE_PY_FROM: LazyLock<regex::Regex> = LazyLock::new(|| {
    regex::Regex::new(r"(?m)^\s*from\s+([\w.]+)\s+import").unwrap()
});
static RE_PY_IMPORT: LazyLock<regex::Regex> = LazyLock::new(|| {
    regex::Regex::new(r"(?m)^\s*import\s+([\w.]+)").unwrap()
});
static RE_GO_IMPORT_BLOCK: LazyLock<regex::Regex> = LazyLock::new(|| {
    regex::Regex::new(r#"import\s*\((?s)(.*?)\)"#).unwrap()
});
static RE_GO_IMPORT_LINE: LazyLock<regex::Regex> = LazyLock::new(|| {
    regex::Regex::new(r#""([^"]+)""#).unwrap()
});
static RE_GO_IMPORT_SINGLE: LazyLock<regex::Regex> = LazyLock::new(|| {
    regex::Regex::new(r#"import\s+"([^"]+)""#).unwrap()
});

fn extract_imports(content: &str, language: &str) -> Vec<String> {
    let mut imports = Vec::new();

    match language {
        "TypeScript" | "JavaScript" | "Vue" | "Svelte" => {
            for cap in RE_TS_IMPORT.captures_iter(content) {
                imports.push(cap[1].to_string());
            }
            for cap in RE_TS_REQUIRE.captures_iter(content) {
                imports.push(cap[1].to_string());
            }
            for cap in RE_TS_DYNAMIC.captures_iter(content) {
                imports.push(cap[1].to_string());
            }
        }
        "Rust" => {
            for cap in RE_RS_USE.captures_iter(content) {
                imports.push(cap[1].trim().to_string());
            }
            for cap in RE_RS_MOD.captures_iter(content) {
                imports.push(format!("mod:{}", &cap[1]));
            }
        }
        "Python" => {
            for cap in RE_PY_FROM.captures_iter(content) {
                imports.push(cap[1].to_string());
            }
            for cap in RE_PY_IMPORT.captures_iter(content) {
                imports.push(cap[1].to_string());
            }
        }
        "Go" => {
            for cap in RE_GO_IMPORT_BLOCK.captures_iter(content) {
                let block = &cap[1];
                for line_cap in RE_GO_IMPORT_LINE.captures_iter(block) {
                    imports.push(line_cap[1].to_string());
                }
            }
            for cap in RE_GO_IMPORT_SINGLE.captures_iter(content) {
                imports.push(cap[1].to_string());
            }
        }
        _ => {}
    }

    imports.sort();
    imports.dedup();
    imports
}

// ── tsconfig.json path alias resolution ──

#[derive(Deserialize)]
struct TsConfig {
    compiler_options: Option<TsCompilerOptions>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct TsCompilerOptions {
    paths: Option<HashMap<String, serde_json::Value>>,
    base_url: Option<String>,
}

/// Load path aliases from tsconfig.json.
/// Returns Vec of (alias_prefix, target_prefix) pairs.
/// e.g. [("@/*", "src/"), ("~utils", "src/utils/")]
fn load_tsconfig_paths(root: &Path) -> Vec<(String, String)> {
    let tsconfig_path = root.join("tsconfig.json");
    let content = match fs::read_to_string(&tsconfig_path) {
        Ok(c) => c,
        Err(_) => return Vec::new(),
    };

    let config: TsConfig = match serde_json::from_str(&content) {
        Ok(c) => c,
        Err(_) => return Vec::new(),
    };

    let compiler = match config.compiler_options {
        Some(c) => c,
        None => return Vec::new(),
    };

    let paths = match compiler.paths {
        Some(p) => p,
        None => return Vec::new(),
    };

    let base_url = compiler.base_url.unwrap_or_else(|| ".".to_string());
    let mut aliases = Vec::new();

    for (alias, targets) in &paths {
        // targets can be string or array — take first entry
        let target = match targets {
            serde_json::Value::String(s) => s.clone(),
            serde_json::Value::Array(arr) => {
                arr.first().and_then(|v| v.as_str()).unwrap_or("").to_string()
            }
            _ => continue,
        };

        if target.is_empty() {
            continue;
        }

        // Normalize: alias "@/*" → prefix "@", target "src/*" → "src/"
        let prefix = alias.trim_end_matches('*').to_string();
        let target_prefix = target.trim_end_matches('*').to_string();

        // Resolve base_url relative to project root
        let resolved_base = if base_url == "." || base_url.is_empty() {
            String::new()
        } else {
            format!("{}/", base_url.trim_end_matches('/'))
        };

        aliases.push((prefix, format!("{}{}", resolved_base, target_prefix)));
    }

    aliases
}

// ── Path resolution ──

/// Resolve a TypeScript/JavaScript import path to a project-relative file path.
/// Tries exact match, common extensions, and index files.
fn resolve_ts_import(
    import_path: &str,
    source_dir: &str,
    project_root: &Path,
    path_to_id: &HashMap<String, String>,
) -> Option<String> {
    let base = if source_dir.is_empty() {
        project_root.join(import_path)
    } else {
        project_root.join(source_dir).join(import_path)
    };

    let normalized = normalize_path(&base)?;
    let relative = normalized.strip_prefix(project_root).ok()?;
    let rel_str = relative.to_string_lossy().replace('\\', "/");

    if path_to_id.contains_key(&rel_str) {
        return Some(rel_str);
    }

    for ext in &[".ts", ".tsx", ".js", ".jsx", ".mts", ".mjs"] {
        let with_ext = format!("{}{}", rel_str, ext);
        if path_to_id.contains_key(&with_ext) {
            return Some(with_ext);
        }
    }

    for ext in &[".ts", ".tsx", ".js", ".jsx"] {
        let idx = format!("{}/index{}", rel_str, ext);
        if path_to_id.contains_key(&idx) {
            return Some(idx);
        }
    }

    None
}

fn resolve_import(
    import_path: &str,
    source_dir: &str,
    language: &str,
    project_root: &Path,
    path_to_id: &HashMap<String, String>,
    path_aliases: &[(String, String)],
) -> Option<String> {
    match language {
        "TypeScript" | "JavaScript" | "Vue" | "Svelte" => {
            // Try alias resolution first for non-relative imports
            if !import_path.starts_with('.') {
                for (alias_prefix, target_prefix) in path_aliases {
                    if let Some(rest) = import_path.strip_prefix(alias_prefix) {
                        let resolved = format!("{}{}", target_prefix, rest);
                        if let Some(found) = resolve_ts_import(&resolved, source_dir, project_root, path_to_id) {
                            return Some(found);
                        }
                    }
                }
                return None;
            }

            return resolve_ts_import(import_path, source_dir, project_root, path_to_id)
        }
        "Rust" => {
            if let Some(mod_name) = import_path.strip_prefix("mod:") {
                for candidate in &[format!("{}.rs", mod_name), format!("{}/mod.rs", mod_name)] {
                    let full = if source_dir.is_empty() {
                        format!("src/{}", candidate)
                    } else {
                        format!("{}/{}", source_dir, candidate)
                    };
                    if path_to_id.contains_key(&full) {
                        return Some(full);
                    }
                }
            } else {
                let parts: Vec<&str> = import_path.split("::").collect();
                let path_part = parts.join("/");

                for candidate in &[format!("{}.rs", path_part), format!("{}/mod.rs", path_part)] {
                    let full = format!("src/{}", candidate);
                    if path_to_id.contains_key(&full) {
                        return Some(full);
                    }
                }

                if import_path.starts_with("super::") {
                    if let Some(parent_dir) = Path::new(source_dir).parent() {
                        let rest = import_path.strip_prefix("super::").unwrap_or(import_path);
                        let rest_path = rest.replace("::", "/");
                        for candidate in &[format!("{}.rs", rest_path), format!("{}/mod.rs", rest_path)] {
                            let full = format!("{}/{}", parent_dir.to_string_lossy().replace('\\', "/"), candidate);
                            if path_to_id.contains_key(&full) {
                                return Some(full);
                            }
                        }
                    }
                }
            }
        }
        "Python" => {
            if import_path.starts_with('.') { return None; }

            let path_part = import_path.replace('.', "/");
            for candidate in &[format!("{}.py", path_part), format!("{}/__init__.py", path_part)] {
                if path_to_id.contains_key(candidate) {
                    return Some(candidate.clone());
                }
            }
        }
        "Go" => {
            if let Ok(go_mod) = fs::read_to_string(project_root.join("go.mod")) {
                if let Some(module_line) = go_mod.lines().find(|l| l.starts_with("module ")) {
                    let module_name = module_line.trim_start_matches("module ").trim();
                    if import_path.starts_with(module_name) {
                        let local = import_path.strip_prefix(module_name)
                            .unwrap_or(import_path)
                            .trim_start_matches('/');
                        if !local.is_empty() {
                            let candidate = format!("{}.go", local);
                            if path_to_id.contains_key(&candidate) {
                                return Some(candidate);
                            }
                            let dir_candidate = format!("{}/{}.go", local, local.split('/').last().unwrap_or(local));
                            if path_to_id.contains_key(&dir_candidate) {
                                return Some(dir_candidate);
                            }
                        }
                    }
                }
            }
        }
        _ => {}
    }
    None
}

fn normalize_path(path: &Path) -> Option<PathBuf> {
    let mut components = Vec::new();
    for comp in path.components() {
        match comp {
            std::path::Component::ParentDir => { components.pop(); }
            std::path::Component::CurDir => {}
            other => components.push(other),
        }
    }
    Some(components.iter().collect::<PathBuf>())
}

// ── Core scan ──

fn scan_project_graph(root: &Path, project_id: &str) -> (Vec<GraphNode>, Vec<GraphEdge>) {
    let mut files = Vec::new();
    walk_project(root, root, 0, 8, &mut files);

    let path_to_node_id: HashMap<String, String> = files.iter()
        .map(|f| (f.relative_path.clone(), new_id()))
        .collect();

    let mut nodes = Vec::new();
    for f in &files {
        let id = path_to_node_id.get(&f.relative_path).cloned().unwrap_or_default();
        nodes.push(GraphNode {
            id,
            project_id: project_id.to_string(),
            file_path: f.relative_path.clone(),
            file_name: f.file_name.clone(),
            language: f.language.clone(),
            directory: f.directory.clone(),
            line_count: f.line_count,
        });
    }

    let mut edges = Vec::new();
    let path_aliases = load_tsconfig_paths(root);
    for f in &files {
        let source_id = match path_to_node_id.get(&f.relative_path) {
            Some(id) => id.clone(),
            None => continue,
        };

        let content = match fs::read_to_string(root.join(&f.relative_path)) {
            Ok(c) => c,
            Err(_) => continue,
        };

        let imports = extract_imports(&content, &f.language);
        let mut seen_targets = HashSet::new();

        for import_path in imports {
            if let Some(target_rel) = resolve_import(&import_path, &f.directory, &f.language, root, &path_to_node_id, &path_aliases) {
                if let Some(target_id) = path_to_node_id.get(&target_rel) {
                    let edge_key = format!("{}->{}", source_id, target_id);
                    if seen_targets.insert(edge_key) {
                        edges.push(GraphEdge {
                            id: new_id(),
                            project_id: project_id.to_string(),
                            source_node_id: source_id.clone(),
                            target_node_id: target_id.clone(),
                            import_path,
                        });
                    }
                }
            }
        }
    }

    (nodes, edges)
}

// ── Commands ──

#[command]
pub async fn graph_scan_project(
    db: State<'_, Database>,
    project_id: String,
) -> Result<GraphSummary, String> {
    let local_path = get_project_path(&db, &project_id)?;

    // Save group-to-filePath associations before deleting nodes
    let group_file_rows = db
        .query_json(
            "SELECT fgf.groupId as groupId, gn.filePath as filePath \
             FROM feature_group_files fgf \
             JOIN graph_nodes gn ON fgf.nodeId = gn.id \
             WHERE gn.projectId = ?1",
            rusqlite::params![project_id],
        )
        .map_err(|e| e.to_string())?;
    let saved_group_files: Vec<(String, String)> = group_file_rows
        .as_array()
        .map(|arr| {
            arr.iter()
                .filter_map(|v| {
                    let gid = v.get("groupId")?.as_str()?.to_string();
                    let fp = v.get("filePath")?.as_str()?.to_string();
                    Some((gid, fp))
                })
                .collect()
        })
        .unwrap_or_default();

    db.execute("DELETE FROM graph_edges WHERE projectId = ?1", rusqlite::params![project_id])
        .map_err(|e| e.to_string())?;
    db.execute("DELETE FROM graph_nodes WHERE projectId = ?1", rusqlite::params![project_id])
        .map_err(|e| e.to_string())?;

    let pid = project_id.clone();
    let start = std::time::Instant::now();
    let (nodes, edges) = tokio::task::spawn_blocking(move || {
        scan_project_graph(Path::new(&local_path), &pid)
    })
    .await
    .map_err(|e| format!("Scan task failed: {}", e))?;
    let duration = start.elapsed().as_millis();

    let mut language_counts = HashMap::new();
    for n in &nodes {
        *language_counts.entry(n.language.clone()).or_insert(0) += 1;
    }

    // Wrap batch inserts in a transaction for performance
    db.execute("BEGIN", &[]).map_err(|e| e.to_string())?;

    for n in &nodes {
        if let Err(e) = db.execute(
            "INSERT INTO graph_nodes (id, projectId, filePath, fileName, language, directory, lineCount) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            rusqlite::params![n.id, n.project_id, n.file_path, n.file_name, n.language, n.directory, n.line_count],
        ) {
            let _ = db.execute("ROLLBACK", &[]);
            return Err(e.to_string());
        }
    }

    for e in &edges {
        if let Err(e) = db.execute(
            "INSERT INTO graph_edges (id, projectId, sourceNodeId, targetNodeId, importPath) VALUES (?1, ?2, ?3, ?4, ?5)",
            rusqlite::params![e.id, e.project_id, e.source_node_id, e.target_node_id, e.import_path],
        ) {
            let _ = db.execute("ROLLBACK", &[]);
            return Err(e.to_string());
        }
    }

    db.execute("COMMIT", &[]).map_err(|e| e.to_string())?;

    // Re-associate feature groups with new node IDs by matching filePath
    if !saved_group_files.is_empty() {
        let new_path_to_id: HashMap<String, String> = nodes.iter()
            .map(|n| (n.file_path.clone(), n.id.clone()))
            .collect();
        for (group_id, file_path) in &saved_group_files {
            if let Some(new_node_id) = new_path_to_id.get(file_path) {
                let fgf_id = new_id();
                let _ = db.execute(
                    "INSERT OR IGNORE INTO feature_group_files (id, groupId, nodeId) VALUES (?1, ?2, ?3)",
                    rusqlite::params![fgf_id, group_id, new_node_id],
                );
            }
        }
    }

    Ok(GraphSummary {
        node_count: nodes.len(),
        edge_count: edges.len(),
        language_counts,
        scan_duration_ms: duration,
    })
}

#[command]
pub async fn graph_get(
    db: State<'_, Database>,
    project_id: String,
) -> Result<GraphData, String> {
    let nodes_json = db
        .query_json(
            "SELECT id, projectId, filePath, fileName, language, directory, lineCount FROM graph_nodes WHERE projectId = ?1 ORDER BY filePath",
            rusqlite::params![project_id],
        )
        .map_err(|e| e.to_string())?;

    let edges_json = db
        .query_json(
            "SELECT id, projectId, sourceNodeId, targetNodeId, importPath FROM graph_edges WHERE projectId = ?1",
            rusqlite::params![project_id],
        )
        .map_err(|e| e.to_string())?;

    let mut nodes = Vec::new();
    if let Some(arr) = nodes_json.as_array() {
        for v in arr {
            nodes.push(parse_node(v));
        }
    }

    let mut edges = Vec::new();
    if let Some(arr) = edges_json.as_array() {
        for v in arr {
            edges.push(GraphEdge {
                id: v.get("id").and_then(|x| x.as_str()).unwrap_or_default().to_string(),
                project_id: v.get("projectId").and_then(|x| x.as_str()).unwrap_or_default().to_string(),
                source_node_id: v.get("sourceNodeId").and_then(|x| x.as_str()).unwrap_or_default().to_string(),
                target_node_id: v.get("targetNodeId").and_then(|x| x.as_str()).unwrap_or_default().to_string(),
                import_path: v.get("importPath").and_then(|x| x.as_str()).unwrap_or_default().to_string(),
            });
        }
    }

    Ok(GraphData { nodes, edges })
}

#[command]
pub async fn graph_get_stats(
    db: State<'_, Database>,
    project_id: String,
) -> Result<GraphStats, String> {
    let data = graph_get(db, project_id).await?;
    Ok(compute_stats(data))
}

#[command]
pub async fn graph_compute_impact(
    db: State<'_, Database>,
    project_id: String,
    node_ids: Vec<String>,
) -> Result<ImpactResult, String> {
    if node_ids.is_empty() {
        return Ok(ImpactResult {
            impacted_nodes: Vec::new(),
            direct_count: 0,
            indirect_count: 0,
            max_depth: 0,
        });
    }

    let data = graph_get(db, project_id).await?;

    // Build reverse adjacency map: target -> [sources that depend on it]
    // Edge semantics: source_node_id imports target_node_id
    // Reverse: if A imports B, then B's change impacts A
    let mut reverse_adj: HashMap<String, Vec<String>> = HashMap::new();
    for edge in &data.edges {
        reverse_adj
            .entry(edge.target_node_id.clone())
            .or_default()
            .push(edge.source_node_id.clone());
    }

    let id_to_node: HashMap<&str, &GraphNode> = data.nodes.iter()
        .map(|n| (n.id.as_str(), n))
        .collect();

    let selected: HashSet<String> = node_ids.iter().cloned().collect();

    // BFS along reverse edges from selected nodes
    let mut visited: HashMap<String, usize> = HashMap::new();
    let mut queue: VecDeque<(String, usize)> = VecDeque::new();

    for id in &node_ids {
        visited.insert(id.clone(), 0);
        queue.push_back((id.clone(), 0));
    }

    let mut max_depth: usize = 0;

    while let Some((current, depth)) = queue.pop_front() {
        if depth > 20 {
            continue;
        }

        if let Some(neighbors) = reverse_adj.get(&current) {
            let next_depth = depth + 1;
            for neighbor in neighbors {
                if !visited.contains_key(neighbor) {
                    visited.insert(neighbor.clone(), next_depth);
                    if next_depth > max_depth {
                        max_depth = next_depth;
                    }
                    queue.push_back((neighbor.clone(), next_depth));
                }
            }
        }
    }

    // Build results, excluding the selected nodes themselves
    let mut impacted_nodes: Vec<ImpactNode> = visited
        .iter()
        .filter(|(id, _)| !selected.contains(*id))
        .filter_map(|(id, &d)| {
            let node = id_to_node.get(id.as_str())?;
            Some(ImpactNode {
                id: id.clone(),
                file_path: node.file_path.clone(),
                file_name: node.file_name.clone(),
                depth: d,
            })
        })
        .collect();

    // Sort by depth then filePath
    impacted_nodes.sort_by(|a, b| {
        a.depth.cmp(&b.depth).then_with(|| a.file_path.cmp(&b.file_path))
    });

    let direct_count = impacted_nodes.iter().filter(|n| n.depth == 1).count();
    let indirect_count = impacted_nodes.iter().filter(|n| n.depth > 1).count();

    // max_depth should reflect actual max in results (may be 0 if no dependents)
    let result_max_depth = impacted_nodes.iter().map(|n| n.depth).max().unwrap_or(0);

    Ok(ImpactResult {
        impacted_nodes,
        direct_count,
        indirect_count,
        max_depth: result_max_depth,
    })
}

#[command]
pub async fn graph_trace_chain(
    db: State<'_, Database>,
    project_id: String,
    node_id: String,
    direction: String,
    max_depth: Option<usize>,
) -> Result<ChainResult, String> {
    let depth_limit = max_depth.unwrap_or(10);
    let graph = graph_get(db, project_id).await?;

    // Build id→node lookup
    let id_to_node: HashMap<&str, &GraphNode> = graph
        .nodes
        .iter()
        .map(|n| (n.id.as_str(), n))
        .collect();

    // Verify start node exists
    if !id_to_node.contains_key(node_id.as_str()) {
        return Ok(ChainResult {
            chain_nodes: Vec::new(),
            chain_edges: Vec::new(),
            max_depth: 0,
            direction,
        });
    }

    // Build adjacency based on direction
    // "backward": target → [sources] (who imports this file)
    // "forward" (default): source → [targets] (what does this file import)
    let is_backward = direction == "backward";
    let mut adj: HashMap<String, Vec<String>> = HashMap::new();
    for edge in &graph.edges {
        if is_backward {
            adj.entry(edge.target_node_id.clone())
                .or_default()
                .push(edge.source_node_id.clone());
        } else {
            adj.entry(edge.source_node_id.clone())
                .or_default()
                .push(edge.target_node_id.clone());
        }
    }

    // BFS
    let mut visited: HashMap<String, usize> = HashMap::new();
    let mut chain_edges: Vec<ChainEdge> = Vec::new();
    let mut queue = VecDeque::new();
    let mut actual_max_depth: usize = 0;

    visited.insert(node_id.clone(), 0);
    queue.push_back((node_id.clone(), 0usize));

    while let Some((current, depth)) = queue.pop_front() {
        if depth >= depth_limit {
            continue;
        }

        if let Some(neighbors) = adj.get(&current) {
            let next_depth = depth + 1;
            for neighbor in neighbors {
                if !visited.contains_key(neighbor) {
                    visited.insert(neighbor.clone(), next_depth);
                    if next_depth > actual_max_depth {
                        actual_max_depth = next_depth;
                    }

                    // Record edge matching the traversal direction
                    if is_backward {
                        // neighbor imports current
                        chain_edges.push(ChainEdge {
                            source_id: neighbor.clone(),
                            target_id: current.clone(),
                        });
                    } else {
                        // current imports neighbor
                        chain_edges.push(ChainEdge {
                            source_id: current.clone(),
                            target_id: neighbor.clone(),
                        });
                    }

                    queue.push_back((neighbor.clone(), next_depth));
                }
            }
        }
    }

    // Build result nodes
    let mut chain_nodes: Vec<ChainNode> = visited
        .iter()
        .filter_map(|(id, &d)| {
            let node = id_to_node.get(id.as_str())?;
            Some(ChainNode {
                id: id.clone(),
                file_path: node.file_path.clone(),
                file_name: node.file_name.clone(),
                depth: d,
            })
        })
        .collect();

    chain_nodes.sort_by(|a, b| a.depth.cmp(&b.depth).then_with(|| a.file_path.cmp(&b.file_path)));

    Ok(ChainResult {
        chain_nodes,
        chain_edges,
        max_depth: actual_max_depth,
        direction,
    })
}

#[command]
pub async fn graph_compute_layers(
    db: State<'_, Database>,
    project_id: String,
) -> Result<LayerResult, String> {
    let data = graph_get(db, project_id).await?;

    let total_nodes = data.nodes.len();

    let id_to_node: HashMap<&str, &GraphNode> = data
        .nodes
        .iter()
        .map(|n| (n.id.as_str(), n))
        .collect();

    // Build in-degree map and adjacency (source → [targets])
    let mut in_degree: HashMap<String, usize> = HashMap::new();
    let mut adj: HashMap<String, Vec<String>> = HashMap::new();

    for n in &data.nodes {
        in_degree.entry(n.id.clone()).or_insert(0);
    }
    for edge in &data.edges {
        in_degree
            .entry(edge.target_node_id.clone())
            .and_modify(|d| *d += 1)
            .or_insert(1);
        adj.entry(edge.source_node_id.clone())
            .or_default()
            .push(edge.target_node_id.clone());
    }

    // Kahn's algorithm
    let mut layers: Vec<LayerInfo> = Vec::new();
    let mut assigned: HashSet<String> = HashSet::new();
    let mut current_zero: VecDeque<String> = in_degree
        .iter()
        .filter(|(_, &d)| d == 0)
        .map(|(id, _)| id.clone())
        .collect();

    for level in 0..100 {
        if current_zero.is_empty() {
            break;
        }

        let mut layer_nodes: Vec<LayerNode> = Vec::new();
        let mut next_zero: VecDeque<String> = VecDeque::new();

        while let Some(node_id) = current_zero.pop_front() {
            assigned.insert(node_id.clone());

            if let Some(node) = id_to_node.get(node_id.as_str()) {
                layer_nodes.push(LayerNode {
                    id: node_id.clone(),
                    file_path: node.file_path.clone(),
                    file_name: node.file_name.clone(),
                });
            }

            // Decrease in-degree of neighbors
            if let Some(targets) = adj.get(&node_id) {
                for target in targets {
                    if let Some(deg) = in_degree.get_mut(target) {
                        *deg -= 1;
                        if *deg == 0 && !assigned.contains(target) {
                            next_zero.push_back(target.clone());
                        }
                    }
                }
            }
        }

        layer_nodes.sort_by(|a, b| a.file_path.cmp(&b.file_path));
        layers.push(LayerInfo {
            level,
            nodes: layer_nodes,
        });

        current_zero = next_zero;
    }

    // Cycle detection: any nodes not assigned are in cycles
    let cycles = if assigned.len() < total_nodes {
        let unassigned_node_ids: Vec<String> = data
            .nodes
            .iter()
            .filter(|n| !assigned.contains(&n.id))
            .map(|n| n.id.clone())
            .collect();
        let unassigned_file_paths: Vec<String> = data
            .nodes
            .iter()
            .filter(|n| !assigned.contains(&n.id))
            .map(|n| n.file_path.clone())
            .collect();
        vec![CycleInfo {
            node_ids: unassigned_node_ids,
            file_paths: unassigned_file_paths,
        }]
    } else {
        Vec::new()
    };

    Ok(LayerResult {
        layers,
        cycles,
        total_nodes,
    })
}

// ── Feature Group commands ──

#[command]
pub async fn graph_create_group(
    db: State<'_, Database>,
    project_id: String,
    data: CreateGroupInput,
) -> Result<FeatureGroup, String> {
    let id = new_id();
    db.execute(
        "INSERT INTO feature_groups (id, projectId, name, description, color) VALUES (?1, ?2, ?3, ?4, ?5)",
        rusqlite::params![id, project_id, data.name, data.description, data.color],
    ).map_err(|e| e.to_string())?;

    let row = db
        .query_one_json(
            "SELECT id, projectId, name, description, color, createdAt FROM feature_groups WHERE id = ?1",
            rusqlite::params![id],
        )
        .map_err(|e| e.to_string())?
        .ok_or("Group not found after insert")?;

    Ok(FeatureGroup {
        id: row.get("id").and_then(|v| v.as_str()).unwrap_or_default().to_string(),
        project_id: row.get("projectId").and_then(|v| v.as_str()).unwrap_or_default().to_string(),
        name: row.get("name").and_then(|v| v.as_str()).unwrap_or_default().to_string(),
        description: row.get("description").and_then(|v| v.as_str()).map(|s| s.to_string()),
        color: row.get("color").and_then(|v| v.as_str()).map(|s| s.to_string()),
        created_at: row.get("createdAt").and_then(|v| v.as_str()).unwrap_or_default().to_string(),
        file_count: 0,
    })
}

#[command]
pub async fn graph_delete_group(
    db: State<'_, Database>,
    group_id: String,
) -> Result<(), String> {
    db.execute("DELETE FROM feature_groups WHERE id = ?1", rusqlite::params![group_id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[command]
pub async fn graph_list_groups(
    db: State<'_, Database>,
    project_id: String,
) -> Result<Vec<FeatureGroup>, String> {
    let rows = db
        .query_json(
            "SELECT fg.id, fg.projectId, fg.name, fg.description, fg.color, fg.createdAt, \
             (SELECT COUNT(*) FROM feature_group_files WHERE groupId = fg.id) as fileCount \
             FROM feature_groups fg WHERE fg.projectId = ?1 ORDER BY fg.name",
            rusqlite::params![project_id],
        )
        .map_err(|e| e.to_string())?;

    let mut groups = Vec::new();
    if let Some(arr) = rows.as_array() {
        for v in arr {
            groups.push(FeatureGroup {
                id: v.get("id").and_then(|x| x.as_str()).unwrap_or_default().to_string(),
                project_id: v.get("projectId").and_then(|x| x.as_str()).unwrap_or_default().to_string(),
                name: v.get("name").and_then(|x| x.as_str()).unwrap_or_default().to_string(),
                description: v.get("description").and_then(|x| x.as_str()).map(|s| s.to_string()),
                color: v.get("color").and_then(|x| x.as_str()).map(|s| s.to_string()),
                created_at: v.get("createdAt").and_then(|x| x.as_str()).unwrap_or_default().to_string(),
                file_count: v.get("fileCount").and_then(|x| x.as_i64()).unwrap_or(0),
            });
        }
    }
    Ok(groups)
}

#[command]
pub async fn graph_add_files_to_group(
    db: State<'_, Database>,
    group_id: String,
    node_ids: Vec<String>,
) -> Result<usize, String> {
    let mut count: usize = 0;
    for node_id in &node_ids {
        let id = new_id();
        let result = db.execute(
            "INSERT OR IGNORE INTO feature_group_files (id, groupId, nodeId) VALUES (?1, ?2, ?3)",
            rusqlite::params![id, group_id, node_id],
        ).map_err(|e| e.to_string())?;
        count += result as usize;
    }
    Ok(count)
}

#[command]
pub async fn graph_remove_file_from_group(
    db: State<'_, Database>,
    group_id: String,
    node_id: String,
) -> Result<(), String> {
    db.execute(
        "DELETE FROM feature_group_files WHERE groupId = ?1 AND nodeId = ?2",
        rusqlite::params![group_id, node_id],
    ).map_err(|e| e.to_string())?;
    Ok(())
}

#[command]
pub async fn graph_get_group_memberships(
    db: State<'_, Database>,
    project_id: String,
) -> Result<Vec<GroupMembership>, String> {
    let rows = db
        .query_json(
            "SELECT fgf.groupId as groupId, fgf.nodeId as nodeId, fg.color as color \
             FROM feature_group_files fgf \
             JOIN feature_groups fg ON fgf.groupId = fg.id \
             WHERE fg.projectId = ?1",
            rusqlite::params![project_id],
        )
        .map_err(|e| e.to_string())?;

    let mut memberships = Vec::new();
    if let Some(arr) = rows.as_array() {
        for v in arr {
            memberships.push(GroupMembership {
                group_id: v.get("groupId").and_then(|x| x.as_str()).unwrap_or_default().to_string(),
                node_id: v.get("nodeId").and_then(|x| x.as_str()).unwrap_or_default().to_string(),
                color: v.get("color").and_then(|x| x.as_str()).map(|s| s.to_string()),
            });
        }
    }
    Ok(memberships)
}

#[command]
pub async fn graph_suggest_groups(
    db: State<'_, Database>,
    project_id: String,
) -> Result<Vec<SuggestedGroup>, String> {
    let data = graph_get(db, project_id).await?;

    let mut suggestions = Vec::new();

    // Pass 1: Directory-based clustering
    let mut dir_nodes: HashMap<String, Vec<&GraphNode>> = HashMap::new();
    for node in &data.nodes {
        let dir = &node.directory;
        // Skip root and too-generic dirs
        let parts: Vec<&str> = dir.split('/').filter(|s| !s.is_empty()).collect();
        if parts.is_empty() { continue; }
        let skip_names = ["src", "lib", "utils", "common", "shared", "helpers", "core", "index", "mod"];
        let key = if parts.len() >= 2 && skip_names.contains(&parts[0]) {
            parts[1].to_string()
        } else {
            parts[0].to_string()
        };
        dir_nodes.entry(key).or_default().push(node);
    }
    for (dir_name, nodes) in &dir_nodes {
        if nodes.len() >= 3 && nodes.len() <= 30 {
            suggestions.push(SuggestedGroup {
                name: dir_name.clone(),
                reason: format!("Directory: {} ({} files)", nodes[0].directory, nodes.len()),
                node_ids: nodes.iter().map(|n| n.id.clone()).collect(),
                file_paths: nodes.iter().map(|n| n.file_path.clone()).collect(),
            });
        }
    }

    // Pass 2: Weakly connected components (Union-Find)
    let node_ids: Vec<&str> = data.nodes.iter().map(|n| n.id.as_str()).collect();
    let id_index: HashMap<&str, usize> = node_ids.iter().enumerate().map(|(i, id)| (*id, i)).collect();
    let n = node_ids.len();
    if n > 0 {
        let mut parent: Vec<usize> = (0..n).collect();
        let mut rank = vec![0usize; n];
        fn find(parent: &mut [usize], x: usize) -> usize {
            if parent[x] != x { parent[x] = find(parent, parent[x]); }
            parent[x]
        }
        for e in &data.edges {
            if let (Some(&si), Some(&ti)) = (id_index.get(e.source_node_id.as_str()), id_index.get(e.target_node_id.as_str())) {
                let rs = find(&mut parent, si);
                let rt = find(&mut parent, ti);
                if rs != rt {
                    if rank[rs] < rank[rt] { parent[rs] = rt; }
                    else if rank[rs] > rank[rt] { parent[rt] = rs; }
                    else { parent[rt] = rs; rank[rs] += 1; }
                }
            }
        }
        let mut components: HashMap<usize, Vec<usize>> = HashMap::new();
        for i in 0..n { components.entry(find(&mut parent, i)).or_default().push(i); }
        let id_to_node: HashMap<&str, &GraphNode> = data.nodes.iter().map(|n| (n.id.as_str(), n)).collect();
        for comp in components.values() {
            if comp.len() >= 3 && comp.len() <= 20 {
                let comp_nodes: Vec<&GraphNode> = comp.iter().filter_map(|&i| id_to_node.get(node_ids[i]).copied()).collect();
                // Find most common directory prefix
                let mut dir_counts: HashMap<&str, usize> = HashMap::new();
                for nd in &comp_nodes {
                    let top = nd.directory.split('/').filter(|s| !s.is_empty()).next().unwrap_or("");
                    *dir_counts.entry(top).or_insert(0) += 1;
                }
                let best_dir = dir_counts.iter().max_by_key(|(_, c)| *c).map(|(d, _)| *d).unwrap_or("module");
                // Check overlap with existing directory suggestions
                let comp_paths: HashSet<&str> = comp_nodes.iter().map(|n| n.file_path.as_str()).collect();
                let overlaps = suggestions.iter().any(|s| {
                    let existing: HashSet<&str> = s.file_paths.iter().map(|p| p.as_str()).collect();
                    let overlap = comp_paths.intersection(&existing).count();
                    overlap as f64 / comp_paths.len() as f64 > 0.8
                });
                if !overlaps {
                    suggestions.push(SuggestedGroup {
                        name: format!("{} (related)", best_dir),
                        reason: format!("Connected component: {} files with dense internal imports", comp_nodes.len()),
                        node_ids: comp_nodes.iter().map(|n| n.id.clone()).collect(),
                        file_paths: comp_nodes.iter().map(|n| n.file_path.clone()).collect(),
                    });
                }
            }
        }
    }

    // Pass 3: Keyword prefix matching
    let mut prefix_groups: HashMap<String, Vec<&GraphNode>> = HashMap::new();
    for node in &data.nodes {
        let stem = node.file_name.rsplit_once('.').map(|(s, _)| s).unwrap_or(&node.file_name);
        let lower = stem.to_lowercase();
        // Try prefixes of length 3..6
        for len in (3..=lower.len().min(8)).rev() {
            let prefix = &lower[..len];
            // Skip if prefix is a generic word
            if ["test", "spec", "index", "util", "type", "const", "hook"].contains(&prefix) { continue; }
            prefix_groups.entry(prefix.to_string()).or_default().push(node);
        }
    }
    let mut seen_keyword = HashSet::new();
    for (prefix, nodes) in &prefix_groups {
        if nodes.len() >= 3 && !seen_keyword.contains(prefix) {
            let paths: HashSet<&str> = nodes.iter().map(|n| n.file_path.as_str()).collect();
            let overlaps = suggestions.iter().any(|s| {
                let existing: HashSet<&str> = s.file_paths.iter().map(|p| p.as_str()).collect();
                let overlap = paths.intersection(&existing).count();
                overlap as f64 / paths.len() as f64 > 0.7
            });
            if !overlaps {
                seen_keyword.insert(prefix.clone());
                suggestions.push(SuggestedGroup {
                    name: format!("{}*", prefix),
                    reason: format!("Keyword pattern: {} files share \"{}\" prefix", nodes.len(), prefix),
                    node_ids: nodes.iter().map(|n| n.id.clone()).collect(),
                    file_paths: nodes.iter().map(|n| n.file_path.clone()).collect(),
                });
            }
        }
    }

    suggestions.truncate(10);
    Ok(suggestions)
}

// ── Helpers ──

fn get_project_path(db: &Database, project_id: &str) -> Result<String, String> {
    let project = db
        .query_one_json(
            "SELECT localPath FROM projects WHERE id = ?1",
            rusqlite::params![project_id],
        )
        .map_err(|e| e.to_string())?
        .ok_or("PROJECT_NOT_FOUND")?;

    project
        .get("localPath")
        .and_then(|v| v.as_str())
        .filter(|s| !s.is_empty())
        .map(|s| s.to_string())
        .ok_or("NO_LOCAL_PATH: Project has no local path".to_string())
}

fn parse_node(v: &serde_json::Value) -> GraphNode {
    GraphNode {
        id: v.get("id").and_then(|x| x.as_str()).unwrap_or_default().to_string(),
        project_id: v.get("projectId").and_then(|x| x.as_str()).unwrap_or_default().to_string(),
        file_path: v.get("filePath").and_then(|x| x.as_str()).unwrap_or_default().to_string(),
        file_name: v.get("fileName").and_then(|x| x.as_str()).unwrap_or_default().to_string(),
        language: v.get("language").and_then(|x| x.as_str()).unwrap_or_default().to_string(),
        directory: v.get("directory").and_then(|x| x.as_str()).unwrap_or_default().to_string(),
        line_count: v.get("lineCount").and_then(|x| x.as_i64()).unwrap_or(0) as i32,
    }
}

fn compute_stats(data: GraphData) -> GraphStats {
    let total_nodes = data.nodes.len();
    let total_edges = data.edges.len();

    let mut in_degree: HashMap<&str, usize> = HashMap::new();
    let mut out_degree: HashMap<&str, usize> = HashMap::new();
    for n in &data.nodes {
        in_degree.entry(&n.id).or_insert(0);
        out_degree.entry(&n.id).or_insert(0);
    }
    for e in &data.edges {
        *in_degree.entry(&e.target_node_id).or_insert(0) += 1;
        *out_degree.entry(&e.source_node_id).or_insert(0) += 1;
    }

    let id_to_file: HashMap<&str, (&str, &str)> = data.nodes.iter()
        .map(|n| (n.id.as_str(), (n.file_path.as_str(), n.file_name.as_str())))
        .collect();

    let orphan_files: Vec<String> = data.nodes.iter()
        .filter(|n| {
            in_degree.get(n.id.as_str()).copied().unwrap_or(0) == 0
                && out_degree.get(n.id.as_str()).copied().unwrap_or(0) == 0
        })
        .map(|n| n.file_path.clone())
        .collect();

    let mut top_dependencies: Vec<FileDepCount> = in_degree.iter()
        .filter(|(_, &count)| count > 0)
        .map(|(&id, &count)| {
            let (path, name) = id_to_file.get(id).unwrap_or(&("", ""));
            FileDepCount { file_path: path.to_string(), file_name: name.to_string(), count }
        })
        .collect();
    top_dependencies.sort_by(|a, b| b.count.cmp(&a.count));
    top_dependencies.truncate(20);

    let mut top_importers: Vec<FileDepCount> = out_degree.iter()
        .filter(|(_, &count)| count > 0)
        .map(|(&id, &count)| {
            let (path, name) = id_to_file.get(id).unwrap_or(&("", ""));
            FileDepCount { file_path: path.to_string(), file_name: name.to_string(), count }
        })
        .collect();
    top_importers.sort_by(|a, b| b.count.cmp(&a.count));
    top_importers.truncate(20);

    let mut language_breakdown: HashMap<String, usize> = HashMap::new();
    let mut directory_breakdown: HashMap<String, usize> = HashMap::new();
    for n in &data.nodes {
        *language_breakdown.entry(n.language.clone()).or_insert(0) += 1;
        *directory_breakdown.entry(n.directory.clone()).or_insert(0) += 1;
    }

    GraphStats {
        total_nodes,
        total_edges,
        orphan_files,
        top_dependencies,
        top_importers,
        language_breakdown,
        directory_breakdown,
    }
}

// ── AI Cache commands ──

#[command]
pub async fn graph_get_ai_cache(
    db: State<'_, Database>,
    project_id: String,
    cache_key: String,
) -> Result<Option<String>, String> {
    let row = db
        .query_one_json(
            "SELECT resultJson FROM graph_ai_cache WHERE projectId = ?1 AND cacheKey = ?2",
            rusqlite::params![project_id, cache_key],
        )
        .map_err(|e| e.to_string())?;

    Ok(row.and_then(|v| v.get("resultJson").and_then(|x| x.as_str()).map(|s| s.to_string())))
}

#[command]
pub async fn graph_set_ai_cache(
    db: State<'_, Database>,
    project_id: String,
    cache_key: String,
    result_json: String,
) -> Result<(), String> {
    let id = new_id();
    db.execute(
        "INSERT OR REPLACE INTO graph_ai_cache (id, projectId, cacheKey, resultJson) VALUES (?1, ?2, ?3, ?4)",
        rusqlite::params![id, project_id, cache_key, result_json],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

/// Resolve a file path to a graph node ID.
/// filePath in graph_nodes is project-relative with forward slashes.
/// Supports both absolute and relative paths — strips project root if needed.
fn resolve_file_node_id(db: &Database, project_id: &str, file_path: &str) -> Result<String, String> {
    let mut normalized = file_path.replace('\\', "/").trim_start_matches("./").to_string();

    // If path is absolute, strip the project root prefix to make it relative
    if let Ok(project_root) = get_project_path(db, project_id) {
        let root_normalized = project_root.replace('\\', "/");
        if normalized.starts_with(&root_normalized) {
            normalized = normalized[root_normalized.len()..].trim_start_matches('/').to_string();
        }
    }

    let rows = db.query_json(
        "SELECT id FROM graph_nodes WHERE projectId = ?1 AND filePath = ?2",
        rusqlite::params![project_id, normalized],
    ).map_err(|e| e.to_string())?;
    rows.as_array()
        .and_then(|arr| arr.first())
        .and_then(|v| v.get("id").and_then(|x| x.as_str()))
        .map(|s| s.to_string())
        .ok_or_else(|| format!("NODE_NOT_FOUND: No graph node for file '{}' (resolved to '{}')", file_path, normalized))
}

/// Unified graph query for Agent integration.
/// Supports impact, deps (chain), and layers analysis.
#[command]
pub async fn graph_query(
    db: State<'_, Database>,
    project_id: String,
    query_type: String,
    params: HashMap<String, String>,
) -> Result<serde_json::Value, String> {
    match query_type.as_str() {
        "impact" => {
            let file = params.get("file").ok_or("MISSING_PARAM: 'file' required")?;
            let node_id = resolve_file_node_id(&db, &project_id, file)?;
            let result = graph_compute_impact(db, project_id, vec![node_id]).await?;
            Ok(serde_json::to_value(result).map_err(|e| e.to_string())?)
        }
        "deps" => {
            let file = params.get("file").ok_or("MISSING_PARAM: 'file' required")?;
            let node_id = resolve_file_node_id(&db, &project_id, file)?;
            let direction = params.get("direction").cloned().unwrap_or_else(|| "backward".to_string());
            let max_depth = params.get("maxDepth").and_then(|s| s.parse::<usize>().ok());
            let result = graph_trace_chain(db, project_id, node_id, direction, max_depth).await?;
            Ok(serde_json::to_value(result).map_err(|e| e.to_string())?)
        }
        "layers" => {
            let result = graph_compute_layers(db, project_id).await?;
            Ok(serde_json::to_value(result).map_err(|e| e.to_string())?)
        }
        _ => Err(format!("UNKNOWN_QUERY_TYPE: '{}'. Use 'impact', 'deps', or 'layers'", query_type)),
    }
}
