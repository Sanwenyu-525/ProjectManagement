use serde::Serialize;
use std::process::{Command, Output};
use tauri::command;

// ── Helpers ────────────────────────────────────────────────────────────────

fn run_git_raw(repo_path: &str, args: &[&str]) -> Result<Output, String> {
    Command::new("git")
        .args(args)
        .current_dir(repo_path)
        .output()
        .map_err(|e| format!("执行 git 失败: {}", e))
}

/// For read-only commands: returns stdout even on non-zero exit
/// (e.g. git diff returns 1 when there are differences)
fn run_git(repo_path: &str, args: &[&str]) -> Result<String, String> {
    let output = run_git_raw(repo_path, args)?;
    if output.status.success() || !String::from_utf8_lossy(&output.stderr).contains("not a git repository") {
        Ok(String::from_utf8_lossy(&output.stdout).to_string())
    } else {
        Err("该路径不是 Git 仓库".into())
    }
}

/// For write commands: returns error on non-zero exit
fn run_git_checked(repo_path: &str, args: &[&str]) -> Result<String, String> {
    let output = run_git_raw(repo_path, args)?;
    if output.status.success() {
        Ok(String::from_utf8_lossy(&output.stdout).to_string())
    } else {
        let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
        Err(if stderr.is_empty() { "git 命令执行失败".into() } else { stderr })
    }
}

// ── Status ─────────────────────────────────────────────────────────────────

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct GitFileEntry {
    pub path: String,
    pub status: String,
    pub staged: bool,
}

#[command]
pub fn git_status(repo_path: String) -> Result<Vec<GitFileEntry>, String> {
    let output = run_git(&repo_path, &["status", "--porcelain=v1"])?;
    let mut entries = Vec::new();

    for line in output.lines() {
        if line.len() < 4 {
            continue;
        }
        let index_status = line.chars().nth(0).unwrap_or(' ');
        let worktree_status = line.chars().nth(1).unwrap_or(' ');
        let path = line[3..].trim().to_string();

        // Handle renames: "old -> new"
        let path = if path.contains(" -> ") {
            path.split(" -> ").last().unwrap_or(&path).to_string()
        } else {
            path
        };

        // Index (staged) entries
        if index_status != ' ' && index_status != '?' {
            let status = match index_status {
                'M' => "Modified",
                'A' => "Added",
                'D' => "Deleted",
                'R' => "Renamed",
                'C' => "Copied",
                'T' => "TypeChanged",
                _ => "Unknown",
            };
            entries.push(GitFileEntry {
                path: path.clone(),
                status: status.into(),
                staged: true,
            });
        }

        // Worktree (unstaged) entries
        if worktree_status != ' ' {
            let status = match worktree_status {
                'M' => "Modified",
                'D' => "Deleted",
                'T' => "TypeChanged",
                '?' => "Untracked",
                _ => "Unknown",
            };
            entries.push(GitFileEntry {
                path,
                status: status.into(),
                staged: false,
            });
        }
    }

    Ok(entries)
}

