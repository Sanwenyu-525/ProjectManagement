# DevHub 项目全面审计报告

> 审计日期：2026-06-22
> 审计范围：前端（React + TypeScript + Vite）+ 后端（Rust + Tauri 2.x + SQLite）+ 配置与构建

---

## 一、Bug（必须修复）

### BUG-1: `tasks_update` WHERE 子句引用错误参数（P0）

**位置**: `src-tauri/src/commands/project/tasks.rs:147-150`

`tasks_update` 的 SQL 构造存在参数索引错误：WHERE 子句使用 `idx - 1`，实际指向的是 `updatedAt` 参数而非 `id` 参数。这意味着更新操作会静默地应用到错误的行（或不生效）。

```rust
// 当前代码（错误）
sets.push(format!("updatedAt = ?{}", idx));   // updatedAt = ?N
param_values.push(Box::new(now));
idx += 1;                                      // idx = N+1

sets.push(format!("id = ?{}", idx));           // id = ?{N+1}
param_values.push(Box::new(id.clone()));

let sql = format!("UPDATE tasks SET {} WHERE id = ?{}", sets.join(", "), idx - 1);
//                                                      ^^^^^ 错误！应该是 idx
```

对比 `projects_update` 的正确实现（`projects.rs:310-314`），应该先捕获 `id_idx` 再引用。

---

### BUG-2: `project_tags` 表在迁移 002 中被删除但仍在使用（P0）

**位置**:
- 删除：`migrations/002_remove_users.sql:61` — `DROP TABLE IF EXISTS "project_tags"`
- 使用：`commands/project/tags.rs` — `tags_assign_to_project`, `tags_remove_from_project`
- 使用：`commands/project/projects.rs` — `projects_get_by_id` 中 JOIN `project_tags`

迁移 002 删除了 `project_tags` 表，但没有后续迁移重建它。所有标签分配/移除操作和项目查询中的标签 JOIN 都会在运行时报 "no such table" 错误。

---

### BUG-3: `projects_batch_import` 引用已删除的 `users` 表（P0）

**位置**: `src-tauri/src/commands/project/projects.rs:922-941`

该函数查询 `SELECT id FROM users LIMIT 1` 并尝试 `INSERT INTO users`，但迁移 002 已删除 `users` 表。此外，迁移后 `projects` 表不再有 `ownerId` 列，导致 INSERT 语句也会失败。整个函数对迁移后的数据库完全不可用。

---

### BUG-4: `run_migration` 部分失败仍标记为已应用（P1）

**位置**: `src-tauri/src/db.rs:92-96`

```rust
if let Err(e) = conn.execute_batch(sql) {
    eprintln!("[devhub] Migration '{}' warning: {}", name, e);
}
conn.execute("INSERT INTO _migrations (name) VALUES (?1)", [name])?;
```

如果迁移部分执行失败（某些语句出错），仍然将其记录为已应用。后续运行会跳过它，可能导致 schema 处于不完整状态。

---

### BUG-5: `truncate` 函数 UTF-8 多字节截断 panic（P1）

**位置**: `src-tauri/src/commands/workspace/memory.rs:508-513`

```rust
fn truncate(s: &str, max_len: usize) -> String {
    if s.len() <= max_len {
        s.to_string()
    } else {
        format!("{}...", &s[..max_len])  // 按字节截断，中文会 panic
    }
}
```

按字节偏移切片会在多字节 UTF-8 字符（如中文，每字符 3 字节）中间截断，导致运行时 panic。应使用 `s.char_indices()` 做字符级截断。

---

### BUG-6: `MilestonesTab` 和 `HealthTab` useEffect 缺失依赖（P1）

**位置**:
- `MilestonesTab.tsx:21` — `useEffect(() => { loadMilestones(); }, [])` 缺少 `projectId`
- `HealthTab.tsx:44-45` — 同样缺少 `projectId`

当用户从一个项目的里程碑/健康页切换到另一个项目时，不会重新加载数据，会显示过期内容。两个文件都用 `eslint-disable` 抑制了该警告。

---

### BUG-7: `NewProjectWizard` 完成按钮不创建项目（P2）

**位置**: `src/features/projects/NewProjectWizard.tsx:199`

