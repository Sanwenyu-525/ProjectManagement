import { create } from 'zustand';
import type { PaneNode, PaneLeaf, PaneSplit, PaneTab, WorkspaceLayout } from '../shared/workspace/types';
import { workspacesApi } from '../api';

const uid = () => Math.random().toString(36).slice(2, 10);

// ── Tree utilities ──

function mapNode(node: PaneNode, fn: (n: PaneNode) => PaneNode): PaneNode {
  const mapped = fn(node);
  if (mapped.type === 'leaf') return mapped;
  return { ...mapped, children: mapped.children.map(c => mapNode(c, fn)) };
}

function findLeaf(node: PaneNode, id: string): PaneLeaf | null {
  if (node.type === 'leaf') return node.id === id ? node : null;
  for (const child of node.children) {
    const found = findLeaf(child, id);
    if (found) return found;
  }
  return null;
}

function removeNode(root: PaneNode, id: string): PaneNode | null {
  if (root.type === 'leaf') return root.id === id ? null : root;
  const children = root.children
    .map(c => removeNode(c, id))
    .filter((c): c is PaneNode => c !== null);
  if (children.length === 0) return null;
  if (children.length === 1) return children[0];
  const totalOld = root.sizes.reduce((a, b) => a + b, 0);
  const totalNew = children.length;
  return { ...root, children, sizes: children.map(() => totalOld / totalNew) };
}

function getAllLeaves(node: PaneNode): PaneLeaf[] {
  if (node.type === 'leaf') return [node];
  return node.children.flatMap(getAllLeaves);
}

// ── Default layout ──

function createDefaultLayout(): WorkspaceLayout {
  const id = `pane-${uid()}`;
  return {
    root: {
      type: 'leaf',
      id,
      tabIds: [],
      activeTabId: null,
    },
    tabs: {},
  };
}

// ── Persistence ──

const LS_KEY = 'devhub_workspace_layout';
let saveTimer: ReturnType<typeof setTimeout> | null = null;

function loadLocal(): WorkspaceLayout | null {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as WorkspaceLayout;
  } catch {
    return null;
  }
}

function saveLocal(root: PaneNode, tabs: Record<string, PaneTab>) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify({ root, tabs }));
  } catch { /* quota exceeded, ignore */ }
}

function scheduleBackendSave(workspaceId: string | null, root: PaneNode, tabs: Record<string, PaneTab>) {
  if (saveTimer) clearTimeout(saveTimer);
  // Always save to localStorage as fast backup
  saveLocal(root, tabs);
  // Debounce backend save
  if (!workspaceId) return;
  saveTimer = setTimeout(() => {
    const layout = JSON.stringify({ root, tabs });
    workspacesApi.saveLayout(workspaceId, layout).catch(() => {});
  }, 500);
}

// ── Store ──

interface WorkspaceStore extends WorkspaceLayout {
  activeWorkspaceId: string | null;
  focusedLeafId: string | null;

  // Tree mutations
  splitPane: (leafId: string, tabId: string, direction?: 'horizontal' | 'vertical', ratio?: number) => void;
  closePane: (leafId: string) => void;

  // Tab management
  addTab: (leafId: string, tab: PaneTab) => void;
  closeTab: (tabId: string) => void;
  setActiveTab: (leafId: string, tabId: string) => void;

  // Layout
  updateSizes: (splitId: string, sizes: number[]) => void;
  getActiveTabId: (leafId: string) => string | null;
  getAllLeaves: () => PaneLeaf[];
  resetLayout: () => void;

  // Focus
  setFocusedLeaf: (leafId: string | null) => void;

  // Workspace switching
  setActiveWorkspace: (id: string | null) => void;
  loadWorkspaceLayout: (id: string) => Promise<void>;

  // Browser navigation
  updateBrowserUrl: (tabId: string, url: string) => void;
  goBack: (tabId: string) => void;
  goForward: (tabId: string) => void;
}

const initial = loadLocal() || createDefaultLayout();

