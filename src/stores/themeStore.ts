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

const VALID_THEME_MODES = new Set<string>(['light', 'dark']);
const VALID_ACCENT_COLORS = new Set<string>(['default', 'blue', 'violet', 'rose']);
const VALID_FONT_SIZES = new Set<string>(['sm', 'base', 'lg']);
const VALID_DENSITIES = new Set<string>(['comfortable', 'compact', 'dense']);

function readStorage<T extends string>(key: string, valid: Set<string>, fallback: T): T {
  const raw = localStorage.getItem(key);
  return raw && valid.has(raw) ? (raw as T) : fallback;
}

interface ThemeState {
  mode: ThemeMode;
  accent: AccentColor;
  fontSize: FontSize;
  density: Density;
  shortcutsModalOpen: boolean;
  toggle: () => void;
  setMode: (m: ThemeMode) => void;
  setAccent: (a: AccentColor) => void;
  setFontSize: (fs: FontSize) => void;
  setDensity: (d: Density) => void;
  setShortcutsModalOpen: (open: boolean) => void;
  toggleShortcutsModal: () => void;
}

export const useThemeStore = create<ThemeState>((set) => ({
  mode: readStorage('app_theme', VALID_THEME_MODES, 'light'),
  accent: readStorage('app_accent', VALID_ACCENT_COLORS, 'default'),
  fontSize: readStorage('app_fontSize', VALID_FONT_SIZES, 'base'),
  density: readStorage('app_density', VALID_DENSITIES, 'comfortable'),
  shortcutsModalOpen: false,

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

  setShortcutsModalOpen: (open) => set({ shortcutsModalOpen: open }),
  toggleShortcutsModal: () => set((s) => ({ shortcutsModalOpen: !s.shortcutsModalOpen })),
}));

// Apply persisted values on load (called from Root component)
export function initThemeFromStorage() {
  const accent = readStorage('app_accent', VALID_ACCENT_COLORS, 'default');
  const fontSize = readStorage('app_fontSize', VALID_FONT_SIZES, 'base');
  applyAccentToDOM(accent);
  applyFontSizeToDOM(fontSize);
  const density = readStorage('app_density', VALID_DENSITIES, 'comfortable');
  applyDensityToDOM(density);
}
