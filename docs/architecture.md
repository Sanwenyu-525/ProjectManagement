# DevHub 项目架构文档

> **DevHub** (v1.0.4) — 开发者项目管理平台，Tauri 2.x 桌面应用。
> React + TypeScript 前端通过 Tauri IPC 与 Rust 后端通信，SQLite 持久化。

---

## 1. 技术栈

| 层 | 技术 | 说明 |
|---|------|------|
| 框架 | Tauri 2.x | 桌面应用，Rust 后端 + Web 前端 |
| 前端 | React 18, TypeScript, Vite 6 | SPA，所有页面懒加载 |
| UI 组件库 | Ant Design 5 | 中文（zh_CN locale），全局 ConfigProvider |
| UI 风格 | Glassmorphism 毛玻璃 | CSS 变量 + 内联样式 + `.glass` 工具类 |
| 状态管理 | Zustand | 5 个 store，inline selector |
| 数据获取 | TanStack React Query | 30s stale, 5min GC, 1 retry |
| 图表 | ECharts | 数据大屏、仪表盘 |
| 拖拽 | @dnd-kit | 看板拖拽 |
| 代码编辑 | CodeMirror | 多标签编辑器，支持 IME 中文输入 |
| 终端 | xterm.js | PTY 终端渲染 |
| 后端 | Rust | Tauri 命令模块 |
| 数据库 | SQLite (rusqlite 0.32) | r2d2 连接池，WAL 模式 |
| PTY | portable-pty 0.8 | 交互式终端 |
| 编码 | encoding_rs 0.8 | UTF-8/GBK 流解码（中文 Windows） |

---

## 2. 目录结构

### 前端 (`src/`)

```
src/
├── App.tsx                 # 路由定义（所有页面懒加载）
├── main.tsx                # 入口：QueryClientProvider → ConfigProvider → BrowserRouter
├── index.css               # 全局 CSS + 设计 token
├── vite-env.d.ts
│
├── api/                    # IPC API 层（所有 Tauri invoke 封装）
│   ├── client.ts           # cmd() 泛型封装 + screenshotApi
│   ├── project.ts          # projectsApi, tasksApi, reposApi, documentsApi, milestonesApi,
│   │                       # tagsApi, timelineApi, searchApi, detectApi, healthApi,
│   │                       # dependenciesApi, gitApi, brainApi
│   ├── agent.ts            # sessionsApi, agentTasksApi
│   ├── browser.ts          # browserMemoryApi
│   ├── terminal.ts         # terminalApi, filesApi
│   ├── workspace.ts        # workspacesApi
│   ├── build.ts            # buildsApi, templatesApi, integrationsApi
│   ├── queryKeys.ts        # 集中 React Query 缓存 key
│   ├── types/              # API 层专用类型（FileEntry, TerminalApi 等）
│   └── index.ts            # barrel re-export
│
├── features/               # 功能页面（路由级组件）
│   ├── dashboard/          # DashboardPage — 首页仪表盘
│   ├── projects/           # 项目管理（最复杂的 feature）
│   │   ├── ProjectsPage.tsx
│   │   ├── ProjectDetailPage.tsx + .css
│   │   ├── NewProjectWizard.tsx + .css
│   │   ├── DependencyGraphPage.tsx
│   │   ├── HealthTab.tsx
│   │   ├── projectUtils.ts, useBatchLaunch.tsx, useScanProjects.ts
│   │   ├── git/            # GitTab, BranchSelector, CommitGraph, DiffViewer,
│   │   │                   # GitTagList, StagingArea
│   │   └── tabs/           # ConfigTab, MilestonesTab, TasksTab
│   ├── git/                # GitDashboardPage, CommitInspector, ConflictAlert,
│   │                       # GitCommitTable, RepoInsights, SplitDiffViewer, gitTypes
│   ├── settings/           # SettingsPage
│   ├── timeline/           # TimelinePage
│   ├── data-screen/        # DataScreenPage — ECharts 数据大屏
│   ├── agents/             # AgentCenterPage
│   ├── builds/             # BuildCenterPage
│   ├── documents/          # KnowledgeCenterPage
│   ├── browser-workspace/  # BrowserWorkspacePage
│   ├── auth/               # （空）
│   └── tasks/              # （空）
│
├── hooks/                  # 自定义 React hooks（12 个）
│   ├── useAgentTasks.ts    # Agent 任务 CRUD
│   ├── useBuilds.ts        # 构建管理
│   ├── useCommandPalette.ts
│   ├── useDebounce.ts
│   ├── useFiles.ts         # 文件操作
│   ├── useGit.ts           # Git 操作
│   ├── useHealth.ts        # 健康检查
│   ├── useProjects.ts      # 项目 CRUD
│   ├── useSearch.ts        # 全局搜索
│   ├── useSessions.ts      # Agent 会话
│   ├── useTimeline.ts      # 时间线
│   └── useWorkspaces.ts    # 工作区
│
├── lib/                    # 工具函数
│   ├── aiContext.ts        # AI 上下文工具
│   ├── constants.ts        # 状态颜色、优先级、shell 映射
│   ├── format.ts           # 格式化
│   ├── healthUtils.ts      # 健康检查工具
│   ├── keyboard.ts         # 快捷键
│   ├── launchProfiles.ts   # 启动配置
│   ├── launchUtils.ts      # 启动工具
│   ├── mcpServer.ts        # MCP server 工具
│   ├── normalize.ts        # techStack JSON→Array 标准化
│   ├── projectUtils.ts     # 项目工具
│   ├── queryClient.ts      # React Query 客户端配置
│   └── themeColors.ts      # 主题感知色板
│
├── shared/                 # 共享组件和基础设施
│   ├── MainLayout.tsx      # 应用壳布局（侧边栏 + 顶栏 + CommandPalette）
│   ├── ErrorBoundary.tsx
│   ├── FileExplorer.tsx    # 文件浏览器
│   ├── GlobalSearch.tsx    # 全局搜索
│   ├── HealthBadge.tsx     # 健康状态徽章
│   ├── QuickLaunchModal.tsx
│   ├── TerminalInstance.tsx # 单个 xterm.js 终端实例
│   ├── TerminalManager.tsx
│   ├── terminalThemes.ts   # 终端主题定义
│   ├── terminalTypes.ts    # 终端核心类型
│   │
│   ├── components/         # 通用 UI 组件
│   │   ├── CommandPalette.tsx  # Cmd+K 命令面板
│   │   ├── GlassCard.tsx       # 毛玻璃卡片
│   │   ├── SearchBox.tsx       # 搜索框
│   │   ├── StatusBadge.tsx     # 状态徽章
│   │   ├── TechTag.tsx         # 技术标签
│   │   └── ToggleSwitch.tsx    # 开关
│   │
│   ├── styles/             # 设计系统 CSS
│   │   ├── variables.css   # CSS 变量（--color-*, --shadow-*, --font-*）
│   │   ├── glassmorphism.css   # .glass, .glass-strong 工具类
│   │   └── animations.css
│   │
│   ├── terminal/           # 终端 UI 组件
│   │   ├── TerminalGroup.tsx
│   │   ├── TerminalPane.tsx
│   │   ├── TerminalTab.tsx
│   │   ├── TerminalTabBar.tsx
│   │   └── SplitDivider.tsx
│   │
│   ├── KanbanBoard/        # 看板拖拽
│   ├── ProjectIcon/        # 项目图标
│   └── workspace/          # 工作区系统（V3）
│       ├── WorkspacePage.tsx       # 主视图
│       ├── WorkspaceHeader.tsx     # 标题栏 + 控制按钮
│       ├── AgentSelector.tsx       # Agent 选择芯片行
│       ├── AgentChat.tsx           # Agent 聊天消息列表 + 输入
│       ├── AgentRightPanel.tsx     # 右侧边栏（Plan/Git/Files/Context）
│       ├── AgentPlanPanel.tsx      # 任务分解面板
│       ├── AgentGitTab.tsx         # Git 状态/暂存/提交
│       ├── BottomPanel.tsx         # 底部面板（Terminal/Preview/Logs）
│       ├── TerminalPane.tsx        # 独立终端面板
│       ├── CodeEditorPane.tsx      # 多标签代码编辑器
│       ├── FileViewer.tsx          # 文件查看器（文本/图片/二进制）
│       ├── FileEditor.tsx          # CodeMirror 编辑器（IME 安全）
│       ├── cmTheme.ts             # CodeMirror 主题 + 语言扩展
│       ├── terminalFactory.ts     # createTerminal() 工厂函数
│       ├── useXtermTerminal.ts    # xterm.js 生命周期 hook
│       └── StatusDot.tsx          # 状态指示点
│
├── stores/                 # Zustand 状态管理
│   ├── themeStore.ts       # 明暗模式切换，持久化 localStorage
│   ├── terminalStore.ts    # 终端实例、面板状态、分割比例、分组、主题
│   ├── agentStore.ts       # Agent 流式文本累积、claudeTerminalId
│   ├── agentWorkspaceStore.ts  # 右侧边栏宽度
│   └── previewStore.ts     # 自动发现的 dev-server URL
│
└── types/
    └── index.ts            # 所有领域类型（606 行）
```

