import { listen } from '@tauri-apps/api/event';
import { terminalApi } from '../../../api';
import type { TerminalOutputEvent } from '../../../shared/terminalTypes';
import type { AgentProvider, AgentStreamEvent, StartOptions } from './AgentProvider';

function stripAnsi(str: string): string {
  return str
    .replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '')
    .replace(/\x1b\][^\x07]*\x07/g, '')
    .replace(/\x1b\[\?[0-9;]*[a-zA-Z]/g, '')
    .replace(/\r/g, '')
    .replace(/\x00/g, '')
    .replace(/\x08/g, '')
    .replace(/\x1b\(B/g, '')
    .replace(/\x1b[=>]/g, '')
    .trim();
}

export class ClaudeProvider implements AgentProvider {
  readonly id = 'claude';
  readonly name = 'Claude Code';
  readonly icon = 'code';

  private terminalId: string | null = null;
  private listeners = new Set<(e: AgentStreamEvent) => void>();
  private unlistenTauri: (() => void) | null = null;
  private idleTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(_config?: { runtimeId?: string }) {}

  async start(options: StartOptions): Promise<string> {
    const terminalId = `claude-${Date.now()}`;
    const launcherPath = await terminalApi.setupAgentLauncher();
    const workDir = options.cwd || '';
    await terminalApi.startAgent(terminalId, launcherPath, [], workDir);
    this.terminalId = terminalId;

    const unlisten = await listen<TerminalOutputEvent>('terminal-output', (event) => {
      if (event.payload.terminalId !== this.terminalId) return;
      const cleaned = stripAnsi(event.payload.data);
      if (!cleaned) return;

      this.emit({ type: 'token', text: cleaned });

      if (this.idleTimer) clearTimeout(this.idleTimer);
      this.idleTimer = setTimeout(() => {
        this.emit({ type: 'done' });
      }, 1500);
    });
    this.unlistenTauri = unlisten;

    return terminalId;
  }

  async send(message: string): Promise<void> {
    if (!this.terminalId) throw new Error('Provider not started');
    await terminalApi.input(this.terminalId, message + '\n');
  }

  async abort(): Promise<void> {
    if (!this.terminalId) return;
    if (this.idleTimer) { clearTimeout(this.idleTimer); this.idleTimer = null; }
    await terminalApi.input(this.terminalId, '\x03');
  }

  async stop(): Promise<void> {
    if (this.idleTimer) { clearTimeout(this.idleTimer); this.idleTimer = null; }
    if (this.unlistenTauri) { this.unlistenTauri(); this.unlistenTauri = null; }
    if (this.terminalId) { await terminalApi.stop(this.terminalId); this.terminalId = null; }
  }

  isActive(): boolean {
    return this.terminalId !== null;
  }

  get connectionId(): string | null {
    return this.terminalId;
  }

  onStream(callback: (event: AgentStreamEvent) => void): () => void {
    this.listeners.add(callback);
    return () => { this.listeners.delete(callback); };
  }

  private emit(event: AgentStreamEvent): void {
    for (const cb of this.listeners) cb(event);
  }
}
