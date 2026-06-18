# Agent 模块问题检查与改造文档

日期：2026-06-18

## 1. 检查范围与假设

本次把“agent 模块”按实际代码边界理解为：

- 前端工作台 Agent：`src/features/workspace/WorkspacePage.tsx`、`src/features/workspace/agent/*`
- Agent 状态与 API：`src/stores/agentStore.ts`、`src/stores/agentWorkspaceStore.ts`、`src/hooks/useSessions.ts`、`src/hooks/useAgentTasks.ts`、`src/api/agent.ts`
- 后端支撑：`src-tauri/src/commands/workspace/sessions.rs`、`src-tauri/src/commands/workspace/agent_tasks.rs`、`src-tauri/src/commands/workspace/terminal.rs`
- 数据表：`007_agent_sessions.sql`、`010_agent_providers.sql`、`011_agent_tasks.sql`
- `/agents` 监控中心：`src/features/workspace/agent/AgentCenterPage.tsx`

本次只做检查和改造文档输出，没有修改业务实现。

## 2. 当前实现概览

当前 Agent 工作台的主链路是：

1. `WorkspacePage` 维护当前 provider、session 和右侧面板状态。
2. `providers.ts` 返回全局单例 provider，目前只有 `ClaudeProvider`。
3. `ClaudeProvider.send()` 每次消息启动一个 `claude -p --output-format stream-json --verbose` PTY 进程，并用 `--resume` 续接 Claude CLI 会话。
4. `AgentChat` 把用户消息写入 Zustand 和 SQLite，监听 provider stream 事件后把 assistant 消息写入 Zustand/SQLite。
5. `AgentPlanPanel` 通过 React Query 读写 `agent_tasks`。
6. `AgentCenterPage` 轮询最近 sessions/messages 展示运行态和历史态。

## 3. 验证结果

- `npx tsc --noEmit --pretty false`：通过。
- `cargo check`：通过。
- `npm run lint`：失败，共 13 个 error、15 个 warning。Agent 直接相关错误集中在 `AgentCenterPage.tsx` 和 `ClaudeProvider.ts` 的控制字符正则。
- 测试文件搜索：未发现 `test/spec/__tests__/tests` 相关测试文件。
- 工作区已有大量未提交/未跟踪改动，本次文档没有清理这些改动。

## 4. 主要问题

### P0-1：PTY 生命周期管理会破坏 Stop/Abort/Input/Resize

证据：

- `terminal_start_agent` 插入 `PTY_TERMINALS` 后，退出 watcher 在线程里立即 `terminals.remove(&tid_exit)` 再 `wait()`：`src-tauri/src/commands/workspace/terminal.rs:385`、`src-tauri/src/commands/workspace/terminal.rs:404`
- `terminal_stop`、`terminal_input`、`terminal_resize` 都依赖从 `PTY_TERMINALS` 查找句柄：`src-tauri/src/commands/workspace/terminal.rs:426`、`src-tauri/src/commands/workspace/terminal.rs:465`、`src-tauri/src/commands/workspace/terminal.rs:493`
- `ClaudeProvider.abort()` / `stop()` 调用 `terminalApi.stop()`，但错误被吞掉：`src/features/workspace/agent/ClaudeProvider.ts:154`、`src/features/workspace/agent/ClaudeProvider.ts:159`

影响：

- Agent 运行中点击 Stop/Abort 可能找不到进程，无法可靠终止。
- 同样的问题也影响普通交互式终端，因为 `terminal_start_shell` 也提前 remove：`src-tauri/src/commands/workspace/terminal.rs:273`、`src-tauri/src/commands/workspace/terminal.rs:293`
- 前端吞掉 stop 错误后，用户会看到 UI 停了，但真实子进程可能还在跑。

建议：

- 最小改法：退出 watcher 不要提前 `remove` registry。改成保留句柄直到进程真正退出，再清理并 emit `terminal-exit`。
- 如果 `portable_pty::Child` 可用 `try_wait`，优先用短周期 `try_wait` watcher，让 `terminal_stop/input/resize` 在进程运行期间仍能访问 registry。
- `terminal_stop` 成功/失败必须返回到 provider，provider 再把错误事件交给 UI。

### P0-2：恢复运行中 session 后 provider 可能未初始化

证据：

