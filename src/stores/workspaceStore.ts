import { create } from 'zustand';
import type { PaneNode, PaneLeaf, PaneSplit, PaneTab, WorkspaceLayout } from '../shared/workspace/types';
import { findLeaf, getAllLeaves } from '../shared/workspace/treeUtils';
import { workspacesApi } from '../api';

// ── Browser log types (ephemeral, not persisted) ──

export interface ConsoleLogEntry {
  id: number;
  method: 'error' | 'warn' | 'log';
  args: string[];
  timestamp: number;
}

export interface NetworkRequestEntry {
  id: number;
  method: string;
  url: string;
  status: number;
  duration: number;
  timestamp: number;
}

interface BrowserLogs {
  consoleLogs: ConsoleLogEntry[];
  networkRequests: NetworkRequestEntry[];
}

// ── Test report types (ephemeral, localStorage-backed) ──

export interface TestReportStep {
  index: number;
  action: string;
  label: string;
  pass: boolean;
  detail?: string;
  duration: number;
}

export interface TestReport {
  id: string;
  name: string;
  browserTabId: string;
  timestamp: number;
  steps: TestReportStep[];
  summary: {
    passed: number;
    failed: number;
    total: number;
    duration: number;
  };
}

const uid = () => Math.random().toString(36).slice(2, 10);
const MAX_LOG_SIZE = 500;
const LOG_FLUSH_INTERVAL = 100; // ms

// ── Batched log buffer ──

let pendingConsole: Record<string, ConsoleLogEntry[]> = {};
let pendingNetwork: Record<string, NetworkRequestEntry[]> = {};
let logFlushTimer: ReturnType<typeof setTimeout> | null = null;
let logFlushSet: ((partial: WorkspaceStore | ((state: WorkspaceStore) => Partial<WorkspaceStore>)) => void) | null = null;
let logFlushGet: (() => WorkspaceStore) | null = null;

function flushLogs() {
  logFlushTimer = null;
  if (!logFlushSet || !logFlushGet) return;
  const consoleEntries = pendingConsole;
  const networkEntries = pendingNetwork;
  if (Object.keys(consoleEntries).length === 0 && Object.keys(networkEntries).length === 0) return;
  pendingConsole = {};
  pendingNetwork = {};

  logFlushSet(state => {
    let browserLogs = state.browserLogs;
    for (const [tabId, entries] of Object.entries(consoleEntries)) {
      const existing = browserLogs[tabId] || { consoleLogs: [], networkRequests: [] };
      const newLogs = [...existing.consoleLogs, ...entries];
      if (newLogs.length > MAX_LOG_SIZE) newLogs.splice(0, newLogs.length - MAX_LOG_SIZE);
      browserLogs = { ...browserLogs, [tabId]: { ...existing, consoleLogs: newLogs } };
    }
    for (const [tabId, entries] of Object.entries(networkEntries)) {
      const existing = browserLogs[tabId] || { consoleLogs: [], networkRequests: [] };
      const newReqs = [...existing.networkRequests, ...entries];
      if (newReqs.length > MAX_LOG_SIZE) newReqs.splice(0, newReqs.length - MAX_LOG_SIZE);
      browserLogs = { ...browserLogs, [tabId]: { ...existing, networkRequests: newReqs } };
    }
    return { browserLogs };
  });
}

function scheduleFlush() {
  if (logFlushTimer) return;
  logFlushTimer = setTimeout(flushLogs, LOG_FLUSH_INTERVAL);
}

// ── Git change types (for FilePane diff) ──

export interface GitChange {
  path: string;
  status: string;
  staged: boolean;
}

// ── Tree utilities (store-private) ──