点击"完成"只是导航到 `/projects`，并不实际调用 `projectsApi.create()`。步骤 2（工作区配置）和步骤 3（Agent 配置）也是占位符（"coming soon"）。

---

### BUG-8: `ProjectsPage` 中 `launchHints` 恒为空数组（P2）

**位置**: `src/features/projects/ProjectsPage.tsx:291`

```typescript
const launchHints = getProjectPriority(project) > 0 ? [] : [];
//                  两个分支都是空数组，条件判断无意义
```

导致 293-313 行的确认弹窗逻辑永远不可达，是死代码。

---

## 二、安全问题

### SEC-1: CSP 未配置（HIGH）

**位置**: `src-tauri/tauri.conf.json:24`

```json
"csp": null
```

没有 Content Security Policy，意味着不限制脚本来源、样式来源或网络连接。桌面应用虽然风险较低，但仍应配置基本的 CSP 限制。

---

### SEC-2: 命令注入风险（HIGH）

**位置**:
- `src-tauri/src/commands/project/projects.rs:518-533` — `projects_open`
- `src-tauri/src/commands/project/projects.rs:689` — `projects_launch`
- `src-tauri/src/commands/workspace/terminal.rs:123-127` — `terminal_start`

用户输入的命令字符串直接传递给 `cmd /C` 执行：

```rust
Command::new("cmd").args(["/C", &command_str]).current_dir(path).spawn();
```

数据库中存储的 `openCommand`、`frontendCommand`、`backendCommand` 经过 `{path}` 替换后直接拼接执行，存在 shell 注入风险。

---

### SEC-3: API 密钥明文存储（MEDIUM）

**位置**: `src-tauri/src/commands/workspace/agent_configs.rs:54`

`providers_create` 将 `api_key` 直接存入 `model_providers` 表，无任何加密。Claude、OpenAI、Gemini 的 API 密钥以明文 SQLite 存储。

---

### SEC-4: 文件操作无路径验证（MEDIUM）

**位置**: `src-tauri/src/commands/workspace/files.rs`

`files_read`、`files_write`、`files_delete`、`files_create`、`files_rename` 均接受前端传入的任意路径，无路径遍历防护。`files_delete` 使用 `fs::remove_dir_all`，可删除任意目录。

---

### SEC-5: `shell:allow-open` 权限过于宽泛（LOW）

**位置**: `src-tauri/capabilities/default.json`

`shell:allow-open` 允许执行任意 shell 命令，需确认是否为有意设计。

---

## 三、性能问题

### PERF-1: 阻塞文件 I/O 占用异步运行时（HIGH）

**位置**:
- `src-tauri/src/commands/project/detect.rs` — `detect_local_project_inner` 同步扫描目录（最深 5 层）
- `src-tauri/src/commands/project/brain.rs` — `brain_analyze_project` 同步读取最多 500 个文件
- `src-tauri/src/commands/workspace/files.rs` — 所有文件操作命令

这些函数从 `async fn` 调用但未使用 `spawn_blocking`，会阻塞 Tauri 的异步运行时。

---

### PERF-2: N+1 查询模式（MEDIUM）

**位置**:
- `projects_list`（`projects.rs:24-29`）— 每行含 3 个关联子查询（taskCount, docCount, repoCount）
- `projects_get_by_id`（`projects.rs:84-126`）— 4 次独立查询（项目、仓库、里程碑、标签）

---

### PERF-3: 终端退出监听线程轮询（MEDIUM）

**位置**: `src-tauri/src/commands/workspace/terminal.rs:167-194`

每个终端创建一个专用线程以 200ms 间隔轮询 `try_wait()`。多终端场景下产生大量忙等待线程。应改用 `wait()` 阻塞或事件通知。

---

### PERF-4: 健康检查无限制并行（MEDIUM）

**位置**: `src-tauri/src/commands/project/health.rs:331-344`

所有项目健康检查同时通过 `spawn_blocking` 启动，项目多时会生成大量线程，每个还运行多个外部进程。

---

### PERF-5: `global_search` 串行执行 3 个查询（LOW）

**位置**: `src-tauri/src/commands/project/search.rs`

projects、tasks、documents 三个 LIKE 查询可并行执行。

---

### PERF-6: 缺少 `projects.workspaceId` 索引（LOW）