### 后端 (`src-tauri/`)

```
src-tauri/
├── Cargo.toml
├── migrations/             # SQLite 迁移（11 个，启动时顺序执行）
│   ├── 001_init.sql
│   ├── 002_remove_users.sql
│   ├── 003_runtime_status.sql
│   ├── 004_health_score.sql
│   ├── 005_workspaces.sql
│   ├── 006_workspace_layout.sql
│   ├── 007_agent_sessions.sql
│   ├── 008_browser_memory.sql
│   ├── 009_builds_templates_integrations.sql
│   ├── 010_agent_providers.sql
│   └── 011_agent_tasks.sql
│
└── src/
    ├── main.rs             # 入口，调用 devhub_lib::run()
    ├── lib.rs              # 应用初始化 + 118 个命令注册
    ├── db.rs               # Database 层（r2d2 连接池 + query_json/execute）
    └── commands/           # IPC 命令模块（22 个）
        ├── mod.rs
        ├── projects.rs     # 15 commands — 项目 CRUD + 启动/停止/环境检测
        ├── tasks.rs        # 5 commands  — 任务 CRUD
        ├── repos.rs        # 5 commands  — 仓库管理
        ├── documents.rs    # 5 commands  — 文档管理
        ├── milestones.rs   # 4 commands  — 里程碑
        ├── tags.rs         # 6 commands  — 标签
        ├── search.rs       # 1 command   — 全局搜索
        ├── timeline.rs     # 2 commands  — 活动时间线
        ├── detect.rs       # 4 commands  — 项目自动检测（~1780 行，支持 20+ 语言）
        ├── brain.rs        # 1 command   — 深度项目分析
        ├── sessions.rs     # 9 commands  — Agent 会话 + 浏览器访问记录
        ├── agent_tasks.rs  # 5 commands  — Agent 任务
        ├── terminal.rs     # 7 commands  — 终端 PTY 管理
        ├── files.rs        # 9 commands  — 文件系统操作
        ├── git.rs          # 20 commands — 完整 Git 操作
        ├── dependencies.rs # 4 commands  — 项目依赖分析
        ├── health.rs       # 4 commands  — 健康检查（100 分制评分）
        ├── workspaces.rs   # 6 commands  — 工作区管理
        ├── builds.rs       # 7 commands  — 构建记录
        ├── templates.rs    # 4 commands  — 模板
        └── integrations.rs # 5 commands  — 集成（GitHub/GitLab 等）
```

---

## 3. 路由

所有路由在 `App.tsx` 中定义，包裹 `ErrorBoundary` + `MainLayout`。除 `ProjectsPage` 和 `NewProjectWizard` 外全部懒加载。

| 路由 | 组件 | 侧边栏可见 |
|------|------|:----------:|
| `/` | `WorkspacePage` | ✅ 工作区 |
| `/projects` | `ProjectsPage` | ✅ 项目管理 |
| `/projects/new` | `NewProjectWizard` | — |
| `/projects/:id` | `ProjectDetailPage` | — |
| `/settings` | `SettingsPage` | ✅ 设置 |
| `/git` | `GitDashboardPage` | ❌ |
| `/graph` | `DependencyGraphPage` | ❌ |
| `/timeline` | `TimelinePage` | ❌ |
| `/data-screen` | `DataScreenPage` | ❌ |
| `/agents` | `AgentCenterPage` | ❌ |
| `/builds` | `BuildCenterPage` | ❌ |
| `/knowledge` | `KnowledgeCenterPage` | ❌ |
| `/browser-workspace` | `BrowserWorkspacePage` | ❌ |
| `*` | 重定向到 `/` | — |

---

## 4. 应用初始化 (`main.tsx`)

```
React.StrictMode
  └── Root
        ├── QueryClientProvider  (React Query: 30s stale, 5min GC, 1 retry)
        ├── ConfigProvider        (Ant Design zh_CN, 动态明暗主题 token)
        │     └── dark: teal/cyan primary (#4fdbc8)
        │     └── light: deep teal primary (#006b5f)
        ├── BrowserRouter
        └── App                   (路由定义)
```

- 主题模式来自 `useThemeStore`（Zustand），同步到 `<html data-theme>` 属性
- 字体：Inter + 系统回退
- React Query 配置：`refetchOnWindowFocus: false`

---

## 5. 后端架构

### 5.1 应用初始化 (`lib.rs`)

加载 4 个 Tauri 插件：
1. `tauri_plugin_shell`
2. `tauri_plugin_dialog`
3. `tauri_plugin_window_state`
4. `tauri_plugin_screenshots`

初始化流程：
1. 设置窗口图标 `icons/icon.ico`
2. 创建 app data 目录，初始化 `Database`（`devhub.db`）
3. 注册 `Database` 为 managed state
4. 注册窗口关闭处理：`terminal::cleanup_all()` 终止所有子进程
5. 注册 **118 个** IPC 命令

### 5.2 数据库层 (`db.rs`)

**架构：**
- `Database` 结构体包装 `r2d2::Pool`（最大 10 连接）
- 自定义 `ConnectionManager`，启动时执行：
  ```sql
  PRAGMA journal_mode=WAL;
  PRAGMA foreign_keys=ON;
  PRAGMA busy_timeout=5000;
  ```
- `DbError` 枚举实现 `serde::Serialize` 用于 IPC 错误传递
- 单用户设计，无认证

**核心 API：**

| 方法 | 说明 |
|------|------|
| `query_json(sql, params)` | 返回 `serde_json::Value::Array` |
| `query_one_json(sql, params)` | 返回第一行或 `None` |
| `execute(sql, params)` | 执行语句，返回 `last_insert_rowid` |
| `execute_returning_changes(sql, params)` | 返回受影响行数 |
| `log_activity(action, entity_type, entity_id, details, project_id)` | 写入 activity_logs |
| `insert_and_fetch(...)` | 插入后查询返回新行 |
| `delete_by_id(table, id)` | 安全删除（白名单校验表名） |

**迁移策略：** 所有迁移通过 `include_str!` 在启动时顺序执行。使用 `CREATE TABLE IF NOT EXISTS` 保证幂等性。包含 `ALTER TABLE` 增量演化逻辑和失败恢复。

### 5.3 数据库 Schema

#### 核心表（001_init.sql）

**`projects`** — 中心实体