function mapNode(node: PaneNode, fn: (n: PaneNode) => PaneNode, depth = 0): PaneNode {
  if (depth > 50) {
    console.error('[mapNode] max depth exceeded — possible tree corruption', node);
    return node;
  }
  const mapped = fn(node);
  if (mapped.type === 'leaf') return mapped;
  return { ...mapped, children: mapped.children.map(c => mapNode(c, fn, depth + 1)) };
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

const LS_PREFIX = 'devhub_workspace_';
let saveTimer: ReturnType<typeof setTimeout> | null = null;

function lsKey(workspaceId: string | null) {
  return workspaceId ? `${LS_PREFIX}${workspaceId}` : `${LS_PREFIX}default`;
}

function loadLocal(workspaceId: string | null): WorkspaceLayout | null {
  try {
    const raw = localStorage.getItem(lsKey(workspaceId));
    if (!raw) return null;
    return JSON.parse(raw) as WorkspaceLayout;
  } catch {
    return null;
  }
}

function saveLocal(root: PaneNode, tabs: Record<string, PaneTab>, workspaceId: string | null) {
  try {
    localStorage.setItem(lsKey(workspaceId), JSON.stringify({ root, tabs }));
  } catch { /* quota exceeded, ignore */ }
}

function scheduleBackendSave(workspaceId: string | null, root: PaneNode, tabs: Record<string, PaneTab>) {
  if (saveTimer) clearTimeout(saveTimer);
  // Always save to localStorage as fast backup
  saveLocal(root, tabs, workspaceId);
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
  splitPane: (leafId: string, tabId: string, direction?: 'horizontal' | 'vertical', ratio?: number, newFirst?: boolean) => void;
  closePane: (leafId: string) => void;

  // Tab management
  addTab: (leafId: string, tab: PaneTab) => void;
  closeTab: (tabId: string) => void;
  setActiveTab: (leafId: string, tabId: string) => void;
  updateTabLabel: (tabId: string, label: string) => void;
  setTabNamePinned: (tabId: string, pinned: boolean) => void;

  // Layout
  updateSizes: (splitId: string, sizes: number[]) => void;
  getActiveTabId: (leafId: string) => string | null;
  getAllLeaves: () => PaneLeaf[];
  resetLayout: () => void;

  // Focus
  setFocusedLeaf: (leafId: string | null) => void;

  // Tab reordering (used by drag-and-drop)
  reorderTabs: (leafId: string, tabIds: string[]) => void;
  sortLeafTabs: (leafId: string, compareFn: (a: PaneTab, b: PaneTab) => number) => void;

  // Workspace switching
  setActiveWorkspace: (id: string | null) => void;
  loadWorkspaceLayout: (id: string) => Promise<void>;

  // Browser navigation
  updateBrowserUrl: (tabId: string, url: string) => void;
  goBack: (tabId: string) => void;
  goForward: (tabId: string) => void;

  // Browser devtools (ephemeral, keyed by tabId)
  browserLogs: Record<string, BrowserLogs>;
  pushConsoleLog: (tabId: string, entry: ConsoleLogEntry) => void;
  pushNetworkRequest: (tabId: string, entry: NetworkRequestEntry) => void;
  clearBrowserLogs: (tabId: string) => void;
  browserPanelState: Record<string, 'none' | 'console' | 'network'>;
  setBrowserActivePanel: (tabId: string, panel: 'none' | 'console' | 'network') => void;

  // Browser automation (ephemeral)
  browserAutomation: Record<string, { status: 'idle' | 'running'; lastResult: string }>;
  setBrowserAutomation: (tabId: string, patch: { status?: 'idle' | 'running'; lastResult?: string }) => void;

  // Test reports (ephemeral, localStorage-backed)
  testReports: TestReport[];
  addTestReport: (report: TestReport) => void;
  clearTestReports: () => void;

  // File panel state (ephemeral, keyed by FileTab id)
  filePanelState: Record<string, {
    expandedDirs: Set<string>;
    selectedFile: string | null;
    fileContent: string | null;
    originalContent: string | null;
    language: string;
    isBinary: boolean;
    isWritable: boolean;
    loading: boolean;
    gitChanges: GitChange[];
    diffTarget: string | null;
    diffOriginal: string | null;
    diffLoading: boolean;
  }>;
  toggleFileDir: (tabId: string, dirPath: string) => void;
  selectFile: (tabId: string, filePath: string | null) => void;
  setFileContent: (tabId: string, content: string, original: string, language: string, isBinary: boolean, isWritable: boolean) => void;
  updateFileContent: (tabId: string, content: string) => void;
  setFileLoading: (tabId: string, loading: boolean) => void;
  clearFileDirty: (tabId: string) => void;
  setGitChanges: (tabId: string, changes: GitChange[]) => void;
  openDiff: (tabId: string, filePath: string, headContent: string) => void;
  closeDiff: (tabId: string) => void;
}

const initialWsId = localStorage.getItem('devhub_active_workspace');
const initial = (initialWsId ? loadLocal(initialWsId) : null) || createDefaultLayout();

export const useWorkspaceStore = create<WorkspaceStore>((set, get) => {
  // Wire up batched log flush
  logFlushSet = set;
  logFlushGet = get as () => WorkspaceStore;

  return {
  root: initial.root,
  tabs: initial.tabs,
  activeWorkspaceId: localStorage.getItem('devhub_active_workspace'),
  focusedLeafId: null,
  browserLogs: {},
  browserPanelState: {},
  browserAutomation: {},
  testReports: JSON.parse(localStorage.getItem('devhub_test_reports') || '[]'),
  filePanelState: {},

  splitPane: (leafId, tabId, direction = 'horizontal', ratio = 0.5, newFirst = false) => {
    set(state => {
      const leaf = findLeaf(state.root, leafId);
      if (!leaf) return state;

      const newLeaf: PaneLeaf = {
        type: 'leaf',
        id: `pane-${uid()}`,
        tabIds: [tabId],
        activeTabId: tabId,
      };

      // Give the remaining pane a new ID so mapNode's fn won't match it again
      const updatedLeaf: PaneLeaf = {
        type: 'leaf',
        id: `pane-${uid()}`,
        tabIds: leaf.tabIds.filter(id => id !== tabId),
        activeTabId: leaf.tabIds.filter(id => id !== tabId).slice(-1)[0] || null,
      };

      const newSplit: PaneSplit = {
        type: 'split',
        id: `split-${uid()}`,
        direction,
        children: newFirst ? [newLeaf, updatedLeaf] : [updatedLeaf, newLeaf],
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
      // Initialize file panel state for file tabs
      const filePanelState = tab.contentType === 'file'
        ? {
            ...state.filePanelState,
            [tab.id]: {
              expandedDirs: new Set<string>(),
              selectedFile: null as string | null,
              fileContent: null as string | null,
              originalContent: null as string | null,
              language: 'text',
              isBinary: false,
              isWritable: true,
              loading: false,
              gitChanges: [] as GitChange[],
              diffTarget: null as string | null,
              diffOriginal: null as string | null,
              diffLoading: false,
            },
          }
        : state.filePanelState;
      scheduleBackendSave(state.activeWorkspaceId, root, tabs);
      return { root, tabs, filePanelState };
    });
  },

  closeTab: (tabId) => {
    set(state => {
      const { [tabId]: closedTab, ...restTabs } = state.tabs;
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

      // Clean up file panel state for file tabs
      const { [tabId]: _panel, ...restPanel } = state.filePanelState;
      const filePanelState = closedTab?.contentType === 'file' ? restPanel : state.filePanelState;

      scheduleBackendSave(state.activeWorkspaceId, root, restTabs);
      return { root, tabs: restTabs, filePanelState };
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

  updateTabLabel: (tabId, label) => {
    set(state => {
      const tab = state.tabs[tabId];
      if (!tab || tab.label === label) return {};
      const tabs = { ...state.tabs, [tabId]: { ...tab, label } };
      scheduleBackendSave(state.activeWorkspaceId, state.root, tabs);
      return { tabs };
    });
  },

  setTabNamePinned: (tabId, pinned) => {
    set(state => {
      const tab = state.tabs[tabId];
      if (!tab) return {};
      const tabs = { ...state.tabs, [tabId]: { ...tab, namePinned: pinned } };
      scheduleBackendSave(state.activeWorkspaceId, state.root, tabs);
      return { tabs };
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

  reorderTabs: (leafId, tabIds) => {
    set(state => {
      const root = mapNode(state.root, n =>
        n.type === 'leaf' && n.id === leafId ? { ...n, tabIds } : n
      );
      scheduleBackendSave(state.activeWorkspaceId, root, state.tabs);
      return { root };
    });
  },

  sortLeafTabs: (leafId, compareFn) => {
    set(state => {
      const tabs = state.tabs;
      const root = mapNode(state.root, n => {
        if (n.type !== 'leaf' || n.id !== leafId) return n;
        const sorted = [...n.tabIds].sort((a, b) => {
          const ta = tabs[a];
          const tb = tabs[b];
          if (!ta || !tb) return 0;
          return compareFn(ta, tb);
        });
        return { ...n, tabIds: sorted };
      });
      scheduleBackendSave(state.activeWorkspaceId, root, state.tabs);
      return { root };
    });
  },

  loadWorkspaceLayout: async (id) => {
    try {
      // Save current layout to its own localStorage key before switching
      const current = get();
      saveLocal(current.root, current.tabs, current.activeWorkspaceId);

      const layoutJson = await workspacesApi.loadLayout(id);
      if (layoutJson) {
        const layout = JSON.parse(layoutJson) as WorkspaceLayout;
        set({ root: layout.root, tabs: layout.tabs, activeWorkspaceId: id });
        saveLocal(layout.root, layout.tabs, id);
      } else {
        // No saved layout — use default
        const fresh = createDefaultLayout();
        set({ root: fresh.root, tabs: fresh.tabs, activeWorkspaceId: id });
        saveLocal(fresh.root, fresh.tabs, id);
      }
      localStorage.setItem('devhub_active_workspace', id);
    } catch {
      // Fallback to localStorage
      const local = loadLocal(id);
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

  // ── Browser devtools (ephemeral, batched) ──

  pushConsoleLog: (tabId, entry) => {
    (pendingConsole[tabId] ||= []).push(entry);
    scheduleFlush();
  },

  pushNetworkRequest: (tabId, entry) => {
    (pendingNetwork[tabId] ||= []).push(entry);
    scheduleFlush();
  },

  clearBrowserLogs: (tabId) => {
    // Clear pending buffer for this tab before flushing
    delete pendingConsole[tabId];
    delete pendingNetwork[tabId];
    set(state => ({
      browserLogs: {
        ...state.browserLogs,
        [tabId]: { consoleLogs: [], networkRequests: [] },
      },
    }));
  },

  setBrowserActivePanel: (tabId, panel) => {
    set(state => ({
      browserPanelState: { ...state.browserPanelState, [tabId]: panel },
    }));
  },

  setBrowserAutomation: (tabId, patch) => {
    set(state => ({
      browserAutomation: {
        ...state.browserAutomation,
        [tabId]: { ...(state.browserAutomation[tabId] || { status: 'idle', lastResult: '' }), ...patch },
      },
    }));
  },

  addTestReport: (report) => {
    set(state => {
      const reports = [report, ...state.testReports].slice(0, 50);
      localStorage.setItem('devhub_test_reports', JSON.stringify(reports));
      return { testReports: reports };
    });
  },

  clearTestReports: () => {
    localStorage.removeItem('devhub_test_reports');
    set({ testReports: [] });
  },

  // File panel
  toggleFileDir: (tabId, dirPath) => {
    set(state => {
      const existing = state.filePanelState[tabId];
      const panel = existing || {
        expandedDirs: new Set<string>(),
        selectedFile: null as string | null,
        fileContent: null as string | null,
        originalContent: null as string | null,
        language: 'text',
        isBinary: false,
        isWritable: true,
        loading: false,
        gitChanges: [] as GitChange[],
        diffTarget: null as string | null,
        diffOriginal: null as string | null,
        diffLoading: false,
      };
      const expanded = new Set(panel.expandedDirs);
      if (expanded.has(dirPath)) {
        expanded.delete(dirPath);
      } else {
        expanded.add(dirPath);
      }
      return {
        filePanelState: {
          ...state.filePanelState,
          [tabId]: { ...panel, expandedDirs: expanded },
        },
      };
    });
  },

  selectFile: (tabId, filePath) => {
    set(state => {
      const existing = state.filePanelState[tabId];
      const panel = existing || {
        expandedDirs: new Set<string>(),
        selectedFile: null as string | null,
        fileContent: null as string | null,
        originalContent: null as string | null,
        language: 'text',
        isBinary: false,
        isWritable: true,
        loading: false,
        gitChanges: [] as GitChange[],
        diffTarget: null as string | null,
        diffOriginal: null as string | null,
        diffLoading: false,
      };
      return {
        filePanelState: {
          ...state.filePanelState,
          [tabId]: { ...panel, selectedFile: filePath, loading: !!filePath },
        },
      };
    });
  },

  setFileContent: (tabId, content, original, language, isBinary, isWritable) => {
    set(state => {
      const panel = state.filePanelState[tabId];
      if (!panel) return state;
      return {
        filePanelState: {
          ...state.filePanelState,
          [tabId]: {
            ...panel,
            fileContent: content,
            originalContent: original,
            language,
            isBinary,
            isWritable,
            loading: false,
          },
        },
      };
    });
  },

  updateFileContent: (tabId, content) => {
    set(state => {
      const panel = state.filePanelState[tabId];
      if (!panel) return state;
      return {
        filePanelState: {
          ...state.filePanelState,
          [tabId]: { ...panel, fileContent: content },
        },
      };
    });
  },

  setFileLoading: (tabId, loading) => {
    set(state => {
      const panel = state.filePanelState[tabId];
      if (!panel) return state;
      return {
        filePanelState: {
          ...state.filePanelState,
          [tabId]: { ...panel, loading },
        },
      };
    });
  },

  clearFileDirty: (tabId) => {
    set(state => {
      const panel = state.filePanelState[tabId];
      if (!panel || panel.fileContent === null) return state;
      return {
        filePanelState: {
          ...state.filePanelState,
          [tabId]: { ...panel, originalContent: panel.fileContent },
        },
      };
    });
  },

  setGitChanges: (tabId, changes) => {
    set(state => {
      const panel = state.filePanelState[tabId];
      if (!panel) return state;
      return {
        filePanelState: {
          ...state.filePanelState,
          [tabId]: { ...panel, gitChanges: changes },
        },
      };
    });
  },

  openDiff: (tabId, filePath, headContent) => {
    set(state => {
      const panel = state.filePanelState[tabId];
      if (!panel) return state;
      return {
        filePanelState: {
          ...state.filePanelState,
          [tabId]: { ...panel, diffTarget: filePath, diffOriginal: headContent, diffLoading: false },
        },
      };
    });
  },

  closeDiff: (tabId) => {
    set(state => {
      const panel = state.filePanelState[tabId];
      if (!panel) return state;
      return {
        filePanelState: {
          ...state.filePanelState,
          [tabId]: { ...panel, diffTarget: null, diffOriginal: null, diffLoading: false },
        },
      };
    });
  },
};
});
