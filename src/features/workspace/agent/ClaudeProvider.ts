import { listen } from '@tauri-apps/api/event';
import { terminalApi } from '../../../api';
import { stripAnsi } from '../../../lib/stripAnsi';
import type { TerminalOutputEvent, TerminalExitEvent } from '../../../shared/terminalTypes';
import type { AgentProvider, AgentStreamEvent, StartOptions } from './AgentProvider';

/**
 * ClaudeProvider — launches `claude --dangerously-skip-permissions` as a
 * persistent PTY session and communicates via stdin/stdout.
 *
 * Each send() writes the message to the process's stdin. The response is
 * captured from terminal-output events, stripped of ANSI codes, and emitted
 * as token events. Response completion is detected by a silence timer
 * (no new output for ~2s) or a prompt pattern reappearing.
 */
export class ClaudeProvider implements AgentProvider {
  readonly id = 'claude';
  readonly name = 'Claude Code';
  readonly icon = 'code';

  private terminalId: string | null = null;
  private listeners = new Set<(e: AgentStreamEvent) => void>();
  private unlistenOutput: (() => void) | null = null;
  private unlistenExit: (() => void) | null = null;

  /** Buffer for the current response being collected */
  private responseBuffer = '';
  /** Timer for detecting response completion via silence */
  private silenceTimer: ReturnType<typeof setTimeout> | null = null;
  /** Whether we're currently waiting for a response */
  private awaitingResponse = false;
  /** Whether the PTY process is running */
  private processRunning = false;

  constructor(_config?: { runtimeId?: string }) {}

  async start(options: StartOptions): Promise<string> {
    this.terminalId = `claude-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

    // Register listeners BEFORE spawning
    this.unlistenOutput = await listen<TerminalOutputEvent>('terminal-output', (event) => {
      if (event.payload.terminalId !== this.terminalId) return;
      this.handleOutput(event.payload.data);
    });

    this.unlistenExit = await listen<TerminalExitEvent>('terminal-exit', (event) => {
      if (event.payload.terminalId !== this.terminalId) return;
      this.processRunning = false;
      // Flush any remaining response
      if (this.awaitingResponse && this.responseBuffer.trim()) {
        this.emitToken(this.responseBuffer);
        this.responseBuffer = '';
        this.emitDone();
      }
      this.cleanupListeners();
    });

    // Spawn `claude --dangerously-skip-permissions` in persistent mode
    const cwd = options.cwd || '';
    await terminalApi.startAgent(this.terminalId, 'claude', ['--dangerously-skip-permissions'], cwd);
    this.processRunning = true;

    return this.terminalId;
  }

  async send(message: string): Promise<void> {
    if (!this.terminalId || !this.processRunning) {
      throw new Error('Claude process not running. Please restart.');
    }

    // Reset response state
    this.responseBuffer = '';
    this.awaitingResponse = true;
    this.clearSilenceTimer();

    // Send message to stdin (append newline to submit)
    await terminalApi.input(this.terminalId, message + '\n');
  }

  async abort(): Promise<void> {
    if (this.terminalId) {
      await terminalApi.stop(this.terminalId);
    }
    this.clearSilenceTimer();
  }

  async stop(): Promise<void> {
    this.clearSilenceTimer();
    if (this.terminalId && this.processRunning) {
      try {
        await terminalApi.stop(this.terminalId);
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        if (!msg.includes('不存在') && !msg.includes('已退出')) {
          throw e;
        }
      }
      this.processRunning = false;
    }
    this.cleanupListeners();
    this.terminalId = null;
  }

  isActive(): boolean {
    return this.processRunning;
  }

  get connectionId(): string | null {
    return this.terminalId;
  }

  onStream(callback: (e: AgentStreamEvent) => void): () => void {
    this.listeners.add(callback);
    return () => { this.listeners.delete(callback); };
  }

  // ── Terminal Output Processing ────────────────────────────────

  private handleOutput(rawData: string): void {
    if (!this.awaitingResponse) return;

    const cleaned = stripAnsi(rawData)
      .replace(/\r/g, '')
      // Remove terminal control sequences that slip through
      .replace(/\x00/g, '');

    if (!cleaned) return;

    // Detect prompt patterns (Claude waiting for input)
    // Common prompts: ">" at line start, "claude>" etc.
    const isPrompt = /^[>❯]\s*$/m.test(cleaned) || /claude\s*[>❯]/i.test(cleaned);

    if (isPrompt) {
      // Prompt appeared = response is complete
      this.clearSilenceTimer();
      if (this.responseBuffer.trim()) {
        this.emitToken(this.responseBuffer);
        this.responseBuffer = '';
      }
      this.emitDone();
      this.awaitingResponse = false;
      return;
    }

    // Accumulate response text
    this.responseBuffer += cleaned;

    // Emit incremental tokens for real-time streaming feel
    // Debounce: emit every chunk but also reset the silence timer
    this.emitToken(cleaned);

    // Reset silence timer — if no output for 2s, consider response complete
    this.clearSilenceTimer();
    this.silenceTimer = setTimeout(() => {
      if (this.awaitingResponse && this.responseBuffer.trim()) {
        // Don't emit the buffer again — tokens were already emitted incrementally
        this.responseBuffer = '';
        this.emitDone();
        this.awaitingResponse = false;
      }
    }, 2000);
  }

  // ── Helpers ───────────────────────────────────────────────────

  private clearSilenceTimer(): void {
    if (this.silenceTimer) {
      clearTimeout(this.silenceTimer);
      this.silenceTimer = null;
    }
  }

  private emitToken(text: string): void {
    this.emit({ type: 'token', text });
  }

  private emitDone(): void {
    this.emit({ type: 'done' });
  }

  private cleanupListeners(): void {
    if (this.unlistenOutput) { this.unlistenOutput(); this.unlistenOutput = null; }
    if (this.unlistenExit) { this.unlistenExit(); this.unlistenExit = null; }
  }

  private emit(event: AgentStreamEvent): void {
    for (const cb of this.listeners) cb(event);
  }
}