| 字段 | 类型 | 说明 |
|------|------|------|
| id | TEXT PK | UUID |
| name | TEXT | 项目名称 |
| description | TEXT | 描述 |
| status | TEXT | Idea/Planning/Active/Completed/Archived |
| priority | TEXT | Low/Medium/High/Critical |
| source | TEXT | Local/Remote/Hybrid |
| iconType / iconUrl / iconColor | TEXT | 图标 |
| localPath | TEXT | 本地路径 |
| openCommand | TEXT | 打开命令 |
| frontendCommand / backendCommand | TEXT | 启动命令 |
| frontendCwd / backendCwd | TEXT | 工作目录（迁移添加） |
| frontendStatus / backendStatus | TEXT | 运行状态（迁移添加） |
| lastLaunchTime | TEXT | 上次启动时间（迁移添加） |
| liveUrl / domainName | TEXT | 线上地址 |
| techStack | TEXT | JSON 数组 |
| workspaceId | TEXT FK | 所属工作区（迁移添加） |
| healthScore / healthStatus | TEXT | 健康评分（迁移添加） |
| startDate / targetDate | TEXT | 日期 |
| createdAt / updatedAt | TEXT | 时间戳 |

**`tasks`** — 项目任务（支持层级）

| 字段 | 说明 |
|------|------|
| id, title, description | 基本信息 |
| status | Todo/InProgress/Done |
| priority | Low/Medium/High/Critical |
| projectId FK | 所属项目 |
| milestoneId FK | 所属里程碑 |
| parentId FK | 父任务（自引用，支持树形结构） |
| repoScope FK | 关联仓库 |

**`milestones`** — 里程碑（id, name, description, dueDate, status, projectId FK）

**`documents`** — 项目文档（id, title, content, type: Doc/Note/README/API/Architecture）

**`remote_repos`** — Git 仓库（id, projectId FK, platform, repoUrl, repoFullName, defaultBranch, repoStatus, lastCommitSha/At, lastSyncAt, integrationId FK）

**`tags` / `project_tags`** — 标签系统（多对多）

**`activity_logs`** — 审计日志（id, action, entityType, entityId, details, projectId FK）

#### 扩展表

| 迁移 | 表 | 说明 |
|------|-----|------|
| db.rs 内联 | `project_health_checks` | 健康检查记录（git 状态、依赖、评分） |
| 005 | `workspaces` | 工作区（name, description, color, sortOrder） |
| 006 | — | workspaces 增加 `layout` JSON 字段 |
| 007 | `agent_sessions` | Agent 会话（agentTabId, runtimeId, status, cwd） |
| 007 | `agent_messages` | Agent 消息（sessionId FK, role, content） |
| 008 | `browser_visits` | 浏览器访问（url, title, domAnalysis） |
| 009 | `builds` | 构建记录（commitSha, branch, status, duration, platforms/artifacts JSON） |
| 009 | `build_logs` | 构建日志 |
| 009 | `templates` | 模板（name, category, data JSON） |
| 009 | `integrations` | 集成（platform, accessToken, settings JSON） |
| 010 | `model_providers` | AI 模型提供商（name, type, apiKey, baseUrl）⚠️ 无对应命令 |
| 010 | `agent_configs` | Agent 配置（providerId FK, model, systemPrompt）⚠️ 无对应命令 |
| 011 | `agent_tasks` | Agent 任务（sessionId FK, parentId FK, title, status, priority） |

### 5.4 IPC 命令总览（118 个）

| 模块 | 命令数 | 能力 |
|------|:------:|------|
| `projects.rs` | 15 | CRUD + 启动/停止 + 环境检测 + 批量导入 + 刷新 |
| `tasks.rs` | 5 | CRUD + 状态变更 |
| `repos.rs` | 5 | CRUD + 同步 |
| `documents.rs` | 5 | CRUD |
| `milestones.rs` | 4 | CRUD |
| `tags.rs` | 6 | CRUD + 分配/移除项目 |
| `search.rs` | 1 | 全文 LIKE 搜索（项目/任务/文档各 10 条） |
| `timeline.rs` | 2 | 全局/项目级活动流 |
| `detect.rs` | 4 | 本地检测 + Git 克隆检测 + 目录扫描 + Agent 检测 |
| `brain.rs` | 1 | 深度分析（目录树、入口、环境、语言统计） |
| `sessions.rs` | 9 | Agent 会话 CRUD + 消息 + 清理 + 浏览器访问记录 |
| `agent_tasks.rs` | 5 | CRUD + 批量创建 |
| `terminal.rs` | 7 | 启动（3 种模式）+ 输入 + 停止 + resize + launcher |
| `files.rs` | 9 | 目录列表 + 读写 + 文件树 + 创建/重命名/删除 + IDE 打开 |
| `git.rs` | 20 | 完整 Git：status/log/branches/diff/add/commit/push/pull/stash/tags/revert/fetch |
| `dependencies.rs` | 4 | 依赖图 + 拓扑排序 + Docker Compose + Monorepo 检测 |
| `health.rs` | 4 | 全量/单项目检查 + 历史 + 最新状态 |
| `workspaces.rs` | 6 | CRUD + 分配项目 + 布局持久化 |
| `builds.rs` | 7 | CRUD + 日志 |
| `templates.rs` | 4 | CRUD |
| `integrations.rs` | 5 | CRUD |

### 5.5 后端关键模式

1. **所有命令**：`async #[command]` 函数，接收 `State<'_, Database>` + 可选 `AppHandle`
2. **无 ORM**：全部手写 SQL，`query_json` 返回 `serde_json::Value` 直接序列化到前端
3. **动态更新**：`macro_rules! add_field!` 按需构建 `SET` 子句，参数化 `?1, ?2, ...`
4. **活动日志**：项目/任务/仓库的增删改操作自动调用 `db.log_activity()`
5. **终端双架构**：非交互 → `std::process::Command` + pipe；交互 → `portable-pty` PTY
6. **进程管理**：`static LazyLock<Mutex<HashMap<String, Child>>>` 全局进程注册表
7. **项目检测**：`detect.rs` 最大模块（~1780 行），支持 20+ 语言/框架的图标、命令、技术栈自动检测
8. **Windows 兼容**：所有进程启动有 `#[cfg(target_os = "windows")]` 分支；Windows 使用 `cmd.exe /C` + `chcp 65001` 设 UTF-8；npm `.cmd` 脚本必须通过 `cmd.exe` 路由；GBK 编码回退

### 5.6 `add_field!` 宏模式（部分更新核心）

用于 7 个模块（projects, tasks, milestones, workspaces, builds, integrations, agent_tasks）的 UPDATE 命令。

```rust
macro_rules! add_field {
    ($field:ident, $col:expr) => {
        if let Some(v) = data.$field {
            sets.push(format!("{} = ?{}", $col, idx));
            param_values.push(Box::new(v));
            idx += 1;
        }
    };
}
```

**工作机制：**
1. `param_values: Vec<Box<dyn ToSql>>` 存储混合类型的参数
2. 对每个 `Option<T>` 字段，如果是 `Some(v)` 则追加 `"col = ?N"` 到 sets 并递增 idx
3. 特殊字段（如 `tech_stack` 需要 `serde_json::to_string`）手动处理
4. 始终在末尾追加 `updatedAt = ?N`
5. **关键**：整个 `add_field!` + SQL 构建块被包裹在 `{ ... }` 作用域中，在 `.await` 之前 drop `param_values` 和 `refs`，避免非 Send 类型跨越 await 点

**使用模式：**
```rust
let mut sets = Vec::new();
let mut param_values: Vec<Box<dyn ToSql>> = Vec::new();
let mut idx = 1u32;
add_field!(name, "name");
add_field!(description, "description");
if !sets.is_empty() {
    sets.push(format!("updatedAt = ?{}", idx));
    let sql = format!("UPDATE projects SET {} WHERE id = ?", sets.join(", "));
    // 构建 refs 并执行
}
```

