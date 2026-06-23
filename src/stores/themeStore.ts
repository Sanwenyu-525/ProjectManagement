import { create } from 'zustand';

type ThemeMode = 'light' | 'dark';
type AccentColor = 'default' | 'blue' | 'violet' | 'rose';
type FontSize = 'sm' | 'base' | 'lg';
type Density = 'comfortable' | 'compact' | 'dense';

const ACCENT_CLASSES: Record<AccentColor, string> = {
  default: '',
  blue: 'accent-blue',
  violet: 'accent-violet',
  rose: 'accent-rose',
};

const FONT_SIZE_CLASSES: Record<FontSize, string> = {
  sm: 'font-sm',
  base: '',
  lg: 'font-lg',
};

const DENSITY_CLASSES: Record<Density, string> = {
  comfortable: '',
  compact: 'density-compact',
  dense: 'density-dense',
};

function applyAccentToDOM(accent: AccentColor) {
  const el = document.documentElement;
  // Remove all accent classes
  Object.values(ACCENT_CLASSES).forEach(cls => { if (cls) el.classList.remove(cls); });
  // Add selected
  const cls = ACCENT_CLASSES[accent];
  if (cls) el.classList.add(cls);
}

function applyFontSizeToDOM(fontSize: FontSize) {
  const el = document.documentElement;
  Object.values(FONT_SIZE_CLASSES).forEach(cls => { if (cls) el.classList.remove(cls); });
  const cls = FONT_SIZE_CLASSES[fontSize];
  if (cls) el.classList.add(cls);
}

function applyDensityToDOM(density: Density) {
  const el = document.documentElement;
  Object.values(DENSITY_CLASSES).forEach(cls => { if (cls) el.classList.remove(cls); });
  const cls = DENSITY_CLASSES[density];
  if (cls) el.classList.add(cls);
}

interface ThemeState {
  mode: ThemeMode;
  accent: AccentColor;
  fontSize: FontSize;
  density: Density;
  toggle: () => void;
  setMode: (m: ThemeMode) => void;
  setAccent: (a: AccentColor) => void;
  setFontSize: (fs: FontSize) => void;
  setDensity: (d: Density) => void;
}

export const useThemeStore = create<ThemeState>((set) => ({
  mode: (localStorage.getItem('app_theme') as ThemeMode) || 'light',
  accent: (localStorage.getItem('app_accent') as AccentColor) || 'default',
  fontSize: (localStorage.getItem('app_fontSize') as FontSize) || 'base',
  density: (localStorage.getItem('app_density') as Density) || 'comfortable',

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

  setAccent: (a) => {
    localStorage.setItem('app_accent', a);
    applyAccentToDOM(a);
    set({ accent: a });
  },

  setFontSize: (fs) => {
    localStorage.setItem('app_fontSize', fs);
    applyFontSizeToDOM(fs);
    set({ fontSize: fs });
  },

  setDensity: (d) => {
    localStorage.setItem('app_density', d);
    applyDensityToDOM(d);
    set({ density: d });
  },
}));

// Apply persisted values on load (called from Root component)
export function initThemeFromStorage() {
  const accent = (localStorage.getItem('app_accent') as AccentColor) || 'default';
  const fontSize = (localStorage.getItem('app_fontSize') as FontSize) || 'base';
  applyAccentToDOM(accent);
  applyFontSizeToDOM(fontSize);
  const density = (localStorage.getItem('app_density') as Density) || 'comfortable';
  applyDensityToDOM(density);
}
