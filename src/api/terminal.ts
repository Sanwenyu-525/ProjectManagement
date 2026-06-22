import { cmd } from './client';
import type { TerminalApi, FileEntry, FileTreeNode, FileContent } from './types';

export interface SlashCommandDef {
  name: string;
  description: string;
  icon: string;
  category?: string;
}

// ==================== Terminal ====================

export const terminalApi: TerminalApi = {
  start: (projectId: string, commandStr: string, cwd: string) =>
    cmd<string>('terminal_start', { projectId, commandStr, cwd }),
  startShell: (terminalId: string, shell: string, cwd: string, args?: string[]) =>
    cmd<string>('terminal_start_shell', { terminalId, shell, args: args ?? null, cwd }),
  startAgent: (terminalId: string, command: string, args: string[], cwd: string) =>
    cmd<string>('terminal_start_agent', { terminalId, command, args, cwd }),
  startAgentPiped: (terminalId: string, command: string, args: string[], cwd: string, stdinData: string) =>
    cmd<string>('terminal_start_agent_piped', { terminalId, command, args, cwd, stdinData }),
  startAgentPipedPty: (terminalId: string, command: string, args: string[], cwd: string, stdinData: string) =>
    cmd<string>('terminal_start_agent_piped_pty', { terminalId, command, args, cwd, stdinData }),
  stop: (terminalId: string) =>
    cmd('terminal_stop', { terminalId }),
  input: (terminalId: string, data: string) =>
    cmd('terminal_input', { terminalId, data }),
  resize: (terminalId: string, cols: number, rows: number) =>
    cmd('terminal_resize', { terminalId, cols, rows }),
};

// ==================== Files ====================

export const filesApi = {
  listDirectory: (path: string) =>
    cmd<FileEntry[]>('files_list_directory', { path }),
  read: (path: string) =>
    cmd<FileContent>('files_read', { path }),
  write: (path: string, content: string) =>
    cmd<void>('files_write', { path, content }),
  writeBase64: (path: string, data: string) =>
    cmd<void>('files_write_base64', { path, data }),
  getTree: (root: string, depth?: number) =>
    cmd<FileTreeNode[]>('files_get_tree', { root, depth }),
  openInIde: (path: string, ide?: string) =>
    cmd<void>('files_open_in_ide', { path, ide }),
  create: (path: string, isDir?: boolean) =>
    cmd<void>('files_create', { path, isDir: isDir ?? false }),
  rename: (oldPath: string, newPath: string) =>
    cmd<void>('files_rename', { oldPath, newPath }),
  delete: (path: string) =>
    cmd<void>('files_delete', { path }),
};

// ==================== Claude Code Commands ====================

export const claudeCommandsApi = {
  list: (projectDir?: string) =>
    cmd<SlashCommandDef[]>('claude_commands_list', { projectDir: projectDir ?? null }),
};