### 5.7 PTY / 终端后端详细实现 (`terminal.rs`)

#### 双注册表架构

```
PROCESSES: LazyLock<Mutex<HashMap<String, Child>>>          // 非交互进程（piped I/O）
PTY_TERMINALS: LazyLock<Mutex<HashMap<String, PtyTerminal>>> // 交互式 PTY
  └── PtyTerminal { child, writer: Box<dyn Write>, master: Box<dyn MasterPty> }
```

**Mutex 中毒恢复**：`m.lock().unwrap_or_else(|e| e.into_inner())`，即使上一个 holder panic 也能恢复。

#### 非交互进程 (`terminal_start`)

1. 生成 ID: `{project_id}-{uuid前8位}`
2. Windows: `cmd /C "chcp 65001 >nul & {command}"`；Unix: `sh -c {command}`
3. 环境变量: `FORCE_COLOR=1`, `TERM=xterm-256color`, `COLORTERM=truecolor`
4. spawn with piped stdin/stdout/stderr
5. 分别为 stdout/stderr 启动 `spawn_output_reader()` 线程
6. 插入 `PROCESSES` 注册表
7. 启动退出监听线程：sleep 100ms → 从注册表移除 → `child.wait()` → emit `"terminal-exit"`

#### 交互式 PTY (`terminal_start_shell`)

1. `native_pty_system().openpty(PtySize { rows: 24, cols: 120 })`
2. Windows: `cmd.exe /C "chcp 65001 >nul 2>&1 & {shell} {args}"`（修复 GBK vs UTF-8）
3. 在 PTY slave 上 spawn：`pair.slave.spawn_command(cmd_builder)`
4. 取 master writer、clone master reader
5. 存储 `PtyTerminal` 到 `PTY_TERMINALS`
6. 启动输出读取线程 + 退出监听线程

#### Agent PTY (`terminal_start_agent`)

与 shell PTY 相同，但直接 spawn agent 命令（无 shell 包装）。Windows 上必须通过 `cmd.exe /C` 路由，因为 npm 安装的 CLI（如 `claude`）是 `.cmd` 脚本，`portable-pty` 无法直接执行。

#### UTF-8 流解码 (`decode_stream_chunk`)

处理 CJK 多字节字符可能在 `read()` 调用间被分割的问题：
1. 维护 `remnant: Vec<u8>` 在调用间传递不完整的尾部字节
2. 将 remnant 前置到新缓冲区
3. 使用 `encoding_rs::Decoder`（有状态）解码
4. 将未消费的字节保存回 remnant

#### 输出读取线程 (`spawn_output_reader`)

`std::thread::spawn`（OS 线程，非 async）：循环读取 8192 字节块 → `decode_stream_chunk` 解码 → emit `"terminal-output"` 事件 `{ terminal_id, data, stream }`

#### 输入 / Resize / 停止 / 清理

- `terminal_input`：先尝试 PTY 注册表（写 `terminal.writer`），回退到 piped 进程（写 `child.stdin`）
- `terminal_resize`：`terminal.master.resize(PtySize { rows, cols })`
- `terminal_stop`：从注册表移除 + `child.kill()`，先 PTY 后 piped
- `cleanup_all`：清空两个注册表，杀掉所有进程。窗口关闭时调用

#### Agent Launcher (`terminal_setup_agent_launcher`)

写入 Node.js `.cjs` 包装脚本（`claude-launcher.cjs`），用 `windowsHide: true` 启动 `claude.cmd` 防止 Windows 控制台弹窗。路径缓存在 `LazyLock<Mutex<Option<String>>>`。

### 5.8 健康评分算法 (`health.rs`)

**100 分制：**

| 类别 | 满分 | 评分规则 |
|------|:----:|----------|
| Git 清洁度 | 25 | 0 dirty=25, 1-5=20, 6-15=12, 16+=5（非 git 项目得 10 分） |
| 分支同步 | 20 | 已同步=20, 仅 ahead=15, 仅 behind=10, 已分叉=5 |
| 依赖状态 | 20 | 0 过期=20, 1-3=15, 4-10=8, 11+=3 |
| 项目结构 | 20 | README 存在=7, src/ 存在=7, .gitignore 存在=6 |
| 代码信号 | 15 | package.json scripts>=3=5(>=1=3), 有测试目录=5, 有 CI 配置=5 |

**状态分层：**
- 80-100: `healthy`
- 50-79: `needs_attention`
- 0-49: `critical`

**数据收集**：`git status --porcelain` + `git rev-list --left-right --count @{upstream}...HEAD` + `npm outdated --json`

**异步模式**：每个项目用 `tokio::task::spawn_blocking` 并行执行（因为 git 命令是同步的 `std::process::Command`）。结果用 `INSERT OR REPLACE` 持久化。

**变更检测**：与上一次健康检查的指标对比（dirtyCount, ahead, behind, outdatedDeps）。首次检查视为基准（无变更）。

### 5.9 项目自动检测 (`detect.rs`)

**检测模式**：按顺序遍历检测器，每个检查特征文件。检测器是累加的——一个项目可以同时被检测为 "TypeScript + Docker + Node.js"。

| 语言/框架 | 检测文件 |
|-----------|----------|
| Node.js | `package.json`（解析 name, description, 框架） |
| Rust | `Cargo.toml`（+ 框架检测） |
| Go | `go.mod` |
| Python | `pyproject.toml`, `requirements.txt`, `setup.py` |
| Java | `pom.xml` (Maven) 或 `build.gradle[.kts]` (Gradle) |
| C#/.NET | `*.csproj` |
| Ruby | `Gemfile`（检查 Rails） |
| PHP | `composer.json` |
| Swift/iOS | `*.xcodeproj` 或 `*.xcworkspace` |
| Kotlin/Android | `build.gradle.kts` + `app/src/` |
| Docker | `Dockerfile` 或 `docker-compose.yml/.yaml` |
| TypeScript | `tsconfig.json` |
| C/C++ | `CMakeLists.txt`, `Makefile`, `meson.build`, `*.sln`, `*.vcxproj` |
| Dart/Flutter | `pubspec.yaml` |

### 5.10 Git 双执行模式 (`git.rs`)

**`run_git`**（只读）：即使非零退出码也返回 stdout（如 `git diff` 有差异时返回 1）。仅在退出码 >= 2 或 stderr 包含 "not a git repository" 时视为错误。

**`run_git_checked`**（写命令）：任何非零退出码都返回错误。用于 checkout, commit, push, pull, tag, restore, reset。

**Git Log 解析**：使用 `--format=%H|%h|%s|%an|%ai|%P|%D` + `|` 分隔符。`assign_branch_indices()` 逆序遍历父提交链，从已装饰提交传播分支 lane 索引（用于 commit graph 渲染）。

**Push 安全**：push 前检查 remote 是否存在和 upstream tracking 是否配置。

### 5.11 文件操作模式 (`files.rs`)

| 常量 | 值 | 说明 |
|------|-----|------|
| `MAX_FILE_SIZE` | 1MB | 超过返回空内容 |
| `BINARY_CHECK_SIZE` | 8KB | 检查前 8KB 是否有 null 字节 |
| `SKIP_DIRS` | `.git`, `node_modules`, `target`, `.next`, `dist`, `.venv` 等 | 文件树构建时跳过 |

**关键实现细节：**
- **原子写入**：写入 `.tmp` 文件再 rename。失败时清理 `.tmp`
- **文件读取**：大小检查 → 二进制检查（null 字节扫描）→ UTF-8 解码 → GBK 回退（`encoding_rs`）
- **文件树**：递归构建，默认深度 4，跳过隐藏/忽略目录，但保留 `.env`, `.gitignore`, `.eslintrc`
- **语言推断**：35+ 文件扩展名映射到语言标识符
- **IDE 打开**：支持 VS Code, Cursor, Windsurf

