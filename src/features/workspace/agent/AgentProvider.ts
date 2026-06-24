export type AgentStreamEvent =
  | { type: 'token'; text: string }
  | { type: 'done' }
  | { type: 'error'; error: string }
  | { type: 'tool_use'; toolName: string; description: string }
  | { type: 'thinking'; text: string }
  | { type: 'tool_start'; id: string; toolName: string; input: Record<string, unknown> }
  | { type: 'tool_result'; toolUseId: string; output: string; isError: boolean }
  | { type: 'result'; costUsd?: number; durationMs?: number; numTurns?: number; sessionId?: string }
  | { type: 'retrying'; attempt: number; maxAttempts: number; delayMs: number; reason: string };

export type MessageBlock =
  | { type: 'text'; text: string }
  | { type: 'thinking'; text: string }
  | { type: 'tool_use'; id: string; toolName: string; input: Record<string, unknown>; output?: string; isError?: boolean; startedAt?: number; durationMs?: number };

export interface StartOptions {
  sessionId: string;
  projectId?: string;
  cwd?: string;
  /** CLI session ID for --resume (from a previous session's providerSessionId). */
  providerSessionId?: string;
  /** 运行模式：interactive（交互式持久 PTY）或 oneshot（一次性 -p）。默认 interactive */
  mode?: 'interactive' | 'oneshot';
}

export interface AgentProvider {
  readonly id: string;
  readonly name: string;
  readonly icon: string;

  start(options: StartOptions): Promise<string>;
  send(message: string): Promise<void>;
  abort(): Promise<void>;
  stop(): Promise<void>;
  isActive(): boolean;
  /** Returns the underlying connection ID (e.g. terminal ID), or null if not started */
  readonly connectionId: string | null;
  onStream(callback: (event: AgentStreamEvent) => void): () => void;
  /** 获取交互模式的 terminal ID，供 xterm.js 连接。非交互模式返回 null */
  getTerminalId?(): string | null;
  /** 是否为交互模式 */
  isInteractive?(): boolean;
}
