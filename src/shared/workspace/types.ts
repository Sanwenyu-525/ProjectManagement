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

export interface PaneTab {
  id: string;
  label: string;
  contentType: 'terminal' | 'agent' | 'browser' | 'build' | 'log';
  status?: 'running' | 'exited' | 'error';
  /** Agent runtime ID (e.g., 'claude', 'gemini') — only for contentType === 'agent' */
  runtimeId?: string;
  /** Terminal shell path — only for contentType === 'terminal' */
  shell?: string;
  /** Terminal working directory — only for contentType === 'terminal' */
  cwd?: string;
  /** Browser URL — only for contentType === 'browser' */
  url?: string;
  /** Browser navigation history (max 50) — only for contentType === 'browser' */
  urlHistory?: string[];
  /** Current position in urlHistory — only for contentType === 'browser' */
  urlHistoryIndex?: number;
}

export interface WorkspaceLayout {
  root: PaneNode;
  tabs: Record<string, PaneTab>;
}
