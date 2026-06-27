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

  // Global editor drawer (merged from globalEditorStore)
  drawerOpen: boolean;
  setDrawerOpen: (v: boolean) => void;
  toggleDrawer: () => void;

  // File rename notification (consumed by CodeEditorPane)
  renamedFile: { oldPath: string; newPath: string } | null;
  setRenamedFile: (v: { oldPath: string; newPath: string } | null) => void;

  // File delete notification (consumed by CodeEditorPane to close stale tabs)
  deletedFiles: string[];
  setDeletedFiles: (paths: string[]) => void;

  // Preview open request (consumed by CodeEditorPane)
  previewToOpen: string | null;
  requestOpenPreview: (url: string | null) => void;

  // Pending message for Agent (consumed by WorkspacePage to auto-send)
  pendingAgentMessage: string | null;
  setPendingAgentMessage: (msg: string | null) => void;

  // Agent impact warning threshold (files affected before showing warning)
  impactWarningThreshold: number;
  setImpactWarningThreshold: (n: number) => void;

  // Max parallel agents for PlanRuntime
  maxParallelAgents: number;
  setMaxParallelAgents: (n: number) => void;
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
  setActiveEditorFile: (path) => set({ activeEditorFile: path }),

  editorOpen: false,
  setEditorOpen: (v) => set({ editorOpen: v }),

  drawerOpen: (() => { try { return localStorage.getItem('devhub_globalEditorOpen') === 'true'; } catch { return false; } })(),
  setDrawerOpen: (v) => {
    try { localStorage.setItem('devhub_globalEditorOpen', String(v)); } catch { /* ignore */ }
    set({ drawerOpen: v });
  },
  toggleDrawer: () => set((s) => {
    const next = !s.drawerOpen;
    try { localStorage.setItem('devhub_globalEditorOpen', String(next)); } catch { /* ignore */ }
    return { drawerOpen: next };
  }),

  renamedFile: null,
  setRenamedFile: (v) => set({ renamedFile: v }),

  deletedFiles: [],
  setDeletedFiles: (paths) => set({ deletedFiles: paths }),

  previewToOpen: null,
  requestOpenPreview: (url) => set({ previewToOpen: url }),

  pendingAgentMessage: null,
  setPendingAgentMessage: (msg) => set({ pendingAgentMessage: msg }),

  impactWarningThreshold: 10,
  setImpactWarningThreshold: (n) => set({ impactWarningThreshold: n }),

  maxParallelAgents: 3,
  setMaxParallelAgents: (n) => set({ maxParallelAgents: n }),
}));
