use serde::{Deserialize, Serialize};
use serde_json::Value as JsonValue;
use tauri::command;
use std::collections::HashMap;
use std::path::Path;

#[derive(Debug, Serialize, Deserialize)]
pub struct ProjectDependency {
    pub project_id: String,
    pub project_name: String,
    pub depends_on: Vec<String>,      // IDs of projects this project depends on
    pub depended_by: Vec<String>,     // IDs of projects that depend on this project
    pub dependency_type: String,      // "docker", "port", "import", "config"
    pub confidence: f32,              // 0.0 - 1.0
}

#[derive(Debug, Serialize, Deserialize)]
pub struct DependencyGraph {
    pub projects: Vec<ProjectDependency>,
    pub edges: Vec<DependencyEdge>,
    pub clusters: Vec<DependencyCluster>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct DependencyEdge {
    pub from: String,
    pub to: String,
    pub edge_type: String,
    pub weight: f32,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct DependencyCluster {
    pub id: String,
    pub name: String,
    pub project_ids: Vec<String>,
    pub cluster_type: String,  // "docker-compose", "monorepo", "microservice"
}

#[command]
pub async fn detect_project_dependencies(
    project_ids: Vec<String>,
) -> Result<DependencyGraph, String> {
    let mut graph = DependencyGraph {
        projects: Vec::new(),
        edges: Vec::new(),
        clusters: Vec::new(),
    };

    // Analyze each project for dependencies
    for project_id in &project_ids {
        let dependencies = analyze_project_dependencies(project_id).await?;
        graph.projects.push(dependencies);
    }

    // Detect dependency clusters
    graph.clusters = detect_dependency_clusters(&graph.projects);

    Ok(graph)
}

async fn analyze_project_dependencies(project_id: &str) -> Result<ProjectDependency, String> {
    // This is a simplified version - in production, you would:
    // 1. Read project files (package.json, docker-compose.yml, etc.)
    // 2. Analyze import statements
    // 3. Check port configurations
    // 4. Look for docker-compose dependencies

    Ok(ProjectDependency {
        project_id: project_id.to_string(),
        project_name: format!("Project {}", project_id),
        depends_on: Vec::new(),
        depended_by: Vec::new(),
        dependency_type: "unknown".to_string(),
        confidence: 0.0,
    })
}

fn detect_dependency_clusters(projects: &[ProjectDependency]) -> Vec<DependencyCluster> {
    let mut clusters = Vec::new();
    let mut visited = HashMap::new();

    // Group projects by dependency type
    for project in projects {
        if !visited.contains_key(&project.project_id) {
            let mut cluster_projects = Vec::new();
            let cluster_type = project.dependency_type.clone();

            // Find all projects in this cluster
            for other in projects {
                if other.dependency_type == cluster_type && !visited.contains_key(&other.project_id) {
                    cluster_projects.push(other.project_id.clone());
                    visited.insert(other.project_id.clone(), true);
                }
            }

            if cluster_projects.len() > 1 {
                clusters.push(DependencyCluster {
                    id: format!("cluster-{}", clusters.len() + 1),
                    name: format!("{} Cluster", cluster_type),
                    project_ids: cluster_projects,
                    cluster_type,
                });
            }
        }
    }

    clusters
}

#[command]
pub async fn get_launch_order(
    project_ids: Vec<String>,
    respect_dependencies: bool,
) -> Result<Vec<String>, String> {
    if !respect_dependencies {
        return Ok(project_ids);
    }

    // Get dependency graph
    let graph = detect_project_dependencies(project_ids.clone()).await?;

    // Topological sort based on dependencies
    let mut sorted = Vec::new();
    let mut visited = std::collections::HashSet::new();
    let mut visiting = std::collections::HashSet::new();

    for project_id in &project_ids {
        if !visited.contains(project_id) {
            topological_sort(
                project_id,
                &graph.projects,
                &mut sorted,
                &mut visited,
                &mut visiting,
            );
        }
    }

    Ok(sorted)
}

fn topological_sort(
    project_id: &str,
    projects: &[ProjectDependency],
    sorted: &mut Vec<String>,
    visited: &mut std::collections::HashSet<String>,
    visiting: &mut std::collections::HashSet<String>,
) {
    if visited.contains(project_id) {
        return;
    }

    if visiting.contains(project_id) {
        // Cycle detected, skip
        return;
    }

    visiting.insert(project_id.to_string());

    // Visit all dependencies first
    if let Some(project) = projects.iter().find(|p| p.project_id == project_id) {
        for dep_id in &project.depends_on {
            topological_sort(dep_id, projects, sorted, visited, visiting);
        }
    }

    visiting.remove(project_id);
    visited.insert(project_id.to_string());
    sorted.push(project_id.to_string());
}

#[command]
pub async fn analyze_docker_compose(
    path: String,
) -> Result<Vec<DockerService>, String> {
    let compose_path = Path::new(&path).join("docker-compose.yml");
    let alt_compose_path = Path::new(&path).join("docker-compose.yaml");

    let compose_file = if compose_path.exists() {
        compose_path.to_string_lossy().to_string()
    } else if alt_compose_path.exists() {
        alt_compose_path.to_string_lossy().to_string()
    } else {
        return Err("No docker-compose.yml found".to_string());
    };

    // In production, parse the YAML file
    // For now, return a placeholder
    Ok(Vec::new())
}

#[derive(Debug, Serialize, Deserialize)]
pub struct DockerService {
    pub name: String,
    pub image: String,
    pub ports: Vec<String>,
    pub depends_on: Vec<String>,
    pub environment: HashMap<String, String>,
}

#[command]
pub async fn detect_monorepo_structure(
    path: String,
) -> Result<MonorepoStructure, String> {
    // Check for monorepo indicators
    let root = Path::new(&path);

    // Check for common monorepo tools
    let is_monorepo = root.join("lerna.json").exists()
        || root.join("pnpm-workspace.yaml").exists()
        || root.join("nx.json").exists()
        || root.join("turbo.json").exists();

    if !is_monorepo {
        return Ok(MonorepoStructure {
            is_monorepo: false,
            packages: Vec::new(),
            workspaces: Vec::new(),
        });
    }

    // In production, parse workspace configuration
    // For now, return a placeholder
    Ok(MonorepoStructure {
        is_monorepo: true,
        packages: Vec::new(),
        workspaces: Vec::new(),
    })
}

#[derive(Debug, Serialize, Deserialize)]
pub struct MonorepoStructure {
    pub is_monorepo: bool,
    pub packages: Vec<String>,
    pub workspaces: Vec<String>,
}