export const useWorkspaceStore = create<WorkspaceStore>((set, get) => ({
  root: initial.root,
  tabs: initial.tabs,
  activeWorkspaceId: localStorage.getItem('devhub_active_workspace'),
  focusedLeafId: null,

  splitPane: (leafId, tabId, direction = 'horizontal', ratio = 0.5) => {
    set(state => {
      const leaf = findLeaf(state.root, leafId);
      if (!leaf) return state;

      const newLeaf: PaneLeaf = {
        type: 'leaf',
        id: `pane-${uid()}`,
        tabIds: [tabId],
        activeTabId: tabId,
      };

      const updatedLeaf: PaneLeaf = {
        ...leaf,
        tabIds: leaf.tabIds.filter(id => id !== tabId),
        activeTabId: leaf.tabIds.filter(id => id !== tabId).slice(-1)[0] || null,
      };

      const newSplit: PaneSplit = {
        type: 'split',
        id: `split-${uid()}`,
        direction,
        children: [updatedLeaf, newLeaf],
        sizes: [ratio, 1 - ratio],
      };

      const root = mapNode(state.root, n =>
        n.type === 'leaf' && n.id === leafId ? newSplit : n
      );

      scheduleBackendSave(state.activeWorkspaceId, root, state.tabs);
      return { root };
    });
  },

  closePane: (leafId) => {
    set(state => {
      const root = removeNode(state.root, leafId);
      if (!root) {
        const fresh = createDefaultLayout();
        scheduleBackendSave(state.activeWorkspaceId, fresh.root, fresh.tabs);
        return fresh;
      }
      scheduleBackendSave(state.activeWorkspaceId, root, state.tabs);
      return { root };
    });
  },

  addTab: (leafId, tab) => {
    set(state => {
      const root = mapNode(state.root, n => {
        if (n.type !== 'leaf' || n.id !== leafId) return n;
        if (n.tabIds.includes(tab.id)) return n;
        return { ...n, tabIds: [...n.tabIds, tab.id], activeTabId: tab.id };
      });
      const tabs = { ...state.tabs, [tab.id]: tab };
      scheduleBackendSave(state.activeWorkspaceId, root, tabs);
      return { root, tabs };
    });
  },

  closeTab: (tabId) => {
    set(state => {
      const { [tabId]: _, ...restTabs } = state.tabs;
      let root = mapNode(state.root, n => {
        if (n.type !== 'leaf') return n;
        if (!n.tabIds.includes(tabId)) return n;
        const tabIds = n.tabIds.filter(id => id !== tabId);
        const activeTabId = n.activeTabId === tabId
          ? (tabIds.slice(-1)[0] || null)
          : n.activeTabId;
        return { ...n, tabIds, activeTabId };
      });

      const leaves = getAllLeaves(root);
      if (leaves.length > 1) {
        for (const leaf of leaves) {
          if (leaf.tabIds.length === 0) {
            const after = removeNode(root, leaf.id);
            if (after) root = after;
          }
        }
      }

      scheduleBackendSave(state.activeWorkspaceId, root, restTabs);
      return { root, tabs: restTabs };
    });
  },

  setActiveTab: (leafId, tabId) => {
    set(state => {
      const root = mapNode(state.root, n =>
        n.type === 'leaf' && n.id === leafId
          ? { ...n, activeTabId: tabId }
          : n
      );
      scheduleBackendSave(state.activeWorkspaceId, root, state.tabs);
      return { root };
    });
  },

  updateSizes: (splitId, sizes) => {
    set(state => {
      const root = mapNode(state.root, n =>
        n.type === 'split' && n.id === splitId
          ? { ...n, sizes }
          : n
      );
      scheduleBackendSave(state.activeWorkspaceId, root, state.tabs);
      return { root };
    });
  },

  getActiveTabId: (leafId) => {
    const leaf = findLeaf(get().root, leafId);
    return leaf?.activeTabId ?? null;
  },

  getAllLeaves: () => getAllLeaves(get().root),

  resetLayout: () => {
    const fresh = createDefaultLayout();
    scheduleBackendSave(get().activeWorkspaceId, fresh.root, fresh.tabs);
    set(fresh);
  },

  setActiveWorkspace: (id) => {
    localStorage.setItem('devhub_active_workspace', id || '');
    set({ activeWorkspaceId: id });
  },

  setFocusedLeaf: (leafId) => set({ focusedLeafId: leafId }),

  loadWorkspaceLayout: async (id) => {
    try {
      const layoutJson = await workspacesApi.loadLayout(id);
      if (layoutJson) {
        const layout = JSON.parse(layoutJson) as WorkspaceLayout;
        // Clear terminal refs from tabs (terminals don't survive workspace switch)
        set({ root: layout.root, tabs: layout.tabs, activeWorkspaceId: id });
      } else {
        // No saved layout — use default
        const fresh = createDefaultLayout();
        set({ root: fresh.root, tabs: fresh.tabs, activeWorkspaceId: id });
        saveLocal(fresh.root, fresh.tabs);
      }
      localStorage.setItem('devhub_active_workspace', id);
    } catch {
      // Fallback to localStorage
      const local = loadLocal();
      if (local) {
        set({ root: local.root, tabs: local.tabs, activeWorkspaceId: id });
      }
    }
  },

  // ── Browser navigation ──

  updateBrowserUrl: (tabId, url) => {
    set(state => {
      const tab = state.tabs[tabId];
      if (!tab || tab.contentType !== 'browser') return state;
      const history = tab.urlHistory || [];
      const idx = tab.urlHistoryIndex ?? -1;
      const newHistory = [...history.slice(0, idx + 1), url].slice(-50);
      const newTab = { ...tab, url, urlHistory: newHistory, urlHistoryIndex: newHistory.length - 1 };
      const tabs = { ...state.tabs, [tabId]: newTab };
      scheduleBackendSave(state.activeWorkspaceId, state.root, tabs);
      return { tabs };
    });
  },

  goBack: (tabId) => {
    set(state => {
      const tab = state.tabs[tabId];
      if (!tab || tab.contentType !== 'browser') return state;
      const idx = tab.urlHistoryIndex ?? -1;
      if (idx <= 0) return state;
      const newIdx = idx - 1;
      const url = tab.urlHistory![newIdx];
      const newTab = { ...tab, url, urlHistoryIndex: newIdx };
      const tabs = { ...state.tabs, [tabId]: newTab };
      scheduleBackendSave(state.activeWorkspaceId, state.root, tabs);
      return { tabs };
    });
  },

  goForward: (tabId) => {
    set(state => {
      const tab = state.tabs[tabId];
      if (!tab || tab.contentType !== 'browser') return state;
      const idx = tab.urlHistoryIndex ?? -1;
      const history = tab.urlHistory || [];
      if (idx >= history.length - 1) return state;
      const newIdx = idx + 1;
      const url = history[newIdx];
      const newTab = { ...tab, url, urlHistoryIndex: newIdx };
      const tabs = { ...state.tabs, [tabId]: newTab };
      scheduleBackendSave(state.activeWorkspaceId, state.root, tabs);
      return { tabs };
    });
  },
}));
