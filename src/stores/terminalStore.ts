import { create } from 'zustand';
import { DEFAULT_CWD } from '../lib/constants';
import { Terminal, TerminalTheme, PanePosition } from '../shared/terminalTypes';
import { useThemeStore } from './themeStore';
import { useWorkspaceStore } from './workspaceStore';

export interface LaunchRequest {
  cwd: string;
  command?: string;
  label?: string;
  projectId?: string;
  pane?: PanePosition;
}

export interface TerminalGroup {
  id: string;
  label: string;
  isProjectGroup: boolean;
  isCollapsed: boolean;
}

// ─── Launch Queue ───────────────────────────────────────────────────────────
// requestLaunch, consumeLaunchRequest, LaunchRequest
interface TerminalStore {
  launchQueue: LaunchRequest[];
  requestLaunch: (req: LaunchRequest) => void;
  consumeLaunchRequest: () => LaunchRequest | null;

  // ─── Config ──────────────────────────────────────────────────────────────
  defaultCwd: string;

  // ─── Terminal Instances ──────────────────────────────────────────────────
  // _terminalCounter, terminals, nextTerminalNumber, addTerminal, removeTerminal, updateTerminal
  _terminalCounter: number;
  terminals: Terminal[];
  nextTerminalNumber: () => number;
  addTerminal: (t: Terminal) => void;
  removeTerminal: (id: string) => void;
  updateTerminal: (id: string, patch: Partial<Terminal>) => void;

  // ─── Theme ───────────────────────────────────────────────────────────────
  // theme, followAppTheme, setTheme, setFollowAppTheme (+ auto-sync with themeStore)
  theme: TerminalTheme;
  followAppTheme: boolean;
  setTheme: (t: TerminalTheme) => void;
  setFollowAppTheme: (v: boolean) => void;

  // ─── Groups ──────────────────────────────────────────────────────────────
  // groups, addGroup, removeGroup, renameGroup, toggleGroupCollapse,
  // moveTerminalToGroup, reorderTerminals, reorderTerminalInGroup
  groups: TerminalGroup[];
  addGroup: (label: string, isProjectGroup?: boolean) => string;
  removeGroup: (id: string) => void;
  renameGroup: (id: string, label: string) => void;
  toggleGroupCollapse: (id: string) => void;
  moveTerminalToGroup: (terminalId: string, groupId: string | null) => void;
  reorderTerminals: (pane: PanePosition, fromIndex: number, toIndex: number) => void;
  reorderTerminalInGroup: (sourceId: string, targetId: string) => void;

  // ─── Cross-Store Coordination ─────────────────────────────────────────────
  // moveTerminalToPane (coordinates with workspaceStore for pane activeId)
  moveTerminalToPane: (terminalId: string, targetPane: PanePosition) => void;
}

