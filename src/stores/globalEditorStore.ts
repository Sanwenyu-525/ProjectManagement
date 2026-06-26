import { create } from 'zustand';

interface GlobalEditorStore {
  // Drawer visibility
  drawerOpen: boolean;
  setDrawerOpen: (v: boolean) => void;
  toggleDrawer: () => void;

  // Open file request
  fileToOpen: string | null;
  requestOpenFile: (path: string | null) => void;

  // Sync events from FileExplorer
  renamedFile: { oldPath: string; newPath: string } | null;
  setRenamedFile: (v: { oldPath: string; newPath: string } | null) => void;
  deletedFiles: string[];
  setDeletedFiles: (paths: string[]) => void;
}

export const useGlobalEditorStore = create<GlobalEditorStore>((set) => ({
  drawerOpen: localStorage.getItem('devhub_globalEditorOpen') === 'true',
  setDrawerOpen: (v) => {
    localStorage.setItem('devhub_globalEditorOpen', String(v));
    set({ drawerOpen: v });
  },
  toggleDrawer: () => set((s) => {
    const next = !s.drawerOpen;
    localStorage.setItem('devhub_globalEditorOpen', String(next));
    return { drawerOpen: next };
  }),

  fileToOpen: null,
  requestOpenFile: (path) => set({ fileToOpen: path }),

  renamedFile: null,
  setRenamedFile: (v) => set({ renamedFile: v }),
  deletedFiles: [],
  setDeletedFiles: (paths) => set({ deletedFiles: paths }),
}));
