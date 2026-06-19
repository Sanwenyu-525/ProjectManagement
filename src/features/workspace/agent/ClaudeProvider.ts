import { listen } from '@tauri-apps/api/event';
import { terminalApi, sessionsApi, gitApi } from '../../../api';
import { stripAnsi } from '../../../lib/stripAnsi';
import type { TerminalOutputEvent, TerminalExitEvent } from '../../../shared/terminalTypes';
import type { AgentProvider, AgentStreamEvent, StartOptions } from './AgentProvider';

/** Parsed Claude CLI stream-json event */
interface StreamJsonEvent {
  type: 'system' | 'assistant' | 'user' | 'result' | 'error';
  subtype?: string;
  session_id?: string;
  model?: string;
  tools?: string[];
  cwd?: string;
  message?: {
    content?: Array<{
      type: string;
      text?: string;
      id?: string;
      name?: string;
      input?: Record<string, unknown>;
      tool_use_id?: string;
      thinking?: string;
      is_error?: boolean;
      [key: string]: unknown; // allow extra fields like content (tool_result output)
    }>;
  };
  result?: string;
  error?: string;
  is_error?: boolean;
  duration_ms?: number;
  total_cost_usd?: number;
  num_turns?: number;
}

/**
 * ClaudeProvider — one-shot mode per message.
 * Each send() spawns `claude -p --output-format stream-json --verbose`.
 * Response is parsed from structured JSON, no interactive UI artifacts.
 */
export class ClaudeProvider implements AgentProvider {
  readonly id = 'claude';
  readonly name = 'Claude Code';
  readonly icon = 'code';

  private config: StartOptions | null = null;
  private cliSessionId: string | null = null;
  private activeTerminalId: string | null = null;
  private listeners = new Set<(e: AgentStreamEvent) => void>();
  private unlistenOutput: (() => void) | null = null;
  private unlistenExit: (() => void) | null = null;
  private jsonBuffer = '';
  private hasStreamedText = false;
  private resultText: string | null = null;
  private hasError = false;
  /** Track emitted text length per block index to handle cumulative stream-json text */
  private emittedTextLengths = new Map<number, number>();
  /** Buffer terminal event when no listener is attached (e.g. PTY exits before AgentChat subscribes) */
  private pendingEvent: AgentStreamEvent | null = null;

  constructor(_config?: { runtimeId?: string }) {}

  async start(options: StartOptions): Promise<string> {
    this.config = options;
    this.cliSessionId = options.providerSessionId || null;
    return `claude-agent-${Date.now()}`;
  }

