# DevHub 项目设计详细文档

## 1. 项目概述

**DevHub** — 开发者控制中心（Developer Control Center）

**不是**项目管理软件，**而是**开发者控制中心。用户打开 DevHub 的目的不是「看看任务」，而是：

- 今天我有哪些项目？
- 哪些项目有问题？
- 哪些项目应该推进？
- 哪些项目可以上线？

**核心价值**：管理你的所有项目，启动你的所有项目，理解你的所有项目。

**技术亮点**：
- 前后端分离架构（React + Rust）
- 嵌入式终端支持（xterm.js + portable-pty）
- 玻璃态 UI 设计（Glassmorphism）
- 本地优先，无网络依赖
- 一键启动项目，自动发现项目，AI 分析项目

---

## 2. 技术栈

### 前端层 (React/TypeScript)

| 技术 | 版本 | 用途 |
|------|------|------|
| React | 18.x | UI 框架 |
| TypeScript | 5.7+ | 类型安全 |
| Vite | 6.x | 构建工具 + HMR 开发服务器 |
| Ant Design | 5.24+ | UI 组件库（表格、表单、Modal、菜单等） |
| @ant-design/icons | 5.6+ | Ant Design 图标库 |
| Zustand | 5.0+ | 轻量级状态管理 |
| React Router | 6.x | 客户端路由 |
| ECharts | 5.6+ | 数据可视化（数据大屏） |
| echarts-for-react | 3.0+ | ECharts React 封装 |
| xterm.js | 6.0+ | 终端仿真（@xterm/xterm） |
| @xterm/addon-fit | 0.11+ | xterm.js 自适应尺寸插件 |
| @dnd-kit | 6.3+ | 拖拽交互（@dnd-kit/core + @dnd-kit/sortable） |
| react-markdown | 9.0+ | Markdown 渲染 |
| dayjs | 1.11+ | 日期处理 |

### 后端层 (Rust)

| 技术 | 版本 | 用途 |
|------|------|------|
| Tauri | 2.x | 桌面应用框架 |
| rusqlite | 0.32+ | SQLite 数据库驱动（bundled） |
| serde/serde_json | 1.x | 序列化/反序列化 |
| portable-pty | 0.8+ | 伪终端（PTY）管理 |
| tokio | 1.x | 异步运行时 |
| uuid | 1.x | UUID 生成 |
| chrono | 0.4+ | 日期时间处理 |
| thiserror | 2.x | 错误处理宏 |

### Tauri 插件 (npm)

- `@tauri-apps/api` ^2.0.0 — Tauri 前端 API
- `@tauri-apps/plugin-dialog` ^2.0.0 — 原生对话框（文件选择等）
- `@tauri-apps/plugin-shell` ^2.0.0 — 系统级 shell 操作

### Tauri 插件 (Rust)

- `tauri-plugin-shell` — 系统级 shell 操作
- `tauri-plugin-dialog` — 原生对话框（文件选择等）
- `tauri-plugin-window-state` — 窗口状态持久化

### 系统配置

```
Rust 编译模式：
- Dev: 增量编译 (incremental = true)
- Release: LTO 优化、代码生成单元=1、strip=true、opt-level="s"

前端构建：
- TypeScript 严格检查 (tsc -b)
- Vite 生产构建 (vite build)
- 热模块替换开发 (vite dev)
```

---

## 3. 项目目录结构