### 5.12 Rust 错误处理模式

```rust
// DbError 实现 thiserror + serde::Serialize（Tauri 要求）
#[derive(Debug, Error)]
pub enum DbError {
    #[error("Database error: {0}")] Sqlite(#[from] rusqlite::Error),
    #[error("Serialization error: {0}")] Serde(#[from] serde_json::Error),
    #[error("Lock error: {0}")] Lock(String),
}
// 序列化为纯字符串：serializer.serialize_str(&self.to_string())

// 所有 Tauri 命令返回 Result<T, String>
// 错误统一转换：.map_err(|e| e.to_string())
// 用户面向错误使用中文："启动失败", "进程不存在"
```

### 5.13 线程模型

| 类型 | 机制 | 用途 |
|------|------|------|
| Async runtime | Tauri 内置 Tokio（仅 `rt` feature） | Tauri 命令函数 |
| Blocking work | `tokio::task::spawn_blocking` | 健康检查、进程等待等同步操作 |
| IO threads | `std::thread::spawn` | PTY 输出读取线程、退出监听线程 |
| 全局共享状态 | `LazyLock<Mutex<HashMap>>` | 进程注册表、PTY 终端注册表、launcher 缓存 |

### 5.14 Cargo.toml 构建配置

**关键依赖：** `tauri 2`(devtools,image-png), `rusqlite 0.32`(bundled), `r2d2 0.8`, `portable-pty 0.8`, `encoding_rs 0.8`, `tokio 1`(rt), `reqwest 0.12`(json,stream,native-tls), `base64 0.21`

**Profile:**
- Dev: `incremental = true`
- Release: `codegen-units=1`, `lto=true`, `opt-level="s"`, `strip=true`

**Crate Type:** `["lib", "cdylib", "staticlib"]`

### 5.15 序列化约定

所有后端结构体使用 `#[serde(rename_all = "camelCase")]` 匹配前端 JS/TS 字段命名。`query_json` 动态从 `stmt.column_name()` 读取列名构建 JSON key。

---

## 6. 前端架构

### 6.1 IPC 调用流程

```
组件调用: projectsApi.list({ status: 'Active' })
  ↓
src/api/project.ts: cmd('projects_list', args)
  ↓
src/api/client.ts: tauriInvoke('projects_list', args)
  ↓
src-tauri/src/commands/projects.rs: #[command] fn projects_list(...)
  ↓
src-tauri/src/db.rs: db.query_json(sql, params)
  ↓
返回 serde_json::Value → 前端反序列化
```

**事件机制**（用于终端输出等流式数据）：
```
后端: app.emit("terminal-output", OutputEvent { id, data })
  ↓
前端: listen<TerminalOutputEvent>("terminal-output", handler)
```

### 6.2 类型系统 (`types/index.ts`)

**基础类型：** `UUID`, `ISODateTime`, `JSONString`

**枚举/联合类型：**
- `ProjectStatus`: Idea / Planning / Active / Completed / Archived
- `ProjectPriority`: Low / Medium / High / Critical
- `ProjectSource`: Local / Remote / Hybrid
- `TaskStatus`: Todo / InProgress / Done
- `TaskPriority`: Low / Medium / High / Critical
- `DocumentType`: Doc / Note / README / API / Architecture
- `MilestoneStatus`: Pending / InProgress / Completed / Overdue
- `HealthStatus`: Healthy / Warning / Critical / Unknown
- `RuntimeStatus`: stopped / starting / running / error
- `BuildStatus`: pending / running / success / failed / cancelled

**核心实体：** `Project`, `ProjectWithStats`, `ProjectDetail`, `Task`, `TaskWithProject`, `RemoteRepo`, `Milestone`, `Document`, `Tag`, `ActivityLog`

**视图模型：** `ProjectViewModel`（扩展 ProjectWithStats，加入 health/runtime/computed 字段）

**输入类型：** Create/Update input 用于 Project, Task, Document, Milestone, Tag, Repo

**其他：** `ProjectBrain`, `DirectoryNode`, `AgentSession`, `AgentMessage`, `AgentTask`, `BrowserVisit`, `Build`, `BuildLog`, `Template`, `Integration`

### 6.3 状态管理（5 个 Zustand Store）

#### 层级状态架构

应用使用三层状态：
1. **Zustand stores**：本地 UI 状态（终端、面板布局、主题、文件选择）
2. **React Query**：服务端状态（projects, git, health, documents, timeline, sessions）
3. **本地 `useState`**：临时 UI 状态（active tab, input text, loading flags）

#### Store 接口详情

**`themeStore`** — 明暗模式（最小 store）

```typescript
type ThemeMode = 'light' | 'dark';
interface ThemeState {
  mode: ThemeMode;         // 初始化自 localStorage('app_theme')，默认 'light'
  toggle: () => void;      // 翻转 + 持久化
  setMode: (m) => void;    // 显式设置 + 持久化
}
```
其他 store（如 `terminalStore`）通过 `useThemeStore.subscribe()` 订阅模式变更来同步自己的主题状态。

**`terminalStore`** — 终端子系统（最大 store）

```typescript
interface LaunchRequest {
  cwd: string; command?: string; label?: string;
  projectId?: string; pane?: PanePosition;
}
interface TerminalGroup {
  id: string; label: string;
  isProjectGroup: boolean; isCollapsed: boolean;
}
interface PaneState { activeId: string | null; }
```

状态字段：
- **启动队列**：`launchQueue: LaunchRequest[]`，FIFO，`requestLaunch()` 入队，`consumeLaunchRequest()` 出队
- **配置**：`defaultCwd` 从 `localStorage('devhub_terminal_default_cwd')` 初始化
- **终端实例**：`terminals: Terminal[]`，`_terminalCounter` 自增 ID
- **面板状态**：4 个面板 `leftPane/rightPane/topPane/bottomPane`，各有 `{ activeId }`
- **主题**：`theme: TerminalTheme`, `followAppTheme: boolean`
- **分组**：`groups: TerminalGroup[]`，项目组 ID 确定性生成（`project-${label}`），项目组不可删除
- **重排序**：`reorderTerminals(pane, fromIndex, toIndex)` 操作面板过滤后的索引，转换为全数组索引
- **分割**：`splitPaneOpen/splitRatio(0.2-0.8)`, `splitVerticalOpen/splitVerticalRatio`
- **Tab 栏**：`tabBarWidth`（140-400，默认 200）
- **文件选择**：`selectedFile: string | null`

**`agentStore`** — Agent 流式状态

```typescript
interface AgentStore {
  streamingText: Record<string, string>;  // sessionId → 累积文本
  streamingSessionId: string | null;      // 当前流式会话
  claudeTerminalId: string | null;        // Claude PTY 终端 ID
  appendToken: (sessionId, token) => void;   // 不可变 spread 更新
  finishStreaming: (sessionId) => void;      // 移除完成的会话文本
  startStreaming / clearStreaming;
}
```

**`agentWorkspaceStore`** — 右侧面板宽度（320-600px，默认 400），持久化 localStorage

**`previewStore`** — URL 检测

```typescript
interface DiscoveredPreview {
  url: string; label: string; terminalId: string; discoveredAt: number;
}
```
- `normalizeUrl(raw)` — 用 `URL` 构造函数标准化，去除尾部斜杠
- `guessLabel(url)` — 端口映射：5173/5174→"Vite Dev", 3000→"Next.js", 4200→"Angular", 6006→"Storybook", 8080/8081→"Dev Server", pathname 含 "swagger"→"Swagger"
- `addPreview` — 标准化后去重
- `removePreviewsByTerminal` — 终端关闭时清理关联 URL

