/**
 * Agent Runtime — defines how an AI agent CLI is spawned and managed.
 *
 * An agent is fundamentally a terminal running a specific command.
 * The runtime knows: command, args, display name, and status parsing.
 *
 * On Windows, npm-installed CLIs (like `claude`) are `.cmd` scripts that
 * portable_pty can't exec directly. Instead we run them through a Node.js
 * wrapper (`claude-launcher.cjs`) which uses `windowsHide: true` to
 * prevent a second console window from popping up.
 */

export interface AgentRuntime {
  /** Unique identifier (e.g., 'claude', 'gemini', 'codex') */
  id: string;

  /** Display name (e.g., 'Claude', 'Gemini CLI') */
  name: string;

  /** Command to spawn (e.g., 'node' on Windows, 'claude' on Unix) */
  command: string;

  /** Default arguments */
  args: string[];

  /** Color for the agent indicator */
  color: string;

  /** Icon (antd icon name) */
  icon: string;
}

export function isWindows(): boolean {
  return typeof navigator !== 'undefined'
    && navigator.userAgent.toLowerCase().includes('win');
}

/**
 * Resolve the runtime command for a given agent id.
 * Checks localStorage for the launcher path on every call (dynamic),
 * because MainLayout sets it after the first mount.
 */
function resolveCommand(id: string): { command: string; args: string[] } {
  if (id !== 'claude') return { command: id, args: [] };
  if (!isWindows()) return { command: 'claude', args: [] };

  const launcher = localStorage.getItem('devhub_claude_launcher');
  if (launcher) return { command: 'node', args: [launcher] };

  // Fallback before launcher is set up (first second of app load)
  return { command: 'claude', args: [] };
}

// Static metadata (everything except command/args which are resolved dynamically)
const RUNTIME_META: Record<string, Omit<AgentRuntime, 'command' | 'args'>> = {
  claude: {
    id: 'claude',
    name: 'Claude',
    color: '#d97706',
    icon: 'ThunderboltOutlined',
  },
  gemini: {
    id: 'gemini',
    name: 'Gemini',
    color: '#4285f4',
    icon: 'GlobalOutlined',
  },
  codex: {
    id: 'codex',
    name: 'Codex',
    color: '#10a37f',
    icon: 'CodeOutlined',
  },
};

/** Get a fully-resolved runtime (reads localStorage for launcher path). */
export function getRuntime(id: string): AgentRuntime | undefined {
  const meta = RUNTIME_META[id];
  if (!meta) return undefined;
  const { command, args } = resolveCommand(id);
  return { ...meta, command, args };
}

/** Get all runtimes (resolves commands dynamically). */
export function getAllRuntimes(): AgentRuntime[] {
  return Object.keys(RUNTIME_META).map(id => getRuntime(id)!);
}