```
ProjectManagement/
├── src/                                    # 前端源码根目录
│   ├── api/                               # IPC 调用层
│   │   └── index.ts                      # 封装所有 Tauri invoke 调用
│   │                                      # 14 个 API 对象（projectsApi, tasksApi 等）
│   │                                      # 统一 cmd<T>() 泛型包装器
│   │
│   ├── stores/                            # Zustand 状态管理
│   │   └── terminalStore.ts             # 终端状态（分组、分屏、启动队列、主题）
│   │
│   ├── features/                          # 业务功能模块
│   │   ├── dashboard/                    # 仪表盘
│   │   │   └── DashboardPage.tsx
│   │   ├── projects/                     # 项目管理（最复杂模块）
│   │   │   ├── ProjectsPage.tsx         # 项目列表页
│   │   │   ├── ProjectDetailPage.tsx    # 项目详情页（包含多个子标签）
│   │   │   ├── ProjectDetailPage.css    # 项目详情页样式
│   │   │   ├── HealthTab.tsx            # 健康检查标签
│   │   │   ├── DependencyGraphPage.tsx  # 依赖关系图页面（/graph 路由）
│   │   │   └── git/                     # Git 集成 UI
│   │   │       ├── GitTab.tsx           # Git 标签页
│   │   │       ├── BranchSelector.tsx   # 分支选择器
│   │   │       ├── StagingArea.tsx      # 暂存区
│   │   │       ├── DiffViewer.tsx       # 差异查看器
│   │   │       └── CommitGraph.tsx      # 提交图
│   │   ├── git/                          # Git 总览
│   │   │   └── GitDashboardPage.tsx     # Git 总览页面（/git 路由）
│   │   ├── data-screen/                  # 数据大屏
│   │   │   └── DataScreenPage.tsx
│   │   ├── timeline/                     # 活动时间线
│   │   │   └── TimelinePage.tsx
│   │   └── settings/                     # 设置页面
│   │       └── SettingsPage.tsx
│   │
│   ├── shared/                            # 共享组件
│   │   ├── MainLayout.tsx               # 主布局（侧边栏 + 内容区 + 终端面板）
│   │   ├── TerminalManager.tsx           # 终端管理器 UI
│   │   ├── TerminalInstance.tsx          # 单个终端实例
│   │   ├── HealthBadge.tsx              # 健康状态徽章
│   │   ├── GlobalSearch.tsx             # 全局搜索（Ctrl+K，含历史记录）
│   │   ├── QuickLaunchModal.tsx         # 快速启动弹窗（配置文件管理）
│   │   ├── terminalTypes.ts             # 终端 TypeScript 类型定义
│   │   ├── terminalThemes.ts            # 终端主题配置（4 种主题）
│   │   ├── components/                  # 通用组件
│   │   │   ├── SearchBox.tsx            # 搜索框组件
│   │   │   └── GlassCard.tsx            # 玻璃态卡片组件
│   │   ├── ProjectIcon/                 # 项目图标
│   │   │   └── index.tsx               # 项目图标组件（技术栈颜色映射）
│   │   ├── KanbanBoard/                 # 看板
│   │   │   └── index.tsx               # 拖拽看板（Todo/InProgress/Done/Cancelled）
│   │   ├── terminal/                    # 终端子组件
│   │   │   ├── SplitDivider.tsx        # 分屏分割线
│   │   │   ├── TerminalPane.tsx        # 终端面板
│   │   │   ├── TerminalTab.tsx         # 终端标签
│   │   │   ├── TerminalTabBar.tsx      # 终端标签栏
│   │   │   └── TerminalGroup.tsx       # 终端分组
│   │   └── styles/                      # 样式
│   │       ├── variables.css           # CSS 变量定义
│   │       ├── glassmorphism.css       # 玻璃态样式
│   │       └── animations.css          # 动画样式
│   │
│   ├── lib/                               # 工具函数和常量
│   │   ├── normalize.ts                 # 数据规范化（techStack JSON 解析）
│   │   ├── healthUtils.ts               # 健康检查工具函数
│   │   ├── launchUtils.ts               # 启动流程工具
│   │   ├── launchProfiles.ts            # 启动配置文件管理
│   │   ├── projectUtils.ts              # 项目工具函数
│   │   ├── format.ts                    # 格式化工具
│   │   └── constants.ts                 # 常量定义
│   │
│   ├── hooks/                             # React Hooks
│   │   └── useDebounce.ts               # 防抖 Hook
│   │
│   ├── types/                             # TypeScript 类型定义
│   │   └── index.ts                     # 全局类型定义
│   │
│   ├── styles/                            # 样式文件
│   │   └── design-system.css            # 设计系统（CSS 变量）
│   │
│   ├── App.tsx                            # 应用根组件（路由配置）
│   ├── main.tsx                           # 应用入口（ConfigProvider 主题设置）
│   └── index.css                          # 全局样式
│
├── src-tauri/                             # Rust 后端源码
│   ├── src/
│   │   ├── lib.rs                        # 应用入口（初始化、插件注册、命令注册）
│   │   ├── db.rs                         # 数据库抽象层（线程安全、迁移、查询）
│   │   └── commands/                     # IPC 命令处理器（15 个模块，75 个命令）
│   │       ├── mod.rs                   # 模块声明
│   │       ├── projects.rs             # 项目管理 (15 个命令)
│   │       ├── tasks.rs                # 任务管理 (5 个命令)
│   │       ├── repos.rs                # 远程仓库管理 (5 个命令)
│   │       ├── documents.rs            # 文档管理 (5 个命令)
│   │       ├── milestones.rs           # 里程碑管理 (4 个命令)
│   │       ├── tags.rs                 # 标签管理 (6 个命令)
│   │       ├── search.rs               # 全局搜索 (1 个命令)
│   │       ├── timeline.rs             # 活动时间线 (2 个命令)
│   │       ├── detect.rs               # 项目检测 (3 个命令)
│   │       ├── terminal.rs             # 终端管理 (5 个命令)
│   │       ├── git.rs                  # Git 操作 (11 个命令)
│   │       ├── dependencies.rs         # 依赖关系检测 (4 个命令)
│   │       ├── health.rs               # 健康检查 (4 个命令)
│   │       └── workspaces.rs           # 工作区管理 (5 个命令)
│   │
│   └── migrations/                        # 数据库迁移
│       ├── 001_init.sql                 # 初始化（项目、任务、仓库等基础表）
│       ├── 002_remove_users.sql         # 移除 users/integrations/project_tags 表
│       ├── 003_runtime_status.sql       # 新增前端/后端运行状态字段
│       ├── 004_health_score.sql         # 新增健康评分字段
│       └── 005_workspaces.sql           # 新增工作区表
│
├── package.json                           # 前端依赖配置
├── Cargo.toml                            # Rust 依赖配置
├── vite.config.ts                        # Vite 配置
├── tsconfig.json                         # TypeScript 配置
└── CLAUDE.md                             # 项目文档
```

---

## 4. 数据库架构

### 4.1 基本信息

- **类型**：SQLite 3
- **存储位置**：`{app_data_dir}/devhub.db`（Windows: `%APPDATA%/devhub/`）
- **PRAGMA 设置**：`journal_mode=WAL`, `foreign_keys=ON`
- **主键**：UUID v4 (TEXT 类型)
- **外键**：支持级联删除 (ON DELETE CASCADE)

### 4.2 表结构

> **注意**：`users`、`integrations`、`project_tags` 表已在迁移 002 中移除。项目不再使用 `ownerId`/`userId` 字段。

#### 项目表 (projects) — 核心表

```sql
id              TEXT PRIMARY KEY       -- UUID
name            TEXT NOT NULL          -- 项目名称
description     TEXT                   -- 项目描述
status          TEXT NOT NULL DEFAULT 'Idea'  -- 项目状态
priority        TEXT NOT NULL DEFAULT 'Medium'  -- 优先级
source          TEXT NOT NULL DEFAULT 'Local'   -- 来源（Local/GitHub/GitLab）
iconType        TEXT NOT NULL DEFAULT 'Auto'    -- 图标类型
iconUrl         TEXT                   -- 图标 URL
iconColor       TEXT                   -- 图标颜色
localPath       TEXT                   -- 本地路径
openCommand     TEXT                   -- 打开命令
frontendCommand TEXT                   -- 前端启动命令
backendCommand  TEXT                   -- 后端启动命令
frontendCwd     TEXT                   -- 前端工作目录
backendCwd      TEXT                   -- 后端工作目录
liveUrl         TEXT                   -- 在线 URL
domainName      TEXT                   -- 域名
techStack       TEXT NOT NULL DEFAULT '[]'  -- 技术栈（JSON 数组）
startDate       DATETIME              -- 开始日期
targetDate      DATETIME              -- 目标日期
createdAt       DATETIME             -- 创建时间
updatedAt       DATETIME             -- 更新时间
frontendStatus  TEXT NOT NULL DEFAULT 'stopped'  -- 前端运行状态
backendStatus   TEXT NOT NULL DEFAULT 'stopped'  -- 后端运行状态
lastLaunchTime  DATETIME             -- 最后启动时间
workspaceId     TEXT                 -- 工作区 ID（外键）

索引：status, workspaceId
外键：workspaceId → workspaces.id (SET NULL)
```

#### 远程仓库表 (remote_repos)

```sql
id              TEXT PRIMARY KEY       -- UUID
projectId       TEXT NOT NULL          -- 项目 ID
platform        TEXT NOT NULL          -- 平台（GitHub/GitLab/Gitee）
repoUrl         TEXT NOT NULL          -- 仓库 URL
repoFullName    TEXT NOT NULL          -- 仓库全名
defaultBranch   TEXT                   -- 默认分支
repoStatus      TEXT NOT NULL DEFAULT 'Synced'  -- 仓库状态
lastCommitSha   TEXT                   -- 最后提交 SHA
lastCommitAt    DATETIME              -- 最后提交时间
lastSyncAt      DATETIME              -- 最后同步时间
extraConfig     TEXT                  -- 额外配置（JSON）
integrationId   TEXT                  -- 集成 ID（遗留字段，integrations 表已移除）
createdAt       DATETIME
updatedAt       DATETIME

索引：projectId, platform
外键：projectId → projects.id (CASCADE)
```

