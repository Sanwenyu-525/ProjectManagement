# CLAUDE.md

## Current Focus

Q3 路线图执行中。P1-P3 已完成，当前进行 P4（多 Agent 并行 + 项目巡检报告）。

**已完成：**
- P1 图谱：启用影响分析、调用链、架构分层三个视图（5/5 视图全部可用）
- 节点操作：选中节点可"打开文件"或"交给 Agent 分析"
- 编辑器修复：Windows 换行符标准化（\r\n → \n），消除误报 modified 状态
- P2 知识库：Q&A 对话 + `/knowledge` slash command + Agent 知识库检索
- P3 Agent 集成图谱：`/graph impact|deps|layers` slash commands + 改前影响检查

**待做（P4）：**
- P4：多 Agent 并行 + 项目巡检报告（4 周）

详见 `docs/superpowers/specs/2026-06-25-q3-roadmap-design.md`。

## Commands

```bash
npm run tauri dev          # 前端 + Tauri 原生窗口（完整开发）
npm run dev                # 仅前端 Vite dev server，端口 1420（UI 迭代）
npm run build              # tsc -b && vite build
npm run tauri build        # 完整构建（前端 + Rust + 打包）
cd src-tauri && cargo check # 检查 Rust 编译（快，不生成二进制）
```

无测试基础设施（无 vitest、jest、cargo test）。

## Architecture

**Tauri 2.x 桌面应用** — 开发者 Agent 工作台。React+Vite 前端通过 Tauri IPC (`invoke`) 与 Rust 后端通信。

### Tech Stack

| 层 | 技术 |
|---|------|
| 前端 | React 18, TypeScript, Vite 6 |
| UI | Ant Design 5 |
| 状态 | Zustand |
| 图表 | ECharts |
| 后端 | Rust, SQLite (rusqlite) |

### 页面路由

**工作区是首页** (`/workspace`)。侧边栏六项：
- **工作区** (`/workspace`) — Agent + 终端 + 编辑器 + 浏览器
- **项目** (`/projects`, `/projects/:id`) — 项目 CRUD 和详情
- **时间线** (`/timeline`)
- **数据大屏** (`/data-screen`)
- **文件浏览器** — 侧边栏面板（无独立路由）
- **知识库** (`/knowledge`)

隐藏路由：`/settings`（仅从顶栏齿轮图标访问）。根路径 `/` 重定向到 `/workspace`。

### 前端目录结构

```
src/features/
  workspace/           — 工作区页面及所有子功能
    WorkspacePage.tsx  — 主工作区视图（首页）
    agent/             — AgentGUIPanel, AgentTabBar, AgentProvider, ClaudeProvider, providers
    terminal/          — TerminalPane, BottomPanel
    editor/            — CodeEditorPane, FileEditor, FileViewer
    browser/           — BrowserWorkspacePage
    git/               — GitDashboardPage
    builds/            — BuildCenterPage
    knowledge/         — KnowledgeCenterPage
    timeline/          — TimelinePage
    data-screen/       — DataScreenPage
    components/        — WorkspaceHeader, StatusDot, cmTheme, terminalFactory
  projects/            — ProjectsPage, ProjectDetailPage, NewProjectWizard
  knowledge/           — KnowledgeBasePage（独立知识库页面）
  settings/            — SettingsPage
src/shared/            — 跨领域共享组件（SearchBox, ShortcutsModal, MainLayout, FileExplorer, ProjectIcon 等）
src/stores/            — Zustand store（themeStore, terminalStore, workspaceStore, agentStore 等）
src/api/               — Tauri IPC 封装（project.ts, terminal.ts, memory.ts, knowledge.ts 等）
src/lib/               — 工具函数（toast.tsx, normalize.ts, constants.ts, launchUtils.ts 等）
src/hooks/             — 自定义 hooks（useProjects.ts, useHealth.ts 等）
```

### Agent Provider System

