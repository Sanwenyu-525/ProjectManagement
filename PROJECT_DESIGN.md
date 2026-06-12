# DevHub 项目设计详细文档

## 1. 项目概述

**DevHub** 是一款面向个人开发者的**本地项目管理桌面应用**，专为管理多个软件开发项目而设计。采用**无服务器、单用户**架构，数据完全本地存储，无需认证系统。主要面向中文用户，界面全部使用中文。

**核心价值**：帮助开发者在本地环境中统一管理多个项目的状态、任务、文档、里程碑和终端操作，提供项目健康检查和依赖关系检测。

**技术亮点**：
- 前后端分离架构（React + Rust）
- 嵌入式终端支持（xterm.js + portable-pty）
- 玻璃态 UI 设计（Glassmorphism）
- 本地优先，无网络依赖

---

## 2. 技术栈

### 前端层 (React/TypeScript)

| 技术 | 版本 | 用途 |
|------|------|------|
| React | 18.x | UI 框架 |
| TypeScript | 5.7+ | 类型安全 |
| Vite | 6.x | 构建工具 + HMR 开发服务器 |
| Ant Design | 5.24+ | UI 组件库（表格、表单、Modal、菜单等） |
| Zustand | 5.0+ | 轻量级状态管理 |
| React Router | 6.x | 客户端路由 |
| ECharts | 5.6+ | 数据可视化（数据大屏） |
| xterm.js | 6.0+ | 终端仿真（@xterm/xterm） |
| @dnd-kit | 6.3+ | 拖拽交互（任务看板） |
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

### Tauri 插件

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
│   │                                      # 10 个 API 对象（projectsApi, tasksApi 等）
│   │                                      # 统一 cmd<T>() 泛型包装器
│   │
│   ├── stores/                            # Zustand 状态管理
│   │   ├── authStore.ts                  # 认证状态（硬编码 default-user）
│   │   └── terminalStore.ts             # 终端状态（复杂：分组、分屏、启动队列）
│   │
│   ├── features/                          # 业务功能模块
│   │   ├── dashboard/                    # 仪表盘
│   │   │   └── DashboardPage.tsx
│   │   ├── projects/                     # 项目管理（最复杂模块）
│   │   │   ├── ProjectsPage.tsx         # 项目列表页
│   │   │   ├── ProjectDetailPage.tsx    # 项目详情页（包含多个子标签）
│   │   │   └── HealthTab.tsx            # 健康检查标签
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
│   │   └── components/                  # 通用组件
│   │       └── SearchBox.tsx            # 全局搜索框 (Ctrl+K)
│   │
│   ├── lib/                               # 工具函数和常量
│   │   ├── normalize.ts                 # 数据规范化（techStack JSON 解析）
│   │   ├── healthUtils.ts               # 健康检查工具函数
│   │   ├── launchUtils.ts               # 启动流程工具
│   │   └── constants.ts                 # 常量定义
│   │
│   ├── styles/                            # 样式文件
│   │   ├── design-system.css            # 设计系统（CSS 变量）
│   │   └── variables.css                # CSS 变量定义
│   │
│   ├── App.tsx                            # 应用根组件（路由配置）
│   └── main.tsx                           # 应用入口（ConfigProvider 主题设置）
│
├── src-tauri/                             # Rust 后端源码
│   ├── src/
│   │   ├── lib.rs                        # 应用入口（初始化、插件注册、命令注册）
│   │   ├── db.rs                         # 数据库抽象层（线程安全、迁移、查询）
│   │   └── commands/                     # IPC 命令处理器（14 个模块）
│   │       ├── mod.rs                   # 模块声明
│   │       ├── projects.rs             # 项目 CRUD (11 个命令)
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
│   │       └── health.rs               # 健康检查 (4 个命令)
│   │
│   └── migrations/                        # 数据库 Schema
│       └── 001_init.sql                 # 初始化迁移（9 个表）
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

#### 用户表 (users) — 单用户模式

```sql
id            TEXT PRIMARY KEY        -- UUID
username      TEXT NOT NULL           -- 用户名
email         TEXT NOT NULL           -- 邮箱
passwordHash  TEXT NOT NULL           -- 密码哈希（当前为空）
avatar        TEXT                    -- 头像 URL
createdAt     DATETIME               -- 创建时间

索引：username (UNIQUE), email (UNIQUE)
初始数据：默认用户 default-user
```

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
ownerId         TEXT NOT NULL         -- 所有者 ID（外键）
createdAt       DATETIME             -- 创建时间
updatedAt       DATETIME             -- 更新时间

索引：ownerId, status
外键：ownerId → users.id ON DELETE CASCADE
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
integrationId   TEXT                  -- 集成 ID
createdAt       DATETIME
updatedAt       DATETIME

索引：projectId, platform
外键：projectId → projects.id (CASCADE)
      integrationId → integrations.id (SET NULL)
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

#### 集成表 (integrations)

```sql
id              TEXT PRIMARY KEY
platform        TEXT NOT NULL          -- 平台类型
accessToken     TEXT NOT NULL          -- 访问令牌
refreshToken    TEXT                   -- 刷新令牌
config          TEXT                  -- 配置（JSON）
lastSyncAt      DATETIME              -- 最后同步时间
userId          TEXT NOT NULL          -- 用户 ID

索引：(userId, platform) UNIQUE
外键：userId → users.id (CASCADE)
```

#### 标签表 (tags)