#### 任务表 (tasks) — 支持层级

```sql
id              TEXT PRIMARY KEY       -- UUID
title           TEXT NOT NULL          -- 任务标题
description     TEXT                   -- 任务描述
status          TEXT NOT NULL DEFAULT 'Todo'  -- 状态（Todo/InProgress/Done）
priority        TEXT NOT NULL DEFAULT 'Medium'  -- 优先级
dueDate         DATETIME              -- 截止日期
projectId       TEXT NOT NULL          -- 所属项目
repoScope       TEXT                  -- 仓库范围（外键）
milestoneId     TEXT                  -- 里程碑 ID
parentId        TEXT                  -- 父任务 ID（支持子任务）
createdAt       DATETIME
updatedAt       DATETIME

索引：projectId, status, repoScope
外键：projectId → projects.id (CASCADE)
      repoScope → remote_repos.id (SET NULL)
      milestoneId → milestones.id (SET NULL)
      parentId → tasks.id (CASCADE)
```

#### 里程碑表 (milestones)

```sql
id              TEXT PRIMARY KEY
name            TEXT NOT NULL          -- 里程碑名称
description     TEXT                   -- 描述
dueDate         DATETIME              -- 截止日期
status          TEXT NOT NULL DEFAULT 'Pending'  -- 状态
projectId       TEXT NOT NULL          -- 所属项目
createdAt       DATETIME

索引：projectId
外键：projectId → projects.id (CASCADE)
```

#### 文档表 (documents)

```sql
id              TEXT PRIMARY KEY
title           TEXT NOT NULL          -- 文档标题
content         TEXT NOT NULL DEFAULT ''  -- 内容（Markdown）
type            TEXT NOT NULL DEFAULT 'Doc'  -- 类型
projectId       TEXT NOT NULL          -- 所属项目
createdAt       DATETIME
updatedAt       DATETIME

索引：projectId
外键：projectId → projects.id (CASCADE)
```

#### 标签表 (tags)

```sql
id              TEXT PRIMARY KEY
name            TEXT NOT NULL          -- 标签名
color           TEXT NOT NULL DEFAULT '#6366F1'  -- 颜色

索引：name (UNIQUE)
```

#### 活动日志表 (activity_logs)

```sql
id              TEXT PRIMARY KEY
action          TEXT NOT NULL          -- 操作类型
entityType      TEXT NOT NULL          -- 实体类型（project/task/document 等）
entityId        TEXT NOT NULL          -- 实体 ID
details         TEXT                  -- 详情（JSON）
projectId       TEXT NOT NULL          -- 所属项目
createdAt       DATETIME

索引：projectId, createdAt
外键：projectId → projects.id (CASCADE)
```

#### 健康检查表 (project_health_checks)

```sql
id              TEXT PRIMARY KEY
projectId       TEXT NOT NULL
checkDate       TEXT NOT NULL          -- 检查日期
dirtyFileCount  INTEGER DEFAULT 0      -- 未提交文件数
currentBranch   TEXT                   -- 当前分支
aheadCount      INTEGER DEFAULT 0      -- 领先提交数
behindCount     INTEGER DEFAULT 0      -- 落后提交数
outdatedDeps    TEXT DEFAULT '[]'      -- 过时依赖（JSON）
outdatedDepCount INTEGER DEFAULT 0     -- 过时依赖数
hasChanges      INTEGER DEFAULT 0      -- 是否有变更
healthScore     INTEGER               -- 健康评分（0-100）
healthStatus    TEXT                   -- 健康状态（Healthy/Warning/Critical）
createdAt       TEXT

索引：projectId, checkDate
外键：projectId → projects.id (CASCADE)
```

#### 工作区表 (workspaces)

```sql
id              TEXT PRIMARY KEY
name            TEXT NOT NULL          -- 工作区名称
description     TEXT                   -- 描述
color           TEXT NOT NULL DEFAULT '#6366F1'  -- 颜色
sortOrder       INTEGER NOT NULL DEFAULT 0  -- 排序顺序
createdAt       DATETIME
updatedAt       DATETIME
```

---

## 5. IPC 通信架构

### 5.1 调用流程

```
┌─────────────────┐      ┌──────────────┐      ┌──────────────┐      ┌──────────┐
│  React 组件     │ ───> │  API 层      │ ───> │  Tauri IPC   │ ───> │  Rust    │
│  (UI 事件)      │      │  (cmd())     │      │  (invoke)    │      │  命令处理 │
└─────────────────┘      └──────────────┘      └──────────────┘      └──────────┘
                                                        │
                                                        │
                                                        v
                                                  ┌──────────┐
                                                  │  SQLite  │
                                                  │  (查询)  │
                                                  └──────────┘
                                                        │
                                                        v
                                                  ┌──────────────┐
                                                  │  JSON 结果   │
                                                  │  (返回前端)   │
                                                  └──────────────┘
```

### 5.2 命令注册 (lib.rs)

