# 代码质量审查报告

**审查日期**: 2026-06-24
**审查范围**: 全模块（workspace、projects、shared/lib/stores、rust-backend）
**审查方法**: 按模块逐一审查，覆盖类型安全、代码重复、复杂度、状态管理、死代码、错误处理、性能、一致性

---

## 总览

| 模块 | Critical | High | Medium | Low | 合计 |
|------|----------|------|--------|-----|------|
| workspace | 0 | 3 | 11 | 7 | 21 |
| projects | 0 | 5 | 9 | 13 | 27 |
| shared/lib/stores | 0 | 3 | 14 | 7 | 24 |
| rust-backend | 0 | 1 | 6 | 11 | 18 |
| **合计** | **0** | **12** | **40** | **38** | **90** |

---

## 一、workspace 模块

### High

| # | 文件 | 行 | 类别 | 描述 |
|---|------|----|------|------|
| W-H1 | `workspaceStore.ts` | 17 | dead code | `splitPaneOpen`, `splitRatio`, `splitVerticalOpen`, `splitVerticalRatio`, `leftPane/rightPane/topPane/bottomPane`, `tabBarWidth` 定义但从未被任何组件消费 |
| W-H2 | `WorkspacePage.tsx` | 34 | complexity | 593 行，7 useEffects，3 useQueries，混合了 SummaryBar 渲染、launch queue、terminal 事件监听、plan mode 重置 |
| W-H3 | `ClaudeProvider.ts` | 119 | complexity | 497 行类，15+ 私有字段，状态重置逻辑在 3 处重复（sendInteractive/sendOneshot/stop） |

### Medium

| # | 文件 | 行 | 类别 | 描述 |
|---|------|----|------|------|
| W-M1 | `agentStore.ts` | 69 | dead code | `toolEvents`, `appendToolEvent`, `clearToolEvents` 已标为 deprecated 且无外部调用 |
| W-M2 | `agentStore.ts` | 59 | dead code | `removeMessagesFrom` 无任何调用者 |
| W-M3 | `WorkspacePage.tsx` | 126 | performance | `handleTabClose` 依赖 `[tabs]` 导致每次 tabs 变化重建闭包 |
| W-M4 | `WorkspacePage.tsx` | 68 | type safety | `gitLog as { date?: string }[] | null` 不安全类型断言 |
| W-M5 | `ClaudeProvider.ts` | 156 | error handling | 硬编码 300ms 延迟等待 PTY 就绪，竞态条件 |
| W-M6 | `AgentRightPanel.tsx` | 52 | logic bug | 点击图标时 togglePanelCollapsed 逻辑错误：展开状态下点击会折叠面板 |
| W-M7 | `AgentTabBar.tsx` | 57 | consistency | `localStorage.getItem('agent_lastCwd')` 内联调用 5 次 |
| W-M8 | `AgentTabBar.tsx` | 18 | performance | 订阅整个 `endedSessionIds`/`errorSessionIds` Record 导致无关 tab 重渲染 |
| W-M9 | `BottomPanel.tsx` | 44 | error handling | `defaultCwd` 在 deps 中但 ref guard 使其无效 |
| W-M10 | `CodeEditorPane.tsx` | 164,186 | type safety | 2 处 eslint-disable-line 压制 react-hooks/exhaustive-deps |
| W-M11 | `WorkspacePage.tsx` | 211 | error handling | terminal event listeners 的 `listen()` 无错误处理 |

### Low

| # | 文件 | 描述 |
|---|------|------|
| W-L1 | `AgentTabBar.tsx:50` | `showClose = true` 常量 + 恒真条件 |
| W-L2 | `BottomPanel.tsx:345` | 硬编码 `#ffffff` 背景色 |
| W-L3 | `BottomPanel.tsx:87` | shell config 读取逻辑在 3 处重复 |
| W-L4 | `CodeEditorPane.tsx:42` | `autoCopyEnabled` 状态可能为死代码 |
| W-L5 | `terminalStore.ts:100` | IIFE 初始化在 import time 运行 |
| W-L6 | `ClaudeProvider.ts:45` | 未使用的 `_config` 构造参数 |
| W-L7 | `WorkspacePage.tsx:226` | `urlLastSeenRef` 无限增长 |

---

## 二、projects 模块

### High

