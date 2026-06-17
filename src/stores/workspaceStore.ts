import { create } from 'zustand';
import { PanePosition } from '../shared/terminalTypes';

interface PaneState {
  activeId: string | null;
}

interface WorkspaceStore {
  // Pane state
  leftPane: PaneState;
  rightPane: PaneState;
  topPane: PaneState;
  bottomPane: PaneState;
  setActiveId: (pane: PanePosition, id: string | null) => void;

  // Split pane - Horizontal
  splitPaneOpen: boolean;
  setSplitPaneOpen: (v: boolean) => void;
  splitRatio: number;
  setSplitRatio: (r: number) => void;

  // Split pane - Vertical (for right pane)
  splitVerticalOpen: boolean;
  setSplitVerticalOpen: (v: boolean) => void;
  splitVerticalRatio: number;
  setSplitVerticalRatio: (r: number) => void;

  // Tab bar width
  tabBarWidth: number;
  setTabBarWidth: (w: number) => void;

  // File explorer selection
  selectedFile: string | null;
  selectFile: (path: string | null) => void;
}

export const useWorkspaceStore = create<WorkspaceStore>((set) => ({
  leftPane: { activeId: null },
  rightPane: { activeId: null },
  topPane: { activeId: null },
  bottomPane: { activeId: null },
  setActiveId: (pane, id) => set(() => {
    const paneKey = pane === 'left' ? 'leftPane' : pane === 'right' ? 'rightPane' : pane === 'top' ? 'topPane' : 'bottomPane';
    return { [paneKey]: { activeId: id } };
  }),

  splitPaneOpen: false,
  setSplitPaneOpen: (v) => set({ splitPaneOpen: v }),
  splitRatio: 0.5,
  setSplitRatio: (r) => set({ splitRatio: Math.min(Math.max(r, 0.2), 0.8) }),

  splitVerticalOpen: false,
  setSplitVerticalOpen: (v) => set({ splitVerticalOpen: v }),
  splitVerticalRatio: 0.5,
  setSplitVerticalRatio: (r) => set({ splitVerticalRatio: Math.min(Math.max(r, 0.2), 0.8) }),

  tabBarWidth: 200,
  setTabBarWidth: (w) => set({ tabBarWidth: Math.min(Math.max(w, 140), 400) }),

  selectedFile: null,
  selectFile: (path) => set({ selectedFile: path ?? null }),
}));