迁移 005 添加的 `workspaceId` 列无索引，但 `projects_list` 经常按它过滤。

---

## 四、前端代码质量

### FE-1: 巨型单文件组件（HIGH）

| 文件 | 行数 | 问题 |
|------|------|------|
| `ProjectsPage.tsx` | 1,159 | 三种视图模式 + 多个弹窗 + 所有业务逻辑在一个文件 |
| `FileExplorer.tsx` | 1,050 | 递归树 + 右键菜单 + 文件操作全在一文件 |
| `ProjectDetailPage.tsx` | 795 | 8 个 Tab 的内联子组件 |
| `WorkspacePage.tsx` | 665 | Agent 生命周期 + 终端管理 + 启动队列 + 编辑器状态 |
| `MainLayout.tsx` | 567 | 侧边栏 + 顶栏 + 文件浏览器 + 工作区 |

---

### FE-2: 递归组件 `TreeNode` 无 `React.memo`（HIGH）

**位置**: `src/shared/FileExplorer.tsx:811`

`TreeNode` 是递归组件，接收 16 个 props，未做 memo 化。展开大型目录树后，任何状态变化会导致整棵树重新渲染。

---

### FE-3: 内联 style 对象导致不必要的重渲染（MEDIUM）

几乎所有组件使用 `style={{ ... }}` 内联对象，每次渲染创建新引用，破坏 React 的浅比较。`WorkspacePage.tsx` 底部的 `styles` 对象（576-664 行）是正确方向，但大部分组件未遵循。

---

### FE-4: 数据获取模式不一致（MEDIUM）

部分组件使用 React Query hooks（`useProjects`、`useProject`），部分使用原始 `useState` + `useEffect` + API 调用（`MilestonesTab`、`HealthTab`）。后者缺乏缓存失效机制。

---

### FE-5: `eslint-disable` 掩盖真实问题（MEDIUM）

**位置**: 共 26 处

- 7 处 `react-hooks/exhaustive-deps` — 其中 MilestonesTab 和 HealthTab 掩盖了 BUG-6
- 4 处 `@typescript-eslint/no-explicit-any` — 标记未类型化代码
- `TasksTab.tsx:16` — 整个文件禁用 exhaustive-deps 规则

---

### FE-6: 死代码和未使用的依赖（MEDIUM）

**死代码**:
- `agentStore.ts:62-66, 204-218` — 已废弃的 `toolEvents` 系统
- `ProjectsPage.tsx:291-313` — 永不可达的确认弹窗
- `src/shared/KanbanBoard/` — 未被任何文件引用
- `src/features/workspace/knowledge/KnowledgeCenterPage.tsx` — 未被引用，应用用的是 `KnowledgeBasePage.tsx`

**空目录**:
- `src/shared/LauncherButton/`
- `src/features/auth/`
- `src/features/tasks/`

**未使用的旧终端组件**:
- `src/shared/terminal/TerminalTab.tsx`
- `src/shared/terminal/TerminalGroup.tsx`
- `src/shared/terminal/SplitDivider.tsx`
- `src/shared/terminal/TerminalTabBar.tsx`
- `src/shared/terminal/TerminalPane.tsx`

**未使用的共享组件**:
- `src/shared/components/SearchBox.tsx`
- `src/lib/projectUtils.ts`（无导入）

**可疑依赖**:
- `react-arborist` — 代码中无导入
- `@dnd-kit/utilities` v3 — 与 `@dnd-kit/core` v6 版本不匹配
- `geist` — 可能未使用（字体从 Google CDN 加载）

---

### FE-7: 类型安全问题（MEDIUM）

- `client.ts:6` — 核心 IPC 封装使用 `<T = any>` 默认泛型
- `ProjectDetailPage.tsx:99` — 通过 `Record<string, unknown>` 类型断言访问 `remoteRepos`
- `MilestonesTab.tsx:72` — 通过 `any` 访问 `_count`
- `KanbanBoard/index.tsx:216` — 拖拽时直接修改 task 对象（props 突变）

---

## 五、后端代码质量

### BE-1: 占位/桩实现（HIGH）

**位置**: `src-tauri/src/commands/project/dependencies.rs`

