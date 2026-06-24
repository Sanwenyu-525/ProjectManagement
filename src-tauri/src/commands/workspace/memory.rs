use serde::Deserialize;
use serde_json::{json, Value as JsonValue};
use tauri::{command, State};

use crate::db::Database;

// ── Memories ──

const VALID_MEMORY_TYPES: &[&str] = &[
    "architecture", "code", "bugfix", "rule", "session", "decision",
    "solution", "pattern", "prompt", "workflow", "experience",
];

fn validate_memory_type(s: &str) -> Result<(), String> {
    if VALID_MEMORY_TYPES.contains(&s) {
        Ok(())
    } else {
        Err(format!(
            "invalid type '{}': must be one of {:?}",
            s, VALID_MEMORY_TYPES
        ))
    }
}

#[command]
pub async fn memories_list(
    db: State<'_, Database>,
    project_id: Option<String>,
) -> Result<JsonValue, String> {
    if let Some(pid) = project_id {
        db.query_json(
            "SELECT * FROM project_memories WHERE projectId = ?1 ORDER BY isPinned DESC, createdAt DESC",
            rusqlite::params![pid],
        )
        .map_err(|e| e.to_string())
    } else {
        db.query_json(
            "SELECT * FROM project_memories ORDER BY isPinned DESC, createdAt DESC",
            rusqlite::params![],
        )
        .map_err(|e| e.to_string())
    }
}

