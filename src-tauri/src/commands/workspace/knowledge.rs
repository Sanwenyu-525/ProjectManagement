use std::fs;
use std::io::Write;
use std::path::PathBuf;
use std::process::{Command as StdCommand, Stdio};

use serde::Deserialize;
use serde_json::{from_str as json_from_str, json, Value as JsonValue};
use tauri::{command, AppHandle, Manager, State};

use crate::db::Database;

/// Run `claude -p` with the prompt passed via stdin.
/// This avoids cmd.exe argument mangling with special characters.
fn run_claude(prompt: &str) -> Result<std::process::Output, String> {
    let mut cmd = StdCommand::new("cmd");
    cmd.args(["/C", "claude", "-p"])
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .env("NO_COLOR", "1")
        .env("TERM", "dumb");

    let mut child = cmd.spawn().map_err(|e| format!("claude 启动失败: {e}"))?;

    // Write prompt to stdin and close to signal EOF
    if let Some(mut stdin) = child.stdin.take() {
        stdin
            .write_all(prompt.as_bytes())
            .map_err(|e| format!("写入 claude stdin 失败: {e}"))?;
    }

    child
        .wait_with_output()
        .map_err(|e| format!("claude 执行失败: {e}"))
}

/// Find the first complete JSON object `{...}` in text, correctly handling nested braces and strings.
fn find_json_object(text: &str) -> Option<&str> {
    let start = text.find('{')?;
    let bytes = text.as_bytes();
    let mut depth = 0i32;
    let mut in_string = false;
    let mut escape = false;
    for i in start..bytes.len() {
        let b = bytes[i];
        if escape {
            escape = false;
            continue;
        }
        if b == b'\\' && in_string {
            escape = true;
            continue;
        }
        if b == b'"' {
            in_string = !in_string;
            continue;
        }
        if in_string {
            continue;
        }
        match b {
            b'{' => depth += 1,
            b'}' => {
                depth -= 1;
                if depth == 0 {
                    return Some(&text[start..=i]);
                }
            }
            _ => {}
        }
    }
    None
}

fn vault_dir(app: &AppHandle) -> PathBuf {
    app.path()
        .app_data_dir()
        .expect("failed to resolve app data dir")
        .join("knowledge_vault")
}

fn ensure_dir(path: &PathBuf) -> Result<(), String> {
    fs::create_dir_all(path).map_err(|e| e.to_string())
}

