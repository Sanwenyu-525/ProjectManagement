import { create } from 'zustand';
import type { PromptPhase, PromptTemplate } from '../features/workspace/agent/promptTemplates';

interface AgentPromptStore {
  activePhase: PromptPhase | 'all';
  setActivePhase: (phase: PromptPhase | 'all') => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  selectedTemplate: PromptTemplate | null;
  setSelectedTemplate: (template: PromptTemplate | null) => void;
  showOptimize: boolean;
  setShowOptimize: (show: boolean) => void;
}

export const useAgentPromptStore = create<AgentPromptStore>((set) => ({
  activePhase: 'all',
  setActivePhase: (phase) => set({ activePhase: phase }),
  searchQuery: '',
  setSearchQuery: (query) => set({ searchQuery: query }),
  selectedTemplate: null,
  setSelectedTemplate: (template) => set({ selectedTemplate: template }),
  showOptimize: false,
  setShowOptimize: (show) => set({ showOptimize: show }),
}));