- `WorkspacePage` 启动时从 DB 找 running session，并只设置 `providerRef.current`、`activeProviderId`、`activeSessionId`：`src/features/workspace/WorkspacePage.tsx:52` 到 `src/features/workspace/WorkspacePage.tsx:62`
- `ClaudeProvider.send()` 要求先 `start()`，否则抛错：`src/features/workspace/agent/ClaudeProvider.ts:80`
- 当前 `agent_sessions` 表没有保存 Claude CLI 的真实 `session_id`，只有应用内 session id：`src-tauri/migrations/007_agent_sessions.sql:1`

影响：

- 应用重启后 UI 可能显示有 running session，但 provider 内部 `config` 和 Claude CLI `session_id` 都丢失，下一条消息发送失败或无法续接上下文。

建议：

- 恢复 session 时必须显式调用 `provider.start({ sessionId, cwd })`，并从 DB 加载历史消息。
- 给 `agent_sessions` 增加 `providerSessionId`、`lastError`、`exitCode` 等字段，保存 Claude `system/init.session_id`。
- 如果无法恢复真实 provider 状态，则启动时把 running session 标记为 ended/stale，避免 UI 展示“可继续”。

### P0-3：`--dangerously-skip-permissions` 被硬编码

证据：

- `ClaudeProvider` 构造 CLI 参数时无条件加入 `--dangerously-skip-permissions`：`src/features/workspace/agent/ClaudeProvider.ts:103`

影响：

- Agent 对工作区文件和命令拥有更高风险执行能力，但 UI、配置和数据库里没有明确授权状态。
- 这不适合成为默认行为，尤其是未来接入多个项目、provider、模板后。

建议：

- 默认关闭危险权限，只有用户对当前 workspace 明确启用“信任模式”时才追加。
- 把权限模式保存到 agent config/session，并在聊天区标题或状态区显示。
- 对危险模式增加首次确认、可撤销设置和审计记录。

### P1-1：消息角色和存储模型不一致

证据：

- 类型允许 `input/output/user/assistant/system`：`src/types/index.ts:482`
- `AgentChat` 写入 `user/assistant`：`src/features/workspace/agent/AgentChat.tsx:107`、`src/features/workspace/agent/AgentChat.tsx:57`
- `AgentCenterPage` 只按 `output` 过滤展示：`src/features/workspace/agent/AgentCenterPage.tsx:41`、`src/features/workspace/agent/AgentCenterPage.tsx:203`
- Zustand 内也维护了一份 per-session messages：`src/stores/agentStore.ts:28`

影响：

- 工作台和 Agent 中心对同一会话的理解不一致，可能出现聊天页有消息、监控中心无输出的情况。
- 本地状态和 DB 状态双写，失败路径容易不同步。

建议：

- 统一消息角色：建议只保留 `user | assistant | system | tool | event`。
- `AgentChat` 渲染以 React Query 的 DB 消息为基准，streaming text 只作为临时覆盖层。
- `AgentCenterPage` 改为读取规范角色，不再依赖旧的 `input/output`。

### P1-2：模型 provider/config 表已建，但没有业务闭环

证据：

- 迁移创建了 `model_providers` 和 `agent_configs`：`src-tauri/migrations/010_agent_providers.sql:2`、`src-tauri/migrations/010_agent_providers.sql:13`
- 前端 query key 已预留 `providers`、`agentConfigs`：`src/api/queryKeys.ts:65`、`src/api/queryKeys.ts:68`
- 实际 provider registry 是硬编码单例：`src/features/workspace/agent/providers.ts:4`

影响：

- 数据库结构和 UI 能力预期不一致，设置页无法真正配置 agent。
- 后续接 Codex/Gemini/OpenAI-compatible 时会被迫绕过现有表，或者产生第二套配置。

建议：

- 增加 `model_providers_*`、`agent_configs_*` Tauri 命令和 `src/api/agent.ts` 封装。
- `providers.ts` 改成 factory/adapter registry：配置从 DB 来，runtime adapter 从代码注册。
- 短期只实现 Claude config，但接口按多 provider 设计。

### P1-3：Agent task 缺少业务约束和归属保护

证据：