| 函数 | 行为 |
|------|------|
| `detect_project_dependencies` (61-76) | 返回硬编码空数据 |
| `analyze_docker_compose` (173-189) | 注释说"生产环境需解析 YAML"，但返回空 Vec |
| `detect_monorepo_structure` (201-229) | 返回占位数据 |
| `repos_sync` (repos.rs:114) | 仅更新 `lastSyncAt`，不做实际同步 |

---

### BE-2: 动态 UPDATE 代码大量重复（MEDIUM）

几乎每个 update 命令都复制粘贴相同的"构建 SET 子句 + 参数化值"模式。应提取为可复用宏或辅助函数。

---

### BE-3: 错误消息中英文混杂（LOW）

- `terminal.rs`: `"启动失败: {}"`
- `files.rs`: `"Path is not a directory"`
- `health.rs`: `"不是 Git 仓库"`
- `projects.rs`: `"请先设置本地路径"`

---

### BE-4: 输入验证不一致（LOW）

- `agent_tasks.rs` — 验证 status 和 priority 白名单
- `tasks.rs` — 不验证 status，接受任意字符串
- `memory.rs` — 验证 memory type
- 大部分模块无输入验证

---

### BE-5: `detect_icon_from_exe` 空实现（LOW）

**位置**: `src-tauri/src/commands/project/detect.rs:1709-1742`

Windows 实现搜索 .exe 文件后直接 `break`，不做任何处理，始终返回 `None`。

---

### BE-6: 临时文件泄漏风险（LOW）

**位置**: `src-tauri/src/commands/workspace/terminal.rs:612-623`

`terminal_start_agent_piped_pty` 创建临时文件 `claude_prompt_{uuid}.txt`，在退出监听线程中清理。如果进程永不退出或监听线程 panic，临时文件会泄漏。应用退出时无全局清理。

---

### BE-7: `detect_git_repo` 错误路径不清理临时目录（LOW）

**位置**: `src-tauri/src/commands/project/detect.rs:278-305`

克隆成功但后续分析出错时，返回 `Err` 但不清理 `temp_dir`。成功路径的清理代码不会执行。

---

## 六、配置与构建问题

### CFG-1: Tauri 插件缺少权限配置（MEDIUM）

**位置**: `src-tauri/capabilities/default.json`

`Cargo.toml` 中声明了 `tauri-plugin-window-state` 和 `tauri-plugin-screenshots`，但 `default.json` 中无对应权限条目，这些插件可能无法正常工作。

---

### CFG-2: `devtools` 特性未条件启用（LOW）

**位置**: `src-tauri/Cargo.toml:16`

```toml
tauri = { version = "2", features = ["devtools", "image-png"] }
```

`devtools` 始终启用，发布版本中应仅在 debug 模式启用。

---

### CFG-3: Favicon 引用不存在的文件（LOW）

**位置**: `index.html:5`

引用 `/vite.svg`，但 `public/` 目录只有 `icon.png`，无 `vite.svg`。

---

### CFG-4: CSS 重复 keyframe 定义（LOW）

- `@keyframes pulse` — `animations.css:42` 和 `index.css:83`（opacity 0.5 vs 0.6）
- `@keyframes shimmer` — `animations.css:78` 和 `index.css:69`（方向逻辑不同）
- `@keyframes spin` — `animations.css:47` 和 `index.html:26`

---

### CFG-5: `index.css` 职责过多（LOW）

363 行混杂了 scrollbar、markdown、Ant Design 覆盖、dark theme、hover 工具类、resize divider 等不相关关注点。大量 `!important` 使用使后续定制困难。

---

### CFG-6: 字体依赖外部 CDN（LOW）

**位置**: `index.html:9-10`

从 `fonts.googleapis.com` 加载 Space Grotesk、DM Sans、JetBrains Mono。桌面应用离线使用时字体不可用，应本地打包。`package.json` 中的 `geist` 包可能与 CDN 字体重复。

---

### CFG-7: `postinstall` 脚本 monkey-patch node_modules（LOW）

**位置**: `scripts/patch-codemirror-ime.cjs`

安装时修改 `@uiw/react-codemirror` 的 `node_modules` 文件以修复 IME 问题。版本升级时会失效。

---

## 七、新功能建议

### NEW-1: 离线字体打包

桌面应用应将字体文件打包到 `public/fonts/`，消除对 Google CDN 的依赖。当前 `public/fonts/` 目录已存在但似乎为空或未被使用。

