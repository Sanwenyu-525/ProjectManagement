import { create } from 'zustand';

interface DiscoveredPreview {
  url: string;
  label: string;
  terminalId: string;
  discoveredAt: number;
}

interface PreviewStore {
  previews: DiscoveredPreview[];
  addPreview: (url: string, terminalId: string) => void;
  removePreviewsByTerminal: (terminalId: string) => void;
}

// Normalize URL for dedup: strip trailing slash, lowercase host
function normalizeUrl(raw: string): string {
  try {
    const u = new URL(raw);
    u.pathname = u.pathname.replace(/\/+$/, '') || '/';
    return u.origin + u.pathname + u.search + u.hash;
  } catch {
    return raw.trim().replace(/\/+$/, '');
  }
}

// Guess a human-friendly label from URL
function guessLabel(url: string): string {
  try {
    const u = new URL(url);
    const port = u.port;
    // Common dev server ports → friendly names
    if (port === '5173' || port === '5174') return 'Vite Dev';
    if (port === '3000') return 'Next.js';
    if (port === '4200') return 'Angular';
    if (port === '6006') return 'Storybook';
    if (port === '8080' || port === '8081') return 'Dev Server';
    if (u.pathname.includes('swagger')) return 'Swagger';
    return u.host;
  } catch {
    return url;
  }
}

export const usePreviewStore = create<PreviewStore>((set, get) => ({
  previews: [],

  addPreview: (rawUrl, terminalId) => {
    const url = normalizeUrl(rawUrl);
    const existing = get().previews.find(p => p.url === url);
    if (existing) return;
    set(state => ({
      previews: [
        ...state.previews,
        { url, label: guessLabel(url), terminalId, discoveredAt: Date.now() },
      ],
    }));
  },

  removePreviewsByTerminal: (terminalId) => {
    set(state => ({
      previews: state.previews.filter(p => p.terminalId !== terminalId),
    }));
  },
}));
