import { create } from 'zustand';

interface MemoryStore {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  selectedMemoryId: string | null;
  setSelectedMemoryId: (id: string | null) => void;
  showCreateModal: boolean;
  setShowCreateModal: (show: boolean) => void;
  showDecisionModal: boolean;
  setShowDecisionModal: (show: boolean) => void;
}

export const useMemoryStore = create<MemoryStore>((set) => ({
  searchQuery: '',
  setSearchQuery: (query) => set({ searchQuery: query }),
  selectedMemoryId: null,
  setSelectedMemoryId: (id) => set({ selectedMemoryId: id }),
  showCreateModal: false,
  setShowCreateModal: (show) => set({ showCreateModal: show }),
  showDecisionModal: false,
  setShowDecisionModal: (show) => set({ showDecisionModal: show }),
}));