```rust
.invoke_handler(tauri::generate_handler![
    // 项目管理 (15 个)
    commands::projects::projects_list,
    commands::projects::projects_get_by_id,
    commands::projects::projects_create,
    commands::projects::projects_update,
    commands::projects::projects_delete,
    commands::projects::projects_update_status,
    commands::projects::projects_get_stats,
    commands::projects::projects_open,
    commands::projects::projects_refresh,
    commands::projects::projects_launch,
    commands::projects::projects_stop,
    commands::projects::projects_check_environment,
    commands::projects::projects_batch_import,
    commands::projects::detect_project_cwd,
    commands::projects::debug_project_raw,
    
    // 任务管理 (5 个)
    commands::tasks::tasks_list,
    commands::tasks::tasks_create,
    commands::tasks::tasks_update,
    commands::tasks::tasks_delete,
    commands::tasks::tasks_update_status,
    
    // 仓库管理 (5 个)
    commands::repos::repos_list,
    commands::repos::repos_add,
    commands::repos::repos_update,
    commands::repos::repos_remove,
    commands::repos::repos_sync,
    
    // 文档管理 (5 个)
    commands::documents::documents_list,
    commands::documents::documents_get_by_id,
    commands::documents::documents_create,
    commands::documents::documents_update,
    commands::documents::documents_delete,
    
    // 里程碑管理 (4 个)
    commands::milestones::milestones_list,
    commands::milestones::milestones_create,
    commands::milestones::milestones_update,
    commands::milestones::milestones_delete,
    
    // 标签管理 (6 个)
    commands::tags::tags_list,
    commands::tags::tags_create,
    commands::tags::tags_update,
    commands::tags::tags_delete,
    commands::tags::tags_assign_to_project,
    commands::tags::tags_remove_from_project,
    
    // 全局搜索 (1 个)
    commands::search::global_search,
    
    // 活动时间线 (2 个)
    commands::timeline::get_timeline,
    commands::timeline::get_project_timeline,
    
    // 项目检测 (3 个)
    commands::detect::detect_local_project,
    commands::detect::detect_git_repo,
    commands::detect::detect_scan_directory,
    
    // 终端管理 (5 个)
    commands::terminal::terminal_start,
    commands::terminal::terminal_start_shell,
    commands::terminal::terminal_stop,
    commands::terminal::terminal_input,
    commands::terminal::terminal_resize,
    
    // Git 操作 (11 个)
    commands::git::git_status,
    commands::git::git_log,
    commands::git::git_branches,
    commands::git::git_diff,
    commands::git::git_branch_switch,
    commands::git::git_stash_list,
    commands::git::git_add,
    commands::git::git_commit,
    commands::git::git_push,
    commands::git::git_diff_commit,
    commands::git::git_reset_head,
    
    // 依赖关系检测 (4 个)
    commands::dependencies::detect_project_dependencies,
    commands::dependencies::get_launch_order,
    commands::dependencies::analyze_docker_compose,
    commands::dependencies::detect_monorepo_structure,
    
    // 健康检查 (4 个)
    commands::health::run_all_health_checks,
    commands::health::run_health_check_for_project,
    commands::health::get_project_health_history,
    commands::health::get_all_latest_health,
    
    // 工作区管理 (5 个)
    commands::workspaces::workspaces_list,
    commands::workspaces::workspaces_create,
    commands::workspaces::workspaces_update,
    commands::workspaces::workspaces_delete,
    commands::workspaces::workspaces_assign_project,
])
// 总计：75 个命令，15 个模块
```

### 5.3 前端 API 层 (src/api/index.ts)

```typescript
// 统一的命令调用包装器
const cmd = <T = any>(name: string, args?: Record<string, unknown>): Promise<T> =>
  tauriInvoke(name, args) as Promise<T>;

// 14 个 API 对象
export const projectsApi = { ... };   // 15 个方法
export const tasksApi = { ... };      // 5 个方法
export const reposApi = { ... };      // 5 个方法
export const documentsApi = { ... };  // 5 个方法
export const milestonesApi = { ... }; // 4 个方法
export const tagsApi = { ... };       // 6 个方法
export const timelineApi = { ... };   // 2 个方法
export const searchApi = { ... };     // 1 个方法
export const detectApi = { ... };     // 3 个方法
export const gitApi = { ... };        // 11 个方法
export const terminalApi = { ... };   // 5 个方法
export const dependenciesApi = { ... }; // 4 个方法
export const healthApi = { ... };     // 4 个方法
export const workspacesApi = { ... }; // 5 个方法
```

### 5.4 事件驱动模式（终端输出）

```rust
// Rust 后端
app.emit("terminal-output", TerminalOutput { terminal_id, data, stream })
app.emit("terminal-exit", TerminalExit { terminal_id, code })
```

```typescript
// React 前端
listen<TerminalOutput>("terminal-output", (event) => { ... })
listen<TerminalExit>("terminal-exit", (event) => { ... })
```

---

## 6. 前端架构

### 6.1 路由结构

```tsx
<Routes>
  <Route path="/" element={<MainLayout />}>
    <Route index element={<DashboardPage />} />           // 仪表盘
    <Route path="projects" element={<ProjectsPage />} />  // 项目列表
    <Route path="projects/:id" element={<ProjectDetailPage />} />  // 项目详情
    <Route path="graph" element={<DependencyGraphPage />} />  // 依赖关系图
    <Route path="git" element={<GitDashboardPage />} />  // Git 总览
    <Route path="timeline" element={<TimelinePage />} />  // 时间线
    <Route path="data-screen" element={<DataScreenPage />} />  // 数据大屏
    <Route path="settings" element={<SettingsPage />} />  // 设置
  </Route>
  <Route path="*" element={<Navigate to="/" replace />} />
</Routes>
```

### 6.2 状态管理 (Zustand)

#### Terminal Store (terminalStore.ts) — 唯一的 Zustand Store

```typescript
interface TerminalStore {
  // 可见性控制
  terminalOpen: boolean;
  setTerminalOpen: (v: boolean) => void;
  
  // 启动队列（延迟启动终端）
  launchQueue: LaunchRequest[];
  requestLaunch: (req: LaunchRequest) => void;
  consumeLaunchRequest: () => LaunchRequest | null;
  
  // 终端实例管理
  terminals: Terminal[];
  addTerminal: (t: Terminal) => void;
  removeTerminal: (id: string) => void;
  updateTerminal: (id: string, patch: Partial<Terminal>) => void;
  
  // 分屏状态
  leftPane: PaneState;
  rightPane: PaneState;
  setActiveId: (pane: 'left' | 'right', id: string | null) => void;
  splitPaneOpen: boolean;
  splitRatio: number;
  moveTerminalToPane: (terminalId: string, targetPane: 'left' | 'right') => void;
  
  // 分组管理
  groups: TerminalGroup[];
  addGroup: (label: string, isProjectGroup?: boolean) => string;
  removeGroup: (id: string) => void;
  moveTerminalToGroup: (terminalId: string, groupId: string | null) => void;
  
  // 主题
  theme: TerminalTheme;  // 'dark' | 'modern' | 'matrix' | 'light'
  setTheme: (t: TerminalTheme) => void;
  
  // Tab 栏宽度
  tabBarWidth: number;
  setTabBarWidth: (w: number) => void;
}
```

### 6.3 主布局 (MainLayout.tsx)