- `status`、`priority` 是普通 TEXT，没有 CHECK 约束：`src-tauri/migrations/011_agent_tasks.sql:6`、`src-tauri/migrations/011_agent_tasks.sql:7`
- update/delete 只按 task id 操作，不校验 session id：`src-tauri/src/commands/workspace/agent_tasks.rs:70`、`src-tauri/src/commands/workspace/agent_tasks.rs:123`
- create/update 直接接受前端传来的 status/priority：`src-tauri/src/commands/workspace/agent_tasks.rs:23`、`src-tauri/src/commands/workspace/agent_tasks.rs:64`

影响：

- 非法状态可以进入 DB，前端 `STATUS_CONFIG` 找不到时表现不可控。
- 如果未来有多 session、多 tab 或外部调用，更新/删除可能越过当前会话边界。

建议：

- 给 `status`、`priority` 加 CHECK 约束，Rust 侧也做白名单校验。
- update/delete 参数增加 `session_id`，SQL 加 `WHERE id = ? AND sessionId = ?`。
- 删除 group 时 UI 增加确认，明确会级联删除子任务。

### P1-4：错误处理过度吞掉，用户不可诊断

证据：

- `AgentChat` 中用户消息持久化、assistant 持久化、附件选择等多个路径 `catch` 后忽略：`src/features/workspace/agent/AgentChat.tsx:58`、`src/features/workspace/agent/AgentChat.tsx:108`、`src/features/workspace/agent/AgentChat.tsx:138`
- provider error 分支只 append 到本地，不持久化错误消息：`src/features/workspace/agent/AgentChat.tsx:63` 到 `src/features/workspace/agent/AgentChat.tsx:67`
- `AgentGitTab` 的 stage/unstage/discard/commit/fetch 多个操作失败后直接忽略：`src/features/workspace/agent/AgentGitTab.tsx:120`、`src/features/workspace/agent/AgentGitTab.tsx:162`

影响：

- 用户无法判断是 CLI 不存在、权限失败、进程终止失败，还是 DB 写入失败。
- Git discard/commit 这类高风险操作失败后没有反馈，也缺少确认。

建议：

- 定义统一 `AgentErrorEvent`，展示到聊天流或顶部状态条。
- DB 写失败至少保留本地 pending/failed 状态，并允许重试。
- Git discard、commit all 增加确认和错误提示，不吞异常。

### P1-5：Lint 已经阻断质量门禁

证据：

- `npm run lint` 当前失败。
- Agent 相关 error：`AgentCenterPage.tsx:32`、`AgentCenterPage.tsx:33`、`ClaudeProvider.ts:10`、`ClaudeProvider.ts:12` 到 `ClaudeProvider.ts:17`
- WorkspacePage 还有 hook dependency warning：`src/features/workspace/WorkspacePage.tsx:65`、`src/features/workspace/WorkspacePage.tsx:93`

影响：

- 即使 TypeScript 和 Rust 通过，前端质量门禁仍然失败。
- 控制字符正则散落在多个文件，后续还会重复触发。

建议：

- 抽出 `src/lib/stripAnsi.ts`，集中处理 ANSI/control char。
- 在工具函数里局部、带说明地禁用 `no-control-regex`，不要在多个组件里复制正则。
- 修复 hook dependency warning，避免恢复 session 和启动 session 时闭包陈旧。

### P2-1：右侧 Files/Context 仍是占位

证据：

- `AgentRightPanel` 有 Files/Context tab，但内容是 placeholder：`src/features/workspace/agent/AgentRightPanel.tsx:79`、`src/features/workspace/agent/AgentRightPanel.tsx:89`

影响：

- 用户会以为 agent 已具备文件上下文能力，但实际不可用。

建议：

- 短期隐藏未实现 tab，或标成 disabled。
- 中期 Files 接入 `filesApi`，Context 展示当前 session 的 cwd、附件、打开文件、token/上下文来源。

## 5. 改造目标

1. 进程生命周期可靠：Start、Send、Abort、Stop、Exit 状态一致，真实子进程不会残留。
2. 会话可恢复：应用重启后要么能恢复 provider 上下文，要么明确关闭陈旧 session。
3. 权限显式：危险权限不可硬编码默认开启。
4. 数据模型统一：消息、任务、provider config 使用同一套类型和约束。
5. 错误可见：用户能看到失败原因，开发者能从日志定位。
6. 可验证：lint/typecheck/cargo check 通过，并为 stream-json parser 和生命周期关键路径补测试。

## 6. 分阶段改造方案