### 6.4 样式系统

**主题变量** (`variables.css`)：
- 颜色：`--color-primary`, `--color-success`, `--color-warning`, `--color-danger`, `--color-info`
- 背景：`--bg-primary`, `--bg-secondary`, `--bg-elevated`
- 文字：`--text-primary`, `--text-secondary`
- 阴影：`--shadow-sm`, `--shadow-md`, `--shadow-lg`
- 字体：`--font-sans`（Inter/系统）, `--font-mono`（Fira Code）

**毛玻璃效果** (`glassmorphism.css`)：
- `.glass` — backdrop-filter: blur(12px) + 半透明背景
- `.glass-strong` — 更强的模糊和对比

**明暗模式：**
- 通过 `data-theme` 属性切换
- Ant Design ConfigProvider 动态切换 token
- Dark：teal/cyan 主色 `#4fdbc8`，深色背景
- Light：deep teal 主色 `#006b5f`，白色背景

**组件样式约定：**
- 布局/定位使用内联样式对象 `styles: Record<string, React.CSSProperties>`
- 不使用 Tailwind、CSS Modules
- Ant Design 覆盖用 `.ant-*` + `!important`

---

## 7. 工作区系统（V3）

### 7.1 布局架构

V3 采用**固定双列 flexbox 布局**（非递归面板树）：

```
┌──────────────────────────────────────────────────────┐
│                   WorkspaceHeader                      │
│               AgentSelector（芯片行）                   │
│                                                        │
│  ┌── 中央区域 (flex:1) ──┐  ┌── 右侧面板 ─────────┐  │
│  │                        │  │  AgentRightPanel      │  │
│  │    AgentChat           │  │  ┌─────────────────┐  │  │
│  │    （消息列表 + 输入）  │  │  │ Plan|Git|Files|  │  │  │
│  │                        │  │  │ Context 标签页    │  │  │
│  │                        │  │  └─────────────────┘  │  │
│  ├────────────────────────┤  │                        │  │
│  │    BottomPanel         │  │  AgentPlanPanel        │  │
│  │  Terminal|Preview|Logs │  │  AgentGitTab           │  │
│  └────────────────────────┘  └────────────────────────┘  │
└──────────────────────────────────────────────────────┘
```

- **中央区域**：WorkspaceHeader → AgentSelector → AgentChat（填满） → BottomPanel（底部停靠，可调高度 120-600px，默认 280px）
- **右侧区域**：AgentRightPanel（可调宽度，持久化 320-600px，默认 400px）

### 7.2 组件职责

| 组件 | 职责 |
|------|------|
| `WorkspacePage.tsx` | 编排整个工作区布局，URL 自动检测 |
| `WorkspaceHeader.tsx` | 标题栏 + Start/New Chat/Stop 控制按钮 |
| `AgentSelector.tsx` | Agent 选择芯片行（当前固定为 Claude Code） |
| `AgentChat.tsx` | 聊天消息列表 + 输入框，通过 PTY 与 Claude Code 交互 |
| `BottomPanel.tsx` | 底部可调面板，Terminal/Preview/Logs 三个标签 |
| `AgentRightPanel.tsx` | 右侧可调面板，Plan/Git/Files/Context 四个标签 |
| `AgentPlanPanel.tsx` | 任务分解 UI（分组、子任务、进度条） |
| `AgentGitTab.tsx` | Git 状态（分支、文件差异、暂存、提交、fetch） |
| `CodeEditorPane.tsx` | 多标签 CodeMirror 代码编辑器 |
| `FileViewer.tsx` | 统一文件查看器（文本/图片/二进制） |
| `terminalFactory.ts` | `createTerminal()` 工厂：生成 ID → 读取 shell 配置 → 启动 PTY → 注册 store |
| `useXtermTerminal.ts` | xterm.js 生命周期：FitAddon、resize 同步、PTY I/O、IME 组合、cwd 检测 |
| `StatusDot.tsx` | 状态指示点（运行中/已结束/无） |

### 7.3 Agent 聊天流程

```
用户输入 → sessionsApi.appendMessage() 保存
  ↓
写入 Claude PTY: terminalApi.input(claudeTerminalId, text + '\n')
  ↓
监听 Tauri 事件 "terminal-output"
  ↓
stripAnsi() 去除转义序列 → 累积到 agentStore.streamingText
  ↓
1.5 秒空闲检测 → 响应完成 → 保存 assistant 消息
  ↓
react-markdown 渲染消息
```

- 中止：发送 Ctrl+C (`\x03`)，保存已累积文本
- 当前硬编码 `CLAUDE_AGENT` 为唯一 Agent

### 7.4 BottomPanel 标签

| 标签 | 说明 |
|------|------|
| **Terminal** | PTY 终端，最多 6 个标签，支持 shell 选择，自动检测 dev-server URL |
| **Preview** | iframe 渲染最后检测到的 localhost URL |
| **Logs** | 构建日志（占位） |

### 7.5 RightPanel 标签

| 标签 | 说明 |
|------|------|
| **Plan** | 任务分解树（分组 + 子任务 + 状态 + 优先级 + 进度条） |
| **Git** | 分支信息、文件状态图标（M/A/D/R/C/?）、stage/unstage/discard、commit、fetch |
| **Files** | 文件浏览器（占位） |
| **Context** | 上下文使用量（占位） |

---

## 8. 终端系统

### 8.1 三种后端模式

| 命令 | 模式 | 执行方式 | 输出 | 用途 |
|------|------|----------|------|------|
| `terminal_start` | 非交互 | `cmd /C` / `sh -c` | 逐行 | `npm run dev` 等 |
| `terminal_start_shell` | 交互 | 直接 spawn shell | 逐字节 | PowerShell/bash |
| `terminal_start_agent` | Agent PTY | `portable-pty` | xterm-256color | claude/gemini/codex CLI |

### 8.2 前端终端架构

```
terminalFactory.createTerminal()
  ↓ 生成 ID → 读 shell 配置 → terminalApi.startShell()
  ↓
terminalStore.addTerminal() 注册
  ↓
useXtermTerminal hook
  ├── 创建 xterm.js Terminal + FitAddon
  ├── ResizeObserver → terminalApi.resize()
  ├── listen("terminal-output") → term.write(data)
  ├── listen("terminal-exit") → 清理
  ├── IME 组合守卫（中文输入）
  ├── 右键粘贴
  └── cwd 检测（解析 PS1/cmd/bash 提示符）
```

### 8.3 URL 自动检测

`WorkspacePage` 监听所有终端输出，使用正则匹配 localhost URL：
- Vite: `http://localhost:5173`
- 通用: `http://localhost:\d+`
- 检测到的 URL 存入 `previewStore`，在 BottomPanel 的 Preview 标签中渲染

---

## 9. 关键架构约束

### 开发规范

- **API 层集中**：所有 Tauri IPC 必须经过 `src/api/index.ts`，禁止直接 `tauriInvoke()`
- **类型集中**：领域类型在 `src/types/index.ts`，禁止内联定义 API 载荷类型
- **无 `any`**：禁止 `any` 和 `as unknown as X`
- **Zustand selector**：必须用 `useStore(s => s.field)`，禁止无选择器使用
- **组件样式**：内联样式对象模式 `styles: Record<string, React.CSSProperties>`
- **新增命令**：在 `commands/<module>.rs` → `lib.rs` 注册 → `api/index.ts` 封装

### 已知未完成

- `model_providers` / `agent_configs` 表已创建（010 迁移）但无对应后端命令
- `auth/` 和 `tasks/` feature 目录为空
- BottomPanel 的 Logs 标签、RightPanel 的 Files/Context 标签为占位状态

---

## 10. 数据获取模式

### 10.1 API 封装层 (`src/api/`)