```
┌────────────────────────────────────────────────────┐
│                    Header                          │
│  [菜单] [项目管理] [活动时间线] [数据大屏] [设置]  │
│  [全局搜索] (Ctrl+K)              [用户头像]       │
├────────────────────────────────────────────────────┤
│                      │                             │
│     侧边栏           │         内容区              │
│     (可折叠)          │    (React Router Outlet)    │
│                      │                             │
│                      │                             │
│                      │                             │
├────────────────────────────────────────────────────┤
│              终端面板 (可拖拽调整高度)              │
│  ┌─────────┬─────────┬─────────┬─────────┐        │
│  │ Tab 1   │ Tab 2   │ Tab 3   │ [+]     │        │
│  ├─────────┴─────────┴─────────┴─────────┤        │
│  │                                        │        │
│  │         终端内容区 (xterm.js)          │        │
│  │                                        │        │
│  └────────────────────────────────────────┘        │
└────────────────────────────────────────────────────┘
```

**特色功能**：
- 终端面板可通过 Ctrl+` 切换
- 可拖拽调整终端高度
- 支持左右分屏
- 终端可分组、重命名
- 支持 4 种主题切换

### 6.4 设计系统 (design-system.css + main.tsx)

**颜色主题**（玻璃态设计）：

```css
--color-primary: #22c55e           /* 绿色主色调 */
--color-success: #22c55e
--color-warning: #f59e0b           /* 琥珀色 */
--color-error: #ef4444             /* 红色 */
--color-bg-base: #ffffff
--color-bg-container: rgba(255, 255, 255, 0.55)  /* 半透明背景 */
--color-bg-elevated: rgba(255, 255, 255, 0.95)
--color-text: #1a1f36
--color-text-secondary: #6b7a99
```

**字体**：
- 正文：Fira Sans（Google Fonts）
- 代码：Fira Code（等宽字体）

**Ant Design 主题覆盖**：

```typescript
theme={{
  token: {
    colorPrimary: '#22c55e',
    borderRadius: 10,
    fontFamily: "'Fira Sans', sans-serif",
    fontSize: 14,
  },
  components: {
    Button: { borderRadius: 10, fontWeight: 500 },
    Card: { borderRadiusLG: 12, colorBgContainer: 'rgba(255, 255, 255, 0.55)' },
    Input: { borderRadius: 10, activeBorderColor: '#22c55e' },
    // ... 更多覆盖
  }
}}
```

---

## 7. 后端架构

### 7.1 数据库抽象层 (db.rs)

```rust
pub struct Database {
    conn: Mutex<Connection>,  // 线程安全包装
}

impl Database {
    pub fn new(path: &Path) -> Result<Self, DbError>;
    pub fn query_json(&self, sql: &str) -> Result<serde_json::Value, DbError>;
    pub fn query_json_with_params(&self, sql: &str, params: &[&dyn ToSql]) -> Result<serde_json::Value, DbError>;
    pub fn execute(&self, sql: &str) -> Result<usize, DbError>;
    pub fn execute_with_params(&self, sql: &str, params: &[&dyn ToSql]) -> Result<usize, DbError>;
    pub fn log_activity(&self, action: &str, entity_type: &str, entity_id: &str, details: Option<&str>, project_id: &str) -> Result<(), DbError>;
}
```

**迁移策略**（5 个迁移文件）：
1. `001_init.sql` — 执行初始化 SQL（创建基础表）
2. 内联 ALTER — 添加 `frontendCommand`/`backendCommand`/`frontendCwd`/`backendCwd`（忽略重复列错误）
3. 内联 CREATE — 创建 `project_health_checks` 表
4. `002_remove_users.sql` — 移除 `users`/`integrations`/`project_tags` 表，重建 `projects` 表（移除 `ownerId`）
5. `003_runtime_status.sql` — 添加 `frontendStatus`/`backendStatus`/`lastLaunchTime` 字段
6. `004_health_score.sql` — 添加 `healthScore`/`healthStatus` 字段
7. `005_workspaces.sql` — 创建 `workspaces` 表，添加 `workspaceId` 字段

### 7.2 终端管理 (terminal.rs) — 双模式

#### 模式 1：非交互式命令 (terminal_start)

```rust
#[command]
pub async fn terminal_start(
    app: AppHandle,
    project_id: String,
    command_str: String,
    cwd: String,
) -> Result<String, String> {
    // Windows: cmd /C chcp 65001 >nul & {command}
    // Unix: sh -c {command}
    
    let mut child = cmd.spawn()?;
    PROCESSES.insert(terminal_id, child);
    
    // 按行读取输出，通过事件发送到前端
    std::thread::spawn(move || {
        loop {
            match reader.read_line(&mut line) {
                Ok(0) | Err(_) => break,
                Ok(_) => app.emit("terminal-output", ...),
            }
        }
    });
}
```

#### 模式 2：交互式 Shell (terminal_start_shell)

```rust
#[command]
pub async fn terminal_start_shell(
    app: AppHandle,
    terminal_id: String,
    shell: String,  // "powershell.exe" | "bash" | "sh"
    cwd: String,
    args: Option<Vec<String>>,
) -> Result<String, String> {
    let pty = native_pty_system();
    let pair = pty.open(PtySize { rows: 24, cols: 80, .. })?;
    
    let mut cmd = CommandBuilder::new(&shell);
    cmd.cwd(&cwd);
    
    let child = pair.slave.spawn_command(cmd)?;
    
    PTY_TERMINALS.insert(terminal_id, PtyTerminal { child, writer, master });
    
    // 逐字节读取输出（更细粒度）
    std::thread::spawn(move || {
        loop {
            match reader.read(&mut buf) {
                Ok(0) | Err(_) => break,
                Ok(n) => app.emit("terminal-output", ...),
            }
        }
    });
}
```

#### 进程清理

```rust
// 窗口关闭时调用
pub fn cleanup_all() {
    let mut procs = recover_lock(&PROCESSES);
    for (_, mut child) in procs.drain() {
        let _ = child.kill();
    }
    
    let mut ptys = recover_lock(&PTY_TERMINALS);
    for (_, mut terminal) in ptys.drain() {
        let _ = terminal.child.kill();
    }
}
```

### 7.3 命令处理模式

#### 输入参数模式

```rust
#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateProjectInput {
    pub name: String,
    pub description: Option<String>,
    pub status: Option<String>,
    pub priority: Option<String>,
    pub local_path: Option<String>,
    pub tech_stack: Option<String>,  // JSON 字符串
    // ...
}
```

#### 响应模式

```rust
#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectResponse {
    pub id: String,
    pub name: String,
    pub tech_stack: serde_json::Value,  // 自动解析为 JSON
    // ...
}
```

#### 动态查询构建

```rust
// 部分更新使用宏构建动态 SET 子句
macro_rules! add_field {
    ($sql:expr, $fields:expr, $key:expr, $value:expr) => {
        if let Some(v) = $value {
            if !$fields.is_empty() { $sql.push_str(", "); }
            $sql.push_str(&format!("{} = '{}'", $key, v));
            $fields.push($key);
        }
    };
}
```

---

## 8. 功能模块详解

### 8.1 项目管理 (projects)

**功能清单**：
- 项目列表展示（分页、排序、筛选）
- 项目创建/编辑/删除
- 项目状态流转（Idea → Planning → Active → Completed → Archived）
- 多仓库关联（GitHub/GitLab/Gitee）
- 项目图标自动生成（Auto/Emoji/Initial/URL）
- 技术栈标签管理
- 项目统计（任务数、完成率、文档数）
- 项目健康检查（每天首次打开自动运行）

**数据流**：
```
ProjectsPage (列表)
  └── projectsApi.list() → 渲染项目卡片
        └── 点击项目
              └── ProjectDetailPage (详情)
                    ├── 任务看板 (KanbanBoard)
                    ├── Git 标签 (GitTab)
                    ├── 文档中心 (DocumentsTab)
                    ├── 里程碑 (MilestonesTab)
                    ├── 仓库管理 (ReposTab)
                    ├── 健康检查 (HealthTab)
                    └── 活动时间线 (TimelineTab)