#[command]
pub async fn knowledge_import_files(
    app: AppHandle,
    db: State<'_, Database>,
    file_paths: Vec<String>,
    project_id: Option<String>,
) -> Result<JsonValue, String> {
    if file_paths.is_empty() {
        return Err("No files provided".into());
    }

    let vault = vault_dir(&app);
    let target_dir = vault.join(project_id.as_deref().unwrap_or("_default"));
    ensure_dir(&target_dir)?;

    let mut results = Vec::new();

    for path_str in &file_paths {
        let src = PathBuf::from(path_str);
        if !src.exists() {
            continue;
        }

        let ext = src
            .extension()
            .and_then(|e| e.to_str())
            .unwrap_or("md");
        if !matches!(ext, "md" | "txt") {
            continue;
        }

        let content = fs::read_to_string(&src).map_err(|e| format!("{}: {}", path_str, e))?;
        let id = crate::db::new_id();
        let now = crate::db::now_str();
        let file_name = format!("{}.{}", id, ext);
        let dest = target_dir.join(&file_name);
        let relative_path = format!(
            "{}/{}",
            project_id.as_deref().unwrap_or("_default"),
            file_name
        );

        fs::write(&dest, &content).map_err(|e| e.to_string())?;

        let title = src
            .file_stem()
            .and_then(|s| s.to_str())
            .unwrap_or("未命名")
            .to_string();

        db.execute(
            "INSERT INTO personal_notes (id, projectId, title, content, tags, filePath, createdAt, updatedAt) \
             VALUES (?1, ?2, ?3, ?4, NULL, ?5, ?6, ?6)",
            rusqlite::params![id, project_id, title, content, relative_path, now],
        )
        .map_err(|e| e.to_string())?;

        results.push(json!({
            "id": id,
            "title": title,
            "filePath": relative_path,
        }));
    }

    if results.is_empty() {
        return Err("No valid .md/.txt files found".into());
    }

    Ok(JsonValue::Array(results))
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateKnowledgeNoteInput {
    pub title: String,
    pub content: String,
    pub project_id: Option<String>,
    pub tags: Option<String>,
}

#[command]
pub async fn knowledge_create_note(
    app: AppHandle,
    db: State<'_, Database>,
    data: CreateKnowledgeNoteInput,
) -> Result<JsonValue, String> {
    let vault = vault_dir(&app);
    let target_dir = vault.join(data.project_id.as_deref().unwrap_or("_default"));
    ensure_dir(&target_dir)?;

    let id = crate::db::new_id();
    let now = crate::db::now_str();
    let file_name = format!("{}.md", id);
    let dest = target_dir.join(&file_name);
    let relative_path = format!(
        "{}/{}",
        data.project_id.as_deref().unwrap_or("_default"),
        file_name
    );

    fs::write(&dest, &data.content).map_err(|e| e.to_string())?;

    db.execute(
        "INSERT INTO personal_notes (id, projectId, title, content, tags, filePath, createdAt, updatedAt) \
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?7)",
        rusqlite::params![
            id,
            data.project_id,
            data.title,
            data.content,
            data.tags,
            relative_path,
            now,
        ],
    )
    .map_err(|e| e.to_string())?;

    db.query_one_json(
        "SELECT * FROM personal_notes WHERE id = ?1",
        rusqlite::params![id],
    )
    .map_err(|e| e.to_string())?
    .ok_or_else(|| "Failed to create note".into())
}

// ── Knowledge Extract (AI-powered) ──

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct KnowledgeExtractInput {
    pub content: String,
    pub source_context: Option<String>,
    pub project_id: Option<String>,
}

#[derive(Debug, Deserialize)]
struct ExtractedItem {
    title: String,
    content: String,
    tags: Option<String>,
}

#[command]
pub async fn knowledge_extract(
    db: State<'_, Database>,
    data: KnowledgeExtractInput,
) -> Result<JsonValue, String> {
    let content = data.content.trim();
    if content.is_empty() {
        return Err("内容不能为空".into());
    }

    let ctx = data.source_context.as_deref().unwrap_or("unknown");
    let prompt = format!(
        r#"分析以下内容，提取 1-3 条值得沉淀的工程经验/知识。
每条必须独立可读，标题简洁概括，内容包含具体细节（不要泛泛而谈）。

来源: {ctx}
---
{content}
---

以 JSON 数组格式返回，每项包含:
- title: string (简洁概括)
- content: string (具体细节，可包含代码块)
- tags: string (逗号分隔标签，如 "debug,rust,async")

只输出 JSON 数组，无其他文本。如果内容不值得沉淀，返回空数组 []。"#
    );

    let output = tokio::task::spawn_blocking(move || run_claude(&prompt))
        .await
        .map_err(|e| format!("claude 调用失败: {e}"))??;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("claude 执行失败: {stderr}"));
    }

    let raw = String::from_utf8_lossy(&output.stdout);
    let text = raw.trim();

    // Find JSON array in output (may be wrapped in markdown)
    let json_str = if let Some(start) = text.find('[') {
        if let Some(end) = text.rfind(']') {
            &text[start..=end]
        } else {
            return Err("AI 返回格式无效".into());
        }
    } else {
        return Err("AI 返回格式无效".into());
    };

    let extracted: Vec<ExtractedItem> = json_from_str(json_str)
        .map_err(|e| format!("解析 AI 输出失败: {e}"))?;

    let mut results = Vec::new();

    for item in &extracted {
        let id = crate::db::new_id();
        let now = crate::db::now_str();

        db.execute(
            "INSERT INTO project_memories (id, projectId, type, title, content, tags, source, sessionId, createdAt, updatedAt) \
             VALUES (?1, ?2, 'experience', ?3, ?4, ?5, 'ai-extract', NULL, ?6, ?6)",
            rusqlite::params![id, data.project_id, item.title, item.content, item.tags, now],
        )
        .map_err(|e| e.to_string())?;

        results.push(json!({
            "id": id,
            "projectId": data.project_id,
            "title": item.title,
            "content": item.content,
            "tags": item.tags,
            "source": "memory",
            "category": "experience",
            "isPinned": false,
            "createdAt": now,
            "updatedAt": now,
        }));
    }

    Ok(JsonValue::Array(results))
}

// ── Knowledge Search Context ──

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct KnowledgeSearchContextInput {
    pub query: String,
    pub project_id: Option<String>,
    pub limit: Option<i32>,
}

fn search_knowledge_items(
    db: &Database,
    query: &str,
    project_id: &Option<String>,
    limit: i32,
) -> Result<Vec<JsonValue>, String> {
    let terms: Vec<String> = query
        .split_whitespace()
        .filter(|t| !t.is_empty())
        .map(|t| format!("%{}%", t.to_lowercase()))
        .collect();

    if terms.is_empty() {
        return Ok(vec![]);
    }

    let mut sql = String::from(
        "SELECT id, title, category, substr(content, 1, 300) as contentSnippet \
         FROM knowledge_items WHERE ",
    );

    let mut conditions = Vec::new();
    for i in 0..terms.len() {
        conditions.push(format!(
            "(LOWER(title) LIKE ?{idx} OR LOWER(content) LIKE ?{idx})",
            idx = i + 1
        ));
    }
    sql.push_str(&conditions.join(" OR "));

    if project_id.is_some() {
        let idx = terms.len() + 1;
        sql.push_str(&format!(" AND projectId = ?{idx}"));
    }
    sql.push_str(&format!(" ORDER BY isPinned DESC, createdAt DESC LIMIT {limit}"));

    let mut params: Vec<Box<dyn rusqlite::types::ToSql>> = Vec::new();
    for term in &terms {
        params.push(Box::new(term.clone()));
    }
    if let Some(ref pid) = project_id {
        params.push(Box::new(pid.clone()));
    }

    let param_refs: Vec<&dyn rusqlite::types::ToSql> = params.iter().map(|p| p.as_ref()).collect();
    let rows = db
        .query_json(&sql, param_refs.as_slice())
        .map_err(|e| e.to_string())?;

    match rows {
        JsonValue::Array(items) => Ok(items),
        _ => Ok(vec![]),
    }
}

