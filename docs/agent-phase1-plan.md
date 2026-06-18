# Phase 1: Claude CLI → 非交互模式 → 聊天界面

## 目标

将 Agent 从"嵌入 TUI"改为"解析 stdout → 聊天界面"。用户看到 ChatGPT/Cursor 风格的聊天 UI，底层使用 Claude CLI。

## 核心变化

**现状：** `claude --dangerously-skip-permissions`（交互式 TUI）→ PTY 输出 → stripAnsi → 聊天 UI（乱码）

**目标：** `claude -p --output-format stream-json --verbose`（非交互式 NDJSON）→ 解析结构化事件 → 聊天 UI（干净）

## 架构设计

### 消息流程

```
用户输入 → ClaudeProvider.send()
  → 生成唯一 terminalId
  → 调用 terminalApi.startAgent(terminalId, 'claude', ['-p', '--output-format', 'stream-json', '--verbose', '--dangerously-skip-permissions', ...resumeArgs, prompt], cwd)
  → 监听 terminal-output 事件
  → 按行解析 NDJSON
  → 提取 text/tool_use 事件 → emit('token') → 聊天 UI 渲染
  → 收到 result 事件 → 保存 session_id → emit('done')
  → PTY 自动退出 → 清理
```

### 多轮对话策略

利用 Claude CLI 的 `--resume` 机制：

1. **首次消息：** `claude -p --output-format stream-json --verbose --dangerously-skip-permissions "用户消息"`
2. **从 `system/init` 事件提取 `session_id`**，存入 provider
3. **后续消息：** `claude -p --output-format stream-json --verbose --dangerously-skip-permissions --resume <session_id> "新消息"`
4. CLI 从磁盘恢复对话历史，前端无需重建上下文

如果 `--resume` 在 `-p` 模式下不可用，退回到每次发送完整对话历史作为 prompt。

### PTY 生命周期（逐消息）

每个用户消息创建一个临时 PTY 进程：
- `send()` 生成 `claude-{timestamp}-{random}` 作为 terminalId
- PTY 启动 → 输出 stream-json → 进程结束 → PTY 清理
- 用户在 `send()` 期间看到"正在思考..."指示器
- `abort()` 杀掉当前 PTY 进程

## 文件变更

### 1. `src/features/workspace/agent/ClaudeProvider.ts` — 重写

**改动：** 移除交互式 PTY 启动，改为逐消息 PTY + stream-json 解析

```typescript
export class ClaudeProvider implements AgentProvider {
  // ...id, name, icon 不变

  private config: StartOptions | null = null;
  private sessionId: string | null = null;  // Claude CLI session_id for --resume
  private activeTerminalId: string | null = null;
  private listeners = new Set<(e: AgentStreamEvent) => void>();
  private jsonBuffer: string = '';  // NDJSON 行缓冲

  // start() — 不再启动 PTY，只保存配置
  async start(options: StartOptions): Promise<string> {
    this.config = options;
    return `claude-agent-${Date.now()}`;
  }

  // send() — 每条消息启动一个 PTY 进程
  async send(message: string): Promise<void> {
    if (!this.config) throw new Error('Provider not started');

    const terminalId = `claude-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    this.activeTerminalId = terminalId;
    this.jsonBuffer = '';

    // 构建 CLI 参数
    const args = [
      '-p',
      '--output-format', 'stream-json',
      '--verbose',
      '--dangerously-skip-permissions',
    ];
    if (this.sessionId) {
      args.push('--resume', this.sessionId);
    }
    args.push(message);

    // 启动 PTY
    await terminalApi.startAgent(terminalId, 'claude', args, this.config.cwd || '');

    // 监听输出
    const unlisten = await listen<TerminalOutputEvent>('terminal-output', (event) => {
      if (event.payload.terminalId !== terminalId) return;
      this.parseStreamJson(event.payload.data);
    });

    // 等待进程退出（监听 terminal-exit）
    const unlistenExit = await listen<TerminalExitEvent>('terminal-exit', (event) => {
      if (event.payload.terminalId !== terminalId) return;
      unlisten();
      unlistenExit();
      this.activeTerminalId = null;
      this.jsonBuffer = '';
      this.emit({ type: 'done' });
    });
  }

  // NDJSON 解析器
  private parseStreamJson(data: string): void {
    this.jsonBuffer += data;
    const lines = this.jsonBuffer.split('\n');
    this.jsonBuffer = lines.pop() || '';  // 最后一行可能不完整

    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const event = JSON.parse(line);
        this.handleStreamEvent(event);
      } catch {
        // 忽略解析失败的行
      }
    }
  }

  // 处理单个 stream-json 事件
  private handleStreamEvent(event: any): void {
    switch (event.type) {
      case 'system':
        if (event.subtype === 'init') {
          this.sessionId = event.session_id;
        }
        break;

      case 'assistant':
        for (const block of event.message?.content || []) {
          if (block.type === 'text') {
            this.emit({ type: 'token', text: block.text });
          } else if (block.type === 'tool_use') {
            this.emit({
              type: 'tool_use',
              toolName: block.name,
              description: block.input?.description || block.name,
            });
          }
        }
        break;

      case 'result':
        if (event.subtype === 'error') {
          this.emit({ type: 'error', error: event.result || 'Unknown error' });
        }
        break;
    }
  }

  // abort, stop, isActive 等方法相应调整
}
```

### 2. `src/features/workspace/agent/AgentProvider.ts` — 扩展事件类型

```typescript
export type AgentStreamEvent =
  | { type: 'token'; text: string }
  | { type: 'done' }
  | { type: 'error'; error: string }
  | { type: 'tool_use'; toolName: string; description: string };  // 新增