```

**新增路由页面**：
- `/graph` — DependencyGraphPage：项目依赖关系图可视化
- `/git` — GitDashboardPage：所有项目的 Git 状态总览

### 8.2 任务看板 (Tasks)

**特性**：
- 拖拽排序（@dnd-kit）
- 状态列：Todo / In Progress / Done
- 按仓库范围筛选
- 支持子任务（parentId）
- 关联里程碑

**UI 结构**：
```
┌─────────┬─────────┬─────────┐
│  Todo   │ In Prog │  Done   │
├─────────┼─────────┼─────────┤
│ Task 1  │ Task 3  │ Task 5  │
│ Task 2  │ Task 4  │         │
└─────────┴─────────┴─────────┘
```

### 8.3 终端管理 (Terminal)

**核心功能**：
- 多实例终端（每个项目可有多个终端）
- 双模式：非交互式（命令执行）+ 交互式（完整 shell）
- 分屏（左右面板）
- 分组（项目分组/自定义分组）
- 主题切换（dark/modern/matrix/light）
- 启动队列（延迟创建终端）
- 键盘快捷键（Ctrl+` 切换终端）

**终端管理器组件层级**：
```
TerminalManager
  ├── TabBar (终端标签栏)
  │   ├── TerminalGroup (分组)
  │   │   └── TerminalTab (单个终端标签)
  │   └── AddTerminalButton (+)
  ├── SplitPane (分屏容器)
  │   ├── LeftPane
  │   │   └── TerminalInstance (xterm.js)
  │   └── RightPane
  │       └── TerminalInstance (xterm.js)
  └── ResizeHandle (拖拽调整高度)
```

### 8.4 Git 集成

**支持的操作**：
- `git status` — 查看状态
- `git log` — 查看提交历史
- `git branches` — 列出分支
- `git diff` — 查看差异（支持按文件、staged）
- `git diff commit` — 查看特定提交的差异
- `git add` — 暂存文件
- `git commit` — 提交
- `git push` — 推送
- `git branch switch` — 切换分支
- `git stash list` — 查看 stash
- `git reset head` — 取消暂存

**Git UI 组件**：
- `GitDashboardPage` — Git 总览页面（/git 路由）
- `GitTab` — 项目详情页内的 Git 标签
- `BranchSelector` — 分支选择器
- `StagingArea` — 暂存区 UI
- `DiffViewer` — 差异查看器
- `CommitGraph` — 提交图可视化

### 8.5 依赖关系检测

**功能**：
- 项目间依赖检测
- Docker Compose 分析
- Monorepo 结构检测
- 启动顺序计算（拓扑排序）

### 8.6 健康检查

**检查项**：
- 未提交文件数 (dirtyFileCount)
- 当前分支 (currentBranch)
- 领先/落后提交数 (aheadCount/behindCount)
- 过时依赖数 (outdatedDepCount)
- 是否有变更 (hasChanges)

**触发时机**：
- 每天首次打开应用时自动运行
- 手动触发单个项目检查

**输出**：
- 存入 `project_health_checks` 表
- 包含 `healthScore`（0-100 评分）和 `healthStatus`（Healthy/Warning/Critical）
- 前端通知显示有问题的项目
- 项目详情页显示健康徽章

### 8.7 工作区管理 (Workspaces)

**功能**：
- 工作区 CRUD（创建、编辑、删除）
- 项目分配到工作区（`workspaceId` 外键）
- 工作区排序（`sortOrder`）
- 工作区颜色标识

**后端命令**：
- `workspaces_list` — 列出所有工作区
- `workspaces_create` — 创建工作区
- `workspaces_update` — 更新工作区
- `workspaces_delete` — 删除工作区
- `workspaces_assign_project` — 将项目分配到工作区

### 8.8 项目启动系统

**功能**：
- 一键启动项目（前端 + 后端 + 打开浏览器）
- 快速启动弹窗（QuickLaunchModal）— 配置文件管理、历史记录、导入导出
- 启动配置文件（launchProfiles.ts）— 保存/加载启动配置
- 环境检查（`projects_check_environment`）— Node.js 版本、端口占用、.env 文件、依赖状态
- 运行状态追踪（`frontendStatus`/`backendStatus`/`lastLaunchTime`）

---

## 9. 数据规范化处理

**问题**：SQLite 存储 `techStack` 为 JSON 字符串，但有时返回数组。

**解决方案** (src/lib/normalize.ts)：

```typescript
export function normalizeProject(project: Record<string, any>): Record<string, any> {
  if (!project) return project;
  return {
    ...project,
    techStack: parseTechStack(project.techStack),
  };
}

export function parseTechStack(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw;
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}
```

**使用方式**：

```typescript
export const projectsApi = {
  list: (params?) => 
    cmd<any[]>('projects_list', { params }).then(normalizeProjects),  // 自动规范化
  // ...
};
```

---

## 10. 构建和部署

### 10.1 开发模式

```bash
# 启动前端开发服务器 (Vite, port 1420)
npm run dev

# 启动完整 Tauri 应用（前端 + Rust）
npm run tauri dev

# Rust 编译检查（不生成二进制）
cd src-tauri && cargo check
```

### 10.2 生产构建

```bash
# 构建生产版本
npm run tauri build

# 输出位置
# Windows: src-tauri/target/release/bundle/
# macOS: src-tauri/target/release/bundle/macos/
# Linux: src-tauri/target/release/bundle/deb/
```

**Release 配置**：

