import { create } from 'zustand';
import type { AgentSession } from '../types';

const STORAGE_KEYS = {
  panelWidth: 'devhub_agent_panel_width',
} as const;

interface AgentWorkspaceStore {
  panelWidth: number;
  setPanelWidth: (w: number) => void;

  recentSessions: AgentSession[];
  setRecentSessions: (sessions: AgentSession[]) => void;

  summaryStats: { tasks: number; issues: number; docs: number } | null;
  setSummaryStats: (stats: { tasks: number; issues: number; docs: number } | null) => void;

  lastCommitTime: string | null;
  setLastCommitTime: (time: string | null) => void;
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

  recentSessions: [],
  setRecentSessions: (sessions) => set({ recentSessions: sessions }),

  summaryStats: null,
  setSummaryStats: (stats) => set({ summaryStats: stats }),

  lastCommitTime: null,
  setLastCommitTime: (time) => set({ lastCommitTime: time }),
}));
