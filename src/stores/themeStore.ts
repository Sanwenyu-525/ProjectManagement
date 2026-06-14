import { create } from 'zustand';

type ThemeMode = 'light' | 'dark';

interface ThemeState {
  mode: ThemeMode;
  toggle: () => void;
  setMode: (m: ThemeMode) => void;
}

export const useThemeStore = create<ThemeState>((set) => ({
  mode: (localStorage.getItem('app_theme') as ThemeMode) || 'light',
  toggle: () =>
    set((s) => {
      const next = s.mode === 'dark' ? 'light' : 'dark';
      localStorage.setItem('app_theme', next);
      return { mode: next };
    }),
  setMode: (m) => {
    localStorage.setItem('app_theme', m);
    set({ mode: m });
  },
}));