**`cmd()` 泛型封装** (`client.ts`)：
```typescript
export const cmd = <T = any>(name: string, args?: Record<string, unknown>): Promise<T> =>
  tauriInvoke(name, args) as Promise<T>;
```
薄封装，直接透传到 Tauri IPC。插件命令使用命名空间格式 `plugin:screenshots|get_screenshotable_windows`。

**按领域分文件：**

| 文件 | API 对象 | 命令前缀 |
|------|----------|----------|
| `project.ts` | projectsApi, tasksApi, reposApi, documentsApi, milestonesApi, tagsApi, timelineApi, searchApi, detectApi, healthApi, dependenciesApi, gitApi, brainApi | `projects_*`, `tasks_*`, `git_*` 等 |
| `agent.ts` | sessionsApi, agentTasksApi | `sessions_*`, `agent_tasks_*` |
| `terminal.ts` | terminalApi, filesApi | `terminal_*`, `files_*` |
| `workspace.ts` | workspacesApi | `workspaces_*` |
| `build.ts` | buildsApi, templatesApi, integrationsApi | `builds_*`, `templates_*`, `integrations_*` |
| `browser.ts` | browserMemoryApi | `browser_*` |

### 10.2 React Query 配置

```typescript
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,           // IPC 本地调用快，30 秒内视为新鲜
      gcTime: 5 * 60_000,          // 卸载后缓存 5 分钟
      refetchOnWindowFocus: false,  // 桌面应用无窗口焦点模式
      retry: 1,                    // 单次重试（IPC 失败通常是持久问题）
    },
  },
});
```

### 10.3 数据获取 Hook 模式 (`src/hooks/`)

**Query hooks（读操作）模式：**
```typescript
export const useProjects = (params?: ProjectListParams) =>
  useQuery({
    queryKey: params ? queryKeys.projects.filtered(params) : queryKeys.projects.all,
    queryFn: () => projectsApi.list(params),
  });

export const useProject = (id?: string) =>
  useQuery({
    queryKey: queryKeys.projects.one(id!),
    queryFn: () => projectsApi.getById(id!),
    enabled: !!id,   // 防止 undefined ID 时发起请求
  });
```

**Mutation hooks（写操作）模式：**
```typescript
export const useCreateProject = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateProjectInput) => projectsApi.create(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: queryKeys.projects.all }); },
  });
};
```

**缓存 key 层级** (`queryKeys.ts`)：
```
queryKeys.projects.all       → ['projects']
queryKeys.projects.filtered  → ['projects', 'filtered', params]
queryKeys.projects.one(id)   → ['projects', 'one', id]
queryKeys.git.status(path)   → ['git', 'status', path]
queryKeys.git.log(path, n)   → ['git', 'log', path, n]
```

**每个 mutation 只 invalidate 最小必要的 query set。**

### 10.4 Git Hook 特殊模式 (`useGit.ts`)

5 个 query hooks（status, log, branches, stashList, tagList）+ 10 个 mutation hooks。

共享缓存失效函数：
```typescript
const invalidateGitQueries = (qc, repoPath) => {
  qc.invalidateQueries({ queryKey: queryKeys.git.status(repoPath) });
  qc.invalidateQueries({ queryKey: queryKeys.git.log(repoPath) });
  qc.invalidateQueries({ queryKey: queryKeys.git.branches(repoPath) });
  qc.invalidateQueries({ queryKey: queryKeys.git.stashList(repoPath) });
};
```

注意：`GitTab.tsx` 中的 Git 操作使用直接 `gitApi` 调用 + `useState`，而非 React Query 模式。这是两种共存的数据获取方式。

---

## 11. 组件交互模式

### 11.1 App Shell (`MainLayout.tsx`)

**布局结构：**
1. **侧边栏**（固定左侧，可折叠 64px/260px）：logo + 版本号、"New Project" 按钮、导航链接（7 项）、FileExplorer（填充剩余空间）、底部链接、用户档案卡片
2. **顶栏**（固定顶部）：左侧 "Recent"/"Favorites"、中央 SearchBox（触发 CommandPalette）、右侧 "Deploy" 按钮、通知、主题切换、用户头像
3. **内容区**（flex-1）：路径为 `/` 时直接渲染 WorkspacePage，其他渲染 `<Outlet />`

**导航项：** `/`(工作区), `/projects`, `/agents`, `/builds`, `/git`, `/terminal`(重定向到 `/`), `/settings`

**每日健康检查：** mount 时 `useEffect` 读 `localStorage('lastHealthCheckDate')`，与今天日期比较（`sv-SE` locale YYYY-MM-DD 格式），未运行则调 `healthApi.runAll()` 并用 Ant Design 通知显示变更项目。

### 11.2 数据规范化 (`normalize.ts`)

后端 `techStack` 可能是 JSON 字符串或已解析数组，防御性解析保证 `string[]`：
```typescript
function parseTechStack(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw;
  if (typeof raw === 'string') { try { return JSON.parse(raw); } catch { return []; } }
  return [];
}
// 通用函数：normalizeProject<T extends { techStack?: unknown }>(project: T): T
```

### 11.3 启动逻辑 (`launchUtils.ts`)

**命令优先级：** `frontendCommand` > `backendCommand` > `openCommand`

**CWD 解析** (`resolveCwd`)：
1. 使用配置的 cwd（如果设置）
2. 绝对路径检测：`/^[A-Z]:\\/i`（Windows）或 `startsWith('/')`（Unix）
3. 否则相对于 `localPath` 拼接（使用 `\\` Windows 分隔符）

**双命令启动：** 如果同时有 `frontendCommand` 和 `backendCommand`，生成两个 LaunchRequest（标注 "前端"/"后端"），否则单个请求。

### 11.4 健康状态工具 (`healthUtils.ts`)

```typescript
interface HealthData {
  dirtyFileCount: number; aheadCount: number;
  behindCount: number; outdatedDepCount: number;
  healthScore?: number | null; healthStatus?: string | null; error?: string | null;
}
```

| 函数 | 逻辑 |
|------|------|
| `formatHealthIssues(r)` | 中文问题描述："3 个未提交文件", "落后远程 5 个提交" 等 |
| `hasHealthIssues(r)` | 任一 count > 0 或有 error |
| `isHealthUrgent(r)` | aheadCount > 5 或 behindCount > 10 |
| `getScoreColor(score)` | >=80 绿色, >=50 琥珀色, <50 红色 |
| `getHealthStatusLabel(status)` | healthy→"健康", needs_attention→"需要关注", critical→"风险" |

### 11.5 键盘 / IME 处理 (`keyboard.ts`)

```typescript
function isEnterCommit(e: React.KeyboardEvent): boolean {
  return e.key === 'Enter' && !e.nativeEvent.isComposing;
}
```
确保 IME 组合中（中文输入）按 Enter 不触发提交，只在"干净" Enter 时提交。此模式贯穿所有输入框。

### 11.6 Shell / 终端配置 (`constants.ts`)

| 常量 | Windows | Unix |
|------|---------|------|
| `DEFAULT_SHELL` | `powershell.exe` | `bash` |
| `DEFAULT_CWD` | `C:\Users` | `/Users` |
| `SHELL_OPTIONS` | PowerShell, CMD, Git Bash | Bash, Zsh, Fish |

`SHELL_MAP` 将 shell 名称映射到 `{ shell, args? }`：PowerShell 加 `['-NoProfile']`，Bash 在 Windows 映射到 `C:\Program Files\Git\bin\bash.exe`。

**状态颜色**：7 个项目状态映射到 Ant Design 色名 + 主题感知 hex 值。
**活动日志配置**：status_change/task_created/task_status_change/repo_synced 各有中文标签和颜色。

### 11.7 CodeMirror 编辑器系统 (`workspace/`)

