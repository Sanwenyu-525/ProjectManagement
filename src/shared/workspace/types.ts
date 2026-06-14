export interface PaneLeaf {
  type: 'leaf';
  id: string;
  tabIds: string[];
  activeTabId: string | null;
}

export interface PaneSplit {
  type: 'split';
  id: string;
  direction: 'horizontal' | 'vertical';
  children: PaneNode[];
  sizes: number[];
}

export type PaneNode = PaneLeaf | PaneSplit;

// ── Discriminated union for PaneTab ──

interface PaneTabBase {
  id: string;
  label: string;
  status?: 'running' | 'exited' | 'error';
  /** When true, the label won't be auto-updated by cwd tracking */
  namePinned?: boolean;
}

export interface TerminalTab extends PaneTabBase {
  contentType: 'terminal';
  shell?: string;
  cwd?: string;
}

export interface AgentTab extends PaneTabBase {
  contentType: 'agent';
  runtimeId?: string;
}

export interface BrowserTab extends PaneTabBase {
  contentType: 'browser';
  url?: string;
  urlHistory?: string[];
  urlHistoryIndex?: number;
}

export interface BuildTab extends PaneTabBase {
  contentType: 'build';
}

export interface LogTab extends PaneTabBase {
  contentType: 'log';
}

export interface PluginTab extends PaneTabBase {
  contentType: 'plugin';
  /** Plugin ID (e.g., 'markdown-editor', 'json-viewer', 'database-browser') */
  pluginId: string;
  /** Plugin-specific state (arbitrary data the plugin manages) */
  pluginState?: Record<string, unknown>;
}

export interface FileTab extends PaneTabBase {
  contentType: 'file';
  /** Project root path for file tree */
  rootPath?: string;
  /** Currently opened file path */
  filePath?: string;
  /** Whether the editor has unsaved changes */
  isDirty?: boolean;
}

export type PaneTab = TerminalTab | AgentTab | BrowserTab | BuildTab | LogTab | PluginTab | FileTab;

// ── Type guards ──

export function isTerminalTab(tab: PaneTab): tab is TerminalTab {
  return tab.contentType === 'terminal';
}

export function isAgentTab(tab: PaneTab): tab is AgentTab {
  return tab.contentType === 'agent';
}

export function isBrowserTab(tab: PaneTab): tab is BrowserTab {
  return tab.contentType === 'browser';
}

export function isPluginTab(tab: PaneTab): tab is PluginTab {
  return tab.contentType === 'plugin';
}

export function isFileTab(tab: PaneTab): tab is FileTab {
  return tab.contentType === 'file';
}

export interface WorkspaceLayout {
  root: PaneNode;
  tabs: Record<string, PaneTab>;
}
