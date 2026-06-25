import { create } from 'zustand';

interface WorkspaceStore {
  // File explorer selection (multi-select) — visual highlight only
  selectedFiles: string[];
  selectionAnchor: string | null;
  selectFile: (path: string | null, mode?: 'single' | 'toggle' | 'range', visiblePaths?: string[]) => void;
  clearSelection: () => void;

  // Open file in editor (separate from selection so shift/ctrl selects don't trigger open)
  fileToOpen: string | null;
  requestOpenFile: (path: string | null) => void;

  // Reverse sync: editor tells explorer which file is currently active
  activeEditorFile: string | null;
  setActiveEditorFile: (path: string | null) => void;

  // Editor panel visibility
  editorOpen: boolean;
  setEditorOpen: (v: boolean) => void;

  // File rename notification (consumed by CodeEditorPane)
  renamedFile: { oldPath: string; newPath: string } | null;
  setRenamedFile: (v: { oldPath: string; newPath: string } | null) => void;
}

export const useWorkspaceStore = create<WorkspaceStore>((set) => ({
  selectedFiles: [],
  selectionAnchor: null,
  selectFile: (path, mode = 'single', visiblePaths) => set((state) => {
    if (!path) return { selectedFiles: [], selectionAnchor: null };

    if (mode === 'single') {
      return { selectedFiles: [path], selectionAnchor: path };
    }

    if (mode === 'toggle') {
      const exists = state.selectedFiles.includes(path);
      const next = exists
        ? state.selectedFiles.filter((p) => p !== path)
        : [...state.selectedFiles, path];
      return {
        selectedFiles: next,
        selectionAnchor: path,
      };
    }

    // mode === 'range': select from anchor to path using the full visible list
    if (mode === 'range' && state.selectionAnchor && visiblePaths) {
      const anchorIdx = visiblePaths.indexOf(state.selectionAnchor);
      const targetIdx = visiblePaths.indexOf(path);
      if (anchorIdx !== -1 && targetIdx !== -1) {
        const start = Math.min(anchorIdx, targetIdx);
        const end = Math.max(anchorIdx, targetIdx);
        return { selectedFiles: visiblePaths.slice(start, end + 1) };
      }
      return { selectedFiles: [state.selectionAnchor, path] };
    }

    return { selectedFiles: [path], selectionAnchor: path };
  }),
  clearSelection: () => set({ selectedFiles: [], selectionAnchor: null }),

  fileToOpen: null,
  requestOpenFile: (path) => set({ fileToOpen: path }),

  activeEditorFile: null,
  setActiveEditorFile: (path) => set({ activeEditorFile: path, selectedFiles: [], selectionAnchor: null }),

  editorOpen: false,
  setEditorOpen: (v) => set({ editorOpen: v }),

  renamedFile: null,
  setRenamedFile: (v) => set({ renamedFile: v }),
}));
