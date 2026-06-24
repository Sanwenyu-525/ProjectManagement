use std::fs;
use std::path::PathBuf;
use std::process::Command as StdCommand;

use serde::Deserialize;
use serde_json::{from_str as json_from_str, json, Value as JsonValue};
use tauri::{command, AppHandle, Manager, State};

use crate::db::Database;

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

    let output = tokio::task::spawn_blocking(move || {
        StdCommand::new("claude")
            .args(["-p", &prompt])
            .output()
    })
    .await
    .map_err(|e| format!("claude 调用失败: {e}"))?
    .map_err(|e| format!("claude 调用失败: {e}"))?;

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

// ── Seed mock data ──

#[command]
pub async fn knowledge_seed(db: State<'_, Database>) -> Result<JsonValue, String> {
    let now = crate::db::now_str();
    let mut count: u32 = 0;

    // ── project_memories ──
    let memories: Vec<(&str, &str, &str, &str, &str)> = vec![
        ("architecture", "Tauri IPC 命令注册模式", "每个新后端命令需要三步：\n1. 在 `src-tauri/src/commands/<domain>/<module>.rs` 添加 `#[command]` 函数\n2. 在 `src-tauri/src/lib.rs` 的 `generate_handler![]` 注册\n3. 在 `src/api/<module>.ts` 添加前端封装\n\n输入 struct 用 `#[serde(rename_all = \"camelCase\")]` 做 JS-Rust 名称转换。", "tauri,ipc,backend", "manual"),
        ("architecture", "前端状态管理约定", "Zustand store 按领域拆分：terminalStore, workspaceStore, agentStore, themeStore。\n\n核心规则：\n- `useStore(s => s.field)` selector 模式\n- 不在 store 中派生状态，用组件内 `useMemo`\n- localStorage 存临时 UI 状态，后端表存持久数据", "zustand,state,frontend", "manual"),
        ("code", "Rust 动态 SQL 构建模式", "部分更新用 `macro_rules! add_field!` 构建动态 SET 子句：\n\n```rust\nmacro_rules! add_field {\n    ($parts:expr, $field:expr, $name:expr) => {\n        if let Some(ref v) = $field {\n            $parts.push((format!(\"{} = ?\", $name), v.clone()));\n        }\n    };\n}\n```\n\n避免手动拼接 SQL 注入风险。", "rust,sql,dynamic-query", "manual"),
        ("bugfix", "xterm 终端中文输入乱码", "问题：PowerShell 环境下中文字符显示为乱码。\n\n根因：`terminal_start_shell` 用逐字节输出，UTF-8 多字节字符被截断。\n\n修复：改用 `String::from_utf8_lossy` 做缓冲，遇到不完整字节序列时等待下一次读取。", "terminal,utf8,powershell", "agent"),
        ("rule", "Ant Design 组件优先原则", "禁止手写 HTML 表单/表格/弹窗。所有交互组件必须用 Ant Design 的 Form、Table、Modal。\n\n例外：纯展示型的简单布局可以用原生 HTML + inline styles。", "ui,antd,convention", "manual"),
        ("session", "V3 架构重构完成", "完成工作区 V3 架构重构：\n- PaneTree 替代旧的固定三栏布局\n- 终端通过 PTY 直连 Agent CLI\n- 新增 Navigator + Toolbar 组件\n- Agent Provider 可插拔模式", "workspace,v3,refactor", "agent"),
        ("solution", "SQLite 并发写入冲突", "多窗口同时写入 SQLite 时报 `database is locked`。\n\n方案：启用 WAL 模式 + busy_timeout：\n```sql\nPRAGMA journal_mode=WAL;\nPRAGMA busy_timeout=5000;\n```\n\nWAL 允许并发读 + 单写，busy_timeout 让写操作自动重试。", "sqlite,wal,concurrency", "manual"),
        ("pattern", "React Query 缓存失效策略", "按领域组织 queryKey：\n```ts\nknowledge: {\n  list: (cat) => ['knowledge', 'list', cat],\n  counts: () => ['knowledge', 'counts'],\n}\n```\n\n写操作后用前缀匹配失效：`queryClient.invalidateQueries({ queryKey: ['knowledge'] })`。", "react-query,cache,frontend", "manual"),
        ("workflow", "功能开发标准流程", "1. 理解需求 → 确认范围\n2. 探索代码 → 找到相关文件\n3. 给出方案（2-3 选项）→ 等用户选\n4. 实现 → 每步验证 tsc + eslint\n5. 本地测试 → 确认行为正确\n6. 提交 → 规范 commit message", "workflow,process,development", "manual"),
        ("prompt", "代码审查提示词模板", "审查以下代码变更，关注：\n1. 类型安全 — 是否有 any/不安全断言\n2. 错误处理 — 边界情况是否覆盖\n3. 一致性 — 是否遵循项目既有模式\n4. 性能 — 是否有不必要的重渲染或查询\n\n给出具体行号和修复建议。", "prompt,review,code-quality", "manual"),
        ("experience", "glassmorphism 样式调试经验", "Ant Design + glassmorphism 的坑：\n- `backdrop-filter` 在 `overflow: hidden` 的父元素上不生效\n- `!important` 覆盖 antd 默认样式是常态，不要抗拒\n- 暗色模式下 `rgba` 透明度需要单独调，不能和亮色用同一值\n- CSS 变量定义在 `index.css`，Ant Design 主题在 `main.tsx` 的 ConfigProvider", "css,glassmorphism,antd", "ai-extract"),
        ("experience", "Tauri 插件对话框使用", "使用 `@tauri-apps/plugin-dialog` 的 `open()` 时：\n- 返回值可能是 `string | string[] | null`，必须处理三种情况\n- `filters` 的 `extensions` 不带点号：`['md', 'txt']` 不是 `['.md', '.txt']`\n- Windows 路径用反斜杠，传给 Rust 前最好统一成正斜杠", "tauri,dialog,windows", "ai-extract"),
        ("prompt", "架构方案评估框架", "评估方案时用这个框架：\n- **可行性**：技术上能实现吗？需要什么前置条件？\n- **复杂度**：改动范围多大？涉及几个模块？\n- **风险**：最坏情况是什么？如何回滚？\n- **收益**：解决什么问题？值得投入吗？", "prompt,architecture,evaluation", "manual"),
    ];

    for (mem_type, title, content, tags, source) in &memories {
        let id = crate::db::new_id();
        db.execute(
            "INSERT INTO project_memories (id, projectId, type, title, content, tags, source, sessionId, createdAt, updatedAt) \
             VALUES (?1, NULL, ?2, ?3, ?4, ?5, ?6, NULL, ?7, ?7)",
            rusqlite::params![id, mem_type, title, content, tags, source, now],
        ).map_err(|e| e.to_string())?;
        count += 1;
    }

    // ── decisions ──
    let decisions: Vec<(&str, &str, &str)> = vec![
        ("采用 Tauri 2.x 而非 Electron", "选择 Tauri 的理由：\n1. 包体积小（~5MB vs Electron ~150MB）\n2. Rust 后端性能好，SQLite 直连无中间层\n3. 安全性更高，无 Node.js 运行时暴露\n4. 前端完全自由，不限框架", "accepted"),
        ("Zustand 替代 Redux", "Redux 的 boilerplate 太多，Zustand 更轻量：\n- 无需 Provider 包裹\n- store 即 hook\n- 中间件（persist/devtools）按需引入\n- 对小团队来说学习成本更低", "accepted"),
        ("单用户无认证设计", "开发者工具不需要多用户：\n- 硬编码 `default-user`\n- 省去登录/权限/会话管理的复杂度\n- 数据全在本地 SQLite，物理隔离\n- 未来如需多人协作，再引入认证层", "accepted"),
        ("放弃 Web Worker 终端方案", "最初考虑在 Web Worker 里跑终端模拟，但：\n- 无法直接访问系统 PTY\n- xterm.js 需要真实 tty 才能正确渲染\n- 最终改为 Rust 直接 spawn shell 进程", "superseded"),
    ];

    for (title, reason, status) in &decisions {
        let id = crate::db::new_id();
        db.execute(
            "INSERT INTO decisions (id, projectId, title, reason, status, isPinned, createdAt, updatedAt) \
             VALUES (?1, NULL, ?2, ?3, ?4, 0, ?5, ?5)",
            rusqlite::params![id, title, reason, status, now],
        ).map_err(|e| e.to_string())?;
        count += 1;
    }

    // ── personal_notes ──
    let notes: Vec<(&str, &str, Option<&str>)> = vec![
        ("项目技术栈总览", "前端：React 18 + TypeScript + Vite 6\nUI：Ant Design 5 + 自定义 glassmorphism\n状态：Zustand\n后端：Rust + SQLite (rusqlite)\n桌面：Tauri 2.x\n图表：ECharts\n终端：xterm.js + PTY", Some("tech,overview")),
        ("开发环境快速启动", "```bash\nnpm run tauri dev    # 完整开发（前端 + 原生窗口）\nnpm run dev          # 仅前端（端口 1420）\ncd src-tauri && cargo check  # Rust 编译检查（快）\n```\n\n注意：`cargo check` 不生成二进制，适合快速验证语法。", Some("dev,setup")),
        ("UI 设计原则备忘", "Glassmorphism 浅色主题：\n- CSS 变量定义在 `index.css`\n- 组件用 inline styles（项目约定，不是临时方案）\n- 禁止硬编码颜色值，必须引用 CSS 变量\n- 字体：Fira Sans（正文）+ Fira Code（等宽）\n- 暗色模式通过 `data-theme` 属性切换", Some("design,ui")),
    ];

    for (title, content, tags) in &notes {
        let id = crate::db::new_id();
        db.execute(
            "INSERT INTO personal_notes (id, projectId, title, content, tags, filePath, createdAt, updatedAt) \
             VALUES (?1, NULL, ?2, ?3, ?4, NULL, ?5, ?5)",
            rusqlite::params![id, title, content, tags, now],
        ).map_err(|e| e.to_string())?;
        count += 1;
    }

    Ok(json!({ "inserted": count }))
}
