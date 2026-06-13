import { create } from 'zustand';
import { DEFAULT_CWD } from '../lib/constants';
import { Terminal, TerminalTheme, PanePosition } from '../shared/terminalTypes';

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

interface PaneState {
  activeId: string | null;
}

interface TerminalStore {
  // Visibility
  terminalOpen: boolean;
  setTerminalOpen: (v: boolean) => void;

  // Launch queue
  launchQueue: LaunchRequest[];
  requestLaunch: (req: LaunchRequest) => void;
  consumeLaunchRequest: () => LaunchRequest | null;

  // Config
  defaultCwd: string;

  // Terminal instances (lifted from TerminalManager)
  terminals: Terminal[];
  addTerminal: (t: Terminal) => void;
  removeTerminal: (id: string) => void;
  updateTerminal: (id: string, patch: Partial<Terminal>) => void;

  // Pane state
  leftPane: PaneState;
  rightPane: PaneState;
  topPane: PaneState;
  bottomPane: PaneState;
  setActiveId: (pane: PanePosition, id: string | null) => void;

  // Theme
  theme: TerminalTheme;
  setTheme: (t: TerminalTheme) => void;

  // Groups
  groups: TerminalGroup[];
  addGroup: (label: string, isProjectGroup?: boolean) => string;
  removeGroup: (id: string) => void;
  renameGroup: (id: string, label: string) => void;
  toggleGroupCollapse: (id: string) => void;
  moveTerminalToGroup: (terminalId: string, groupId: string | null) => void;

  // Split pane - Horizontal
  splitPaneOpen: boolean;
  setSplitPaneOpen: (v: boolean) => void;
  splitRatio: number;
  setSplitRatio: (r: number) => void;
  moveTerminalToPane: (terminalId: string, targetPane: PanePosition) => void;

  // Split pane - Vertical (for right pane)
  splitVerticalOpen: boolean;
  setSplitVerticalOpen: (v: boolean) => void;
  splitVerticalRatio: number;
  setSplitVerticalRatio: (r: number) => void;

  // Tab bar width
  tabBarWidth: number;
  setTabBarWidth: (w: number) => void;
}

export const useTerminalStore = create<TerminalStore>((set, get) => ({
  // Visibility
  terminalOpen: false,
  setTerminalOpen: (v) => set({ terminalOpen: v }),

  // Launch queue
  launchQueue: [],
  requestLaunch: (req) => set(state => ({
    launchQueue: [...state.launchQueue, req],
    terminalOpen: true,
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
  terminals: [],
  addTerminal: (t) => set(state => ({ terminals: [...state.terminals, t] })),
  removeTerminal: (id) => set(state => ({
    terminals: state.terminals.filter(t => t.id !== id),
  })),
  updateTerminal: (id, patch) => set(state => ({
    terminals: state.terminals.map(t => t.id === id ? { ...t, ...patch } : t),
  })),

  // Pane state
  leftPane: { activeId: null },
  rightPane: { activeId: null },
  topPane: { activeId: null },
  bottomPane: { activeId: null },
  setActiveId: (pane, id) => set(() => {
    const paneKey = pane === 'left' ? 'leftPane' : pane === 'right' ? 'rightPane' : pane === 'top' ? 'topPane' : 'bottomPane';
    return { [paneKey]: { activeId: id } };
  }),

  // Theme
  theme: (() => {
    const saved = localStorage.getItem('terminal-theme');
    if (saved && ['dark', 'modern', 'matrix', 'light'].includes(saved)) {
      return saved as TerminalTheme;
    }
    return 'dark' as TerminalTheme;
  })(),
  setTheme: (t) => {
    localStorage.setItem('terminal-theme', t);
    set({ theme: t });
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

  // Split pane
  splitPaneOpen: false,
  setSplitPaneOpen: (v) => set({ splitPaneOpen: v }),
  splitRatio: 0.5,
  setSplitRatio: (r) => set({ splitRatio: Math.min(Math.max(r, 0.2), 0.8) }),

  // Split pane - Vertical (for right pane)
  splitVerticalOpen: false,
  setSplitVerticalOpen: (v) => set({ splitVerticalOpen: v }),
  splitVerticalRatio: 0.5,
  setSplitVerticalRatio: (r) => set({ splitVerticalRatio: Math.min(Math.max(r, 0.2), 0.8) }),

  moveTerminalToPane: (terminalId, targetPane) => {
    const state = get();
    const terminal = state.terminals.find(t => t.id === terminalId);
    if (!terminal || terminal.pane === targetPane) return;

    const sourcePane = terminal.pane;
    const sourceTerminals = state.terminals.filter(t => t.pane === sourcePane && t.id !== terminalId);

    const getPaneKey = (pane: PanePosition) => {
      if (pane === 'left') return 'leftPane';
      if (pane === 'right') return 'rightPane';
      if (pane === 'top') return 'topPane';
      return 'bottomPane';
    };

    set({
      terminals: state.terminals.map(t =>
        t.id === terminalId ? { ...t, pane: targetPane } : t
      ),
      [getPaneKey(sourcePane)]: {
        activeId: sourceTerminals.length > 0
          ? sourceTerminals[sourceTerminals.length - 1].id
          : null,
      },
      [getPaneKey(targetPane)]: {
        activeId: terminalId,
      },
    });
  },

  // Tab bar width
  tabBarWidth: 200,
  setTabBarWidth: (w) => set({ tabBarWidth: Math.min(Math.max(w, 140), 400) }),
}));