// ── Log (for commit graph) ─────────────────────────────────────────────────

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct GitCommit {
    pub hash: String,
    pub short_hash: String,
    pub message: String,
    pub author: String,
    pub date: String,
    pub parents: Vec<String>,
    pub branch_idx: usize,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct GitBranchInfo {
    pub name: String,
    pub current: bool,
    pub is_remote: bool,
    pub upstream: Option<String>,
    pub ahead: i32,
    pub behind: i32,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GitLogResult {
    pub commits: Vec<GitCommit>,
    pub branches: Vec<GitBranchInfo>,
}

#[command]
pub fn git_log(repo_path: String, limit: Option<usize>) -> Result<GitLogResult, String> {
    let n = limit.unwrap_or(50).to_string();
    let output = run_git(&repo_path, &[
        "log", "--all",
        &format!("--format=%H|%h|%s|%an|%ai|%P|%D"),
        "-n", &n,
    ])?;

    // Parse branches first for lane assignment
    let branches_output = run_git(&repo_path, &["branch", "-vv", "--all"])?;
    let branch_infos = parse_branches(&branches_output);
    let branch_names: Vec<String> = branch_infos.iter().map(|b| b.name.clone()).collect();

    // Parse commits
    let mut commits: Vec<GitCommit> = Vec::new();
    for line in output.lines() {
        let parts: Vec<&str> = line.splitn(7, '|').collect();
        if parts.len() < 6 {
            continue;
        }
        let hash = parts[0].to_string();
        let short_hash = parts[1].to_string();
        let message = parts[2].to_string();
        let author = parts[3].to_string();
        let date = parts[4].to_string();
        let parents: Vec<String> = parts[5]
            .split_whitespace()
            .map(|s| s.to_string())
            .collect();
        let refs = if parts.len() > 6 { parts[6] } else { "" };

        // Determine branch index from ref decoration
        let branch_idx = find_branch_idx(refs, &branch_names);

        commits.push(GitCommit {
            hash,
            short_hash,
            message,
            author,
            date,
            parents,
            branch_idx,
        });
    }

    // Assign branch_idx for commits without direct ref decoration
    // by walking parent chains from known branch tips
    assign_branch_indices(&mut commits);

    Ok(GitLogResult {
        commits,
        branches: branch_infos,
    })
}

fn parse_branches(output: &str) -> Vec<GitBranchInfo> {
    let mut branches = Vec::new();
    for line in output.lines() {
        let line = line.trim();
        if line.is_empty() {
            continue;
        }
        let current = line.starts_with('*');
        let line = if current { line[1..].trim() } else { line.trim() };

        // Parse: "name hash [upstream: ahead/behind] message"
        // or:    "remotes/origin/name hash message"
        let parts: Vec<&str> = line.splitn(2, char::is_whitespace).collect();
        if parts.is_empty() {
            continue;
        }
        let name = parts[0].to_string();
        let rest = if parts.len() > 1 { parts[1] } else { "" };

        let is_remote = name.starts_with("remotes/") || name.contains("origin/");
        let display_name = name
            .strip_prefix("remotes/")
            .unwrap_or(&name)
            .to_string();

        // Parse upstream tracking info: "[origin/main: ahead 1, behind 2]"
        let mut upstream: Option<String> = None;
        let mut ahead = 0i32;
        let mut behind = 0i32;

        if let Some(bracket_start) = rest.find('[') {
            if let Some(bracket_end) = rest.find(']') {
                let tracking = &rest[bracket_start + 1..bracket_end];
                // Parse "origin/main: ahead 1, behind 2" or "origin/main"
                let t_parts: Vec<&str> = tracking.splitn(2, ':').collect();
                upstream = Some(t_parts[0].trim().to_string());
                if t_parts.len() > 1 {
                    let info = t_parts[1];
                    if let Some(pos) = info.find("ahead ") {
                        let after = &info[pos + 6..];
                        ahead = after.split([',', ']']).next()
                            .and_then(|s| s.trim().parse().ok())
                            .unwrap_or(0);
                    }
                    if let Some(pos) = info.find("behind ") {
                        let after = &info[pos + 7..];
                        behind = after.split([',', ']']).next()
                            .and_then(|s| s.trim().parse().ok())
                            .unwrap_or(0);
                    }
                }
            }
        }

        // Skip HEAD pointer entries
        if display_name.starts_with("HEAD") {
            continue;
        }

        branches.push(GitBranchInfo {
            name: display_name,
            current,
            is_remote,
            upstream,
            ahead,
            behind,
        });
    }
    branches
}

fn find_branch_idx(refs_str: &str, branch_names: &[String]) -> usize {
    // refs_str like "HEAD -> main, origin/main, origin/feature"
    // Find the first local branch (HEAD ->) in the refs
    for part in refs_str.split(',') {
        let part = part.trim();
        if let Some(name) = part.strip_prefix("HEAD -> ") {
            if let Some(idx) = branch_names.iter().position(|n| n == name) {
                return idx;
            }
        }
    }
    // Try to match any named ref
    for part in refs_str.split(',') {
        let part = part.trim();
        // Skip HEAD
        if part == "HEAD" {
            continue;
        }
        let name = part.strip_prefix("HEAD -> ").unwrap_or(part);
        if let Some(idx) = branch_names.iter().position(|n| n == name || part.ends_with(n)) {
            return idx;
        }
    }
    0 // Default to first branch
}

fn assign_branch_indices(commits: &mut [GitCommit]) {
    let hash_map: std::collections::HashMap<String, usize> = commits
        .iter()
        .enumerate()
        .map(|(i, c)| (c.hash.clone(), i))
        .collect();

    let mut visited = std::collections::HashSet::new();

    // git log is reverse-chronological: index 0 = newest, N-1 = oldest
    // For each commit, propagate branch_idx to unvisited parents (older commits)
    for i in 0..commits.len() {
        let branch_idx = commits[i].branch_idx;
        for parent_hash in &commits[i].parents {
            if let Some(&parent_idx) = hash_map.get(parent_hash) {
                if parent_idx > i && !visited.contains(&parent_idx) {
                    commits[parent_idx].branch_idx = branch_idx;
                    visited.insert(parent_idx);
                }
            }
        }
    }
}

// ── Branches ───────────────────────────────────────────────────────────────

#[command]
pub fn git_branches(repo_path: String) -> Result<Vec<GitBranchInfo>, String> {
    let output = run_git(&repo_path, &["branch", "-vv", "--all"])?;
    Ok(parse_branches(&output))
}

// ── Diff ───────────────────────────────────────────────────────────────────

#[command]
pub fn git_diff(repo_path: String, file: Option<String>, staged: Option<bool>) -> Result<String, String> {
    let mut args = vec!["diff"];
    if staged.unwrap_or(false) {
        args.push("--staged");
    }
    if let Some(ref f) = file {
        args.push("--");
        args.push(f);
    }
    run_git(&repo_path, &args)
}

// ── Branch switch ──────────────────────────────────────────────────────────

#[command]
pub fn git_branch_switch(repo_path: String, branch: String) -> Result<String, String> {
    run_git_checked(&repo_path, &["checkout", &branch])
}

// ── Stash ──────────────────────────────────────────────────────────────────

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GitStashEntry {
    pub index: i32,
    pub message: String,
}

#[command]
pub fn git_stash_list(repo_path: String) -> Result<Vec<GitStashEntry>, String> {
    let output = run_git(&repo_path, &["stash", "list", "--format=%gd|%s"])?;
    let mut entries = Vec::new();
    for line in output.lines() {
        let parts: Vec<&str> = line.splitn(2, '|').collect();
        if parts.len() < 2 {
            continue;
        }
        let index_str = parts[0].trim_start_matches("stash@{").trim_end_matches('}');
        let index = index_str.parse().unwrap_or(0);
        entries.push(GitStashEntry {
            index,
            message: parts[1].to_string(),
        });
    }
    Ok(entries)
}

// ── Add (stage files) ──────────────────────────────────────────────────────

#[command]
pub fn git_add(repo_path: String, files: Vec<String>) -> Result<String, String> {
    let mut args = vec!["add"];
    let file_refs: Vec<&str> = files.iter().map(|s| s.as_str()).collect();
    args.extend(file_refs);
    run_git_checked(&repo_path, &args)?;
    Ok("已暂存".into())
}

// ── Commit ─────────────────────────────────────────────────────────────────

#[command]
pub fn git_commit(repo_path: String, message: String) -> Result<String, String> {
    run_git_checked(&repo_path, &["commit", "-m", &message])?;
    Ok("已提交".into())
}

// ── Push ───────────────────────────────────────────────────────────────────

#[command]
pub fn git_push(repo_path: String, remote: Option<String>, branch: Option<String>) -> Result<String, String> {
    let remote_str = remote.unwrap_or_else(|| "origin".into());
    let mut args = vec!["push", &remote_str];
    let branch_str;
    if let Some(ref b) = branch {
        branch_str = b.clone();
        args.push(&branch_str);
    }
    run_git_checked(&repo_path, &args)?;
    Ok("已推送".into())
}

// ── Diff commit ────────────────────────────────────────────────────────────

#[command]
pub fn git_diff_commit(repo_path: String, hash: String) -> Result<String, String> {
    run_git(&repo_path, &["diff", &format!("{}^..{}", hash, hash)])
}

// ── Reset (unstage) ────────────────────────────────────────────────────────

#[command]
pub fn git_reset_head(repo_path: String, files: Vec<String>) -> Result<String, String> {
    if files.is_empty() {
        run_git_checked(&repo_path, &["reset", "HEAD"])?;
    } else {
        let mut args = vec!["reset", "HEAD", "--"];
        for f in &files {
            args.push(f);
        }
        run_git_checked(&repo_path, &args)?;
    }
    Ok("已取消暂存".into())
}