```toml
[profile.release]
codegen-units = 1        # 单代码生成单元（优化大小）
lto = true               # 链接时优化
opt-level = "s"          # 优化大小
strip = true             # 剥离调试符号
```

### 10.3 安装包

- **Windows**: NSIS 安装程序 (.exe) 或 MSI
- **macOS**: .app 应用包
- **Linux**: .deb / .rpm / .AppImage

---

## 11. 代码规范和模式

### 11.1 Rust 后端规范

#### 错误处理

```rust
#[derive(Debug, Error)]
pub enum DbError {
    #[error("Database error: {0}")]
    Sqlite(#[from] rusqlite::Error),
    #[error("Serialization error: {0}")]
    Serde(#[from] serde_json::Error),
    #[error("Lock error: {0}")]
    Lock(String),
}

// 所有命令错误映射为 String
.map_err(|e| e.to_string())
```

#### 命名约定

- 命令函数：`{module}_{action}`（如 `projects_list`、`terminal_start`）
  - **注意**：部分模块偏离此模式，使用 `{verb}_{noun}` 命名：
    - `global_search`（应为 `search_global`）
    - `get_timeline` / `get_project_timeline`（应为 `timeline_get`）
    - `run_all_health_checks` / `get_project_health_history`（应为 `health_run_all`）
    - `detect_project_dependencies` / `get_launch_order`（应为 `dependencies_*`）
- 输入结构：`{Action}Input`（如 `CreateProjectInput`）
- 输出结构：`{Entity}Response`（如 `ProjectResponse`）

#### 线程安全

- 使用 `Mutex<T>` 保护共享状态
- 使用 `LazyLock` 初始化静态数据
- 使用 `recover_lock` 处理锁中毒

### 11.2 TypeScript 前端规范

#### 类型定义

- 所有 API 返回值使用 `any`（为了灵活性）
- 组件 Props 定义 interface
- 使用 `Record<string, unknown>` 表示动态对象

#### 组件模式

- 函数组件 + Hooks
- 使用 Zustand 而不是 Context
- 样式：内联样式为主 + CSS 变量 + `shared/styles/` 模块化样式

#### 导入别名

```typescript
// tsconfig.json
"paths": { "@/*": ["./src/*"] }

// 使用
import { useTerminalStore } from '@/stores/terminalStore';
import { normalizeProject } from '@/lib/normalize';
```

---

## 12. 设计权衡

### 优点

1. **无服务器、单用户** — 简化架构，无需认证
2. **完全本地化** — 数据不离开本地
3. **玻璃态设计** — 现代、美观的 UI（glassmorphism.css + variables.css）
4. **嵌入式终端** — 无需切换窗口（双模式：命令执行 + 交互式 shell）
5. **灵活的 IPC 架构** — 易于扩展新命令（75 个命令，15 个模块）
6. **Git 深度集成** — 完整的 Git UI（暂存、提交、分支、差异、提交图）
7. **工作区管理** — 项目分组和组织

### 缺点和权衡

1. **无测试框架** — 难以保证代码质量
   - 没有 vitest/jest（前端）
   - 没有 cargo test（后端）

2. **类型安全不足** — API 层使用 `any`
   - 缺乏端到端类型检查
   - 运行时可能出现类型错误

3. **内联样式仍较多** — 部分改善
   - 已有 `shared/styles/`（variables.css、glassmorphism.css、animations.css）
   - 但组件内仍有大量内联样式

4. **部分大组件** — 终端子系统已拆分
   - TerminalManager 已拆为 5 个子组件（SplitDivider、TerminalPane、TerminalTab、TerminalTabBar、TerminalGroup）
   - MainLayout 可能仍较大

5. **增量迁移** — 数据库经历 5 次迁移
   - 001_init → 002_remove_users → 003_runtime_status → 004_health_score → 005_workspaces

6. **事件命名不一致** — 部分使用 camelCase，部分使用 kebab-case

7. **命令命名不一致** — 部分模块偏离 `{module}_{action}` 模式（见第 11 节）

---

## 13. 产品架构与路线图

### 整体架构

```
DevHub
│
├── 工作台 Dashboard — 一眼看到所有项目状态 ✅
│
├── 项目中心 Projects — 项目卡片、一键启动、自动发现、依赖关系图 ✅
│
├── AI 中心 AI Center — 项目分析、启动诊断、技术债检测 ❌（V2.0）
│
├── 终端中心 Terminal — 多终端、主题、Shell、分屏 ✅
│
├── Git 中心 Git — 所有项目的 Git 状态总览、提交图 ✅
│
├── 监控中心 Health — 项目健康度评分与排序 ✅
│
├── 知识中心 Docs — Markdown 文档 ✅
│
├── 工作区 Workspaces — 项目分组和组织 ✅
│
└── 设置 Settings ✅
```

### 发展路线图

```
V1.0 — 基础能力 ✅ 已完成
├── 项目管理（CRUD、状态、任务、看板拖拽）
├── 嵌入式终端（双模式：命令执行 + 交互式 shell）
├── Git 集成（11 个命令 + Git UI 组件）
├── 文档管理
├── 活动时间线
├── 数据大屏（ECharts）
├── 全局搜索（Ctrl+K + 历史记录）
└── 健康检查（healthScore 评分）

V1.5 — 启动体验 ✅ 大部分已完成
├── 项目自动发现（detect 模块）
├── 工作区管理（workspaces 模块）
├── 项目一键启动（projects_launch + QuickLaunchModal）
├── 启动配置文件（launchProfiles.ts）
├── 环境检查（projects_check_environment）
├── 依赖关系图（DependencyGraphPage）
└── 批量导入项目（projects_batch_import）

V2.0 — 智能化 ❌ 未开始
├── LLM API 集成层（后端调用 OpenAI/Claude/本地模型）
├── AI 项目分析（完成度、风险、下一步建议）
├── AI 启动诊断（启动失败自动分析+一键修复）
├── AI 结果展示面板（结构化报告 UI）
└── API Key 配置（设置页集成）

V2.5 — 深度分析 ❌ 未开始
├── AI 项目问答（基于任务/文档/代码的 RAG）
├── 技术债分析（大文件、未使用依赖、循环依赖、TODO）
└── 项目关系图谱增强（Docker/Monorepo/API 调用视图）

V3.0 — 开发者操作系统 ❌ 未开始
├── 多项目智能体（自动规划开发路线）
├── 自动生成文档
└── 自动生成周报
```

### 当前版本状态

| 版本 | 状态 | 完成度 |
|------|------|--------|
| V1.0 基础能力 | ✅ 已完成 | 100% |
| V1.5 启动体验 | ✅ 大部分完成 | ~90% |
| V2.0 智能化 | ❌ 未开始 | 0% |
| V2.5 深度分析 | ❌ 未开始 | 0% |
| V3.0 开发者操作系统 | ❌ 未开始 | 0% |

