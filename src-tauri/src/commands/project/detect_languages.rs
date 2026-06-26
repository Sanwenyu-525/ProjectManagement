use serde_json::Value as JsonValue;
use std::fs;
use std::path::Path;

use super::detect::DetectedProject;

// ==================== Language Detection Functions ====================

pub(crate) struct NodeProjectInfo {
    pub(crate) name: Option<String>,
    pub(crate) description: Option<String>,
    pub(crate) tech_stack: Vec<String>,
}

pub(crate) fn detect_node_project(dir: &Path) -> Option<NodeProjectInfo> {
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

pub(crate) struct CargoProjectInfo {
    pub(crate) name: Option<String>,
    pub(crate) description: Option<String>,
}

pub(crate) fn detect_cargo_project(dir: &Path) -> Option<CargoProjectInfo> {
    let content = fs::read_to_string(dir.join("Cargo.toml")).ok()?;
    let name = extract_toml_value(&content, "name");
    let description = extract_toml_value(&content, "description");
    Some(CargoProjectInfo { name, description })
}

pub(crate) struct PythonProjectInfo {
    pub(crate) description: Option<String>,
    pub(crate) frameworks: Vec<String>,
}

pub(crate) fn detect_python_project(dir: &Path) -> Option<PythonProjectInfo> {
    // Try pyproject.toml first
    if let Ok(content) = fs::read_to_string(dir.join("pyproject.toml")) {
        let description = extract_toml_value(&content, "description");
        let content_lower = content.to_lowercase();
        let frameworks = detect_python_frameworks(&content_lower);
        return Some(PythonProjectInfo { description, frameworks });
    }

    // Try requirements.txt
    if let Ok(content) = fs::read_to_string(dir.join("requirements.txt")) {
        let content_lower = content.to_lowercase();
        let frameworks = detect_python_frameworks(&content_lower);
        return Some(PythonProjectInfo {
            description: None,
            frameworks,
        });
    }

    // Also check manage.py to confirm Django
    let mut frameworks = Vec::new();
    if dir.join("manage.py").exists() {
        frameworks.push("Django".into());
    }

    Some(PythonProjectInfo {
        description: None,
        frameworks,
    })
}

/// Helper to detect Python frameworks from dependency content.
fn detect_python_frameworks(content_lower: &str) -> Vec<String> {
    let mut frameworks = Vec::new();
    if content_lower.contains("django") {
        frameworks.push("Django".into());
    }
    if content_lower.contains("flask") {
        frameworks.push("Flask".into());
    }
    if content_lower.contains("fastapi") {
        frameworks.push("FastAPI".into());
    }
    frameworks
}

pub(crate) struct CppProjectInfo {
    pub(crate) description: Option<String>,
    pub(crate) build_system: Option<String>,
}

pub(crate) fn detect_cpp_project(dir: &Path) -> Option<CppProjectInfo> {
    // CMake
    if dir.join("CMakeLists.txt").exists() {
        let description = fs::read_to_string(dir.join("CMakeLists.txt"))
            .ok()
            .and_then(|c| {
                c.lines()
                    .find(|l| l.contains("project(") && l.contains("DESCRIPTION"))
                    .and_then(|l| {
                        l.split("DESCRIPTION")
                            .nth(1)?
                            .split(')')
                            .next()?
                            .trim()
                            .trim_matches('"')
                            .trim_matches('\'')
                            .to_string()
                            .into()
                    })
            });
        return Some(CppProjectInfo {
            description,
            build_system: Some("CMake".into()),
        });
    }

    // Makefile
    if dir.join("Makefile").exists() {
        return Some(CppProjectInfo {
            description: None,
            build_system: Some("Make".into()),
        });
    }

    // Meson
    if dir.join("meson.build").exists() {
        let content = fs::read_to_string(dir.join("meson.build")).ok();
        let description = content.and_then(|c| {
            c.lines()
                .find(|l| l.contains("project(") && l.contains("description:"))
                .and_then(|l| {
                    l.split("description:")
                        .nth(1)?
                        .split(')')
                        .next()?
                        .trim()
                        .trim_matches('"')
                        .trim_matches('\'')
                        .to_string()
                        .into()
                })
        });
        return Some(CppProjectInfo {
            description,
            build_system: Some("Meson".into()),
        });
    }

    // MSBuild (.sln or .vcxproj)
    if has_file_extension(dir, "sln") || has_file_extension(dir, "vcxproj") {
        return Some(CppProjectInfo {
            description: None,
            build_system: Some("MSBuild".into()),
        });
    }

    None
}

pub(crate) struct DartProjectInfo {
    pub(crate) name: Option<String>,
    pub(crate) description: Option<String>,
    pub(crate) is_flutter: bool,
}

pub(crate) fn detect_dart_project(dir: &Path) -> Option<DartProjectInfo> {
    let content = fs::read_to_string(dir.join("pubspec.yaml")).ok()?;
    let name = extract_yaml_value(&content, "name");
    let description = extract_yaml_value(&content, "description");
    // Check if this is a Flutter project
    let is_flutter = is_flutter_project(&content);
    Some(DartProjectInfo {
        name,
        description,
        is_flutter,
    })
}

pub(crate) struct ScalaProjectInfo {
    pub(crate) name: Option<String>,
    pub(crate) description: Option<String>,
}

pub(crate) fn detect_scala_project(dir: &Path) -> Option<ScalaProjectInfo> {
    let content = fs::read_to_string(dir.join("build.sbt")).ok()?;
    let name = content.lines().find_map(|l| {
        let trimmed = l.trim();
        if trimmed.starts_with("name") && trimmed.contains(":=") {
            trimmed
                .split(":=")
                .nth(1)?
                .trim()
                .trim_matches('"')
                .trim_matches('\'')
                .to_string()
                .into()
        } else {
            None
        }
    });
    Some(ScalaProjectInfo {
        name,
        description: None,
    })
}

pub(crate) struct ElixirProjectInfo {
    pub(crate) name: Option<String>,
    pub(crate) description: Option<String>,
    pub(crate) is_phoenix: bool,
}

pub(crate) fn detect_elixir_project(dir: &Path) -> Option<ElixirProjectInfo> {
    let content = fs::read_to_string(dir.join("mix.exs")).ok()?;
    // Extract project name from def project block
    let name = content.lines().find_map(|l| {
        let trimmed = l.trim();
        if trimmed.starts_with("app:") {
            trimmed
                .split(':')
                .nth(1)?
                .trim()
                .trim_matches(',')
                .trim_matches('"')
                .trim_matches('\'')
                .to_string()
                .into()
        } else {
            None
        }
    });
    // Check for Phoenix
    let is_phoenix = content.contains(":phoenix") || content.contains("'phoenix'");
    Some(ElixirProjectInfo {
        name,
        description: None,
        is_phoenix,
    })
}

pub(crate) struct RProjectInfo {
    pub(crate) description: Option<String>,
}

pub(crate) fn detect_r_project(dir: &Path) -> Option<RProjectInfo> {
    // Try DESCRIPTION file (standard R package format)
    if let Ok(content) = fs::read_to_string(dir.join("DESCRIPTION")) {
        let description = content.lines().find_map(|l| {
            let trimmed = l.trim();
            if trimmed.starts_with("Description:") {
                trimmed
                    .split(':')
                    .nth(1)?
                    .trim()
                    .to_string()
                    .into()
            } else {
                None
            }
        });
        return Some(RProjectInfo { description });
    }
    None
}

pub(crate) struct JuliaProjectInfo {
    pub(crate) name: Option<String>,
    pub(crate) description: Option<String>,
}

pub(crate) fn detect_julia_project(dir: &Path) -> Option<JuliaProjectInfo> {
    let content = fs::read_to_string(dir.join("Project.toml")).ok()?;
    let name = extract_toml_value(&content, "name");
    let description = extract_toml_value(&content, "description");
    Some(JuliaProjectInfo { name, description })
}

pub(crate) struct RubyProjectInfo {
    pub(crate) is_rails: bool,
}

pub(crate) fn detect_ruby_project(dir: &Path) -> Option<RubyProjectInfo> {
    let content = fs::read_to_string(dir.join("Gemfile")).ok()?;
    let is_rails = content.contains("gem 'rails'") || content.contains("gem \"rails\"");
    Some(RubyProjectInfo { is_rails })
}

pub(crate) struct PhpProjectInfo {
    pub(crate) frameworks: Vec<String>,
}

pub(crate) fn detect_php_project(dir: &Path) -> Option<PhpProjectInfo> {
    let content = fs::read_to_string(dir.join("composer.json")).ok()?;
    let pkg: JsonValue = serde_json::from_str(&content).ok()?;
    let mut frameworks = Vec::new();

    if let Some(require) = pkg.get("require").and_then(|v| v.as_object()) {
        let keys: std::collections::HashSet<&str> = require.keys().map(|s| s.as_str()).collect();
        if keys.contains("laravel/framework") {
            frameworks.push("Laravel".into());
        }
        if keys.iter().any(|k| k.starts_with("symfony/")) {
            frameworks.push("Symfony".into());
        }
    }

    Some(PhpProjectInfo { frameworks })
}

pub(crate) struct JavaProjectInfo {
    pub(crate) frameworks: Vec<String>,
}

pub(crate) fn detect_java_project(dir: &Path, build_system: &str) -> Option<JavaProjectInfo> {
    let mut frameworks = Vec::new();

    if build_system == "maven" {
        if let Ok(content) = fs::read_to_string(dir.join("pom.xml")) {
            if content.contains("spring-boot-starter") {
                frameworks.push("Spring Boot".into());
            }
        }
    } else if build_system == "gradle" {
        let build_file = if dir.join("build.gradle.kts").exists() {
            dir.join("build.gradle.kts")
        } else {
            dir.join("build.gradle")
        };
        if let Ok(content) = fs::read_to_string(&build_file) {
            if content.contains("org.springframework.boot") || content.contains("spring-boot") {
                frameworks.push("Spring Boot".into());
            }
        }
    }

    Some(JavaProjectInfo { frameworks })
}

pub(crate) fn detect_rust_frameworks(dir: &Path) -> Vec<String> {
    let mut frameworks = Vec::new();
    if let Ok(content) = fs::read_to_string(dir.join("Cargo.toml")) {
        let content_lower = content.to_lowercase();
        if content_lower.contains("actix-web") {
            frameworks.push("Actix-web".into());
        }
        if content_lower.contains("axum") {
            frameworks.push("Axum".into());
        }
        if content_lower.contains("tokio") {
            frameworks.push("Tokio".into());
        }
        if content_lower.contains("rocket") {
            frameworks.push("Rocket".into());
        }
    }
    frameworks
}

pub(crate) fn detect_go_frameworks(dir: &Path) -> Vec<String> {
    let mut frameworks = Vec::new();
    if let Ok(content) = fs::read_to_string(dir.join("go.mod")) {
        if content.contains("github.com/gin-gonic/gin") {
            frameworks.push("Gin".into());
        }
        if content.contains("github.com/gofiber/fiber") {
            frameworks.push("Fiber".into());
        }
        if content.contains("github.com/labstack/echo") {
            frameworks.push("Echo".into());
        }
    }
    frameworks
}

/// Extract value from YAML-like config (simple key: value or key = value).
pub(crate) fn extract_yaml_value(content: &str, key: &str) -> Option<String> {
    for line in content.lines() {
        let trimmed = line.trim();
        if trimmed.starts_with(key) && (trimmed.contains(':') || trimmed.contains('=')) {
            let val = if trimmed.contains(':') {
                trimmed.split(':').nth(1)?.trim()
            } else {
                trimmed.split('=').nth(1)?.trim()
            };
            let val = val.trim_matches('"').trim_matches('\'');
            if !val.is_empty() {
                return Some(val.to_string());
            }
        }
    }
    None
}

/// Apply project info from detection to the DetectedProject.
/// Only updates name if current name is the directory name.
/// Only updates description if current description is None.
pub(crate) fn apply_project_info(
    detected: &mut DetectedProject,
    dir: &Path,
    name: Option<String>,
    description: Option<String>,
) {
    if detected.name.as_deref() == dir.file_name().and_then(|n| n.to_str()) {
        if let Some(name) = name {
            detected.name = Some(name);
        }
    }
    if detected.description.is_none() {
        detected.description = description;
    }
}

/// Check if a Flutter project based on content.
pub(crate) fn is_flutter_project(content: &str) -> bool {
    content.contains("flutter:") || content.contains("  flutter:") || content.contains("flutter sdk:")
}

/// Check for a Makefile with a run target.
pub(crate) fn has_makefile_run_target(dir: &Path) -> bool {
    if !dir.join("Makefile").exists() {
        return false;
    }
    fs::read_to_string(dir.join("Makefile"))
        .map(|c| c.contains("run:") || c.contains("run\t"))
        .unwrap_or(false)
}

/// Extract value from TOML-like config (key = "value").
pub(crate) fn extract_toml_value(content: &str, key: &str) -> Option<String> {
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

pub(crate) fn has_file_extension(dir: &Path, ext: &str) -> bool {
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