#[command]
pub async fn knowledge_search_context(
    db: State<'_, Database>,
    data: KnowledgeSearchContextInput,
) -> Result<JsonValue, String> {
    let limit = data.limit.unwrap_or(10).max(1).min(20);
    let results = search_knowledge_items(&db, &data.query, &data.project_id, limit)?;
    Ok(JsonValue::Array(results))
}

// ── Knowledge Query (AI-powered Q&A) ──

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct KnowledgeQueryInput {
    pub question: String,
    pub project_id: Option<String>,
}

#[command]
pub async fn knowledge_query(
    db: State<'_, Database>,
    data: KnowledgeQueryInput,
) -> Result<JsonValue, String> {
    let question = data.question.trim();
    if question.is_empty() {
        return Err("问题不能为空".into());
    }

    // Step 1: Retrieve relevant knowledge items
    let sources = search_knowledge_items(&db, question, &data.project_id, 5)?;

    // Step 2: Build prompt
    let context = if sources.is_empty() {
        "（知识库中没有找到相关内容）".to_string()
    } else {
        sources
            .iter()
            .enumerate()
            .map(|(i, item)| {
                let title = item.get("title").and_then(|v| v.as_str()).unwrap_or("未命名");
                let cat = item.get("category").and_then(|v| v.as_str()).unwrap_or("");
                let snippet = item.get("contentSnippet").and_then(|v| v.as_str()).unwrap_or("");
                let id = item.get("id").and_then(|v| v.as_str()).unwrap_or("");
                format!(
                    "[{}] {} ({}): {} — ID: {}",
                    i + 1,
                    title,
                    cat,
                    snippet,
                    id
                )
            })
            .collect::<Vec<_>>()
            .join("\n\n")
    };

    let prompt = format!(
        r#"你是一个项目知识库助手。基于以下知识库条目回答用户问题。
要求：
- 回答要准确、简洁
- 在回答中引用来源，格式为 [来源N]（N 对应下方条目编号）
- 如果知识库中没有相关内容，诚实说明并尝试给出通用建议

知识库条目:
{context}

用户问题: {question}

以 JSON 格式返回:
{{"answer": "你的回答（支持引用 [来源N]）", "sourceIds": ["用到的条目ID列表"]}}

只输出 JSON，无其他文本。"#
    );

    // Step 3: Call claude -p
    let output = tokio::task::spawn_blocking(move || run_claude(&prompt))
        .await
        .map_err(|e| format!("claude 调用失败: {e}"))??;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("claude 执行失败: {stderr}"));
    }

    let raw = String::from_utf8_lossy(&output.stdout);
    let text = raw.trim();

    // Step 4: Parse JSON response — use brace matching to handle nested content
    let json_str = find_json_object(text)
        .ok_or("AI 返回格式无效")?;

    let parsed: JsonValue =
        json_from_str(json_str).map_err(|e| format!("解析 AI 输出失败: {e}"))?;

    let answer = parsed
        .get("answer")
        .and_then(|v| v.as_str())
        .unwrap_or(text)
        .to_string();
    let source_ids: Vec<String> = parsed
        .get("sourceIds")
        .and_then(|v| v.as_array())
        .map(|arr| {
            arr.iter()
                .filter_map(|v| v.as_str().map(String::from))
                .collect()
        })
        .unwrap_or_default();

    // Step 5: Build response with full source metadata
    let matched_sources: Vec<&JsonValue> = sources
        .iter()
        .filter(|item| {
            item.get("id")
                .and_then(|v| v.as_str())
                .map(|id| source_ids.contains(&id.to_string()))
                .unwrap_or(false)
        })
        .collect();

    let output_sources: Vec<JsonValue> = if matched_sources.is_empty() && !sources.is_empty() {
        sources
            .iter()
            .map(|item| {
                let mut s = item.clone();
                if let JsonValue::Object(ref mut map) = s {
                    map.insert("relevance".into(), JsonValue::from("matched"));
                }
                s
            })
            .collect()
    } else {
        matched_sources
            .into_iter()
            .map(|item| {
                let mut s = item.clone();
                if let JsonValue::Object(ref mut map) = s {
                    map.insert("relevance".into(), JsonValue::from("cited"));
                }
                s
            })
            .collect()
    };

    Ok(json!({
        "answer": answer,
        "sources": output_sources,
    }))
}

