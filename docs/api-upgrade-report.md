# DevHub 前端架构升级报告

> Mock → 真实后端驱动 + TanStack Query + API 层拆分

---

## 一、项目现状扫描

### 扫描结果：无 Mock 数据

对 `src/pages`、`src/features`、`src/components`、`src/services`、`src/api` 全量扫描后确认：

- ❌ 无 `mock`、`fake`、`demo`、`sample`、`hardcoded` 数据数组
- ❌ 无 TODO/FIXME 提及 mock 或真实数据
- ✅ 所有组件已通过 `src/api/index.ts` 调用真实 Tauri IPC 后端（~100 个命令，20 个模块）

### 发现的架构问题

| 问题 | 严重度 | 说明 |
|------|--------|------|
| 无查询缓存/去重 | 🔴 高 | 每次导航都重新请求，无 stale-while-revalidate |
| 无 loading/error 抽象 | 🔴 高 | 每个组件手动 `useState` + `useEffect` + try/catch 模板代码 |
| API 单文件过载 | 🟡 中 | `src/api/index.ts` 一个文件 480 行，21 个 namespace |
| 重复请求同一数据 | 🟡 中 | 项目列表被 5+ 个页面独立请求 |

---

## 二、数据流架构

### 升级前

```
UI Component
  → useState + useEffect (手动 loading/error)
    → xxxApi.method() (src/api/index.ts 单文件)
      → tauriInvoke() (Tauri IPC)
        → Rust command handler
          → SQLite
```

### 升级后

```
┌─────────────────────────────────────────────────────────┐
│  UI Component (DashboardPage, ProjectsPage, etc.)       │
│    ↓ useQuery / useMutation (TanStack Query)            │
│    ↓ Loading / Error / 状态自动管理                      │
├─────────────────────────────────────────────────────────┤
│  React Query Hooks (src/hooks/)                         │
│    ↓ useProjects, useGitStatus, useSessions, etc.       │
│    ↓ Query Key 工厂 (src/api/queryKeys.ts)              │
│    ↓ 自动缓存 / 去重 / 失效                              │
├─────────────────────────────────────────────────────────┤
│  API Layer (src/api/) — 按域拆分                         │
│    ↓ client.ts → cmd() → tauriInvoke()                  │
│    ↓ project.ts / workspace.ts / agent.ts / etc.        │
│    ↓ 类型安全的 Tauri IPC 包装                           │
├─────────────────────────────────────────────────────────┤
│  Zustand Stores (src/stores/) — 仅客户端 UI 状态        │
│    ↓ terminalStore: 终端 UI + Tauri event 监听           │
│    ↓ themeStore: 主题切换 (localStorage)                 │
│    ↓ previewStore: 预览 URL (终端输出解析)                │
├─────────────────────────────────────────────────────────┤
│  Rust Backend (src-tauri/src/commands/)                 │
│    ↓ 20 个命令模块, ~100 个 Tauri IPC 命令               │
│    ↓ SQLite 数据库 (11 张表)                             │
└─────────────────────────────────────────────────────────┘

实时数据通道 (不经过 React Query):
  Backend → app.emit("terminal-output") → listen() → xterm.js
  Backend → app.emit("terminal-exit")   → listen() → Zustand store
```

---

## 三、7 模块验证

| # | 模块 | React Query | Mock/硬编码数据 | 状态 |
|---|------|-------------|----------------|------|
| 1 | Dashboard | ✅ `useProjects()` | 无 | ✅ 已连接 |
| 2 | Projects | ✅ 全部 hooks | 无 | ✅ 完全连接 |
| 3 | Workspace | N/A (Zustand + Tauri IPC) | 无 | ✅ 完全连接 |
| 4 | Agent | ✅ `useSessions()` (5s 轮询) | 无 | ✅ 已连接 |
| 5 | Browser | ❌ 静态 UI 原型 | 整页硬编码 | ⚠️ 需 UI 开发 |
| 6 | Terminal | N/A (Zustand + Tauri IPC) | 无 | ✅ 完全连接 |
| 7 | Knowledge | ✅ `useDocuments()` | AI Insights 面板硬编码 | ⚠️ 部分连接 |

---

## 四、API 层拆分

### 升级前

```
src/api/
└── index.ts    # 480 行，21 个 namespace，~90 个方法
```

### 升级后

