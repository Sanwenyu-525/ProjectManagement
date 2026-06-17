export type AgentStreamEvent =
  | { type: 'token'; text: string }
  | { type: 'done' }
  | { type: 'error'; error: string };

export interface StartOptions {
  sessionId: string;
  projectId?: string;
  cwd?: string;
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
