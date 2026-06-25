import { create } from 'zustand';

const STORAGE_KEYS = {
  panelWidth: 'devhub_agent_panel_width',
  panelCollapsed: 'devhub_agent_panel_collapsed',
} as const;

interface AgentWorkspaceStore {
  panelWidth: number;
  panelCollapsed: boolean;
  setPanelWidth: (w: number) => void;
  togglePanelCollapsed: () => void;
}

export const useAgentWorkspaceStore = create<AgentWorkspaceStore>((set) => ({
  panelWidth: (() => {
    const saved = localStorage.getItem(STORAGE_KEYS.panelWidth);
    return saved ? Math.min(600, Math.max(320, Number(saved))) : 400;
  })(),
  panelCollapsed: localStorage.getItem(STORAGE_KEYS.panelCollapsed) === 'true',
  setPanelWidth: (w) => {
    const clamped = Math.min(600, Math.max(320, Math.round(w)));
    localStorage.setItem(STORAGE_KEYS.panelWidth, String(clamped));
    set({ panelWidth: clamped });
  },
  togglePanelCollapsed: () =>
    set((s) => {
      const next = !s.panelCollapsed;
      localStorage.setItem(STORAGE_KEYS.panelCollapsed, String(next));
      return { panelCollapsed: next };
    }),
}));