```
src/api/
├── index.ts          # Barrel re-export (20 行)
├── client.ts         # Tauri IPC 包装函数 cmd() + screenshotApi
├── project.ts        # projects / tasks / repos / documents / milestones / tags
│                     # timeline / search / health / dependencies / detect / brain / git
├── workspace.ts      # workspacesApi
├── agent.ts          # sessionsApi
├── browser.ts        # browserMemoryApi
├── terminal.ts       # terminalApi + filesApi
├── build.ts          # buildsApi + templatesApi + integrationsApi
├── knowledge.ts      # knowledgeApi (documents 别名)
├── queryKeys.ts      # Query Key 工厂
└── types.ts          # FileEntry / FileTreeNode / FileContent / ScreenshotableWindow / TerminalApi
```

**零导入变更**：`index.ts` 作为 barrel 重新导出所有内容，所有现有 `import { xxxApi } from '../../api'` 继续有效。

---

## 五、React Query Hooks

### Query Keys 工厂 (`src/api/queryKeys.ts`)

```typescript
queryKeys.projects.all                    → ['projects']
queryKeys.projects.filtered(params)       → ['projects', params]
queryKeys.project.one(id)                 → ['project', id]
queryKeys.project.brain(id)               → ['project', id, 'brain']
queryKeys.project.health(id)              → ['project', id, 'health']
queryKeys.project.timeline(id)            → ['project', id, 'timeline']
queryKeys.tasks.all(projectId)            → ['tasks', projectId]
queryKeys.documents.all(projectId)        → ['documents', projectId]
queryKeys.git.status(repoPath)            → ['git', repoPath, 'status']
queryKeys.sessions.all                    → ['sessions']
queryKeys.sessions.messages(sessionId)    → ['sessions', sessionId, 'messages']
queryKeys.health.all                      → ['health', 'all']
queryKeys.builds.all(projectId?)          → ['builds', projectId]
queryKeys.workspaces.all                  → ['workspaces']
queryKeys.integrations.all                → ['integrations']
// ... 完整列表见 queryKeys.ts
```

### Hooks 文件

| 文件 | 导出 |
|------|------|
| `useProjects.ts` | `useProjects`, `useProject`, `useProjectBrain`, `useTasks`, `useRepos`, `useDocuments`, `useMilestones`, `useTags`, `useCreateProject`, `useUpdateProject`, `useDeleteProject`, `useRefreshProject`, `useDetectLocal`, `useDetectGit`, `useCreateTask`, `useUpdateTask`, `useDeleteTask` |
| `useHealth.ts` | `useAllHealth`, `useProjectHealth`, `useRunAllHealth`, `useRunProjectHealth` |
| `useGit.ts` | `useGitStatus`, `useGitLog`, `useGitBranches`, `useGitStashList`, `useGitTagList`, `useGitCommit`, `useGitPush`, `useGitPull`, `useGitFetch`, `useGitAdd`, `useGitUnstage`, `useGitBranchSwitch`, `useGitBranchCreate`, `useGitRestore`, `useGitRevert`, `useGitTagCreate`, `useGitTagDelete` |
| `useSessions.ts` | `useSessions` (5s polling), `useSessionMessages`, `useEndSession` |
| `useWorkspaces.ts` | `useWorkspaces`, `useCreateWorkspace`, `useUpdateWorkspace`, `useDeleteWorkspace` |
| `useBuilds.ts` | `useBuilds`, `useBuildLogs`, `useCreateBuild`, `useUpdateBuild`, `useDeleteBuild`, `useTemplates`, `useIntegrations`, `useCreateIntegration`, `useUpdateIntegration`, `useDeleteIntegration` |
| `useTimeline.ts` | `useTimeline`, `useProjectTimeline` |
| `useSearch.ts` | `useSearch(query)` |
| `useFiles.ts` | `useFileTree`, `useFileContent`, `useFileDirectory`, `useWriteFile`, `useCreateFile`, `useRenameFile`, `useDeleteFile`, `useOpenInIde` |

### QueryClient 配置 (`src/lib/queryClient.ts`)

```typescript
staleTime: 30_000           // 30s — Tauri IPC 本地调用很快
gcTime: 5 * 60_000          // 5 分钟
refetchOnWindowFocus: false // 桌面应用不需要
retry: 1                    // 单次重试
```

---

## 六、页面重构详情

### DashboardPage

```diff
- const [projects, setProjects] = useState([]);
- const [loading, setLoading] = useState(true);
- const [refreshing, setRefreshing] = useState(false);
- useEffect(() => { loadProjects(); }, []);
- async function loadProjects() { ... }
+ const { data: projects = [], isLoading, refetch, isRefetching } = useProjects();
```

