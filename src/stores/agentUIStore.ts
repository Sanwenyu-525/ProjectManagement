import { create } from 'zustand';
import type { PromptPhase, PromptTemplate } from '../features/workspace/agent/promptTemplates';

const STORAGE_KEYS = {
  panelWidth: 'devhub_agent_panel_width',
  panelCollapsed: 'devhub_agent_panel_collapsed',
} as const;

interface AgentUIStore {
  // Prompt panel state (from agentPromptStore)
  activePhase: PromptPhase | 'all';
  setActivePhase: (phase: PromptPhase | 'all') => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  selectedTemplate: PromptTemplate | null;
  setSelectedTemplate: (template: PromptTemplate | null) => void;
  showOptimize: boolean;
  setShowOptimize: (show: boolean) => void;

  // Panel layout state (from agentWorkspaceStore)
  panelWidth: number;
  panelCollapsed: boolean;
  setPanelWidth: (w: number) => void;
  togglePanelCollapsed: () => void;
}

export const useAgentUIStore = create<AgentUIStore>((set) => ({
  // Prompt panel
  activePhase: 'all',
  setActivePhase: (phase) => set({ activePhase: phase }),
  searchQuery: '',
  setSearchQuery: (query) => set({ searchQuery: query }),
  selectedTemplate: null,
  setSelectedTemplate: (template) => set({ selectedTemplate: template }),
  showOptimize: false,
  setShowOptimize: (show) => set({ showOptimize: show }),

  // Panel layout
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