| # | 文件 | 行 | 类别 | 描述 |
|---|------|----|------|------|
| P-H1 | `ProjectsPage.tsx` | 80 | complexity | ~1285 行，包含 grid/list/kanban 三种视图 + 3 个弹窗 + DnD + branch fetching |
| P-H2 | `ProjectsPage.tsx` | 422 | state bug | kanban `handleKanbanDragOver` 直接 mutation useMemo 缓存对象 |
| P-H3 | `ProjectsPage.tsx` | 126 | performance | branch-fetching useEffect 在每次 projects 引用变化时触发 N 个 IPC 调用 |
| P-H4 | `GitTab.tsx` | 23 | complexity | ~607 行，三面板布局 + 拖拽 + 完整 git 操作 |
| P-H5 | `GraphTab.tsx` | 384 | complexity | ~925 行，包含布局算法 + ECharts 配置 + feature group 管理 |

### Medium

| # | 文件 | 行 | 类别 | 描述 |
|---|------|----|------|------|
| P-M1 | `ProjectsPage.tsx` | 433 | type safety | `(proj as ProjectWithStats).status = toCol as ProjectStatus` 不安全断言 |
| P-M2 | `ProjectsPage.tsx` | 192 | type safety | `handleCreate` 接受 `Record<string, unknown>` 失去类型安全 |
| P-M3 | `ProjectsPage.tsx` | 195 | type safety | `as ProjectStatus` / `as ProjectPriority` 无验证 |
| P-M4 | `ProjectsPage.tsx` | 372 | duplication | `formatRelativeTime` 与 OverviewTab 中重复 |
| P-M5 | `ProjectDetailPage.tsx` | 105 | type safety | `project as ProjectDetail & Record<string, unknown>` 不安全断言 |
| P-M6 | `GraphTab.tsx` | 147 | type safety | ECharts option builders 中多处 `any` |
| P-M7 | `useProjects.ts` | 25 | type safety | 大量 `id!` 非空断言 |
| P-M8 | `useProjects.ts` | 146 | dead code | 多个 exported hooks 无外部消费者 |
| P-M9 | `OverviewTab.tsx` | 164 | error handling | "查看变更" 按钮导航到 `/git` 而非项目级 git 页 |

### Low

| # | 文件 | 描述 |
|---|------|------|
| P-L1 | `ProjectsPage.tsx:56` | 13+ 处命令式 onMouseEnter/Leave 替代 CSS |
| P-L2 | `ProjectsPage.tsx:707` | 硬编码 rgba 颜色 |
| P-L3 | `GitTab.tsx:327,416,516,559` | `isDark ? X : X` 恒等三元表达式 |
| P-L4 | `GitTab.tsx:12` | 本地 Branch/GitCommit 接口应共享 |
| P-L5 | `GitTab.tsx:582` | DragHandle 本地定义应抽取 |
| P-L6 | `BusinessGraphView.tsx:7` | MODULE_COLORS 与 GROUP_PALETTE 重复 |
| P-L7 | `NewProjectWizard.tsx:176,214` | 使用原始 HTML input/button 违反 CLAUDE.md |
| P-L8 | `OverviewTab.tsx:15` | `activityTab` 状态未用于过滤 |
| P-L9 | `api/project.ts:207` | gitApi 方法无显式返回类型 |
| P-L10 | `api/project.ts:74` | debugRaw 返回 `Record<string, any>` |
| P-L11 | `NewProjectWizard.tsx:60` | workspace/agent 步骤为空占位 |
| P-L12 | `OverviewTab.tsx:23` | git API 调用无缓存 |
| P-L13 | `api/project.ts:46` | normalizeProject 结果用 `as` 断言 |

---

## 三、shared/lib/stores 模块

### High

| # | 文件 | 行 | 类别 | 描述 |
|---|------|----|------|------|
| S-H1 | `SearchBox.tsx` | 46 | complexity | 487 行，12 useState，处理命令面板 + 多种搜索 + 键盘导航 |
| S-H2 | `FileExplorer.tsx` | 88 | complexity | 1370 行，17 hooks，处理目录管理 + 文件操作 + 剪贴板 + 右键菜单 + 行内编辑 |
| S-H3 | `graphClassifier.ts` | 10 | bug | `computeCacheKey` 不包含实际路径内容，不同图可能产生相同缓存键 |

### Medium

