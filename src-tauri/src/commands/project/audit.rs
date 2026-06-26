use serde::{Deserialize, Serialize};
use serde_json::Value as JsonValue;
use tauri::{command, State};

use crate::db::Database;

// ── Types ───────────────────────────────────────────────────────

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct AuditItem {
    pub id: String,
    pub audit_id: String,
    pub dimension: String,
    pub item_key: String,
    pub label: String,
    pub score: i32,
    pub max_score: i32,
    pub status: String,
    pub details: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct RiskItem {
    pub dimension: String,
    pub label: String,
    pub severity: String, // 'warning' | 'critical'
    pub detail: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Recommendation {
    pub dimension: String,
    pub label: String,
    pub priority: String, // 'low' | 'medium' | 'high'
    pub detail: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ProjectAuditResult {
    pub id: String,
    pub project_id: String,
    pub audit_date: String,
    pub score_architecture: i32,
    pub score_code_quality: i32,
    pub score_dependencies: i32,
    pub score_change_impact: i32,
    pub score_knowledge_gap: i32,
    pub total_score: i32,
    pub risk_items: Vec<RiskItem>,
    pub recommendations: Vec<Recommendation>,
    pub trigger_source: String,
    pub duration_ms: Option<i64>,
    pub items: Vec<AuditItem>,
}

// ── Scoring helpers ─────────────────────────────────────────────

struct ScoreItem {
    key: String,
    label: String,
    score: i32,
    max_score: i32,
    status: String,      // 'good' | 'warning' | 'critical'
    details: Option<String>,
}

fn status_for(score: i32, max: i32) -> String {
    let pct = (score as f64) / (max as f64);
    if pct >= 0.8 { "good".into() }
    else if pct >= 0.5 { "warning".into() }
    else { "critical".into() }
}

// ── Dimension scorers (all sync, called from spawn_blocking) ───

fn score_architecture(local_path: &str) -> (Vec<ScoreItem>, Vec<RiskItem>, Vec<Recommendation>) {
    let mut items = Vec::new();
    let mut risks = Vec::new();
    let mut recs = Vec::new();
    let root = std::path::Path::new(local_path);

    // 1. Has src/ directory (4 pts)
    let has_src = root.join("src").exists();
    items.push(ScoreItem {
        key: "has_src".into(), label: "src/ 目录".into(),
        score: if has_src { 4 } else { 0 }, max_score: 4,
        status: if has_src { "good".into() } else { "critical".into() },
        details: if has_src { None } else { Some("缺少 src/ 目录".into()) },
    });
    if !has_src {
        risks.push(RiskItem { dimension: "architecture".into(), label: "缺少 src/ 目录".into(), severity: "warning".into(), detail: "项目没有标准的 src/ 源码目录".into() });
    }

    // 2. Module structure (4 pts) — check for common patterns
    let has_components = root.join("src/components").exists() || root.join("src/features").exists() || root.join("src/pages").exists();
    let has_lib = root.join("src/lib").exists() || root.join("src/utils").exists() || root.join("src/helpers").exists();
    let struct_score = match (has_components, has_lib) {
        (true, true) => 4,
        (true, false) | (false, true) => 2,
        _ => 0,
    };
    items.push(ScoreItem {
        key: "module_structure".into(), label: "模块化结构".into(),
        score: struct_score, max_score: 4,
        status: status_for(struct_score, 4),
        details: Some(format!("components: {}, lib/utils: {}", has_components, has_lib)),
    });
    if struct_score < 2 {
        recs.push(Recommendation { dimension: "architecture".into(), label: "改善模块结构".into(), priority: "medium".into(), detail: "建议将代码按功能拆分到 components/features/lib 等子目录".into() });
    }

    // 3. Build config (4 pts)
    let has_tsconfig = root.join("tsconfig.json").exists();
    let has_build_config = root.join("vite.config.ts").exists() || root.join("webpack.config.js").exists()
        || root.join("next.config.js").exists() || root.join("vite.config.js").exists();
    let build_score = match (has_tsconfig, has_build_config) {
        (true, true) => 4,
        (true, false) | (false, true) => 2,
        _ => 0,
    };
    items.push(ScoreItem {
        key: "build_config".into(), label: "构建配置".into(),
        score: build_score, max_score: 4,
        status: status_for(build_score, 4),
        details: Some(format!("tsconfig: {}, bundler config: {}", has_tsconfig, has_build_config)),
    });

    // 4. Package.json structure (4 pts)
    let mut pkg_score = 0i32;
    if let Ok(content) = std::fs::read_to_string(root.join("package.json")) {
        if let Ok(pkg) = serde_json::from_str::<serde_json::Value>(&content) {
            if pkg.get("name").is_some() { pkg_score += 1; }
            if pkg.get("scripts").and_then(|s| s.as_object()).map_or(false, |s| s.len() >= 2) { pkg_score += 1; }
            if pkg.get("dependencies").or(pkg.get("devDependencies")).is_some() { pkg_score += 1; }
            if pkg.get("engines").is_some() || pkg.get("volta").is_some() { pkg_score += 1; }
        }
    }
    items.push(ScoreItem {
        key: "package_structure".into(), label: "package.json 完整度".into(),
        score: pkg_score, max_score: 4,
        status: status_for(pkg_score, 4),
        details: None,
    });

    // 5. Monorepo / workspace awareness (4 pts)
    let has_workspaces = root.join("pnpm-workspace.yaml").exists()
        || root.join("lerna.json").exists()
        || root.join("turbo.json").exists();
    let ws_score = if has_workspaces { 4 } else { 2 }; // Default 2, not penalized
    items.push(ScoreItem {
        key: "workspace_config".into(), label: "工作区配置".into(),
        score: ws_score, max_score: 4,
        status: status_for(ws_score, 4),
        details: if has_workspaces { Some("检测到 monorepo 工作区配置".into()) } else { None },
    });

    (items, risks, recs)
}

fn score_code_quality(local_path: &str) -> (Vec<ScoreItem>, Vec<RiskItem>, Vec<Recommendation>) {
    let mut items = Vec::new();
    let mut risks = Vec::new();
    let mut recs = Vec::new();
    let root = std::path::Path::new(local_path);

    // 1. README (4 pts)
    let has_readme = root.join("README.md").exists() || root.join("README").exists() || root.join("readme.md").exists();
    items.push(ScoreItem {
        key: "readme".into(), label: "README 文档".into(),
        score: if has_readme { 4 } else { 0 }, max_score: 4,
        status: if has_readme { "good".into() } else { "critical".into() },
        details: None,
    });
    if !has_readme {
        risks.push(RiskItem { dimension: "code_quality".into(), label: "缺少 README".into(), severity: "warning".into(), detail: "项目缺少 README.md 文件".into() });
        recs.push(Recommendation { dimension: "code_quality".into(), label: "添加 README".into(), priority: "medium".into(), detail: "创建 README.md 描述项目用途和使用方法".into() });
    }

    // 2. .gitignore (3 pts)
    let has_gitignore = root.join(".gitignore").exists();
    items.push(ScoreItem {
        key: "gitignore".into(), label: ".gitignore".into(),
        score: if has_gitignore { 3 } else { 0 }, max_score: 3,
        status: if has_gitignore { "good".into() } else { "warning".into() },
        details: None,
    });

    // 3. Lint config (3 pts)
    let has_eslint = root.join(".eslintrc.js").exists() || root.join(".eslintrc.json").exists()
        || root.join("eslint.config.js").exists() || root.join("eslint.config.mjs").exists();
    let has_prettier = root.join(".prettierrc").exists() || root.join(".prettierrc.json").exists()
        || root.join("prettier.config.js").exists();
    let lint_score = match (has_eslint, has_prettier) {
        (true, true) => 3,
        (true, false) | (false, true) => 2,
        _ => 0,
    };
    items.push(ScoreItem {
        key: "lint_config".into(), label: "Lint/格式化配置".into(),
        score: lint_score, max_score: 3,
        status: status_for(lint_score, 3),
        details: Some(format!("eslint: {}, prettier: {}", has_eslint, has_prettier)),
    });
    if lint_score == 0 {
        recs.push(Recommendation { dimension: "code_quality".into(), label: "添加 ESLint".into(), priority: "low".into(), detail: "配置 ESLint 以保持代码风格一致性".into() });
    }

    // 4. TypeScript strict (4 pts)
    let mut ts_score = 0i32;
    if let Ok(content) = std::fs::read_to_string(root.join("tsconfig.json")) {
        if let Ok(tsc) = serde_json::from_str::<serde_json::Value>(&content) {
            let compiler = tsc.get("compilerOptions");
            if compiler.is_some() { ts_score += 1; }
            if compiler.and_then(|c| c.get("strict")).and_then(|v| v.as_bool()).unwrap_or(false) { ts_score += 2; }
            if compiler.and_then(|c| c.get("noUncheckedIndexedAccess")).and_then(|v| v.as_bool()).unwrap_or(false) { ts_score += 1; }
        }
    }
    items.push(ScoreItem {
        key: "ts_strict".into(), label: "TypeScript 严格模式".into(),
        score: ts_score, max_score: 4,
        status: status_for(ts_score, 4),
        details: None,
    });
    if ts_score < 2 {
        recs.push(Recommendation { dimension: "code_quality".into(), label: "启用 strict 模式".into(), priority: "medium".into(), detail: "在 tsconfig.json 中启用 strict: true".into() });
    }

    // 5. Test files (3 pts)
    let has_tests = root.join("tests").exists() || root.join("__tests__").exists()
        || root.join("test").exists() || root.join("src/__tests__").exists()
        || root.join("spec").exists();
    items.push(ScoreItem {
        key: "tests".into(), label: "测试文件".into(),
        score: if has_tests { 3 } else { 0 }, max_score: 3,
        status: if has_tests { "good".into() } else { "warning".into() },
        details: None,
    });
    if !has_tests {
        recs.push(Recommendation { dimension: "code_quality".into(), label: "添加测试".into(), priority: "low".into(), detail: "建议添加单元测试或集成测试".into() });
    }

    // 6. CI config (3 pts)
    let has_ci = root.join(".github/workflows").exists() || root.join(".gitlab-ci.yml").exists()
        || root.join(".circleci").exists() || root.join("Jenkinsfile").exists();
    items.push(ScoreItem {
        key: "ci_config".into(), label: "CI/CD 配置".into(),
        score: if has_ci { 3 } else { 0 }, max_score: 3,
        status: if has_ci { "good".into() } else { "warning".into() },
        details: None,
    });

    (items, risks, recs)
}

fn score_dependencies(local_path: &str) -> (Vec<ScoreItem>, Vec<RiskItem>, Vec<Recommendation>) {
    let mut items = Vec::new();
    let mut risks = Vec::new();
    let mut recs = Vec::new();
    let root = std::path::Path::new(local_path);

    // 1. Lock file (5 pts)
    let has_lock = root.join("package-lock.json").exists() || root.join("yarn.lock").exists()
        || root.join("pnpm-lock.yaml").exists();
    items.push(ScoreItem {
        key: "lock_file".into(), label: "Lock 文件".into(),
        score: if has_lock { 5 } else { 0 }, max_score: 5,
        status: if has_lock { "good".into() } else { "critical".into() },
        details: None,
    });
    if !has_lock {
        risks.push(RiskItem { dimension: "dependencies".into(), label: "缺少 lock 文件".into(), severity: "critical".into(), detail: "没有 lock 文件会导致依赖版本不一致".into() });
    }

    // 2. Outdated deps (8 pts) — check npm outdated
    let mut outdated_count = 0i32;
    if root.join("package.json").exists() {
        if let Ok(output) = std::process::Command::new("npm")
            .args(["outdated", "--json"])
            .current_dir(local_path)
            .output()
        {
            let stdout = String::from_utf8_lossy(&output.stdout);
            if let Ok(obj) = serde_json::from_str::<serde_json::Map<String, serde_json::Value>>(&stdout) {
                for (_, info) in &obj {
                    if let Some(info_obj) = info.as_object() {
                        let current = info_obj.get("current").and_then(|v| v.as_str()).unwrap_or("-");
                        let latest = info_obj.get("latest").and_then(|v| v.as_str()).unwrap_or("-");
                        if current != latest && current != "-" {
                            outdated_count += 1;
                        }
                    }
                }
            }
        }
    }
    let outdated_score = match outdated_count {
        0 => 8,
        1..=3 => 6,
        4..=10 => 3,
        _ => 1,
    };
    items.push(ScoreItem {
        key: "outdated_deps".into(), label: "过时依赖".into(),
        score: outdated_score, max_score: 8,
        status: status_for(outdated_score, 8),
        details: Some(format!("{} 个依赖有更新", outdated_count)),
    });
    if outdated_count > 10 {
        risks.push(RiskItem { dimension: "dependencies".into(), label: "大量过时依赖".into(), severity: "critical".into(), detail: format!("{} 个依赖需要更新", outdated_count) });
        recs.push(Recommendation { dimension: "dependencies".into(), label: "更新依赖".into(), priority: "high".into(), detail: "运行 npm update 或手动更新过时的依赖包".into() });
    } else if outdated_count > 3 {
        risks.push(RiskItem { dimension: "dependencies".into(), label: "部分过时依赖".into(), severity: "warning".into(), detail: format!("{} 个依赖需要更新", outdated_count) });
    }

    // 3. Dep count (4 pts)
    let mut dep_count = 0i32;
    if let Ok(content) = std::fs::read_to_string(root.join("package.json")) {
        if let Ok(pkg) = serde_json::from_str::<serde_json::Value>(&content) {
            dep_count += pkg.get("dependencies").and_then(|d| d.as_object()).map_or(0, |o| o.len()) as i32;
            dep_count += pkg.get("devDependencies").and_then(|d| d.as_object()).map_or(0, |o| o.len()) as i32;
        }
    }
    let dep_score = match dep_count {
        0..=20 => 4,
        21..=50 => 3,
        51..=100 => 2,
        _ => 1,
    };
    items.push(ScoreItem {
        key: "dep_count".into(), label: "依赖数量".into(),
        score: dep_score, max_score: 4,
        status: status_for(dep_score, 4),
        details: Some(format!("{} 个直接依赖", dep_count)),
    });

    // 4. Security audit config (3 pts)
    let has_npmrc = root.join(".npmrc").exists();
    let has_audit_script = if let Ok(content) = std::fs::read_to_string(root.join("package.json")) {
        content.contains("audit")
    } else { false };
    let sec_score = if has_npmrc || has_audit_script { 3 } else { 1 };
    items.push(ScoreItem {
        key: "security_config".into(), label: "安全配置".into(),
        score: sec_score, max_score: 3,
        status: status_for(sec_score, 3),
        details: None,
    });

    (items, risks, recs)
}

fn score_change_impact(local_path: &str) -> (Vec<ScoreItem>, Vec<RiskItem>, Vec<Recommendation>) {
    let mut items = Vec::new();
    let risks = Vec::new();
    let mut recs = Vec::new();
    let root = std::path::Path::new(local_path);

    // 1. File count / size (5 pts)
    let mut file_count = 0i32;
    let mut large_files = 0i32;
    if let Ok(entries) = walk_dir(root, 3) {
        file_count = entries.len() as i32;
        for entry in &entries {
            if let Ok(meta) = std::fs::metadata(entry) {
                if meta.len() > 500_000 { large_files += 1; } // > 500KB
            }
        }
    }
    let size_score = match file_count {
        0..=50 => 5,
        51..=200 => 4,
        201..=500 => 3,
        _ => 2,
    };
    items.push(ScoreItem {
        key: "project_size".into(), label: "项目规模".into(),
        score: size_score, max_score: 5,
        status: status_for(size_score, 5),
        details: Some(format!("{} 个文件", file_count)),
    });

    // 2. Large files (5 pts)
    let lf_score = match large_files {
        0 => 5,
        1..=2 => 3,
        _ => 1,
    };
    items.push(ScoreItem {
        key: "large_files".into(), label: "大文件".into(),
        score: lf_score, max_score: 5,
        status: status_for(lf_score, 5),
        details: Some(format!("{} 个文件超过 500KB", large_files)),
    });
    if large_files > 2 {
        recs.push(Recommendation { dimension: "change_impact".into(), label: "拆分大文件".into(), priority: "low".into(), detail: "有多个大文件，考虑拆分以降低变更影响".into() });
    }

    // 3. Has git history (5 pts)
    let has_git = root.join(".git").exists();
    items.push(ScoreItem {
        key: "git_history".into(), label: "Git 历史".into(),
        score: if has_git { 5 } else { 0 }, max_score: 5,
        status: if has_git { "good".into() } else { "critical".into() },
        details: None,
    });

    // 4. Config files (5 pts) — dotfiles indicating project maturity
    let config_files = [".editorconfig", ".env.example", ".dockerignore", "Dockerfile", "docker-compose.yml"];
    let config_count = config_files.iter().filter(|f| root.join(f).exists()).count() as i32;
    let config_score = match config_count {
        3..=5 => 5,
        2 => 3,
        1 => 2,
        _ => 1,
    };
    items.push(ScoreItem {
        key: "config_files".into(), label: "项目配置文件".into(),
        score: config_score, max_score: 5,
        status: status_for(config_score, 5),
        details: Some(format!("{} 个配置文件存在", config_count)),
    });

    (items, risks, recs)
}

fn score_knowledge_gap(local_path: &str) -> (Vec<ScoreItem>, Vec<RiskItem>, Vec<Recommendation>) {
    let mut items = Vec::new();
    let mut risks = Vec::new();
    let mut recs = Vec::new();
    let root = std::path::Path::new(local_path);

    // 1. CLAUDE.md (5 pts)
    let has_claude_md = root.join("CLAUDE.md").exists();
    items.push(ScoreItem {
        key: "claude_md".into(), label: "CLAUDE.md".into(),
        score: if has_claude_md { 5 } else { 0 }, max_score: 5,
        status: if has_claude_md { "good".into() } else { "warning".into() },
        details: None,
    });
    if !has_claude_md {
        recs.push(Recommendation { dimension: "knowledge_gap".into(), label: "添加 CLAUDE.md".into(), priority: "low".into(), detail: "创建 CLAUDE.md 记录项目架构和开发规范".into() });
    }

    // 2. docs/ directory (5 pts)
    let has_docs = root.join("docs").exists() || root.join("documentation").exists();
    items.push(ScoreItem {
        key: "docs_dir".into(), label: "文档目录".into(),
        score: if has_docs { 5 } else { 0 }, max_score: 5,
        status: if has_docs { "good".into() } else { "warning".into() },
        details: None,
    });
    if !has_docs {
        risks.push(RiskItem { dimension: "knowledge_gap".into(), label: "缺少文档目录".into(), severity: "warning".into(), detail: "没有 docs/ 目录，项目文档可能分散".into() });
        recs.push(Recommendation { dimension: "knowledge_gap".into(), label: "创建文档目录".into(), priority: "medium".into(), detail: "创建 docs/ 目录集中管理项目文档".into() });
    }

    // 3. Changelog (5 pts)
    let has_changelog = root.join("CHANGELOG.md").exists() || root.join("CHANGELOG").exists()
        || root.join("CHANGES.md").exists();
    items.push(ScoreItem {
        key: "changelog".into(), label: "变更日志".into(),
        score: if has_changelog { 5 } else { 0 }, max_score: 5,
        status: if has_changelog { "good".into() } else { "warning".into() },
        details: None,
    });

    // 4. Contributing guide (5 pts)
    let has_contributing = root.join("CONTRIBUTING.md").exists() || root.join(".github/CONTRIBUTING.md").exists();
    items.push(ScoreItem {
        key: "contributing".into(), label: "贡献指南".into(),
        score: if has_contributing { 5 } else { 0 }, max_score: 5,
        status: if has_contributing { "good".into() } else { "warning".into() },
        details: None,
    });

    (items, risks, recs)
}

/// Recursively walk directory up to max_depth, returning file paths.
fn walk_dir(dir: &std::path::Path, max_depth: i32) -> Result<Vec<std::path::PathBuf>, std::io::Error> {
    let mut result = Vec::new();
    if max_depth <= 0 { return Ok(result); }
    for entry in std::fs::read_dir(dir)? {
        let entry = entry?;
        let path = entry.path();
        let name = entry.file_name().to_string_lossy().to_string();
        // Skip common non-source dirs
        if name.starts_with('.') || name == "node_modules" || name == "target" || name == "dist" || name == "build" {
            continue;
        }
        if path.is_dir() {
            result.extend(walk_dir(&path, max_depth - 1)?);
        } else {
            result.push(path);
        }
    }
    Ok(result)
}

// ── Main audit runner ───────────────────────────────────────────

fn run_audit(project_id: &str, local_path: &str) -> Result<ProjectAuditResult, String> {
    let start = std::time::Instant::now();
    let audit_id = crate::db::new_id();
    let now = crate::db::now_str();

    let (arch_items, arch_risks, arch_recs) = score_architecture(local_path);
    let (cq_items, cq_risks, cq_recs) = score_code_quality(local_path);
    let (dep_items, dep_risks, dep_recs) = score_dependencies(local_path);
    let (ci_items, ci_risks, ci_recs) = score_change_impact(local_path);
    let (kg_items, kg_risks, kg_recs) = score_knowledge_gap(local_path);

    fn sum_score(items: &[ScoreItem]) -> i32 { items.iter().map(|i| i.score).sum() }

    let score_arch = sum_score(&arch_items);
    let score_cq = sum_score(&cq_items);
    let score_dep = sum_score(&dep_items);
    let score_ci = sum_score(&ci_items);
    let score_kg = sum_score(&kg_items);
    let total = score_arch + score_cq + score_dep + score_ci + score_kg;

    let all_items: Vec<ScoreItem> = arch_items.into_iter().chain(cq_items).chain(dep_items).chain(ci_items).chain(kg_items).collect();
    let all_risks: Vec<RiskItem> = arch_risks.into_iter().chain(cq_risks).chain(dep_risks).chain(ci_risks).chain(kg_risks).collect();
    let all_recs: Vec<Recommendation> = arch_recs.into_iter().chain(cq_recs).chain(dep_recs).chain(ci_recs).chain(kg_recs).collect();

    let audit_items: Vec<AuditItem> = all_items.iter().map(|si| AuditItem {
        id: crate::db::new_id(),
        audit_id: audit_id.clone(),
        dimension: match si.key.as_str() {
            k if k.starts_with("has_src") || k.starts_with("module") || k.starts_with("build") || k.starts_with("package") || k.starts_with("workspace") => "architecture".into(),
            k if k.starts_with("readme") || k.starts_with("gitignore") || k.starts_with("lint") || k.starts_with("ts_") || k == "tests" || k == "ci_config" => "code_quality".into(),
            k if k.starts_with("lock") || k.starts_with("outdated") || k.starts_with("dep_") || k.starts_with("security") => "dependencies".into(),
            k if k.starts_with("project_size") || k.starts_with("large") || k.starts_with("git_history") || k.starts_with("config_") => "change_impact".into(),
            _ => "knowledge_gap".into(),
        },
        item_key: si.key.clone(),
        label: si.label.clone(),
        score: si.score,
        max_score: si.max_score,
        status: si.status.clone(),
        details: si.details.clone(),
    }).collect();

    let duration_ms = start.elapsed().as_millis() as i64;

    Ok(ProjectAuditResult {
        id: audit_id,
        project_id: project_id.to_string(),
        audit_date: now,
        score_architecture: score_arch,
        score_code_quality: score_cq,
        score_dependencies: score_dep,
        score_change_impact: score_ci,
        score_knowledge_gap: score_kg,
        total_score: total,
        risk_items: all_risks,
        recommendations: all_recs,
        trigger_source: "manual".into(),
        duration_ms: Some(duration_ms),
        items: audit_items,
    })
}

fn save_audit(db: &Database, result: &ProjectAuditResult) -> Result<(), String> {
    let risk_json = serde_json::to_string(&result.risk_items).unwrap_or_default();
    let rec_json = serde_json::to_string(&result.recommendations).unwrap_or_default();

    db.execute(
        "INSERT INTO project_audits (id, projectId, auditDate, scoreArchitecture, scoreCodeQuality, scoreDependencies, scoreChangeImpact, scoreKnowledgeGap, totalScore, riskItems, recommendations, triggerSource, durationMs) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13)",
        rusqlite::params![
            result.id, result.project_id, result.audit_date,
            result.score_architecture, result.score_code_quality, result.score_dependencies,
            result.score_change_impact, result.score_knowledge_gap, result.total_score,
            risk_json, rec_json, result.trigger_source, result.duration_ms,
        ],
    ).map_err(|e| e.to_string())?;

    for item in &result.items {
        db.execute(
            "INSERT INTO project_audit_items (id, auditId, dimension, itemKey, label, score, maxScore, status, details) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
            rusqlite::params![
                item.id, item.audit_id, item.dimension, item.item_key,
                item.label, item.score, item.max_score, item.status, item.details,
            ],
        ).map_err(|e| e.to_string())?;
    }

    Ok(())
}

// ── Tauri Commands ──────────────────────────────────────────────

#[command]
pub async fn audit_run_for_project(
    db: State<'_, Database>,
    project_id: String,
) -> Result<ProjectAuditResult, String> {
    let project = db.query_one_json(
        "SELECT id, localPath FROM projects WHERE id = ?1",
        rusqlite::params![project_id],
    ).map_err(|e| e.to_string())?
        .ok_or("项目不存在")?;

    let local_path = project.get("localPath")
        .and_then(|v| v.as_str())
        .ok_or("项目没有设置本地路径")?
        .to_string();

    let pid = project_id.clone();
    let result = tokio::task::spawn_blocking(move || run_audit(&pid, &local_path))
        .await
        .map_err(|e| e.to_string())??;

    save_audit(&db, &result)?;
    Ok(result)
}

#[command]
pub async fn audit_get_project_history(
    db: State<'_, Database>,
    project_id: String,
    limit: Option<i32>,
) -> Result<JsonValue, String> {
    let n = limit.unwrap_or(10);
    db.query_json(
        "SELECT * FROM project_audits WHERE projectId = ?1 ORDER BY auditDate DESC LIMIT ?2",
        rusqlite::params![project_id, n],
    ).map_err(|e| e.to_string())
}

#[command]
pub async fn audit_get_latest_all(
    db: State<'_, Database>,
) -> Result<JsonValue, String> {
    db.query_json(
        "SELECT a.* FROM project_audits a
         INNER JOIN (SELECT projectId, MAX(auditDate) as maxDate FROM project_audits GROUP BY projectId) latest
         ON a.projectId = latest.projectId AND a.auditDate = latest.maxDate",
        rusqlite::params![],
    ).map_err(|e| e.to_string())
}

#[command]
pub async fn audit_get_items(
    db: State<'_, Database>,
    audit_id: String,
) -> Result<JsonValue, String> {
    db.query_json(
        "SELECT * FROM project_audit_items WHERE auditId = ?1 ORDER BY dimension, itemKey",
        rusqlite::params![audit_id],
    ).map_err(|e| e.to_string())
}
