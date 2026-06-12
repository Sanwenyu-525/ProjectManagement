export interface Terminal {
  id: string;
  label: string;
  createdAt: Date;
  shell: string;
  cwd: string;
  status: 'running' | 'exited' | 'error';
  projectId?: string | null;
  groupId?: string | null;
  pane: 'left' | 'right';
}

export type TerminalTheme = 'dark' | 'modern' | 'matrix' | 'light';

export interface TerminalThemeColors {
  background: string;
  foreground: string;
  cursor: string;
  cursorAccent: string;
  selectionBackground: string;
  selectionForeground: string;
  black: string;
  red: string;
  green: string;
  yellow: string;
  blue: string;
  magenta: string;
  cyan: string;
  white: string;
  brightBlack: string;
  brightRed: string;
  brightGreen: string;
  brightYellow: string;
  brightBlue: string;
  brightMagenta: string;
  brightCyan: string;
  brightWhite: string;
}

export interface TerminalThemeConfig {
  name: string;
  colors: TerminalThemeColors;
}

export interface TerminalOutputEvent {
  terminalId: string;
  data: string;
  stream: string;
}

export interface TerminalExitEvent {
  terminalId: string;
  code: number | null;
}

export interface TerminalManagerState {
  terminals: Terminal[];
  activeId: string | null;
  theme: TerminalTheme;
}

export interface TerminalManagerActions {
  createTerminal: (label?: string) => Promise<void>;
  closeTerminal: (id: string) => Promise<void>;
  switchTerminal: (id: string) => void;
  renameTerminal: (id: string, label: string) => void;
  setTheme: (theme: TerminalTheme) => void;
}