**主题** (`cmTheme.ts`)：基于 `isDark` 动态生成。Fira Code 13px，暗模式透明背景，亮模式 `#FAFAFA`，选区 teal 色调，括号匹配用 CSS 变量。

**语法高亮**：keywords 紫色 `#8455ef`、comments 灰色斜体、strings 绿色 `#16bb83`、numbers 深 teal、type names 主色 `#006b5f`。

**语言扩展**：TypeScript(含 JSX)、JavaScript(含 JSX)、JSON、Markdown、Rust、CSS、HTML、YAML、SQL、Python。不支持的语言返回 `null`（纯文本模式）。

**文件管理** (`CodeEditorPane.tsx`)：
- 多标签 `EditorFile[]`：id(path), label, content, originalContent, modified, isBinary
- 文件打开：`filesApi.read()` → 创建 EditorFile → 去重追加
- 变更检测：基于索引的数组克隆（只替换变更文件）
- 保存：`filesRef` 避免闭包陈旧，调 `filesApi.write()`
- Tab 切换：dispatch 全量替换事务同步 CodeMirror 文档
- 自动加载：mount 时加载 `src/` 下最多 6 个 `.tsx/.jsx/.ts/.js` 文件

**consume-and-clear 模式**：FileExplorer 写 `terminalStore.selectedFile` → CodeEditorPane 消费后清 null → 避免竞态

### 11.8 xterm.js 生命周期 Hook (`useXtermTerminal.ts`)

单一 `useEffect`，keyed on `[terminalId, theme]`：

1. **创建**：Terminal（cursor blink off, font 13px, Cascadia Code/Fira Code/JetBrains Mono, 10000 行滚动）
2. **FitAddon**：350ms 延迟初始 fit → `terminalApi.resize()` 同步 PTY 尺寸
3. **ResizeObserver**：100ms debounce → fit → resize 同步
4. **IME 组合守卫**：`compositionstart/update/end` 事件追踪 `composing` 状态，`justComposed` + `setTimeout(0)` 防止 xterm `onData` 在 `compositionend` 后触发的双字符 bug，`attachCustomKeyEventHandler` 在 `e.isComposing` 时阻塞所有 keydown
5. **右键粘贴**：拦截 `contextmenu`，读 `navigator.clipboard.writeText` 写入终端（仅无选中文本时）
6. **PTY 输出**：监听 `terminal-output` → 提取 OSC 0/2 标题 → strip OSC → `term.write(data)` → 正则检测 CWD（Windows PS/cmd prompt、bash $/# prompt）300ms debounce
7. **退出**：监听 `terminal-exit` → 调 `onExit` 回调
8. **清理**：清计时器、断 ResizeObserver、dispose onData、取消事件监听、移除 composition/contextmenu 监听、`term.dispose()`

返回 `{ termRef, fitAddonRef, refit }`。

### 11.9 terminalFactory.ts

工具模块（非组件）：
- 上限 10 个终端
- ID: `global-${randomBase36}`
- 标签从 CWD 文件夹名生成，碰撞避免（"MyApp", "MyApp 2"）
- 调 `terminalApi.startShell(id, shell, cwd, args)` + `terminalStore.addTerminal()`
- 返回 `{ terminal, id, label }`

### 11.10 BottomPanel 终端生命周期

mount 时（`createdRef` 防止 StrictMode 双创建）：
1. 读 `localStorage('devhub_terminal_shell')` 或 `DEFAULT_SHELL`
2. 生成 ID: `term-${Date.now()}`
3. 调 `terminalApi.startShell(id, cfg.shell, defaultCwd, cfg.args)`
4. 注册到 `terminalStore` + 本地 tab 状态
5. 监听 `terminal-exit` 更新状态为 `exited`/`error`（绿点指示运行中）

**调整大小**：顶部拖拽 handle，`mousemove`/`mouseup` 在 `document` 上，clamped 120-600px，拖拽时设 `document.body.style.cursor = 'row-resize'`。

### 11.11 AgentChat 流式检测算法

**1.5 秒空闲计时器**是核心设计模式（纯时间基，无协议级消息结束标记）：

```
1. handleSend()
   ├── 保存用户消息到 state + sessionsApi
   ├── startStreaming(activeSessionId)
   └── terminalApi.input(claudeTerminalId, content + '\n')

2. listen("terminal-output") 回调
   ├── 过滤 terminalId === claudeTerminalId
   ├── stripAnsi() 多遍清洗（CSI、OSC、DEC 私有模式、CR/null/backspace、charset）
   ├── appendToken(sessionId, cleaned)
   ├── 清除 idleTimerRef.current
   └── 设新 1500ms timer

3. 1500ms 后 timer 触发
   ├── 读 streamingText[sessionId]
   ├── sessionsApi.appendMessage(sessionId, 'assistant', text)
   ├── finishStreaming(sessionId)
   └── sending = false
```

**中止流程**：发送 `\x03`(Ctrl+C) → 保存已累积文本 → 重置流式状态 + 清计时器

**UI**：react-markdown 渲染、用户消息右对齐 primary-container 色、助手消息左对齐 + Code avatar、流式文本末尾闪烁光标 `|`、流式开始但无文本时 "Thinking" 动画点、Textarea 自适应高度（max 120px），Enter 发送 / Shift+Enter 换行。

### 11.12 AgentRightPanel 可调宽度

持久化宽度到 `agentWorkspaceStore`。左边缘拖拽 handle，`col-resize` 光标，delta 计算宽度，`document` 级鼠标监听。与 BottomPanel 的垂直调整大小模式相同。

### 11.13 GitTab 三面板布局

- **左面板**（默认 260px）：Branch 列表（local/remote 标签）、Staging Area（staging/tags 标签）
- **中央面板**（flex）：Commit graph + Diff viewer（40%/60% 分割）
- **右面板**（默认 380px）：Commit inspector

两处拖拽 handle 用 `DragHandle` 组件。文件和 commit 选择互斥：选文件调 `gitApi.diff()`，选 commit 调 `gitApi.diffCommit()`。提交用 Modal + `Input.TextArea`，`Ctrl+Enter` 提交。

### 11.14 项目详情页模式 (`ProjectDetailPage.tsx`)

- 数据获取：`useProject(id)` + `useRefreshProject()`
- Loading：Ant Design `Skeleton`，未找到：`Empty`
- 刷新逻辑：逐字段对比旧新数据（JSON.stringify 比较数组），构建上下文感知成功消息
- Tab 布局：overview, ConfigTab, TasksTab, MilestonesTab, GitTab, HealthTab
- 启动集成：`buildLaunchRequests()` → `terminalStore.requestLaunch()` → `navigate('/')`

### 11.15 项目列表页模式 (`ProjectsPage.tsx`)

- 数据：`useProjects(params)` + `useWorkspaces()` + `useAllHealth()`
- 创建流程：表单 → `handleDetect()` 自动填充 → `handleCreate()` 标准化 techStack（逗号分割）
- 视图模式：grid/list/kanban + 按 name/status/updated 排序
- 批量操作：`useBatchLaunch` + `useScanProjects` hooks

---

## 12. 已知未完成项

| 项 | 位置 | 状态 |
|-----|------|------|
| `model_providers` / `agent_configs` 表 | 迁移 010 已创建 | 无对应后端命令 |
| `auth/` feature 目录 | `src/features/auth/` | 空目录 |
| `tasks/` feature 目录 | `src/features/tasks/` | 空目录 |
| Logs 标签 | BottomPanel | 占位文本 |
| Files 标签 | AgentRightPanel | 占位文本 |
| Context 标签 | AgentRightPanel | 占位文本 |
| `insert_and_fetch` 方法 | `db.rs` | 死代码 |
| Docker Compose 分析 | `dependencies.rs` | stub 实现 |