| # | 文件 | 行 | 类别 | 描述 |
|---|------|----|------|------|
| S-M1 | `SearchBox.tsx` | 296 | consistency | 13 处硬编码 rgba 颜色 |
| S-M2 | `MainLayout.tsx` | 300 | consistency | 硬编码 `#f59e0b` |
| S-M3 | `SearchBox.tsx` | 82 | performance | commands 数组每次渲染重建 |
| S-M4 | `FileExplorer.tsx` | 128 | performance | dirs persist effect 每次变化触发 O(n*m) |
| S-M5 | `FileExplorer.tsx` | 342 | performance | autoExpandTree 无并发限制 |
| S-M6 | `FileExplorer.tsx` | 433 | performance | selectFile 依赖 [dirs] 破坏 memo |
| S-M7 | `themeStore.ts` | 65 | type safety | localStorage 值直接 `as ThemeMode` 不验证 |
| S-M8 | `themeStore.ts` | 107 | state management | `initThemeFromStorage` 与 store 初始化重复 |
| S-M9 | `commands.ts` | 24 | state management | 模块级可变变量 `_navigate`, `_toggleFilePanel` |
| S-M10 | `graphClassifier.ts` | 76 | error handling | PTY 进程挂起时事件监听器泄漏 |
| S-M11 | `graphClassifier.ts` | 158 | type safety | `JSON.parse() as BusinessClassification` 无运行时验证 |
| S-M12 | `types/index.ts` | 179 | duplication | Create/Update Input 类型 ~80% 字段重复 |
| S-M13 | `FileExplorer.tsx` | 552 | error handling | handleDelete 部分失败时状态不一致 |
| S-M14 | `FileExplorer.tsx` | 464 | error handling | copyToClipboard 无 try/catch |

### Low

| # | 文件 | 描述 |
|---|------|------|
| S-L1 | `FileExplorer.tsx:1233` | 不必要的模板字面量 |
| S-L2 | `SearchBox.tsx:369` | 硬编码文字颜色 |
| S-L3 | `FileExplorer.tsx:88` | `collapsed` prop 可能为死代码 |
| S-L4 | `types/index.ts:1` | 794 行单体类型文件 |
| S-L5 | `keyboard.ts:3` | 已弃用 `navigator.platform` |
| S-L6 | `main.tsx:186` | root 元素非空断言 |
| S-L7 | `ShortcutsModal.tsx:23` | buildGroups 模块初始化 |

---

## 四、rust-backend 模块

### High

| # | 文件 | 行 | 类别 | 描述 |
|---|------|----|------|------|
| R-H1 | `files.rs` | 312 | security | file 操作无路径限制，前端可读写删除系统任意文件 |

### Medium

| # | 文件 | 行 | 类别 | 描述 |
|---|------|----|------|------|
| R-M1 | `projects.rs` | 746 | security | SQL 列名通过 `format!` 插值 |
| R-M2 | `terminal.rs` | 952 | security | shell 命令拼接未转义 cwd |
| R-M3 | `graph.rs` | 193 | performance | `extract_imports` 每次调用编译正则 |
| R-M4 | `graph.rs` | 499 | performance | 批量插入无事务包装 |
| R-M5 | `projects.rs` | 893 | validation | `projects_batch_import` 无输入验证 |
| R-M6 | `projects.rs` | 264 | inconsistency | 脆弱的 `{}` 作用域块模式 |

### Low

| # | 文件 | 描述 |
|---|------|------|
| R-L1 | `terminal.rs:245` | exit watcher 线程代码重复 5 次 |
| R-L2 | `terminal.rs:412` | PTY 设置代码重复 |
| R-L3 | `db.rs:224` | query_json/query_one_json 重复 |
| R-L4 | `files.rs:62` | SKIP_DIRS 列表与 graph.rs 不一致 |
| R-L5 | `sessions.rs:17,196` | 使用 `uuid::Uuid::new_v4()` 而非 `new_id()` |
| R-L6 | `workspaces.rs:54` | `add_field!` 宏重复定义 |
| R-L7 | `db.rs:54` | `has_broken` 始终返回 false |
| R-L8 | `projects.rs:624` | debug 端点未加 cfg guard |
| R-L9 | `graph.rs:816` | 建议算法复杂度高 |
| R-L10 | `graph.rs:450` | 扫描无文件数上限 |
| R-L11 | `terminal.rs:63` | resolve_claude_exe 仅 Windows 有效 |