### NEW-2: 真正实现依赖分析

`dependencies.rs` 中 4 个命令全部返回占位数据。应实现：
- `detect_project_dependencies` — 解析 `package.json`、`Cargo.toml`、`requirements.txt` 等
- `analyze_docker_compose` — 解析 `docker-compose.yml` 获取服务和端口映射
- `detect_monorepo_structure` — 识别 monorepo 工具（lerna、turborepo、pnpm workspace）
- `get_launch_order` — 基于依赖图的拓扑排序

### NEW-3: `NewProjectWizard` 补全

当前向导：
- 步骤 2（工作区配置）和步骤 3（Agent 配置）是 "coming soon" 占位符
- "完成"按钮不实际创建项目
应补全整个创建流程，或简化为单步创建。

### NEW-4: `repos_sync` 真正同步远程仓库

当前仅更新 `lastSyncAt` 时间戳。应实现：
- `git fetch` 获取最新远程信息
- 更新分支列表、最新 commit、标签
- 检测并显示与远程的差异

### NEW-5: API 密钥加密存储

使用系统 keychain（如 Windows Credential Manager）或至少 AES 加密存储 API 密钥，而非明文 SQLite。

### NEW-6: 全局错误处理

`queryClient.ts` 未设置全局 `onError` 处理。应添加统一的错误通知机制，替代各组件分散的 `try/catch + message.error()` 模式。

### NEW-7: 端口预览自动发现增强

`previewStore` 中端口到标签的映射是硬编码的。可以：
- 从终端输出中自动检测框架类型
- 支持用户自定义端口映射
- 支持多个同时运行的 dev server

### NEW-8: 终端搜索功能

当前终端（基于 xterm.js）似乎缺少搜索功能。xterm-search 插件可以添加 Ctrl+F 搜索终端输出。

### NEW-9: 项目健康检查定时执行

当前健康检查仅手动触发。可以添加定时自动检查（如每小时），并在状态变化时通知用户。

### NEW-10: 暗色模式 ErrorBoundary

`ErrorBoundary.tsx:65` 硬编码深色背景 `#161821`，在浅色模式下视觉不协调。应读取 `themeStore` 适配两种主题。

---

## 八、优先级总览

| 优先级 | 类别 | 编号 | 摘要 |
|--------|------|------|------|
| **P0** | Bug | BUG-1 | `tasks_update` WHERE 子句参数错误 |
| **P0** | Bug | BUG-2 | `project_tags` 表被删但仍在使用 |
| **P0** | Bug | BUG-3 | `projects_batch_import` 引用已删表 |
| **P0** | 安全 | SEC-2 | 命令注入风险（cmd /C） |
| **P1** | Bug | BUG-4 | 迁移部分失败仍标记成功 |
| **P1** | Bug | BUG-5 | `truncate` UTF-8 panic |
| **P1** | Bug | BUG-6 | `useEffect` 缺失 projectId 依赖 |
| **P1** | 安全 | SEC-1 | CSP 为 null |
| **P1** | 性能 | PERF-1 | 阻塞 I/O 占用异步运行时 |
| **P1** | 前端 | FE-1 | 5 个组件超过 500 行 |
| **P1** | 前端 | FE-2 | TreeNode 递归组件无 memo |
| **P2** | Bug | BUG-7 | 向导不创建项目 |
| **P2** | Bug | BUG-8 | launchHints 恒为空 |
| **P2** | 安全 | SEC-3 | API 密钥明文存储 |
| **P2** | 安全 | SEC-4 | 文件操作无路径验证 |
| **P2** | 性能 | PERF-2 | N+1 查询 |
| **P2** | 性能 | PERF-3 | 终端线程轮询 |
| **P2** | 前端 | FE-3~7 | 内联样式、模式不一致、死代码、类型 |
| **P2** | 后端 | BE-1 | 占位实现 |
| **P2** | 后端 | BE-2 | UPDATE 代码重复 |
| **P3** | 配置 | CFG-1~7 | 插件权限、devtools、favicon、CSS、字体等 |
| **P3** | 后端 | BE-3~7 | 错误消息、验证、空实现、资源泄漏 |
| **P3** | 功能 | NEW-1~10 | 新功能建议 |
