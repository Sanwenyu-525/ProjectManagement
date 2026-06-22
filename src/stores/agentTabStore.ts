import { create } from 'zustand';

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

interface AgentTabStore {
  tabs: AgentTab[];
  activeTabId: string | null;

  addTab: () => string;
  switchTab: (tabId: string) => void;
  closeTab: (tabId: string) => void;
  setSessionId: (tabId: string, sessionId: string) => void;
  setLabel: (tabId: string, label: string) => void;
  setCwd: (tabId: string, cwd: string) => void;
  setAgentMode: (tabId: string, mode: 'xterm' | 'gui') => void;
  getActiveTab: () => AgentTab | undefined;
}

export const useAgentTabStore = create<AgentTabStore>((set, get) => {
  const firstTab: AgentTab = { id: generateTabId(), sessionId: null, label: '新对话', cwd: null, agentMode: 'xterm' };
  return {
    tabs: [firstTab],
    activeTabId: firstTab.id,

  addTab: () => {
    const { tabs, activeTabId } = get();
    const activeTab = tabs.find(t => t.id === activeTabId);

    // If current active tab is empty, reuse it
    if (activeTab && !activeTab.sessionId) {
      return activeTab.id;
    }

    const id = generateTabId();
    const newTab: AgentTab = {
      id,
      sessionId: null,
      label: '新对话',
      cwd: null,
      agentMode: 'xterm',
    };
    set({ tabs: [...tabs, newTab], activeTabId: id });
    return id;
  },

  switchTab: (tabId) => {
    set({ activeTabId: tabId });
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
  },

  setSessionId: (tabId, sessionId) => {
    const { tabs } = get();
    set({
      tabs: tabs.map(t => t.id === tabId ? { ...t, sessionId } : t),
    });
  },

  setLabel: (tabId, label) => {
    const { tabs } = get();
    set({
      tabs: tabs.map(t => t.id === tabId ? { ...t, label } : t),
    });
  },

  setCwd: (tabId, cwd) => {
    const { tabs } = get();
    set({
      tabs: tabs.map(t => t.id === tabId ? { ...t, cwd } : t),
    });
  },

  setAgentMode: (tabId, agentMode) => {
    const { tabs } = get();
    set({
      tabs: tabs.map(t => t.id === tabId ? { ...t, agentMode } : t),
    });
  },

  getActiveTab: () => {
    const { tabs, activeTabId } = get();
    return tabs.find(t => t.id === activeTabId);
  },
};
});