### ProjectsPage

```diff
- const [projects, setProjects] = useState([]);
- const [loading, setLoading] = useState(true);
- const [_workspaces, _setWorkspaces] = useState([]);
- const [healthResults, setHealthResults] = useState({});
- useEffect(() => { loadProjects(); }, [loadProjects]);
- useEffect(() => { workspacesApi.list().then(...) }, []);
- useEffect(() => { healthApi.getAllLatest().then(...) }, []);
+ const { data: projects = [], isLoading: loading, refetch } = useProjects(params);
+ const { data: _workspaces = [] } = useWorkspaces();
+ const { data: healthData = [] } = useAllHealth();
+ const createProject = useCreateProject();
+ const deleteProject = useDeleteProject();
```

### ProjectDetailPage

```diff
- const [project, setProject] = useState(null);
- const [loading, setLoading] = useState(true);
- useEffect(() => { projectsApi.getById(id).then(...) }, [id]);
+ const { data: project, isLoading: loading } = useProject(id);
+ const refreshProject = useRefreshProject();

// OverviewTab
- useEffect(() => { brainApi.analyze(id).then(...); timelineApi.byProject(id).then(...); }, [id]);
+ const { data: brain } = useProjectBrain(project.id);
+ const { data: activityLogs = [] } = useProjectTimeline(project.id);

// DocumentsTab
- const [docs, setDocs] = useState([]);
- useEffect(() => { documentsApi.list(projectId).then(...) }, []);
+ const { data: docs = [], isLoading } = useDocuments(projectId);
+ const createDoc = useCreateDocument(projectId);
```

### AgentCenterPage

```diff
- const [sessions, setSessions] = useState([]);
- const [loading, setLoading] = useState(true);
- const refresh = useCallback(async () => { ... }, []);
- useEffect(() => { refresh(); const t = setInterval(refresh, 5000); ... }, [refresh]);
+ const { data: sessions = [], isLoading: loading } = useSessions(20); // 5s 轮询内置
+ const endSession = useEndSession();
```

---

## 七、已接入接口清单