### Phase 0：稳定现有 Claude Agent

范围：

- 修复 `terminal.rs` registry 生命周期，确保 stop/abort 可用。
- `ClaudeProvider` 去掉默认 `--dangerously-skip-permissions`，改为显式配置。
- `WorkspacePage` 恢复 session 时初始化 provider；无法恢复时关闭 stale session。
- 抽出 `stripAnsi` 工具，修复 lint error。
- `AgentChat` 把 provider/send/DB 错误展示到 UI。

验收：

- `npm run lint` 通过。
- `npx tsc --noEmit --pretty false` 通过。
- `cargo check` 通过。
- 手动验证：启动 Agent、发送消息、点击 Abort、点击 Stop，进程均能结束且 UI 状态正确。

### Phase 1：统一会话、消息、任务模型

范围：

- `agent_sessions` 增加 `providerSessionId`、`permissionMode`、`lastError`、`exitCode`、`updatedAt`。
- 消息角色统一到 `user | assistant | system | tool | event`。
- `AgentChat` 从 DB hydrate 历史消息，Zustand 只保存临时 streaming/tool event 状态。
- `AgentCenterPage` 改用规范角色统计和展示。
- `agent_tasks` 增加 CHECK 约束，Rust 命令校验状态/优先级和 session 归属。

验收：

- 重启应用后，历史消息仍能显示。
- `/agents` 能正确显示最近 assistant 输出和消息数量。
- 非法 task status/priority 无法写入。

### Phase 2：补齐 provider/config 闭环

范围：

- 为 `model_providers`、`agent_configs` 增加后端 CRUD 命令和前端 API/hooks。
- 设置页提供 Claude CLI 配置：可执行路径、默认 cwd、权限模式、模型/参数占位。
- `providers.ts` 改为 adapter registry + config factory。
- 保留当前 Claude CLI adapter，不在本阶段强行接入所有模型。

验收：

- 新建/编辑 agent config 后，工作台 AgentSelector 使用配置生成 agent。
- 没有配置时有明确空状态和入口，不再只有硬编码 Claude。

### Phase 3：补齐右侧能力与测试

范围：

- Files tab 接入文件树和当前会话 cwd。
- Context tab 展示当前上下文来源：cwd、附件、最近打开文件、工具事件、权限模式。
- AgentGitTab 的 destructive 操作增加确认和错误提示。
- 增加 parser 单测、task API 单测和至少一条聊天流端到端冒烟测试。

验收：

- Files/Context 不再是占位。
- discard/commit/fetch 失败有用户可见提示。
- 关键 parser 输入覆盖：完整 NDJSON、分块 NDJSON、tool_use、error、result fallback。

## 7. 不建议现在做的事

- 不建议先做大规模 UI 重设计。当前最大风险在进程生命周期、权限和数据模型。
- 不建议马上接入多模型 API。先把 Claude CLI adapter 的生命周期和恢复逻辑做稳。
- 不建议继续扩展占位 tab。未实现能力应隐藏或禁用，减少用户误解。
- 不建议用更多 localStorage 承载 agent 状态。会话、消息、权限和 provider config 应进 SQLite。

## 8. 推荐执行顺序

1. 修 `terminal.rs` registry 生命周期。
2. 修 `ClaudeProvider` stop/abort/error 传播。
3. 移除硬编码危险权限，增加显式 permission mode。
4. 修 session restore 和 `providerSessionId` 持久化。
5. 统一 message role，并调整 `AgentCenterPage`。
6. 补 `agent_tasks` 约束和 session 归属校验。
7. 实现 provider/config CRUD。
8. 补测试与手动验证脚本。

## 9. 最小验收清单

- Lint、TypeScript、Rust 三项检查全部通过。
- 启动 Agent 后发送普通问题，能收到 assistant 响应并持久化。
- 发送需要工具调用的问题，能显示 tool event，不污染 assistant 文本。
- Abort 后子进程确实结束，UI 不再继续 streaming。
- Stop 后 session 标记为 ended，`sessions_list` 不再返回该 running session。
- 应用重启后不存在“UI 显示 running 但 provider 未 start”的状态。
- 默认情况下不传 `--dangerously-skip-permissions`。
- `/agents` 能看到新角色模型下的最近输出。
- Agent task 的非法 status/priority 写入被拒绝。
