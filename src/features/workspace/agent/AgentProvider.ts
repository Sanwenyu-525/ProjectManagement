export type AgentStreamEvent =
  | { type: 'token'; text: string }
  | { type: 'done' }
  | { type: 'error'; error: string }
  | { type: 'tool_use'; toolName: string; description: string }
  | { type: 'thinking'; text: string }
  | { type: 'tool_start'; id: string; toolName: string; input: Record<string, unknown> }
  | { type: 'tool_result'; toolUseId: string; output: string; isError: boolean };

export type MessageBlock =
  | { type: 'text'; text: string }
  | { type: 'thinking'; text: string }
  | { type: 'tool_use'; id: string; toolName: string; input: Record<string, unknown>; output?: string; isError?: boolean };

export interface StartOptions {
  sessionId: string;
  projectId?: string;
  cwd?: string;
  /** When true, pass --dangerously-skip-permissions to Claude CLI. Disabled by default. */
  dangerouslySkipPermissions?: boolean;
  /** CLI session ID for --resume (from a previous session's providerSessionId). */
  providerSessionId?: string;
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
}
