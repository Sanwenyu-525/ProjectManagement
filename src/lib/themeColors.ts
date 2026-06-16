/**
 * JS-accessible theme color helper.
 * Reads computed CSS variable values for use in contexts where CSS vars can't be used
 * (ECharts options, SVG fills, JS color logic).
 *
 * Call inside component render or useMemo — reads live values so it responds to theme toggle.
 */

export interface ThemeColors {
  primary: string;
  primaryDark: string;
  primaryLight: string;
  accent: string;
  info: string;
  purple: string;
  amber: string;
  text: string;
  textSecondary: string;
  textTertiary: string;
  textMuted: string;
  textDescription: string;
  textPlaceholder: string;
  textLight: string;
  bgBase: string;
  bgSurface: string;
  bgCard: string;
  bgElevated: string;
  bgInput: string;
  border: string;
  borderSubtle: string;
  divider: string;
  statusDone: string;
  statusProgress: string;
  statusTodo: string;
  statusCancel: string;
  diffAddBg: string;
  diffAddText: string;
  diffDelBg: string;
  diffDelText: string;
  diffHunkBg: string;
  wsBg: string;
  wsText: string;
  wsTextSecondary: string;
  wsTextTertiary: string;
  wsBorder: string;
  wsActiveBg: string;
  wsActiveBorder: string;
  wsContentBg: string;
}

let cache: ThemeColors | null = null;
let lastTheme = '';

export function getThemeColors(): ThemeColors {
  const root = document.documentElement;
  const theme = root.getAttribute('data-theme') || 'light';
  if (cache && lastTheme === theme) return cache;

  const s = getComputedStyle(root);
  const v = (name: string) => s.getPropertyValue(name).trim();

  cache = {
    primary: v('--color-primary'),
    primaryDark: v('--color-primary-dark'),
    primaryLight: v('--color-primary-light'),
    accent: v('--color-accent'),
    info: v('--color-info'),
    purple: v('--color-purple'),
    amber: v('--color-amber'),
    text: v('--color-text-primary'),
    textSecondary: v('--color-text-secondary'),
    textTertiary: v('--color-text-tertiary'),
    textMuted: v('--color-text-muted'),
    textDescription: v('--color-text-description'),
    textPlaceholder: v('--color-text-placeholder'),
    textLight: v('--color-text-light'),
    bgBase: v('--color-bg-base'),
    bgSurface: v('--color-bg-surface'),
    bgCard: v('--color-bg-card'),
    bgElevated: v('--color-bg-elevated'),
    bgInput: v('--color-bg-input'),
    border: v('--color-border'),
    borderSubtle: v('--color-border-subtle'),
    divider: v('--color-divider'),
    statusDone: v('--color-status-done'),
    statusProgress: v('--color-status-progress'),
    statusTodo: v('--color-status-todo'),
    statusCancel: v('--color-status-cancel'),
    diffAddBg: v('--color-diff-add-bg'),
    diffAddText: v('--color-diff-add-text'),
    diffDelBg: v('--color-diff-del-bg'),
    diffDelText: v('--color-diff-del-text'),
    diffHunkBg: v('--color-diff-hunk-bg'),
    wsBg: v('--ws-bg'),
    wsText: v('--ws-text'),
    wsTextSecondary: v('--ws-text-secondary'),
    wsTextTertiary: v('--ws-text-tertiary'),
    wsBorder: v('--ws-border'),
    wsActiveBg: v('--ws-active-bg'),
    wsActiveBorder: v('--ws-active-border'),
    wsContentBg: v('--ws-content-bg'),
  };
  lastTheme = theme;
  return cache;
}

/** Invalidate cache when theme changes. Call from theme toggle handler. */
export function invalidateThemeCache() {
  cache = null;
  lastTheme = '';
}
