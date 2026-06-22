import { create } from 'zustand';

interface KnowledgeStore {
  selectedId: string | null;
  setSelectedId: (id: string | null) => void;
  selectedCategory: string | null;
  setSelectedCategory: (category: string | null) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  editingNoteId: string | null;
  setEditingNoteId: (id: string | null) => void;
}

export const useKnowledgeStore = create<KnowledgeStore>((set) => ({
  selectedId: null,
  setSelectedId: (id) => set({ selectedId: id }),
  selectedCategory: null,
  setSelectedCategory: (category) => set({ selectedCategory: category }),
  searchQuery: '',
  setSearchQuery: (query) => set({ searchQuery: query }),
  editingNoteId: null,
  setEditingNoteId: (id) => set({ editingNoteId: id }),
}));