| 模块 | API 方法 | Hook / 调用方式 |
|------|----------|----------------|
| Projects | `projectsApi.list()` | `useProjects()` |
| Projects | `projectsApi.getById()` | `useProject(id)` |
| Projects | `projectsApi.create()` | `useCreateProject()` |
| Projects | `projectsApi.update()` | `useUpdateProject()` |
| Projects | `projectsApi.delete()` | `useDeleteProject()` |
| Projects | `projectsApi.refresh()` | `useRefreshProject()` |
| Projects | `projectsApi.launch()` | 直接调用 |
| Projects | `projectsApi.stop()` | 直接调用 |
| Projects | `projectsApi.checkEnvironment()` | 直接调用 |
| Projects | `projectsApi.batchImport()` | 直接调用 |
| Tasks | `tasksApi.list()` | `useTasks(projectId)` |
| Tasks | `tasksApi.create()` | `useCreateTask(projectId)` |
| Tasks | `tasksApi.update()` | `useUpdateTask(projectId)` |
| Tasks | `tasksApi.delete()` | `useDeleteTask(projectId)` |
| Documents | `documentsApi.list()` | `useDocuments(projectId)` |
| Documents | `documentsApi.create()` | `useCreateDocument(projectId)` |
| Documents | `documentsApi.getById()` | `useQuery` 直接调用 |
| Documents | `documentsApi.update()` | `useUpdateDocument(projectId)` |
| Documents | `documentsApi.delete()` | `useDeleteDocument(projectId)` |
| Milestones | `milestonesApi.list()` | `useMilestones(projectId)` |
| Milestones | `milestonesApi.create()` | `useCreateMilestone(projectId)` |
| Repos | `reposApi.list()` | `useRepos(projectId)` |
| Repos | `reposApi.add()` | 直接调用 |
| Repos | `reposApi.sync()` | 直接调用 |
| Repos | `reposApi.remove()` | 直接调用 |
| Tags | `tagsApi.list()` | `useTags()` |
| Git | `gitApi.status()` | `useGitStatus(path)` |
| Git | `gitApi.log()` | `useGitLog(path)` |
| Git | `gitApi.branches()` | `useGitBranches(path)` |
| Git | `gitApi.stashList()` | `useGitStashList(path)` |
| Git | `gitApi.commit()` | `useGitCommit(path)` |
| Git | `gitApi.push()` | `useGitPush(path)` |
| Git | `gitApi.pull()` | `useGitPull(path)` |
| Git | `gitApi.fetch()` | `useGitFetch(path)` |
| Git | `gitApi.add()` | `useGitAdd(path)` |
| Git | `gitApi.unstage()` | `useGitUnstage(path)` |
| Git | `gitApi.branchSwitch()` | `useGitBranchSwitch(path)` |
| Git | `gitApi.branchCreate()` | `useGitBranchCreate(path)` |
| Git | `gitApi.restore()` | `useGitRestore(path)` |
| Git | `gitApi.revert()` | `useGitRevert(path)` |
| Git | `gitApi.tagCreate()` | `useGitTagCreate(path)` |
| Git | `gitApi.tagDelete()` | `useGitTagDelete(path)` |
| Git | `gitApi.tagList()` | `useGitTagList(path)` |
| Health | `healthApi.getAllLatest()` | `useAllHealth()` |
| Health | `healthApi.getProjectHistory()` | `useProjectHealth(id)` |
| Health | `healthApi.runAll()` | `useRunAllHealth()` |
| Health | `healthApi.runForProject()` | `useRunProjectHealth()` |
| Brain | `brainApi.analyze()` | `useProjectBrain(id)` |
| Timeline | `timelineApi.list()` | `useTimeline()` |
| Timeline | `timelineApi.byProject()` | `useProjectTimeline(id)` |
| Search | `searchApi.search()` | `useSearch(query)` |
| Detect | `detectApi.local()` | `useDetectLocal()` |
| Detect | `detectApi.gitRepo()` | `useDetectGit()` |
| Sessions | `sessionsApi.list()` | `useSessions(limit)` (5s 轮询) |
| Sessions | `sessionsApi.end()` | `useEndSession()` |
| Sessions | `sessionsApi.messages()` | 直接调用（N+1 模式） |
| Sessions | `sessionsApi.cleanupStale()` | 直接调用 |
| Workspaces | `workspacesApi.list()` | `useWorkspaces()` |
| Workspaces | `workspacesApi.create()` | `useCreateWorkspace()` |
| Workspaces | `workspacesApi.update()` | `useUpdateWorkspace()` |
| Workspaces | `workspacesApi.delete()` | `useDeleteWorkspace()` |
| Workspaces | `workspacesApi.saveLayout()` | 直接调用 |
| Workspaces | `workspacesApi.loadLayout()` | 直接调用 |
| Builds | `buildsApi.list()` | `useBuilds(projectId?)` |
| Builds | `buildsApi.getLogs()` | `useBuildLogs(buildId)` |
| Builds | `buildsApi.create()` | `useCreateBuild()` |
| Builds | `buildsApi.update()` | `useUpdateBuild()` |
| Builds | `buildsApi.delete()` | `useDeleteBuild()` |
| Templates | `templatesApi.list()` | `useTemplates(category?)` |
| Integrations | `integrationsApi.list()` | `useIntegrations()` |
| Integrations | `integrationsApi.create()` | `useCreateIntegration()` |
| Integrations | `integrationsApi.update()` | `useUpdateIntegration()` |
| Integrations | `integrationsApi.delete()` | `useDeleteIntegration()` |
| Files | `filesApi.getTree()` | `useFileTree(root)` |
| Files | `filesApi.read()` | `useFileContent(path)` |
| Files | `filesApi.listDirectory()` | `useFileDirectory(path)` |
| Files | `filesApi.write()` | `useWriteFile()` |
| Files | `filesApi.create()` | `useCreateFile()` |
| Files | `filesApi.rename()` | `useRenameFile()` |
| Files | `filesApi.delete()` | `useDeleteFile()` |
| Files | `filesApi.openInIde()` | `useOpenInIde()` |
| Terminal | `terminalApi.*` | Zustand + Tauri event (实时数据) |
| Browser | `browserMemoryApi.*` | hooks 已创建，页面待实现 |

---

## 八、剩余未接入接口

| 接口 | 原因 | 优先级 |
|------|------|--------|
| `browserMemoryApi.*` | BrowserWorkspacePage 是静态 UI 原型，需完整实现浏览器功能 | P1 |
| Knowledge AI Insights 面板 | 硬编码 UI 占位符，需后端 AI 接口 | P2 |
| `gitApi.showFile()` / `gitApi.diff()` | GitTab 内部直接使用 | P3 |