可插拔 provider 模式 (`src/features/workspace/agent/`)：
- `AgentProvider.ts` — 接口：`start()`, `send()`, `abort()`, `stop()`, `onStream()`, `isActive()`
- `ClaudeProvider.ts` — PTY 实现，直接 spawn `claude --dangerously-skip-permissions`
- `providers.ts` — 注册表：`getProviders()`, `getProvider(id)`

新增 agent 后端：实现 `AgentProvider` 接口，注册到 `providers.ts`。

### IPC Flow

```
Frontend: projectsApi.list()
  → src/api/project.ts: cmd('projects_list', args)
    → src-tauri/src/commands/project/projects.rs    // #[command] fn
      → src-tauri/src/db.rs: db.query_json(sql)     // SQLite via rusqlite
        → returns serde_json::Value
```

所有命令在 `src-tauri/src/lib.rs` 的 `tauri::generate_handler![]` 中注册。

**事件**（终端输出/退出）：后端 `app.emit("event-name", payload)`，前端 `listen()` from `@tauri-apps/api/event`。

### Backend Pattern (Rust)

每个领域一个 command 模块：`src-tauri/src/commands/<domain>/`
- `project/` — projects, tasks, repos, documents, milestones, tags, search, timeline, detect, brain, dependencies, health, feature_groups, graph（含 impact/chain/layers 分析命令）
- `workspace/` — terminal, files, sessions, agent_tasks, workspaces, memory, knowledge
- `git/` — git 操作
- `build/` — builds, templates, integrations

关键约定：
- Input structs 用 `#[serde(rename_all = "camelCase")]` 做 JS↔Rust 名称转换
- Commands 通过 `State<'_, Database>` 访问数据库
- 错误统一映射为 `String`：`.map_err(|e| e.to_string())`
- 部分更新用 `macro_rules! add_field!` 构建动态 SET 子句
- 重要状态变更调用 `db.log_activity()` 写入 timeline

数据库：SQLite，路径 `{app_data_dir}/devhub.db`，TEXT UUID，ON DELETE CASCADE。
Schema：`src-tauri/migrations/001_init.sql` ~ `022_project_soft_delete.sql`（22 个迁移）。
项目表支持 soft-delete（`deletedAt` 列），`projects_list` 自动过滤已删除记录，`projects_restore` 可恢复。

### Frontend Pattern

- **API 层** (`src/api/`)：按领域拆分文件（`project.ts`, `terminal.ts`, `memory.ts` 等），统一通过 `cmd()` 封装 Tauri IPC
- **自定义 hooks** (`src/hooks/`)：`useProjects.ts` 封装 react-query 查询和 mutation（`useCreateProject`, `useDeleteProject`, `useRestoreProject` 等）
- **状态管理** (`src/stores/`)：按领域组织的 Zustand store
- **路径别名**：`@/` → `./src/`（tsconfig.json + vite.config.ts）
- **单用户，无认证**：硬编码 `default-user`
- **数据标准化**：`techStack` 在 SQLite 中存为 JSON 文本，前端解析为数组（`src/lib/normalize.ts`）

### Terminal

三个后端变体：
- `terminal_start` — 通过 `cmd /C` / `sh -c` 执行命令，逐行输出。用于非交互式命令。
- `terminal_start_shell` — 直接 spawn shell，逐字节输出。用于交互式终端（PowerShell/bash）。
- `terminal_start_agent` — 直接 spawn agent CLI（如 `claude --dangerously-skip-permissions`），PTY + xterm-256color。

进程注册表：`static LazyLock<Mutex<HashMap<String, Child>>>` in `terminal.rs`。

### Styling