export const useTerminalStore = create<TerminalStore>((set, get) => ({
  // Launch queue
  launchQueue: [],
  requestLaunch: (req) => set(state => ({
    launchQueue: [...state.launchQueue, req],
  })),
  consumeLaunchRequest: () => {
    const queue = get().launchQueue;
    if (queue.length === 0) return null;
    const [first, ...rest] = queue;
    set({ launchQueue: rest });
    return first;
  },

  // Config
  defaultCwd: localStorage.getItem('devhub_terminal_default_cwd') || DEFAULT_CWD,

  // Terminal instances
  _terminalCounter: 0,
  terminals: [],
  nextTerminalNumber: () => {
    const state = get();
    const next = state._terminalCounter + 1;
    set({ _terminalCounter: next });
    return next;
  },
  addTerminal: (t) => set(state => ({ terminals: [...state.terminals, t] })),
  removeTerminal: (id) => set(state => ({
    terminals: state.terminals.filter(t => t.id !== id),
  })),
  updateTerminal: (id, patch) => set(state => ({
    terminals: state.terminals.map(t => t.id === id ? { ...t, ...patch } : t),
  })),

  // Theme
  theme: (() => {
    const follow = localStorage.getItem('terminal-follow-app') !== 'false';
    if (follow) {
      return useThemeStore.getState().mode === 'light' ? 'light' : 'dark';
    }
    const saved = localStorage.getItem('terminal-theme');
    if (saved && ['dark', 'modern', 'matrix', 'light'].includes(saved)) {
      return saved as TerminalTheme;
    }
    return 'dark' as TerminalTheme;
  })(),
  followAppTheme: localStorage.getItem('terminal-follow-app') !== 'false',
  setTheme: (t) => {
    localStorage.setItem('terminal-theme', t);
    localStorage.setItem('terminal-follow-app', 'false');
    set({ theme: t, followAppTheme: false });
  },
  setFollowAppTheme: (v) => {
    localStorage.setItem('terminal-follow-app', String(v));
    set({ followAppTheme: v });
    if (v) {
      const appMode = useThemeStore.getState().mode;
      const newTheme: TerminalTheme = appMode === 'light' ? 'light' : 'dark';
      localStorage.setItem('terminal-theme', newTheme);
      set({ theme: newTheme });
    }
  },

  // Groups
  groups: [],
  addGroup: (label, isProjectGroup = false) => {
    const id = isProjectGroup ? `project-${label}` : `custom-${Math.random().toString(36).slice(2, 8)}`;
    const exists = get().groups.find(g => g.id === id);
    if (exists) return id;
    set(state => ({
      groups: [...state.groups, { id, label, isProjectGroup, isCollapsed: false }],
    }));
    return id;
  },
  removeGroup: (id) => {
    const group = get().groups.find(g => g.id === id);
    if (group?.isProjectGroup) return;
    set(state => ({
      groups: state.groups.filter(g => g.id !== id),
      terminals: state.terminals.map(t =>
        t.groupId === id ? { ...t, groupId: null } : t
      ),
    }));
  },
  renameGroup: (id, label) => set(state => ({
    groups: state.groups.map(g => g.id === id ? { ...g, label } : g),
  })),
  toggleGroupCollapse: (id) => set(state => ({
    groups: state.groups.map(g =>
      g.id === id ? { ...g, isCollapsed: !g.isCollapsed } : g
    ),
  })),
  moveTerminalToGroup: (terminalId, groupId) => set(state => ({
    terminals: state.terminals.map(t =>
      t.id === terminalId ? { ...t, groupId } : t
    ),
  })),

  reorderTerminals: (pane, fromIndex, toIndex) => set(state => {
    // Get indices of terminals for this pane in the full array
    const paneIndices: number[] = [];
    state.terminals.forEach((t, i) => {
      if (t.pane === pane) paneIndices.push(i);
    });
    if (fromIndex < 0 || fromIndex >= paneIndices.length || toIndex < 0 || toIndex >= paneIndices.length) return state;
    const fullFrom = paneIndices[fromIndex];
    const fullTo = paneIndices[toIndex];
    if (fullFrom === fullTo) return state;
    const next = [...state.terminals];
    const [moved] = next.splice(fullFrom, 1);
    next.splice(fullTo, 0, moved);
    return { terminals: next };
  }),

  reorderTerminalInGroup: (sourceId, targetId) => set(state => {
    const source = state.terminals.find(t => t.id === sourceId);
    const target = state.terminals.find(t => t.id === targetId);
    if (!source || !target || source.pane !== target.pane) return state;
    const sourceGroup = source.groupId || null;
    const targetGroup = target.groupId || null;
    if (sourceGroup !== targetGroup) return state;
    // Get terminals in same pane+group, find indices
    const groupTerminals = state.terminals.filter(
      t => t.pane === source.pane && (t.groupId || null) === sourceGroup
    );
    const fromIdx = groupTerminals.findIndex(t => t.id === sourceId);
    const toIdx = groupTerminals.findIndex(t => t.id === targetId);
    if (fromIdx === -1 || toIdx === -1 || fromIdx === toIdx) return state;
    // Reorder within group
    const reordered = [...groupTerminals];
    const [moved] = reordered.splice(fromIdx, 1);
    reordered.splice(toIdx, 0, moved);
    // Rebuild full array: keep non-group terminals, insert reordered group
    const others = state.terminals.filter(
      t => t.pane !== source.pane || (t.groupId || null) !== sourceGroup
    );
    // Insert reordered terminals at the position of the first group terminal
    const insertAt = state.terminals.findIndex(
      t => t.pane === source.pane && (t.groupId || null) === sourceGroup
    );
    const next = [...others];
    next.splice(insertAt, 0, ...reordered);
    return { terminals: next };
  }),

  // Move terminal between panes
  moveTerminalToPane: (terminalId, targetPane) => {
    const state = get();
    const terminal = state.terminals.find(t => t.id === terminalId);
    if (!terminal || terminal.pane === targetPane) return;

    const sourcePane = terminal.pane;
    const sourceTerminals = state.terminals.filter(t => t.pane === sourcePane && t.id !== terminalId);

    // Update terminal.pane (in terminalStore)
    set({
      terminals: state.terminals.map(t =>
        t.id === terminalId ? { ...t, pane: targetPane } : t
      ),
    });

    // Update pane activeId (in workspaceStore)
    const ws = useWorkspaceStore.getState();
    ws.setActiveId(sourcePane, sourceTerminals.length > 0 ? sourceTerminals[sourceTerminals.length - 1].id : null);
    ws.setActiveId(targetPane, terminalId);
  },
}));

// Auto-sync terminal theme with app theme
let lastMode: 'light' | 'dark' | undefined;
useThemeStore.subscribe((state) => {
  if (state.mode === lastMode) return;
  lastMode = state.mode;
  const { followAppTheme, theme } = useTerminalStore.getState();
  if (!followAppTheme) return;
  const target: TerminalTheme = state.mode === 'light' ? 'light' : 'dark';
  if (theme !== target) {
    localStorage.setItem('terminal-theme', target);
    useTerminalStore.setState({ theme: target });
  }
});
