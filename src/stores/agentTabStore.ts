import { create } from 'zustand';

const STORAGE_KEY = 'agent_tabs';

function generateTabId(): string {
  return `agent-tab-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

interface AgentTab {
  id: string;
  sessionId: string | null;
  label: string;
  cwd: string | null;
  agentMode: 'xterm' | 'gui';
}

interface PersistedTab {
  id: string;
  sessionId: string | null;
  label: string;
  cwd: string | null;
  agentMode: 'xterm' | 'gui';
}

function saveTabsToStorage(tabs: AgentTab[], activeTabId: string | null): void {
  const data: { tabs: PersistedTab[]; activeTabId: string | null } = {
    tabs: tabs.map(t => ({ id: t.id, sessionId: t.sessionId, label: t.label, cwd: t.cwd, agentMode: t.agentMode })),
    activeTabId,
  };
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch { /* quota */ }
}

function loadTabsFromStorage(): { tabs: AgentTab[]; activeTabId: string | null } | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as { tabs: PersistedTab[]; activeTabId: string | null };
    if (!Array.isArray(data.tabs) || data.tabs.length === 0) return null;
    return {
      tabs: data.tabs.map(t => ({
        ...t,
        // xterm buffer can't be restored from DB — switch to GUI so message history loads
        agentMode: t.sessionId && t.agentMode === 'xterm' ? 'gui' : t.agentMode,
      })),
      activeTabId: data.activeTabId,
    };
  } catch { return null; }
}

interface AgentTabStore {
  tabs: AgentTab[];
  activeTabId: string | null;

  addTab: () => string;
  switchTab: (tabId: string) => void;
  closeTab: (tabId: string) => void;
  setSessionId: (tabId: string, sessionId: string | null) => void;
  setLabel: (tabId: string, label: string) => void;
  setCwd: (tabId: string, cwd: string) => void;
  setAgentMode: (tabId: string, mode: 'xterm' | 'gui') => void;
  getActiveTab: () => AgentTab | undefined;
}

export const useAgentTabStore = create<AgentTabStore>((set, get) => {
  const saved = loadTabsFromStorage();
  const initialTabs = saved?.tabs ?? [{ id: generateTabId(), sessionId: null, label: '新对话', cwd: null, agentMode: 'xterm' as const }];
  const initialActiveId = saved?.activeTabId ?? initialTabs[0].id;

  const save = () => {
    const { tabs, activeTabId } = get();
    saveTabsToStorage(tabs, activeTabId);
  };

  return {
    tabs: initialTabs,
    activeTabId: initialActiveId,

  addTab: () => {
    const { tabs } = get();
    const id = generateTabId();
    const newTab: AgentTab = {
      id,
      sessionId: null,
      label: '新对话',
      cwd: null,
      agentMode: 'xterm',
    };
    set({ tabs: [...tabs, newTab], activeTabId: id });
    save();
    return id;
  },

  switchTab: (tabId) => {
    set({ activeTabId: tabId });
    save();
  },

  closeTab: (tabId) => {
    const { tabs, activeTabId } = get();
    const idx = tabs.findIndex(t => t.id === tabId);
    if (idx < 0) return;

    const newTabs = tabs.filter(t => t.id !== tabId);

    // If closing the active tab, switch to adjacent
    let newActiveId = activeTabId;
    if (activeTabId === tabId) {
      if (newTabs.length === 0) {
        // Create a fresh empty tab
        const fresh: AgentTab = { id: generateTabId(), sessionId: null, label: '新对话', cwd: null, agentMode: 'xterm' };
        newTabs.push(fresh);
        newActiveId = fresh.id;
      } else {
        newActiveId = newTabs[Math.min(idx, newTabs.length - 1)]?.id ?? newTabs[0].id;
      }
    }

    set({ tabs: newTabs, activeTabId: newActiveId });
    save();
  },

  setSessionId: (tabId, sessionId) => {
    const { tabs } = get();
    set({
      tabs: tabs.map(t => t.id === tabId ? { ...t, sessionId } : t),
    });
    save();
  },

  setLabel: (tabId, label) => {
    const { tabs } = get();
    set({
      tabs: tabs.map(t => t.id === tabId ? { ...t, label } : t),
    });
    save();
  },

  setCwd: (tabId, cwd) => {
    const { tabs } = get();
    set({
      tabs: tabs.map(t => t.id === tabId ? { ...t, cwd } : t),
    });
    save();
  },

  setAgentMode: (tabId, agentMode) => {
    const { tabs } = get();
    set({
      tabs: tabs.map(t => t.id === tabId ? { ...t, agentMode } : t),
    });
    save();
  },

  getActiveTab: () => {
    const { tabs, activeTabId } = get();
    return tabs.find(t => t.id === activeTabId);
  },
};
});