### 优先级建议

```
Phase 1（立即）：V2.0 — LLM API 集成层 → AI 项目分析 → AI 启动诊断
Phase 2（近期）：V2.0 补充 — AI 结果展示面板 → API Key 配置
Phase 3（中期）：V2.5 — 技术债分析 → 项目问答
Phase 4（远期）：V3.0 — 多项目智能体 → 自动文档 → 自动周报
```

---

## 14. 扩展点

### 易于扩展的领域

1. **新增 IPC 命令**
   - 在 `src-tauri/src/commands/` 添加新模块
   - 在 `lib.rs` 注册命令
   - 在 `src/api/index.ts` 添加前端包装

2. **新增页面**
   - 在 `src/features/` 添加新模块
   - 在 `App.tsx` 添加路由

3. **新增数据库表**
   - 在 `db.rs` 添加迁移 SQL
   - 在 `migrations/` 添加新迁移文件

4. **新增 UI 主题**
   - 在 `terminalStore.ts` 扩展主题类型
   - 在 CSS 中添加主题变量

### 难以扩展的领域

1. **多用户支持** — 需要重写认证、数据库 schema
2. **远程数据同步** — 需要添加网络层、冲突解决
3. **插件系统** — 需要设计插件接口、沙箱隔离
4. **移动端** — 需要重新设计 UI、功能裁剪

---

## 15. AI 智能模块

### 核心定位

**需要，但不是把 AI 做成聊天框。**

DevHub 与 Cursor、Claude Code、Gemini CLI 的本质区别：

- 终端里的 AI 是「项目执行者」— 专注于代码生成和重构
- DevHub 做的是「项目管理层 AI」— 专注于跨项目信息汇总和决策

这是两个层级，不竞争，而是互补。

**用户已经有** Claude Code、Gemini CLI、Cursor Agent、Copilot Agent 解决编码问题。DevHub 最有价值的是解决「管理多个项目时的信息汇总和决策」— 这恰恰是终端里的智能体最难做到的。

### 四类 AI 能力

#### 第一类：项目健康分析（SSS 优先级）

不是聊天，是「分析项目」按钮。

扫描 Git、package.json、Cargo.toml、README、任务、文档，输出：

```
项目完成度：72%
风险：
1. 两个月没有提交
2. 依赖过期12个
3. 没有测试
建议：
优先升级依赖
补充测试
```

#### 第二类：项目启动诊断（SSS 优先级）

用户点击「启动项目」时，DevHub 先检查：

```
Node版本 → OK
npm依赖 → 过期3个
Docker → 未运行
Redis → 未启动
MySQL → OK
端口3000 → 被占用
```

输出诊断报告和修复建议，甚至可以直接执行修复命令（如 `docker compose up redis`）。

**AI 运维助手** — 非常契合终端为核心的产品定位。

#### 第三类：项目问答（SS 优先级）

用户问「这个项目还有什么没做？」，AI 读取任务、里程碑、文档、Git 记录后回答：

```
支付系统 → 未开始
权限系统 → 进行中，剩余3个任务
日志系统 → 未开始
```

终端 AI 不知道 DevHub 里的项目元数据，这是独有价值。

#### 第四类：跨项目决策（SS 优先级）

终端 AI 做不到的。例如用户有 AIFilter、DevHub、NovelAI 三个项目，问「应该优先开发哪个？」

AI 读取任务数量、完成度、最近提交、健康评分后输出：

```
优先开发 AIFilter
原因：
1. 完成度80%
2. 最接近上线
3. 用户需求明确
```

### 优先级总览

| 优先级 | AI 功能 | 说明 |
|--------|---------|------|
| SSS | 项目健康分析 | 基于 Git、依赖、测试、文档的综合评分 |
| SSS | 项目启动诊断 | 启动前环境检查，自动修复建议 |
| SS | 项目问答 | 基于任务/里程碑/文档的自然语言查询 |
| SS | 项目完成度评估 | 跨项目进度对比和优先级建议 |
| S | 自动生成项目文档 | 从代码结构生成文档 |
| A | Git 提交分析 | 提交频率、质量、分支策略分析 |
| A | 技术债分析 | 代码质量、过期依赖、缺失测试 |
| B | 聊天助手 | 通用问答（低优先级） |
| C | AI 写代码 | 不做，终端已解决 |

### 技术方案

**数据源**：直接从 DevHub 内部数据获取（任务、里程碑、Git 状态、健康检查、文档），不需要 AI 去扫描文件系统。

**调用方式**：支持配置 API Key（OpenAI/Claude/本地模型），通过后端命令调用 LLM API，前端展示结构化结果。

**输出形式**：结构化报告（卡片/面板），不是聊天界面。用户点击按钮 → AI 分析 → 展示结果。

### 不做的事

- **不做 AI 聊天框** — 用户已经有专业工具
- **不做 AI 写代码** — 终端已经解决了这个问题

---

## 16. 性能特点

### 优化措施

1. **SQLite WAL 模式** — 支持并发读
2. **Rust LTO 优化** — 生产构建优化大小和速度
3. **增量编译** — 开发模式快速启动
4. **懒加载** — 终端按需创建
5. **事件驱动** — 非阻塞输出

### 潜在瓶颈

1. **大项目列表** — 无虚拟滚动
2. **终端输出** — 大量输出可能造成 UI 卡顿
3. **SQLite 单写** — 写操作串行化
4. **Rust 编译时间** — 首次编译需要几分钟

---

## 17. 开发指南

### 快速开始

```bash
# 1. 安装依赖
npm install

# 2. 启动开发服务器
npm run tauri dev

# 3. 或者只启动前端
npm run dev
```

### 常见任务

#### 添加新命令

1. 在 `src-tauri/src/commands/` 创建或编辑模块文件
2. 在 `src-tauri/src/lib.rs` 注册命令
3. 在 `src/api/index.ts` 添加前端包装函数
4. 在组件中使用

#### 添加新页面

1. 在 `src/features/` 创建新目录
2. 创建页面组件
3. 在 `src/App.tsx` 添加路由
4. 在 `src/shared/MainLayout.tsx` 添加菜单项

#### 修改数据库 Schema

1. 在 `src-tauri/migrations/` 创建新迁移文件
2. 在 `src-tauri/src/db.rs` 的 `run_migrations` 中添加
3. 更新相关命令处理

---

**文档版本**：3.0  
**最后更新**：2026-06-12  
**维护者**：DevHub 开发团队
