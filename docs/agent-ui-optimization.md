# Agent 模块优化执行文档

## 定位

**不走 IDE 方向，不自研智能体。** 核心定位是：给原生 Claude Code 引擎套一个比 CLI 体验更好的 GUI 外壳。

用户用的就是 Claude Code 本身的全部能力（tool use、文件编辑、bash 执行、MCP 等），我们只做 **呈现层** 和 **交互层** 的优化。

---

## 现状分析

### 架构

```
用户输入 → ClaudeProvider.send()
         → spawn `claude -p --output-format stream-json --verbose`
         → 解析 NDJSON 事件 (system/assistant/result/error)
         → emit AgentStreamEvent (token/tool_use/done/error)
         → AgentChat 渲染
```

### 当前问题

| # | 问题 | 影响 |
|---|------|------|
| 1 | **每条消息启动新进程**（`-p` 一次性模式），依赖 `--resume` 维持上下文 | 每轮对话有冷启动延迟 ~2-3s |
| 2 | **tool_use 信息极度简化** — 只有 toolName + description，无输入/输出 | 用户看不到 agent 在做什么 |
| 3 | **流式文本是一整坨** — assistant 的所有 text block 拼成一个字符串 | 无法区分"思考"、"回复"、"代码"等结构 |
| 4 | **无中间状态反馈** — tool 执行期间只有"Thinking"动画 | 长时间等待不知进度 |
| 5 | **会话不可恢复** — provider 重启后 cliSessionId 丢失 | 刷新页面失去上下文 |
| 6 | **右侧面板 (Plan/Git/Context) 与 agent 行为完全解耦** | 纯手动操作，agent 不驱动 |

---

## 优化方案

### Phase 1：通信层升级 — 交互式会话模式

**目标**：消除每条消息的冷启动，实现真正的多轮对话。

**方案**：改为长驻交互式 Claude Code 进程 + `stream-json` 输出。

```
改造前：每条消息 spawn 新进程 + --resume
改造后：start() spawn 一个长驻 claude 进程，send() 通过 stdin 发送
```

具体变更：

| 文件 | 改动 |
|------|------|
| `ClaudeProvider.ts` | 重写为长驻模式：`start()` 启动 `claude --output-format stream-json --verbose --dangerously-skip-permissions`，通过 PTY stdin 发消息 |
| `AgentProvider.ts` | 接口不变，语义不变 |
| `terminal.rs` | 新增 `terminal_input_line` 命令（或复用 `terminal_input`），向 agent PTY 写入用户消息 |
| `agentStore.ts` | 新增 `cliSessionId` 持久化到 localStorage |

**关键细节**：
- 交互模式下 Claude Code 的 stdout 仍然是 NDJSON（`--output-format stream-json` 在交互模式也生效）
- 用户消息通过 stdin 写入，格式为纯文本 + 换行
- 进程生命周期跟随 workspace session，页面卸载时 kill

**验证**：手动在终端测试 `claude --output-format stream-json --verbose` 交互模式，确认输出格式。如果交互模式不支持 stream-json，则退回 `-p --resume` 方案但优化为进程池预热。

---

### Phase 2：丰富事件解析 — 结构化消息模型

**目标**：从 stream-json 中提取更多信息，让 UI 有足够数据渲染。

**改造 AgentStreamEvent 类型**：

```typescript
export type AgentStreamEvent =
  | { type: 'text'; text: string }
  | { type: 'thinking'; text: string }
  | { type: 'tool_start'; id: string; toolName: string; input: Record<string, unknown> }
  | { type: 'tool_result'; id: string; output: string; isError: boolean }
  | { type: 'done' }
  | { type: 'error'; error: string };
```

**改造 agentStore 消息模型**：

```typescript
interface AgentMessage {
  id: string;
  role: 'user' | 'assistant';
  timestamp: number;
  blocks: MessageBlock[];
}

type MessageBlock =
  | { type: 'text'; content: string }
  | { type: 'thinking'; content: string }
  | { type: 'tool_use'; id: string; toolName: string; input: Record<string, unknown>; output?: string; status: 'running' | 'done' | 'error' }
  | { type: 'code'; language: string; content: string };
```

**解析增强**（`ClaudeProvider.handleStreamEvent`）：
- `assistant` 事件中的 `content` 数组已包含 `text` / `tool_use` block，当前只取 text —— 改为按 block 逐个 emit
- `tool_use` block 有完整的 `input` 字段（file_path、command 等），当前丢弃了
- 新增对 `tool_result` 事件类型的处理（stream-json 会输出工具执行结果）