#[command]
pub async fn memories_search(
    db: State<'_, Database>,
    project_id: Option<String>,
    query: String,
) -> Result<JsonValue, String> {
    // Try FTS5 first, fall back to LIKE
    let fts_result = if query.trim().is_empty() {
        None
    } else {
        let fts_query = query
            .split_whitespace()
            .map(|term| format!("\"{}\"", term.replace('"', "")))
            .collect::<Vec<_>>()
            .join(" OR ");

        let sql = if let Some(ref pid) = project_id {
            db.query_json(
                "SELECT pm.* FROM project_memories pm \
                 JOIN project_memories_fts fts ON pm.rowid = fts.rowid \
                 WHERE project_memories_fts MATCH ?1 AND pm.projectId = ?2 \
                 ORDER BY fts.rank \
                 LIMIT 50",
                rusqlite::params![fts_query, pid],
            )
        } else {
            db.query_json(
                "SELECT pm.* FROM project_memories pm \
                 JOIN project_memories_fts fts ON pm.rowid = fts.rowid \
                 WHERE project_memories_fts MATCH ?1 \
                 ORDER BY fts.rank \
                 LIMIT 50",
                rusqlite::params![fts_query],
            )
        };

        match sql {
            Ok(JsonValue::Array(arr)) if !arr.is_empty() => Some(JsonValue::Array(arr)),
            _ => None,
        }
    };

    if let Some(result) = fts_result {
        return Ok(result);
    }

    // Fallback to LIKE search
    let pattern = format!("%{}%", query);
    if let Some(pid) = project_id {
        db.query_json(
            "SELECT * FROM project_memories WHERE projectId = ?1 AND (title LIKE ?2 OR content LIKE ?2 OR tags LIKE ?2) ORDER BY isPinned DESC, createdAt DESC",
            rusqlite::params![pid, pattern],
        )
        .map_err(|e| e.to_string())
    } else {
        db.query_json(
            "SELECT * FROM project_memories WHERE title LIKE ?1 OR content LIKE ?1 OR tags LIKE ?1 ORDER BY isPinned DESC, createdAt DESC",
            rusqlite::params![pattern],
        )
        .map_err(|e| e.to_string())
    }
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateMemoryInput {
    pub project_id: Option<String>,
    pub memory_type: String,
    pub title: String,
    pub content: String,
    pub tags: Option<String>,
    pub source: Option<String>,
    pub session_id: Option<String>,
}

#[command]
pub async fn memories_create(
    db: State<'_, Database>,
    data: CreateMemoryInput,
) -> Result<JsonValue, String> {
    validate_memory_type(&data.memory_type)?;

    let id = crate::db::new_id();
    let now = crate::db::now_str();
    let source = data.source.unwrap_or_else(|| "manual".into());

    db.execute(
        "INSERT INTO project_memories (id, projectId, type, title, content, tags, source, sessionId, createdAt, updatedAt) \
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?9)",
        rusqlite::params![
            id,
            data.project_id,
            data.memory_type,
            data.title,
            data.content,
            data.tags,
            source,
            data.session_id,
            now,
        ],
    )
    .map_err(|e| e.to_string())?;

    db.query_one_json(
        "SELECT * FROM project_memories WHERE id = ?1",
        rusqlite::params![id],
    )
    .map_err(|e| e.to_string())?
    .ok_or_else(|| "Failed to create memory".into())
}

#[command]
pub async fn memories_delete(db: State<'_, Database>, id: String) -> Result<(), String> {
    db.execute(
        "DELETE FROM project_memories WHERE id = ?1",
        rusqlite::params![id],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

#[command]
pub async fn memories_pin(db: State<'_, Database>, id: String) -> Result<JsonValue, String> {
    let now = crate::db::now_str();
    db.execute(
        "UPDATE project_memories SET isPinned = CASE WHEN isPinned = 1 THEN 0 ELSE 1 END, updatedAt = ?1 WHERE id = ?2",
        rusqlite::params![now, id],
    )
    .map_err(|e| e.to_string())?;

    db.query_one_json(
        "SELECT * FROM project_memories WHERE id = ?1",
        rusqlite::params![id],
    )
    .map_err(|e| e.to_string())?
    .ok_or_else(|| "Memory not found".into())
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateMemoryInput {
    pub id: String,
    pub title: Option<String>,
    pub content: Option<String>,
    pub tags: Option<String>,
}

#[command]
pub async fn memories_update(
    db: State<'_, Database>,
    data: UpdateMemoryInput,
) -> Result<JsonValue, String> {
    let now = crate::db::now_str();
    let mut sets: Vec<String> = Vec::new();
    let mut params: Vec<Box<dyn rusqlite::types::ToSql>> = Vec::new();
    let mut idx = 1;

    if let Some(ref t) = data.title {
        sets.push(format!("title = ?{}", idx));
        params.push(Box::new(t.clone()));
        idx += 1;
    }
    if let Some(ref c) = data.content {
        sets.push(format!("content = ?{}", idx));
        params.push(Box::new(c.clone()));
        idx += 1;
    }
    if let Some(ref t) = data.tags {
        sets.push(format!("tags = ?{}", idx));
        params.push(Box::new(t.clone()));
        idx += 1;
    }

    if sets.is_empty() {
        return Err("No fields to update".into());
    }

    sets.push(format!("updatedAt = ?{}", idx));
    params.push(Box::new(now));
    idx += 1;

    let sql = format!(
        "UPDATE project_memories SET {} WHERE id = ?{}",
        sets.join(", "),
        idx
    );
    params.push(Box::new(data.id.clone()));

    let param_refs: Vec<&dyn rusqlite::types::ToSql> = params.iter().map(|p| p.as_ref()).collect();
    db.execute(&sql, &param_refs)
        .map_err(|e| e.to_string())?;

    db.query_one_json(
        "SELECT * FROM project_memories WHERE id = ?1",
        rusqlite::params![data.id],
    )
    .map_err(|e| e.to_string())?
    .ok_or_else(|| "Memory not found".into())
}

// ── Context Engine ──

const HIGH_VALUE_TYPES: &[&str] = &["architecture", "rule", "solution", "pattern"];

fn type_weight(ty: &str) -> f64 {
    if HIGH_VALUE_TYPES.contains(&ty) { 1.5 } else { 1.0 }
}

fn recency_bonus(created_at: &str) -> f64 {
    if let Ok(dt) = chrono::NaiveDateTime::parse_from_str(created_at, "%Y-%m-%dT%H:%M:%SZ") {
        let now = chrono::Utc::now().naive_utc();
        let days = (now - dt).num_days() as f64;
        (2.0 - days / 30.0).max(0.0)
    } else {
        0.0
    }
}

#[command]
pub async fn context_retrieve(
    db: State<'_, Database>,
    query: String,
    project_id: Option<String>,
    limit: Option<i32>,
) -> Result<JsonValue, String> {
    let limit = limit.unwrap_or(10).max(1).min(50);

    if query.trim().is_empty() {
        let sql = if let Some(ref pid) = project_id {
            db.query_json(
                "SELECT * FROM project_memories WHERE projectId = ?1 AND (isPinned = 1 OR type IN ('architecture','rule','solution','pattern')) ORDER BY isPinned DESC, createdAt DESC LIMIT ?2",
                rusqlite::params![pid, limit],
            )
        } else {
            db.query_json(
                "SELECT * FROM project_memories WHERE isPinned = 1 OR type IN ('architecture','rule','solution','pattern') ORDER BY isPinned DESC, createdAt DESC LIMIT ?1",
                rusqlite::params![limit],
            )
        };
        return sql.map_err(|e| e.to_string());
    }

    let fts_query = query
        .split_whitespace()
        .map(|term| format!("\"{}\"", term.replace('"', "")))
        .collect::<Vec<_>>()
        .join(" OR ");

    let raw_results = if let Some(ref pid) = project_id {
        db.query_json(
            "SELECT pm.*, fts.rank FROM project_memories pm \
             JOIN project_memories_fts fts ON pm.rowid = fts.rowid \
             WHERE project_memories_fts MATCH ?1 AND pm.projectId = ?2 \
             ORDER BY fts.rank \
             LIMIT 50",
            rusqlite::params![fts_query, pid],
        )
    } else {
        db.query_json(
            "SELECT pm.*, fts.rank FROM project_memories pm \
             JOIN project_memories_fts fts ON pm.rowid = fts.rowid \
             WHERE project_memories_fts MATCH ?1 \
             ORDER BY fts.rank \
             LIMIT 50",
            rusqlite::params![fts_query],
        )
    };

    let results = raw_results.map_err(|e| e.to_string())?;

    let JsonValue::Array(rows) = results else {
        return Ok(JsonValue::Array(vec![]));
    };

    let mut scored: Vec<(f64, JsonValue)> = rows
        .into_iter()
        .map(|row| {
            let is_pinned = row.get("isPinned").and_then(|v| v.as_i64()).unwrap_or(0) == 1;
            let ty = row.get("type").and_then(|v| v.as_str()).unwrap_or("session");
            let created = row.get("createdAt").and_then(|v| v.as_str()).unwrap_or("");
            let fts_rank = row.get("rank").and_then(|v| v.as_f64()).unwrap_or(0.0);

            let pinned_bonus = if is_pinned { 5.0 } else { 0.0 };
            let fts_score = -fts_rank;
            let tw = type_weight(ty);
            let rb = recency_bonus(created);

            let final_score = fts_score * tw + pinned_bonus + rb;

            let mut item = row;
            if let JsonValue::Object(ref mut map) = item {
                map.remove("rank");
            }

            (final_score, item)
        })
        .collect();

    scored.sort_by(|a, b| b.0.partial_cmp(&a.0).unwrap_or(std::cmp::Ordering::Equal));
    scored.truncate(limit as usize);

    let output: Vec<JsonValue> = scored
        .into_iter()
        .map(|(score, mut item)| {
            if let JsonValue::Object(ref mut map) = item {
                map.insert("score".into(), JsonValue::from(score));
            }
            item
        })
        .collect();

    Ok(JsonValue::Array(output))
}

// ── Build Context (Agent Memory Pack) ──

#[command]
pub async fn build_context(
    db: State<'_, Database>,
    project_id: Option<String>,
) -> Result<JsonValue, String> {
    let mut sections: Vec<String> = Vec::new();
    let mut memory_count = 0i32;
    let mut decision_count = 0i32;

    // 1. Pinned memories
    let pinned = if let Some(ref pid) = project_id {
        db.query_json(
            "SELECT title, content, type FROM project_memories WHERE projectId = ?1 AND isPinned = 1 ORDER BY updatedAt DESC",
            rusqlite::params![pid],
        )
    } else {
        db.query_json(
            "SELECT title, content, type FROM project_memories WHERE isPinned = 1 ORDER BY updatedAt DESC",
            rusqlite::params![],
        )
    };
    let pinned = pinned.map_err(|e| e.to_string())?;

    if let JsonValue::Array(ref items) = pinned {
        if !items.is_empty() {
            let mut section = String::from("=== Pinned Memory ===\n");
            for item in items {
                let title = item.get("title").and_then(|v| v.as_str()).unwrap_or("");
                let content = item.get("content").and_then(|v| v.as_str()).unwrap_or("");
                section.push_str(&format!("- [{}] {}\n", title, truncate(content, 200)));
                memory_count += 1;
            }
            sections.push(section);
        }
    }

    // 2. Recent decisions
    let decisions = if let Some(ref pid) = project_id {
        db.query_json(
            "SELECT title, reason, context, options, consequences FROM decisions WHERE projectId = ?1 AND status = 'accepted' ORDER BY createdAt DESC LIMIT 10",
            rusqlite::params![pid],
        )
    } else {
        db.query_json(
            "SELECT title, reason, context, options, consequences FROM decisions WHERE status = 'accepted' ORDER BY createdAt DESC LIMIT 10",
            rusqlite::params![],
        )
    };
    let decisions = decisions.map_err(|e| e.to_string())?;

    if let JsonValue::Array(ref items) = decisions {
        if !items.is_empty() {
            let mut section = String::from("=== Recent Decisions ===\n");
            for item in items {
                let title = item.get("title").and_then(|v| v.as_str()).unwrap_or("");
                let reason = item.get("reason").and_then(|v| v.as_str()).unwrap_or("");
                let context = item.get("context").and_then(|v| v.as_str()).unwrap_or("");
                let options = item.get("options").and_then(|v| v.as_str()).unwrap_or("");
                let consequences = item.get("consequences").and_then(|v| v.as_str()).unwrap_or("");

                section.push_str(&format!("- {} | Reason: {}", title, truncate(reason, 150)));
                if !context.is_empty() {
                    section.push_str(&format!(" | Context: {}", truncate(context, 150)));
                }
                if !options.is_empty() {
                    section.push_str(&format!(" | Options: {}", truncate(options, 150)));
                }
                if !consequences.is_empty() {
                    section.push_str(&format!(" | Consequences: {}", truncate(consequences, 150)));
                }
                section.push('\n');
                decision_count += 1;
            }
            sections.push(section);
        }
    }

    // 3. Bugfix/solution memories
    let issues = if let Some(ref pid) = project_id {
        db.query_json(
            "SELECT title, content FROM project_memories WHERE projectId = ?1 AND type IN ('bugfix','solution') ORDER BY createdAt DESC LIMIT 20",
            rusqlite::params![pid],
        )
    } else {
        db.query_json(
            "SELECT title, content FROM project_memories WHERE type IN ('bugfix','solution') ORDER BY createdAt DESC LIMIT 20",
            rusqlite::params![],
        )
    };
    let issues = issues.map_err(|e| e.to_string())?;

    if let JsonValue::Array(ref items) = issues {
        if !items.is_empty() {
            let mut section = String::from("=== Known Issues & Solutions ===\n");
            for item in items {
                let title = item.get("title").and_then(|v| v.as_str()).unwrap_or("");
                let content = item.get("content").and_then(|v| v.as_str()).unwrap_or("");
                section.push_str(&format!("- {}: {}\n", title, truncate(content, 200)));
                memory_count += 1;
            }
            sections.push(section);
        }
    }

    // 4. Architecture/rule memories
    let arch = if let Some(ref pid) = project_id {
        db.query_json(
            "SELECT title, content FROM project_memories WHERE projectId = ?1 AND type IN ('architecture','rule') ORDER BY createdAt DESC LIMIT 10",
            rusqlite::params![pid],
        )
    } else {
        db.query_json(
            "SELECT title, content FROM project_memories WHERE type IN ('architecture','rule') ORDER BY createdAt DESC LIMIT 10",
            rusqlite::params![],
        )
    };
    let arch = arch.map_err(|e| e.to_string())?;

    if let JsonValue::Array(ref items) = arch {
        if !items.is_empty() {
            let mut section = String::from("=== Architecture & Rules ===\n");
            for item in items {
                let title = item.get("title").and_then(|v| v.as_str()).unwrap_or("");
                let content = item.get("content").and_then(|v| v.as_str()).unwrap_or("");
                section.push_str(&format!("- {}: {}\n", title, truncate(content, 200)));
                memory_count += 1;
            }
            sections.push(section);
        }
    }

    let packed_context = if sections.is_empty() {
        String::new()
    } else {
        format!(
            "=== Project Memory Pack ===\n{}\nPlease use this context to inform your responses.",
            sections.join("\n")
        )
    };

    Ok(json!({
        "packedContext": packed_context,
        "memoryCount": memory_count,
        "decisionCount": decision_count,
    }))
}

fn truncate(s: &str, max_len: usize) -> String {
    if s.len() <= max_len {
        s.to_string()
    } else {
        let truncate_at = s
            .char_indices()
            .take_while(|&(i, _)| i < max_len)
            .last()
            .map(|(i, c)| i + c.len_utf8())
            .unwrap_or(0);
        format!("{}...", &s[..truncate_at])
    }
}

// ── Decisions (ADR) ──

#[command]
pub async fn decisions_list(
    db: State<'_, Database>,
    project_id: Option<String>,
) -> Result<JsonValue, String> {
    if let Some(pid) = project_id {
        db.query_json(
            "SELECT * FROM decisions WHERE projectId = ?1 ORDER BY createdAt DESC",
            rusqlite::params![pid],
        )
        .map_err(|e| e.to_string())
    } else {
        db.query_json(
            "SELECT * FROM decisions ORDER BY createdAt DESC",
            rusqlite::params![],
        )
        .map_err(|e| e.to_string())
    }
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateDecisionInput {
    pub project_id: Option<String>,
    pub title: String,
    pub reason: String,
    pub alternatives: Option<String>,
    pub session_id: Option<String>,
    pub context: Option<String>,
    pub options: Option<String>,
    pub consequences: Option<String>,
    pub status: Option<String>,
}

#[command]
pub async fn decisions_create(
    db: State<'_, Database>,
    data: CreateDecisionInput,
) -> Result<JsonValue, String> {
    let id = crate::db::new_id();
    let now = crate::db::now_str();
    let status = data.status.unwrap_or_else(|| "accepted".into());

    db.execute(
        "INSERT INTO decisions (id, projectId, title, reason, alternatives, sessionId, context, options, consequences, status, createdAt, updatedAt) \
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?11)",
        rusqlite::params![
            id,
            data.project_id,
            data.title,
            data.reason,
            data.alternatives,
            data.session_id,
            data.context,
            data.options,
            data.consequences,
            status,
            now,
        ],
    )
    .map_err(|e| e.to_string())?;

    db.query_one_json(
        "SELECT * FROM decisions WHERE id = ?1",
        rusqlite::params![id],
    )
    .map_err(|e| e.to_string())?
    .ok_or_else(|| "Failed to create decision".into())
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateDecisionInput {
    pub id: String,
    pub title: Option<String>,
    pub reason: Option<String>,
    pub context: Option<String>,
    pub options: Option<String>,
    pub consequences: Option<String>,
    pub status: Option<String>,
}

#[command]
pub async fn decisions_update(
    db: State<'_, Database>,
    data: UpdateDecisionInput,
) -> Result<JsonValue, String> {
    let now = crate::db::now_str();
    let mut sets: Vec<String> = Vec::new();
    let mut params: Vec<Box<dyn rusqlite::types::ToSql>> = Vec::new();
    let mut idx = 1;

    if let Some(ref t) = data.title {
        sets.push(format!("title = ?{}", idx));
        params.push(Box::new(t.clone()));
        idx += 1;
    }
    if let Some(ref r) = data.reason {
        sets.push(format!("reason = ?{}", idx));
        params.push(Box::new(r.clone()));
        idx += 1;
    }
    if let Some(ref c) = data.context {
        sets.push(format!("context = ?{}", idx));
        params.push(Box::new(c.clone()));
        idx += 1;
    }
    if let Some(ref o) = data.options {
        sets.push(format!("options = ?{}", idx));
        params.push(Box::new(o.clone()));
        idx += 1;
    }
    if let Some(ref c) = data.consequences {
        sets.push(format!("consequences = ?{}", idx));
        params.push(Box::new(c.clone()));
        idx += 1;
    }
    if let Some(ref s) = data.status {
        sets.push(format!("status = ?{}", idx));
        params.push(Box::new(s.clone()));
        idx += 1;
    }

    if sets.is_empty() {
        return Err("No fields to update".into());
    }

    sets.push(format!("updatedAt = ?{}", idx));
    params.push(Box::new(now));
    idx += 1;

    let sql = format!(
        "UPDATE decisions SET {} WHERE id = ?{}",
        sets.join(", "),
        idx
    );
    params.push(Box::new(data.id.clone()));

    let param_refs: Vec<&dyn rusqlite::types::ToSql> = params.iter().map(|p| p.as_ref()).collect();
    db.execute(&sql, &param_refs)
        .map_err(|e| e.to_string())?;

    db.query_one_json(
        "SELECT * FROM decisions WHERE id = ?1",
        rusqlite::params![data.id],
    )
    .map_err(|e| e.to_string())?
    .ok_or_else(|| "Decision not found".into())
}

#[command]
pub async fn decisions_delete(db: State<'_, Database>, id: String) -> Result<(), String> {
    db.execute(
        "DELETE FROM decisions WHERE id = ?1",
        rusqlite::params![id],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

// ── Memory Relations ──

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AddRelationInput {
    pub source_id: String,
    pub target_id: String,
    pub relation_type: Option<String>,
}

#[command]
pub async fn memory_relations_add(
    db: State<'_, Database>,
    data: AddRelationInput,
) -> Result<JsonValue, String> {
    let id = crate::db::new_id();
    let now = crate::db::now_str();
    let rel_type = data.relation_type.unwrap_or_else(|| "related_to".into());

    db.execute(
        "INSERT INTO memory_relations (id, sourceId, targetId, relationType, createdAt) \
         VALUES (?1, ?2, ?3, ?4, ?5)",
        rusqlite::params![id, data.source_id, data.target_id, rel_type, now],
    )
    .map_err(|e| e.to_string())?;

    Ok(json!({ "id": id }))
}

#[command]
pub async fn memory_relations_list(
    db: State<'_, Database>,
    memory_id: String,
) -> Result<JsonValue, String> {
    db.query_json(
        "SELECT mr.*, pm.title, pm.type, pm.content FROM memory_relations mr \
         JOIN project_memories pm ON (pm.id = mr.targetId OR pm.id = mr.sourceId) AND pm.id != ?1 \
         WHERE mr.sourceId = ?1 OR mr.targetId = ?1 \
         ORDER BY mr.createdAt DESC",
        rusqlite::params![memory_id],
    )
    .map_err(|e| e.to_string())
}

// ── Knowledge Base ──

#[command]
pub async fn knowledge_list(
    db: State<'_, Database>,
    category: Option<String>,
    project_id: Option<String>,
    limit: Option<i32>,
) -> Result<JsonValue, String> {
    let limit = limit.unwrap_or(100).max(1).min(500);

    let mut conditions: Vec<String> = Vec::new();
    let mut params: Vec<Box<dyn rusqlite::types::ToSql>> = Vec::new();
    let mut idx = 1;

    if let Some(ref cat) = category {
        conditions.push(format!("category = ?{}", idx));
        params.push(Box::new(cat.clone()));
        idx += 1;
    }
    if let Some(ref pid) = project_id {
        conditions.push(format!("projectId = ?{}", idx));
        params.push(Box::new(pid.clone()));
        idx += 1;
    }

    params.push(Box::new(limit));

    let where_clause = if conditions.is_empty() {
        String::new()
    } else {
        format!("WHERE {}", conditions.join(" AND "))
    };

    let sql = format!(
        "SELECT * FROM knowledge_items {} ORDER BY isPinned DESC, createdAt DESC LIMIT ?{}",
        where_clause, idx
    );

    let param_refs: Vec<&dyn rusqlite::types::ToSql> = params.iter().map(|p| p.as_ref()).collect();
    db.query_json(&sql, &param_refs)
        .map_err(|e| e.to_string())
}

#[command]
pub async fn knowledge_counts(
    db: State<'_, Database>,
    project_id: Option<String>,
) -> Result<JsonValue, String> {
    if let Some(pid) = project_id {
        db.query_json(
            "SELECT category, COUNT(*) as count FROM knowledge_items WHERE projectId = ?1 GROUP BY category",
            rusqlite::params![pid],
        )
        .map_err(|e| e.to_string())
    } else {
        db.query_json(
            "SELECT category, COUNT(*) as count FROM knowledge_items GROUP BY category",
            rusqlite::params![],
        )
        .map_err(|e| e.to_string())
    }
}
