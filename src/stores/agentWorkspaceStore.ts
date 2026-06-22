import { create } from 'zustand';

const STORAGE_KEYS = {
  panelWidth: 'devhub_agent_panel_width',
} as const;

interface AgentWorkspaceStore {
  panelWidth: number;
  setPanelWidth: (w: number) => void;
}

export const useAgentWorkspaceStore = create<AgentWorkspaceStore>((set) => ({
  panelWidth: (() => {
    const saved = localStorage.getItem(STORAGE_KEYS.panelWidth);
    return saved ? Math.min(600, Math.max(320, Number(saved))) : 400;
  })(),
  setPanelWidth: (w) => {
    const clamped = Math.min(600, Math.max(320, Math.round(w)));
    localStorage.setItem(STORAGE_KEYS.panelWidth, String(clamped));
    set({ panelWidth: clamped });
  },
}));
