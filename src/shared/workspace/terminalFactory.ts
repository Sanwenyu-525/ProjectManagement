import { terminalApi } from '../../api';
import { DEFAULT_SHELL, SHELL_MAP } from '../../lib/constants';
import { useTerminalStore } from '../../stores/terminalStore';
import type { Terminal } from '../terminalTypes';

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
  const label = options?.label || `终端 ${state.nextTerminalNumber()}`;
  const cwd = options?.cwd || state.defaultCwd;

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