Glassmorphism 浅色主题——无 Tailwind，无 CSS Modules：
- **设计 token**：`src/shared/styles/variables.css`（CSS 变量 + 密度模式覆写）
- **玻璃效果**：`src/shared/styles/glassmorphism.css`（`.glass`/`.glass-strong`/`.glass-card`）
- **动画**：`src/shared/styles/animations.css`（`animate-in`、`hover-lift`、`clickable`，含 `prefers-reduced-motion` 支持）
- **密度模式**：三档（comfortable/compact/dense），`[data-density]` 类选择器覆写 `--space-*` token，`themeStore` 持久化
- Ant Design `ConfigProvider` 主题在 `src/main.tsx`
- 大量 `.ant-*` 覆盖 + `!important` 实现玻璃效果（backdrop-filter, 半透明背景）
- 组件内大量使用 inline styles，`styles: Record<string, React.CSSProperties>` 对象模式
- 字体：Fira Sans（正文）+ Fira Code（等宽）

### Adding a New Backend Command

1. 在 `src-tauri/src/commands/<domain>/<module>.rs` 添加函数
2. 在 `src-tauri/src/lib.rs` 的 `invoke_handler` 列表中注册
3. 在 `src/api/<module>.ts` 添加前端封装

---

## Development Rules

### Architecture Constraints
- **Feature-first layout**: 新领域逻辑放 `src/features/<domain>/`。跨领域共享代码放 `src/shared/`。工具函数放 `src/lib/`。
- **禁止新建 src/ 顶层目录**（除非用户明确同意）。
- **API 层集中化**: 所有 Tauri IPC 调用走 `src/api/` 下按领域拆分的文件。组件中禁止直接调 `tauriInvoke()`。
- **类型集中化**: 领域类型在 `src/types/index.ts`，API 类型在 `src/api/types/index.ts`。禁止为 API payload 创建内联类型。

### Type Safety
- **禁止 `any` 类型。** `src/api/index.ts` 中的既有抑制是遗留代码，新代码必须用正确类型。
- **禁止不安全类型断言** (`as unknown as X`)。需要收窄时用 type guard。
- **优先使用判别联合**：用 `type` 字段区分（如 `src/shared/workspace/types.ts` 中 `PaneTab` 联合），不要用可选属性。
- **未使用变量/参数是错误** (`noUnusedLocals`, `noUnusedParameters`)。有意不使用时前缀 `_`。

### UI Consistency (Ant Design + Glassmorphism)
- **用 Ant Design 组件**（Button, Card, Table, Modal, Form 等），不手写等效 HTML。
- **禁止原始 HTML 表单、表格、弹窗。** 用 Ant Design 的 Form、Table、Modal。
- **Glassmorphism token**: 用 `src/shared/styles/variables.css` 的 CSS 变量，用 `src/shared/styles/glassmorphism.css` 的 `.glass`/`.glass-strong` 工具类。
- **Inline styles 是既定模式**：布局/定位用 `styles: Record<string, React.CSSProperties>` 对象（参考 `WorkspacePage.tsx`）。
- **禁止硬编码颜色值**：引用 CSS 变量或 Ant Design 主题色板。
- **暗色模式**：通过 `data-theme` 属性和 `themeStore` 支持。组件必须同时适配两种模式。

### State Management (Zustand)
- **一个 store 对应一个领域**: `terminalStore`, `workspaceStore`, `agentStore`, `themeStore`, `previewStore`。
- **Selector 模式**: `useStore(s => s.field)` —— 绝不 `useStore()` 无 selector。
- **不在 store 中派生状态**：优先在组件中用 `useMemo`。
- **持久化**: localStorage 用于临时 UI 状态，后端表用于持久数据。

### Component Patterns
- 3+ `useState`/`useEffect` 关注同一关注点时提取自定义 hook。
- Page 组件 (`*Page.tsx`) 管数据获取和状态，子组件管渲染。
- 重页面用 `React.lazy()` + `Suspense`。

### Verification

修改代码后**必须**运行验证，零错误才算通过：

```bash
npx tsc -b          # TypeScript 编译检查
npx eslint src/     # Lint 检查
```

- 无新依赖批准不加。
- 无测试基础设施，不要主动建议加测试。
- 新后端命令确保前端类型匹配 Rust `#[serde(rename_all = "camelCase")]` 序列化。