```sql
id              TEXT PRIMARY KEY
name            TEXT NOT NULL          -- 标签名
color           TEXT NOT NULL DEFAULT '#6366F1'  -- 颜色
userId          TEXT NOT NULL          -- 用户 ID

索引：(userId, name) UNIQUE
外键：userId → users.id (CASCADE)
```

#### 项目-标签关联表 (project_tags) — 多对多关系

```sql
projectId       TEXT                  -- 项目 ID
tagId           TEXT                  -- 标签 ID
PRIMARY KEY (projectId, tagId)

外键：projectId → projects.id (CASCADE)
      tagId → tags.id (CASCADE)
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

#### 健康检查表 (project_health_checks) — 后期添加

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
createdAt       TEXT

索引：projectId, checkDate
外键：projectId → projects.id (CASCADE)
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
    // 项目管理 (11 个)
    commands::projects::projects_list,
    commands::projects::projects_get_by_id,
    commands::projects::projects_create,
    // ... 等
    
    // 任务管理 (5 个)
    commands::tasks::tasks_list,
    commands::tasks::tasks_create,
    // ... 等
    
    // 终端管理 (5 个)
    commands::terminal::terminal_start,
    commands::terminal::terminal_start_shell,
    commands::terminal::terminal_stop,
    commands::terminal::terminal_input,
    commands::terminal::terminal_resize,
    
    // Git 操作 (11 个)
    commands::git::git_status,
    commands::git::git_log,
    // ... 等
    
    // 健康检查 (4 个)
    commands::health::run_all_health_checks,
    commands::health::run_health_check_for_project,
    // ... 等
])
// 总计：65+ 个命令
```

### 5.3 前端 API 层 (src/api/index.ts)

```typescript
// 统一的命令调用包装器
const cmd = <T = any>(name: string, args?: Record<string, unknown>): Promise<T> =>
  tauriInvoke(name, args) as Promise<T>;

// 10 个 API 对象
export const projectsApi = {
  list: (params?) => cmd<any[]>('projects_list', { params }).then(normalizeProjects),
  getById: (id) => cmd('projects_get_by_id', { id }).then(normalizeProject),
  create: (data) => cmd('projects_create', { data }).then(normalizeProject),
  // ...
};

export const tasksApi = { ... };
export const reposApi = { ... };
export const documentsApi = { ... };
export const milestonesApi = { ... };
export const tagsApi = { ... };
export const timelineApi = { ... };
export const searchApi = { ... };
export const detectApi = { ... };
export const gitApi = { ... };
export const terminalApi = { ... };
export const dependenciesApi = { ... };
export const healthApi = { ... };
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
    <Route path="timeline" element={<TimelinePage />} />  // 时间线
    <Route path="data-screen" element={<DataScreenPage />} />  // 数据大屏
    <Route path="settings" element={<SettingsPage />} />  // 设置
  </Route>
  <Route path="*" element={<Navigate to="/" replace />} />
</Routes>
```

### 6.2 状态管理 (Zustand)

#### Auth Store (authStore.ts)

```typescript
interface AuthStore {
  user: User | null;
  loading: boolean;
  init: () => Promise<void>;  // 加载默认用户
}
// 硬编码 default-user，无需认证
```

#### Terminal Store (terminalStore.ts) — 最复杂的状态管理

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

**迁移策略**：
1. 执行初始化 SQL（IF NOT EXISTS）
2. 执行增量 ALTER 语句（忽略重复列错误）
3. 动态创建新表（如 project_health_checks）

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
                    ├── 任务看板 (TasksTab)
                    ├── 文档中心 (DocumentsTab)
                    ├── 里程碑 (MilestonesTab)
                    ├── 仓库管理 (ReposTab)
                    ├── 健康检查 (HealthTab)
                    └── 活动时间线 (TimelineTab)
```

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
- `git add` — 暂存文件
- `git commit` — 提交
- `git push` — 推送
- `git branch switch` — 切换分支
- `git stash list` — 查看 stash
- `git reset head` — 取消暂存

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
- 前端通知显示有问题的项目
- 项目详情页显示健康徽章

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
- 样式：内联样式为主 + CSS 变量

#### 导入别名

```typescript
// tsconfig.json
"paths": { "@/*": ["./src/*"] }

// 使用
import { useAuthStore } from '@/stores/authStore';
```

---

## 12. 设计权衡

### 优点

1. **无服务器、单用户** — 简化架构，无需认证
2. **完全本地化** — 数据不离开本地
3. **玻璃态设计** — 现代、美观的 UI
4. **嵌入式终端** — 无需切换窗口
5. **灵活的 IPC 架构** — 易于扩展新命令

### 缺点和权衡

1. **无测试框架** — 难以保证代码质量
   - 没有 vitest/jest（前端）
   - 没有 cargo test（后端）

2. **类型安全不足** — API 层使用 `any`
   - 缺乏端到端类型检查
   - 运行时可能出现类型错误

3. **内联样式过多** — 难以维护
   - 没有 CSS 模块或 CSS-in-JS
   - 样式复用困难

4. **单文件大组件** — 部分组件代码超过 500 行
   - MainLayout.tsx
   - TerminalManager.tsx

5. **增量迁移** — 部分字段是后加的
   - frontendCommand、backendCommand 等

6. **事件命名不一致** — 部分使用 camelCase，部分使用 kebab-case

---

## 13. 扩展点

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

## 14. 性能特点

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

## 15. 开发指南

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

**文档版本**：1.0  
**最后更新**：2026-06-12  
**维护者**：DevHub 开发团队
