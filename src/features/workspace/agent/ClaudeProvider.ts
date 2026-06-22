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
  attempt?: number;
  max_retries?: number;
  retry_delay_ms?: number;
  error_status?: number;
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
  private stderrBuffer = '';

  // ── Retry state (429 rate-limit) ──
  private static readonly MAX_RETRIES = 3;
  private static readonly BASE_DELAY_MS = 5_000;
  private retryAttempt = 0;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private lastMessage: string | null = null;
  /** Track emitted text length per block index to handle cumulative stream-json text */
  private emittedTextLengths = new Map<number, number>();
  /** 运行模式：interactive（交互式持久 PTY）或 oneshot（一次性 -p） */
  private mode: 'interactive' | 'oneshot' = 'interactive';
  /** Buffer stream events when no listener is attached (e.g. PTY exits before AgentChat subscribes).
   *  Uses a queue instead of single value to prevent token events from being overwritten by done/error. */
  private pendingEvents: AgentStreamEvent[] = [];

  constructor(_config?: { runtimeId?: string }) {}

  async start(options: StartOptions): Promise<string> {
    this.config = options;
    this.cliSessionId = options.providerSessionId || null;
    this.mode = options.mode || 'interactive';
    return `claude-agent-${Date.now()}`;
  }

  async send(message: string): Promise<void> {
    if (!this.config) throw new Error('Provider not started');

    if (this.mode === 'interactive') {
      await this.sendInteractive(message);
    } else {
      await this.sendOneshot(message);
    }
  }

  /** Shared exit-event handler for both interactive and oneshot modes */
  private handleTerminalExit(terminalId: string, event: { payload: TerminalExitEvent }): void {
    if (event.payload.terminalId !== terminalId) return;
    const code = event.payload.code;

    // Update session with exit code and last error
    if (this.config?.sessionId) {
      const updateData: { exitCode?: number; lastError?: string } = {};
      if (code !== null) updateData.exitCode = code;
      if (code !== null && code !== 0 && !this.hasError) {
        updateData.lastError = `Agent exited with code ${code}`;
      }
      if (Object.keys(updateData).length > 0) {
        sessionsApi.update(this.config.sessionId, updateData).catch(() => {});
      }
    }

    const leftover = this.flushJsonBuffer();
    // Fallback: if process exited without streaming text, surface result, leftover buffer, or error
    if (!this.hasStreamedText && !this.hasError) {
      if (this.resultText) {
        this.emit({ type: 'token', text: this.resultText });
      } else if (leftover) {
        this.emit({ type: 'token', text: leftover });
      } else if (code !== null && code !== 0) {
        this.emit({ type: 'error', error: `Agent exited with code ${code}` });
      } else {
        this.emit({ type: 'error', error: 'Agent returned empty response' });
      }
    }
    if (code !== null && code !== 0 && !this.hasError) {
      this.emit({ type: 'error', error: `Agent exited with code ${code}` });
    }

    // Check for 429 rate-limit before finalizing
    if (this.retryAttempt <= ClaudeProvider.MAX_RETRIES && this.lastMessage &&
        (this.isRateLimitError(this.stderrBuffer) || this.isRateLimitError(this.resultText || ''))) {
      this.cleanupListeners();
      this.activeTerminalId = null;
      this.jsonBuffer = '';
      this.stderrBuffer = '';
      this.scheduleRetry(this.lastMessage);
      return;
    }
    this.stderrBuffer = '';
    this.cleanupListeners();
    this.activeTerminalId = null;
    this.jsonBuffer = '';
    if (!this.hasError) {
      this.emit({ type: 'done' });
    }
  }

  /** 交互模式：首次 send() spawn 持久 PTY（stream-json 输出），后续 send() 写入 stdin */
  private async sendInteractive(message: string): Promise<void> {
    if (!this.config) throw new Error('Provider not started');

    if (!this.activeTerminalId) {
      // 首次调用：spawn 持久交互式 PTY，输出 stream-json 格式
      const terminalId = `claude-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      this.activeTerminalId = terminalId;

      const args: string[] = ['--output-format', 'stream-json', '--verbose'];
      if (this.config.dangerouslySkipPermissions) args.push('--dangerously-skip-permissions');
      if (this.cliSessionId) args.push('--resume', this.cliSessionId);

      const cwd = this.config.cwd || '';

      // 监听 terminal-output，走 parseStreamJson 解析管线（同 oneshot）
      this.unlistenOutput = await listen<TerminalOutputEvent>('terminal-output', (event) => {
        if (event.payload.terminalId !== terminalId) return;
        if (event.payload.stream === 'stderr') {
          const text = event.payload.data.trim();
          this.stderrBuffer += text + '\n';
          console.error('[ClaudeProvider] interactive stderr:', text);
          if (text && !this.isRateLimitError(text)) {
            this.hasError = true;
            this.emit({ type: 'error', error: text });
          }
          return;
        }
        this.parseStreamJson(event.payload.data);
      });

      this.unlistenExit = await listen<TerminalExitEvent>('terminal-exit', (event) => {
        this.handleTerminalExit(terminalId, event);
      });

      await terminalApi.startAgent(terminalId, 'claude', args, cwd);

      // 等待 PTY 就绪
      await new Promise(resolve => setTimeout(resolve, 300));
    }

    // 每次 send 前重置解析状态，为下一轮对话做准备
    this.jsonBuffer = '';
    this.emittedTextLengths.clear();
    this.hasStreamedText = false;
    this.resultText = null;
    this.hasError = false;
    this.pendingEvents = [];

    // 写入 stdin 并发送回车
    await terminalApi.input(this.activeTerminalId, message + '\r');
  }

  /** Oneshot 模式：每次 send() spawn 新的 claude -p 进程（原有逻辑） */
  private async sendOneshot(message: string): Promise<void> {
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
    this.pendingEvents = [];

    const enrichedMessage = await this.buildContextMessage(message);
    const args = ['-p', '--output-format', 'stream-json', '--verbose'];
    if (this.config.dangerouslySkipPermissions) args.push('--dangerously-skip-permissions');
    if (this.cliSessionId) args.push('--resume', this.cliSessionId);

    const cwd = this.config.cwd || '';

    // Register listeners BEFORE spawning
    this.unlistenOutput = await listen<TerminalOutputEvent>('terminal-output', (event) => {
      if (event.payload.terminalId !== terminalId) return;
      if (event.payload.stream === 'stderr') {
        const text = event.payload.data.trim();
        this.stderrBuffer += text + '\n';
        console.error('[ClaudeProvider] stderr:', text);
        if (text && !this.isRateLimitError(text)) {
          this.hasError = true;
          this.emit({ type: 'error', error: text });
        }
        return;
      }
      this.parseStreamJson(event.payload.data);
    });

    this.unlistenExit = await listen<TerminalExitEvent>('terminal-exit', (event) => {
      this.handleTerminalExit(terminalId, event);
    });

    try {
      // Pass prompt via stdin using a temp file + cmd redirect.
      // cmd.exe /C strips quotes from args, breaking `claude -p "prompt"`.
      // By writing the prompt to a temp file and using `< file` redirect,
      // we avoid all quoting issues on Windows.
      await terminalApi.startAgentPipedPty(terminalId, 'claude', args, cwd, enrichedMessage);
    } catch (err) {
      this.cleanupListeners();
      this.activeTerminalId = null;
      throw err;
    }
  }

  async abort(): Promise<void> {
    if (!this.activeTerminalId) return;
    if (this.mode === 'interactive') {
      // 交互模式：发送 Ctrl+C 中断当前操作，不终止进程
      await terminalApi.input(this.activeTerminalId, '\x03');
    } else {
      await terminalApi.stop(this.activeTerminalId);
    }
  }

  async stop(): Promise<void> {
    if (this.activeTerminalId) {
      try { await terminalApi.stop(this.activeTerminalId); } catch { /* ignore */ }
      this.activeTerminalId = null;
    }
    this.cleanupListeners();
    this.cliSessionId = null;
    this.clearRetryTimer();
    this.jsonBuffer = '';
    this.stderrBuffer = '';
    this.pendingEvents = [];
  }

  private clearRetryTimer(): void {
    if (this.retryTimer) {
      clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }
  }

  /** Detect 429 rate-limit from stderr text or error event message. */
  private isRateLimitError(text: string): boolean {
    const lower = text.toLowerCase();
    return lower.includes('429') || lower.includes('rate limit') || lower.includes('too many requests');
  }

  /** Schedule a retry with exponential backoff + jitter. */
  private scheduleRetry(message: string): void {
    this.retryAttempt++;
    if (this.retryAttempt > ClaudeProvider.MAX_RETRIES) {
      this.emit({ type: 'error', error: `Rate limited after ${ClaudeProvider.MAX_RETRIES} retries. Please wait and try again later.` });
      this.retryAttempt = 0;
      return;
    }

    const delay = ClaudeProvider.BASE_DELAY_MS * Math.pow(2, this.retryAttempt - 1)
      + Math.random() * 1000;

    this.emit({
      type: 'retrying',
      attempt: this.retryAttempt,
      maxAttempts: ClaudeProvider.MAX_RETRIES,
      delayMs: Math.round(delay),
      reason: 'Rate limited (429)',
    });

    this.retryTimer = setTimeout(async () => {
      this.retryTimer = null;
      if (this.activeTerminalId) {
        try { await terminalApi.stop(this.activeTerminalId); } catch { /* ignore */ }
        this.cleanupListeners();
        this.activeTerminalId = null;
      }
      try {
        await this.send(message);
      } catch (err) {
        this.emit({ type: 'error', error: err instanceof Error ? err.message : String(err) });
      }
    }, delay);
  }

  isActive(): boolean { return this.activeTerminalId !== null; }
  get connectionId(): string | null { return this.activeTerminalId; }
  getTerminalId(): string | null { return this.activeTerminalId; }
  isInteractive(): boolean { return this.mode === 'interactive'; }

  onStream(callback: (e: AgentStreamEvent) => void): () => void {
    this.listeners.add(callback);
    // Replay all buffered events (e.g. PTY exited before this listener attached)
    if (this.pendingEvents.length > 0) {
      const events = this.pendingEvents;
      this.pendingEvents = [];
      for (const evt of events) callback(evt);
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
    // Fast path: skip ANSI stripping when buffer contains no escape sequences
    const buf = this.jsonBuffer.indexOf('\x1b') >= 0
      ? stripAnsi(this.jsonBuffer)
      : this.jsonBuffer;
    const lines = buf.split('\n');

    // Last line may be incomplete — hold it back
    const maybePending = lines.pop() ?? '';

    let pendingPartial = '';

    for (const rawLine of lines) {
      const line = (pendingPartial + rawLine).trim();
      pendingPartial = '';

      if (!line) continue;
      if (!line.startsWith('{')) continue; // skip non-JSON lines (banner, prompts)

      // Try parsing as a single object first (fast path)
      if (this.tryParseObject(line)) continue;

      // Line starts with '{' — might be concatenated JSON objects (no newline between them)
      // Split by brace-depth to extract each complete object
      const objects = this.splitJsonObjects(line);
      if (objects.length > 1) {
        for (const obj of objects) {
          this.tryParseObject(obj);
        }
        continue;
      }

      // Line starts with '{' but didn't parse — could be partial (split across lines
      // due to newlines in string values like thinking content). Check brace balance.
      if (this.hasUnbalancedBraces(line)) {
        pendingPartial = line;
        continue;
      }

      // Brace-balanced but still didn't parse — might have trailing garbage.
      // Already tried in tryParseObject; nothing more we can do here.
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

    // Strategy 4: repair malformed JSON from non-official API backends
    // Some backends emit invalid syntax like `"key"::` (double colon)
    const repaired = this.repairMalformedJson(cleaned);
    if (repaired !== cleaned) {
      try {
        this.handleStreamEvent(JSON.parse(repaired) as StreamJsonEvent);
        return true;
      } catch { /* fall through */ }
    }

    // Strategy 5: brace-matching — extract first complete JSON object from line
    // Handles trailing garbage, extra content, or line concatenation artifacts
    const extracted = this.extractFirstJsonObject(aggressive);
    if (extracted && extracted !== aggressive) {
      try {
        this.handleStreamEvent(JSON.parse(extracted) as StreamJsonEvent);
        return true;
      } catch { /* fall through */ }
    }

    // Strategy 6: extract session_id from init messages via regex (even if full parse fails)
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

    // Brace-balanced but still didn't parse — might have trailing garbage.
    // Already tried in tryParseObject; nothing more we can do here.
    // Suppress warn for obviously incomplete chunks (no closing brace) —
    // the data will be re-parsed once the next PTY chunk arrives.
    if (objStr.endsWith('}')) {
      console.warn('[ClaudeProvider] parse fail:', objStr.slice(0, 200));
    }
    return false;
  }

  /** Check if a line has more open braces than close braces (indicating a split JSON object) */
  private hasUnbalancedBraces(s: string): boolean {
    let depth = 0;
    let inString = false;
    let escape = false;
    for (const ch of s) {
      if (escape) { escape = false; continue; }
      if (ch === '\\' && inString) { escape = true; continue; }
      if (ch === '"') { inString = !inString; continue; }
      if (inString) continue;
      if (ch === '{') depth++;
      if (ch === '}') depth--;
    }
    return depth > 0;
  }

  /**
   * Split a string containing multiple concatenated JSON objects into individual objects.
   * E.g. '{"a":1}{"b":2}' → ['{"a":1}', '{"b":2}']
   */
  private splitJsonObjects(s: string): string[] {
    const objects: string[] = [];
    let depth = 0;
    let inString = false;
    let escape = false;
    let start = -1;

    for (let i = 0; i < s.length; i++) {
      const ch = s[i];
      if (escape) { escape = false; continue; }
      if (ch === '\\' && inString) { escape = true; continue; }
      if (ch === '"') { inString = !inString; continue; }
      if (inString) continue;
      if (ch === '{') {
        if (depth === 0) start = i;
        depth++;
      } else if (ch === '}') {
        depth--;
        if (depth === 0 && start !== -1) {
          objects.push(s.slice(start, i + 1));
          start = -1;
        }
      }
    }
    return objects;
  }

  /**
   * Repair common JSON syntax errors from non-official API backends.
   * Currently handles: `"key"::` → `"key":` (double colon after property name).
   */
  private repairMalformedJson(s: string): string {
    // Fix `"key"::` → `"key":` — match a quoted key followed by two colons
    // Safe: in valid JSON, `::` never appears outside string values
    return s.replace(/"(\w+)"::/g, '"$1":');
  }

  /**
   * Extract the first complete JSON object from a string using brace depth tracking.
   * Handles cases where the line contains extra content before/after the JSON,
   * or where multiple JSON objects are concatenated.
   */
  private extractFirstJsonObject(s: string): string | null {
    const start = s.indexOf('{');
    if (start === -1) return null;

    let depth = 0;
    let inString = false;
    let escape = false;

    for (let i = start; i < s.length; i++) {
      const ch = s[i];
      if (escape) { escape = false; continue; }
      if (ch === '\\' && inString) { escape = true; continue; }
      if (ch === '"') { inString = !inString; continue; }
      if (inString) continue;
      if (ch === '{') depth++;
      if (ch === '}') {
        depth--;
        if (depth === 0) return s.slice(start, i + 1);
      }
    }
    return null;
  }

  private flushJsonBuffer(): string {
    this.extractJsonObjects();
    // Return leftover buffer content — exit handlers can surface it if nothing was streamed
    const leftover = this.jsonBuffer.trim();
    this.jsonBuffer = '';
    return leftover;
  }

  private handleStreamEvent(event: StreamJsonEvent): void {
    switch (event.type) {
      case 'system':
        if (event.subtype === 'init' && event.session_id) {
          this.cliSessionId = event.session_id;
          if (this.config?.sessionId) {
            sessionsApi.update(this.config.sessionId, { providerSessionId: event.session_id }).catch(() => {});
          }
        } else if (event.subtype === 'api_retry') {
          const delay = Math.round(event.retry_delay_ms ?? 0);
          this.emit({ type: 'thinking', text: `API 重试 ${event.attempt}/${event.max_retries}（${event.error_status}，${(delay / 1000).toFixed(1)}s）` });
        }
        // thinking_tokens / cost_usd 等内部系统事件：静默忽略
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
        this.retryAttempt = 0; // reset on successful response
        if (event.result) this.resultText = event.result;
        if (event.is_error) {
          this.hasError = true;
          this.emit({ type: 'error', error: event.result || 'Unknown error' });
        }
        if (event.total_cost_usd !== undefined || event.duration_ms !== undefined || event.num_turns !== undefined) {
          this.emit({
            type: 'result',
            costUsd: event.total_cost_usd,
            durationMs: event.duration_ms,
            numTurns: event.num_turns,
            sessionId: event.session_id,
          });
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
      // Buffer all events so they're not lost if AgentChat hasn't subscribed yet
      // (previously only done/error were buffered, causing token events to be silently dropped)
      this.pendingEvents.push(event);
      return;
    }
    for (const cb of this.listeners) cb(event);
  }
}