  async send(message: string): Promise<void> {
    if (!this.config) throw new Error('Provider not started');

    // Kill any still-active PTY from a previous send
    if (this.activeTerminalId) {
      try { await terminalApi.stop(this.activeTerminalId); } catch { /* ignore */ }
      this.cleanupListeners();
    }

    const terminalId = `claude-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    this.activeTerminalId = terminalId;
    this.jsonBuffer = '';
    this.hasStreamedText = false;
    this.resultText = null;
    this.hasError = false;
    this.emittedTextLengths.clear();
    this.pendingEvent = null;

    const enrichedMessage = await this.buildContextMessage(message);
    const args = ['-p', '--output-format', 'stream-json', '--verbose'];
    if (this.config.dangerouslySkipPermissions) args.push('--dangerously-skip-permissions');
    if (this.cliSessionId) args.push('--resume', this.cliSessionId);

    const cwd = this.config.cwd || '';

    // Register listeners BEFORE spawning
    this.unlistenOutput = await listen<TerminalOutputEvent>('terminal-output', (event) => {
      if (event.payload.terminalId !== terminalId) return;
      this.parseStreamJson(event.payload.data);
    });

    this.unlistenExit = await listen<TerminalExitEvent>('terminal-exit', (event) => {
      if (event.payload.terminalId !== terminalId) return;
      this.flushJsonBuffer();
      if (!this.hasStreamedText && !this.hasError && this.resultText) {
        this.emit({ type: 'token', text: this.resultText });
      }
      if (event.payload.code !== null && event.payload.code !== 0 && !this.hasError) {
        this.emit({ type: 'error', error: `Agent exited with code ${event.payload.code}` });
      }
      if (this.config?.sessionId) {
        const updateData: { exitCode?: number; lastError?: string } = {};
        if (event.payload.code !== null) updateData.exitCode = event.payload.code;
        if (event.payload.code !== null && event.payload.code !== 0 && !this.hasError) {
          updateData.lastError = `Agent exited with code ${event.payload.code}`;
        }
        if (Object.keys(updateData).length > 0) {
          sessionsApi.update(this.config.sessionId, updateData).catch(() => {});
        }
      }
      this.cleanupListeners();
      this.activeTerminalId = null;
      this.jsonBuffer = '';
      if (!this.hasError) {
        this.emit({ type: 'done' });
      }
    });

    try {
      // Use piped mode: pass prompt via stdin to avoid cmd.exe mangling
      // special characters (angle brackets, ampersands, etc.) in the message
      await terminalApi.startAgentPiped(terminalId, 'claude', args, cwd, enrichedMessage);
    } catch (err) {
      this.cleanupListeners();
      this.activeTerminalId = null;
      throw err;
    }
  }

  async abort(): Promise<void> {
    if (!this.activeTerminalId) return;
    await terminalApi.stop(this.activeTerminalId);
  }

  async stop(): Promise<void> {
    if (this.activeTerminalId) {
      try { await terminalApi.stop(this.activeTerminalId); } catch { /* ignore */ }
      this.activeTerminalId = null;
    }
    this.cleanupListeners();
    this.cliSessionId = null;
    this.jsonBuffer = '';
    this.pendingEvent = null;
  }

  isActive(): boolean { return this.activeTerminalId !== null; }
  get connectionId(): string | null { return this.activeTerminalId; }

  onStream(callback: (e: AgentStreamEvent) => void): () => void {
    this.listeners.add(callback);
    // Replay buffered terminal event (e.g. PTY exited before this listener attached)
    if (this.pendingEvent) {
      const evt = this.pendingEvent;
      this.pendingEvent = null;
      callback(evt);
    }
    return () => { this.listeners.delete(callback); };
  }

  // ── Workspace Context ────────────────────────────────────────

  private async buildContextMessage(message: string): Promise<string> {
    const parts: string[] = [];
    const cwd = this.config?.cwd;

    if (cwd) {
      parts.push(`Working directory: ${cwd}`);
      try {
        const branches = await gitApi.branches(cwd) as Array<{ name: string; current: boolean }>;
        const current = branches?.find(b => b.current);
        if (current) parts.push(`Current git branch: ${current.name}`);
      } catch { /* not a git repo */ }
    }

    if (parts.length === 0) return message;
    return `<workspace-context>\n${parts.join('\n')}\n</workspace-context>\n\n${message}`;
  }

  // ── NDJSON Parsing ──────────────────────────────────────────
  // PTY output arrives in arbitrary chunks that may split JSON objects mid-line.
  // Instead of splitting on \n (which breaks when newlines fall inside JSON),
  // we scan the raw buffer for complete {…} objects using brace depth + string state.

  private parseStreamJson(data: string): void {
    this.jsonBuffer += data.replace(/\r/g, '');
    this.extractJsonObjects();
  }

  /**
   * Extract complete JSON objects from the buffer.
   *
   * Strategy: split by newlines first (stream-json is NDJSON — one JSON per line).
   * Lines that don't parse are accumulated. If a line starts with '{' but doesn't
   * parse, we hold it in the buffer waiting for more data. Non-JSON lines (banner
   * text, PTY control output) are discarded.
   */
  private extractJsonObjects(): void {
    const buf = stripAnsi(this.jsonBuffer);
    const lines = buf.split('\n');

    // Last line may be incomplete — hold it back
    const maybePending = lines.pop() ?? '';

    let pendingPartial = '';

    for (const rawLine of lines) {
      const line = (pendingPartial + rawLine).trim();
      pendingPartial = '';

      if (!line) continue;
      if (!line.startsWith('{')) continue; // skip non-JSON lines (banner, prompts)

      if (this.tryParseObject(line)) continue;

      // If the line starts with '{' but doesn't parse, it may be a partial object
      // split across lines due to PTY wrapping. Accumulate it.
      pendingPartial = line;
    }

    // Whatever is left (pending partial + last incomplete line) goes back to buffer
    const remaining = pendingPartial
      ? pendingPartial + '\n' + maybePending
      : maybePending;
    this.jsonBuffer = remaining;
  }

  /**
   * Try to parse a JSON object string with progressive fallback strategies.
   * PTY output may contain control characters inside JSON string values
   * (e.g. from terminal escape sequences not fully stripped by stripAnsi),
   * which break JSON.parse. We try multiple strategies to recover.
   *
   * Returns true if parsing succeeded, false otherwise.
   */
  private tryParseObject(objStr: string): boolean {
    // Strategy 1: parse as-is (fast path for clean data)
    try {
      this.handleStreamEvent(JSON.parse(objStr) as StreamJsonEvent);
      return true;
    } catch { /* fall through */ }

    // Strategy 2: strip control characters 0x00-0x1f
    // eslint-disable-next-line no-control-regex -- Intentional: stripping control chars from PTY output
    const cleaned = objStr.replace(/[\x00-\x1f]/g, '');
    try {
      this.handleStreamEvent(JSON.parse(cleaned) as StreamJsonEvent);
      return true;
    } catch { /* fall through */ }

    // Strategy 3: aggressive strip — remove non-printable chars outside basic ASCII
    const aggressive = objStr.replace(/[^\x20-\x7e]/g, '');
    try {
      this.handleStreamEvent(JSON.parse(aggressive) as StreamJsonEvent);
      return true;
    } catch { /* fall through */ }

    // Strategy 4: extract session_id from init messages via regex (even if full parse fails)
    const sidMatch = objStr.match(/"session_id"\s*:\s*"([^"]+)"/);
    if (sidMatch) {
      this.cliSessionId = sidMatch[1];
      if (this.config?.sessionId) {
        sessionsApi.update(this.config.sessionId, { providerSessionId: sidMatch[1] }).catch(() => {});
      }
      // If we got session_id, attempt to reconstruct the event type
      if (objStr.includes('"subtype":"init"') || objStr.includes('"type":"system"')) {
        // Init event — we extracted what we need (session_id), consider it handled
        return true;
      }
    }

    console.warn('[ClaudeProvider] parse fail:', objStr.slice(0, 300));
    return false;
  }

  private flushJsonBuffer(): void {
    this.extractJsonObjects();
  }

  private handleStreamEvent(event: StreamJsonEvent): void {
    switch (event.type) {
      case 'system':
        if (event.subtype === 'init' && event.session_id) {
          this.cliSessionId = event.session_id;
          if (this.config?.sessionId) {
            sessionsApi.update(this.config.sessionId, { providerSessionId: event.session_id }).catch(() => {});
          }
        }
        break;

      case 'assistant':
        for (let i = 0; i < (event.message?.content || []).length; i++) {
          const block = event.message!.content![i];
          if (block.type === 'text' && block.text) {
            this.hasStreamedText = true;
            // stream-json sends cumulative text — emit only the new portion
            const prevLen = this.emittedTextLengths.get(i) || 0;
            if (block.text.length > prevLen) {
              this.emit({ type: 'token', text: block.text.slice(prevLen) });
              this.emittedTextLengths.set(i, block.text.length);
            }
          } else if (block.type === 'thinking' && (block.thinking || block.text)) {
            this.emit({ type: 'thinking', text: block.thinking || block.text || '' });
          } else if (block.type === 'tool_use' && block.name) {
            const toolId = block.id || `tool-${Date.now()}`;
            this.emit({
              type: 'tool_start',
              id: toolId,
              toolName: block.name,
              input: block.input || {},
            });
          }
        }
        break;

      case 'user':
        for (const block of event.message?.content || []) {
          if (block.type !== 'tool_result' || !block.tool_use_id) continue;
          const rawContent = block.content as string | Array<{type: string; text?: string}> | undefined;
          let output = '';
          if (typeof rawContent === 'string') {
            output = rawContent;
          } else if (Array.isArray(rawContent)) {
            output = rawContent
              .filter((p) => p.type === 'text' && p.text)
              .map((p) => p.text || '')
              .join('');
          }
          this.emit({
            type: 'tool_result',
            toolUseId: block.tool_use_id,
            output,
            isError: Boolean(block.is_error),
          });
        }
        break;

      case 'result':
        if (event.result) this.resultText = event.result;
        if (event.is_error) {
          this.hasError = true;
          this.emit({ type: 'error', error: event.result || 'Unknown error' });
        }
        break;

      case 'error':
        this.emit({ type: 'error', error: event.error || event.result || 'CLI error' });
        break;
    }
  }

  private cleanupListeners(): void {
    if (this.unlistenOutput) { this.unlistenOutput(); this.unlistenOutput = null; }
    if (this.unlistenExit) { this.unlistenExit(); this.unlistenExit = null; }
  }

  private emit(event: AgentStreamEvent): void {
    if (this.listeners.size === 0) {
      // Buffer terminal events so they're not lost if AgentChat hasn't subscribed yet
      if (event.type === 'done' || event.type === 'error') {
        this.pendingEvent = event;
      }
      return;
    }
    for (const cb of this.listeners) cb(event);
  }
}
