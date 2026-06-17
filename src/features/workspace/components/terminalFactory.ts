import { terminalApi } from '../../../api';
import { DEFAULT_SHELL, SHELL_MAP } from '../../../lib/constants';
import { useTerminalStore } from '../../../stores/terminalStore';
import type { Terminal } from '../../../shared/terminalTypes';

export interface CreateTerminalResult {
  terminal: Terminal;
  id: string;
  label: string;
}

export interface CreateTerminalOptions {
  /** Override the default working directory */
  cwd?: string;
  /** Override the terminal label */
  label?: string;
}

/** Extract the last folder name from a path, e.g. "D:\Develop\MyApp" → "MyApp" */
export function folderName(cwd: string): string {
  const sep = cwd.includes('\\') ? '\\' : '/';
  const parts = cwd.replace(/[\\/]+$/, '').split(sep);
  return parts[parts.length - 1] || cwd;
}

/** Generate a unique label based on the cwd folder name */
function uniqueLabel(cwd: string): string {
  const base = folderName(cwd);
  const terminals = useTerminalStore.getState().terminals;
  const existing = terminals.filter(t => t.label === base || t.label.startsWith(base + ' '));
  if (existing.length === 0) return base;
  return `${base} ${existing.length + 1}`;
}

/**
 * Create and start a terminal. Returns the terminal data for the caller to
 * bind to a pane leaf via workspaceStore.addTab().
 */
export async function createTerminal(options?: CreateTerminalOptions): Promise<CreateTerminalResult | null> {
  const state = useTerminalStore.getState();
  if (state.terminals.length >= 10) return null;

  const id = `global-${Math.random().toString(36).slice(2, 10)}`;
  const shellPref = localStorage.getItem('devhub_terminal_shell') || DEFAULT_SHELL;
  const cfg = SHELL_MAP[shellPref] || SHELL_MAP[DEFAULT_SHELL];
  const cwd = options?.cwd || state.defaultCwd;
  const label = options?.label || uniqueLabel(cwd);

  const terminal: Terminal = {
    id,
    label,
    createdAt: new Date(),
    shell: cfg.shell,
    cwd,
    status: 'running',
    projectId: null,
    groupId: null,
    pane: 'left',
  };

  await terminalApi.startShell(id, cfg.shell, cwd, cfg.args);
  state.addTerminal(terminal);

  return { terminal, id, label };
}