```

### 3. `src/stores/agentStore.ts` — 增加消息列表和工具事件

```typescript
interface AgentStore {
  // ...现有字段

  /** 已完成的消息列表（per session） */
  messages: Record<string, AgentMessage[]>;

  /** 工具调用事件（用于显示工具状态指示器） */
  toolEvents: Record<string, ToolEvent[]>;

  appendMessage: (sessionId: string, role: 'user' | 'assistant', content: string) => void;
  appendToolEvent: (sessionId: string, event: ToolEvent) => void;
  clearMessages: (sessionId: string) => void;
}

interface ToolEvent {
  id: string;
  toolName: string;
  description: string;
  timestamp: number;
}
```

### 4. `src/features/workspace/agent/AgentChat.tsx` — 渲染聊天消息

改动点：
- 从 store 的 `messages` 渲染完整对话历史
- 流式文本显示在最后一条 assistant 消息中
- `tool_use` 事件渲染为紧凑的状态指示器（如 `🔧 正在执行 Bash: ls -la`）
- `result` 事件中的成本/耗时信息可选显示

### 5. `src/features/workspace/WorkspacePage.tsx` — 适配新生命周期

改动点：
- `handleStartAgent`：provider.start() 不再返回真正的 terminalId，使用占位 ID
- 移除对 `terminal-exit` 的自动清理逻辑（或改为由 provider 内部管理）
- 确保 stop/abort 正确清理 provider 内部状态

## PTY 基础设施（不改动）

`src-tauri/src/commands/workspace/terminal.rs` 无需修改：
- `terminal_start_agent` 已支持自定义命令和参数
- `spawn_output_reader` 正确处理 UTF-8 流式输出
- PTY 进程退出后自动清理

## 验证方式

1. 启动 agent → 聊天界面显示"准备就绪"，无 TUI 输出
2. 发送 "你好" → 收到干净的文本回复
3. 发送 "列出当前目录文件" → 看到 tool_use 指示器 + 文本回复
4. 连续发 3 条消息 → 每条都保持上下文（通过 --resume）
5. 点击停止 → 进程正确终止，无残留

## 已知限制（Phase 2 解决）

- 每次消息启动新进程，首次响应有冷启动延迟（~2-3s）
- tool_use 只显示为文本指示器，不展示详细参数/结果
- 无 Agent Timeline（Phase 2 的事件解析器）
- 对话上下文依赖 CLI session 持久化（默认 2-3 天过期）