---

## 九、风险点

| 风险 | 严重度 | 说明 |
|------|--------|------|
| BrowserWorkspacePage 是静态原型 | 🔴 高 | 整页硬编码 HTML，零后端连接，需完整 UI 开发 |
| AgentCenterPage N+1 消息查询 | 🟡 中 | 每 5s 为 9 个 session 各发一次请求，可加批量端点优化 |
| Knowledge AI Insights 硬编码 | 🟡 中 | 右侧面板是 UI 占位符，无后端 AI 接口 |
| `gitApi` 缺少显式返回类型 | 🟡 低 | 使用 `cmd(...)` 无泛型，后续可补充 |

---

## 十、后端缺失接口

| 缺失接口 | 说明 |
|----------|------|
| 批量获取 session 消息 | `sessionsApi.messages(id)` 一次只能获取一个 session，需 N+1 查询 |
| AI 文档分析/摘要 | Knowledge AI Insights 面板需要后端 AI 接口 |
| 浏览器历史/书签 CRUD | Browser 需要完整的浏览器管理后端 |
| 搜索结果分页 | `global_search` 返回固定 10 条，无分页参数 |
| `repos_sync` 实际同步 | 当前是 stub，仅更新 `lastSyncAt` |

---

## 十一、推荐优化项

| 优化 | 优先级 | 说明 |
|------|--------|------|
| 实现 BrowserWorkspacePage | P1 | 当前是静态原型，需完整实现浏览器标签/地址栏/历史记录 |
| 批量 session 消息端点 | P2 | 减少 AgentCenterPage 的 N+1 查询 |
| Knowledge 接入 searchApi | P2 | 需先添加搜索 UI 组件 |
| Knowledge AI Insights 后端 | P2 | 需要 AI 接口支持文档摘要/相关推荐 |
| 补充 gitApi 返回类型 | P3 | 提升类型安全性 |
| TanStack Query DevTools | P3 | 开发时调试缓存状态 |

---

## 十二、编译验证

```bash
npx tsc -b    ✅ 零错误
npx eslint src/  ✅ 仅预存的 7 个 no-control-regex 错误（ANSI 正则，非本次引入）
```

---

## 附录：新增文件清单

```
新增文件:
  src/lib/queryClient.ts           # QueryClient 单例
  src/api/queryKeys.ts             # Query Key 工厂
  src/api/types.ts                 # API 本地类型
  src/api/client.ts                # Tauri IPC 包装 + screenshotApi
  src/api/project.ts               # 项目域 API
  src/api/workspace.ts             # 工作区 API
  src/api/agent.ts                 # Agent sessions API
  src/api/browser.ts               # Browser memory API
  src/api/terminal.ts              # Terminal + Files API
  src/api/build.ts                 # Builds + Templates + Integrations API
  src/api/knowledge.ts             # Knowledge/Documents API
  src/hooks/useProjects.ts         # 项目 + 子实体 hooks
  src/hooks/useHealth.ts           # 健康检查 hooks
  src/hooks/useGit.ts              # Git hooks
  src/hooks/useSessions.ts         # Agent sessions hooks
  src/hooks/useWorkspaces.ts       # 工作区 hooks
  src/hooks/useBuilds.ts           # 构建 + 模板 + 集成 hooks
  src/hooks/useTimeline.ts         # 时间线 hooks
  src/hooks/useSearch.ts           # 搜索 hooks
  src/hooks/useFiles.ts            # 文件操作 hooks

修改文件:
  src/main.tsx                     # 添加 QueryClientProvider
  src/api/index.ts                 # 从 480 行 → 20 行 barrel re-export
  src/features/dashboard/DashboardPage.tsx      # useProjects()
  src/features/projects/ProjectsPage.tsx        # useProjects + mutations
  src/features/projects/ProjectDetailPage.tsx   # useProject + sub-hooks
  src/features/agents/AgentCenterPage.tsx       # useSessions (5s polling)
  src/features/documents/KnowledgeCenterPage.tsx # useDocuments
  src/features/timeline/TimelinePage.tsx        # useTimeline
  src/features/data-screen/DataScreenPage.tsx   # 多 hooks
  src/features/projects/DependencyGraphPage.tsx # useProjects
  src/features/builds/BuildCenterPage.tsx       # useBuilds
  src/features/settings/SettingsPage.tsx        # useIntegrations + useTemplates
```