---

### Phase 3：UI 渲染升级

**目标**：基于结构化消息模型，渲染更丰富的对话内容。

#### 3.1 消息气泡内分块渲染

替换当前"一整坨 Markdown"渲染，改为 block-based 渲染：

```
一条 assistant 消息 = [thinking block] + [text block] + [tool block] + [text block] + ...
```

| Block 类型 | 渲染方式 |
|-----------|---------|
| `text` | Markdown 渲染（保持现有） |
| `thinking` | 折叠面板，灰色斜体，默认收起 |
| `tool_use` | 可折叠卡片：图标 + 工具名 + 摘要 + 展开后显示 input/output |
| `code` | 带语法高亮的代码块（已有 CodeMirror 依赖） |

#### 3.2 Tool 执行卡片设计

```
┌─────────────────────────────────────────┐
│ 🔧 Read  src/api/index.ts              │  ← 收起状态
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│ 🔧 Bash                                 │  ← 展开状态
│ $ npm run build                         │
│ ─────────────────────────────────────── │
│ ✓ Build completed in 2.3s              │
│   dist/index.js   12.4 KB              │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│ ✏️ Edit  src/components/App.tsx          │  ← 展开显示 diff
│ ─────────────────────────────────────── │
│ - import { old } from './old';          │
│ + import { new } from './new';          │
└─────────────────────────────────────────┘
```

#### 3.3 实时进度状态

streaming 期间：
- 顶部显示紧凑状态条：`🔄 Reading file... → Editing → Running bash`
- tool 卡片显示 spinner 直到收到 result
- 文本流式显示保持现有光标动画

#### 3.4 文件列表

| 改动 | 说明 |
|------|------|
| `AgentChat.tsx` | 重写消息渲染逻辑，改为 block-based |
| 新增 `ToolCard.tsx` | 工具执行卡片组件 |
| 新增 `ThinkingBlock.tsx` | 思考过程折叠组件 |
| 修改 `agentStore.ts` | 消息模型从 string 改为 block 数组 |

---

### Phase 4：会话管理增强

**目标**：会话可恢复，历史可回看。

| 改动 | 说明 |
|------|------|
| DB 持久化 | `agent_messages` 表存储结构化 blocks（JSON 列），而非纯 text |
| 会话恢复 | 页面刷新后从 DB 恢复 messages + 从 localStorage 恢复 cliSessionId，重新 attach 或 resume |
| 会话列表 | AgentIdleState 的 recent sessions 点击后直接恢复该会话（重新 `--resume`） |

---

### Phase 5：右侧面板联动（可选后续）

当 agent 产生特定 tool_use 时，右侧面板自动响应：

| Agent 行为 | 右侧面板反应 |
|-----------|-------------|
| 编辑文件 | Context tab 高亮显示被修改的文件列表 |
| git commit | Git tab 自动刷新 |
| 提到 plan/task | Plan tab 更新 |

实现方式：在 `handleStreamEvent` 中识别特定 tool pattern，dispatch 到对应 store。

---

## 执行顺序与优先级

```
Phase 2 (事件解析) → Phase 3 (UI 渲染) → Phase 1 (通信层) → Phase 4 (会话管理) → Phase 5 (联动)
```

**为什么 Phase 2 先于 Phase 1**：
- Phase 1（交互模式）需要先验证 Claude Code 交互模式是否支持 stream-json 输出
- Phase 2/3 在当前 `-p` 模式下就能做，立刻可见效果
- Phase 2 是 Phase 3 的前置条件

---

## 风险与约束

| 风险 | 应对 |
|------|------|
| Claude Code 交互模式可能不输出 stream-json | 验证后决定：不支持则保持 `-p` 模式 + 进程池预热 |
| stream-json 格式随 CLI 版本变化 | 解析层做容错，未知事件 skip 不 crash |
| tool_result 可能很大（文件内容） | UI 截断 + 展开显示，store 中限制单条 result 大小 |
| 长会话 context 消耗 | 这是 Claude Code 自己管理的，我们不需要干预 |

---

## 不做的事

- ❌ 不自研 agent 逻辑（prompt、tool 定义、上下文管理）
- ❌ 不做 IDE 功能（语法分析、跳转定义、调试器）
- ❌ 不做多 agent 编排
- ❌ 不做 API 直连（不调 Anthropic API，只用 Claude Code CLI）
- ❌ 不做终端仿真渲染（去掉 xterm，只展示结构化数据）
