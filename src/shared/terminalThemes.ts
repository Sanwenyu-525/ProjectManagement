import { TerminalTheme, TerminalThemeConfig } from './terminalTypes';
import { getThemeColors as getAppThemeColors } from '../lib/themeColors';

const modernTheme: TerminalThemeConfig = {
  name: '现代深灰',
  colors: {
    background: '#0F172A',
    foreground: '#d4d4d4',
    cursor: '#ffffff',
    cursorAccent: '#1e1e1e',
    selectionBackground: '#264f78',
    selectionForeground: '#ffffff',
    black: '#000000',
    red: '#cd3131',
    green: '#00bc00',
    yellow: '#949800',
    blue: '#0451a5',
    magenta: '#bc05bc',
    cyan: '#0598bc',
    white: '#a5a5a5',
    brightBlack: '#666666',
    brightRed: '#cd3131',
    brightGreen: '#14ce14',
    brightYellow: '#b5ba00',
    brightBlue: '#0451a5',
    brightMagenta: '#bc05bc',
    brightCyan: '#0598bc',
    brightWhite: '#ffffff',
  },
};

const matrixTheme: TerminalThemeConfig = {
  name: '绿色终端',
  colors: {
    background: '#0a0a0a',
    foreground: '#00ff00',
    cursor: '#00ff00',
    cursorAccent: '#0a0a0a',
    selectionBackground: '#003300',
    selectionForeground: '#00ff00',
    black: '#0a0a0a',
    red: '#ff0000',
    green: '#00ff00',
    yellow: '#ffff00',
    blue: '#0066ff',
    magenta: '#ff00ff',
    cyan: '#00ffff',
    white: '#00ff00',
    brightBlack: '#003300',
    brightRed: '#ff5555',
    brightGreen: '#55ff55',
    brightYellow: '#ffff55',
    brightBlue: '#5555ff',
    brightMagenta: '#ff55ff',
    brightCyan: '#55ffff',
    brightWhite: '#aaffaa',
  },
};

function buildDarkTheme(): TerminalThemeConfig {
  const tc = getAppThemeColors();
  return {
    name: '石墨深色',
    colors: {
      background: '#0f1722',
      foreground: '#d9e5ef',
      cursor: tc.accent || '#4fdbc8',
      cursorAccent: '#0f1722',
      selectionBackground: tc.primaryLight || 'rgba(79, 219, 200, 0.24)',
      selectionForeground: tc.text || '#e5edf5',
      black: '#0f1722',
      red: tc.statusCancel || '#f87171',
      green: tc.statusDone || '#22c55e',
      yellow: tc.statusProgress || '#f59e0b',
      blue: tc.info || '#38bdf8',
      magenta: tc.purple || '#a78bfa',
      cyan: tc.primary || '#4fdbc8',
      white: '#d9e5ef',
      brightBlack: '#6b7a8c',
      brightRed: '#fca5a5',
      brightGreen: '#4ade80',
      brightYellow: '#fbbf24',
      brightBlue: '#7dd3fc',
      brightMagenta: '#c4b5fd',
      brightCyan: tc.accent || '#4fdbc8',
      brightWhite: '#f8fbff',
    },
  };
}

function buildLightTheme(): TerminalThemeConfig {
  const tc = getAppThemeColors();
  return {
    name: '液态浅色',
    colors: {
      background: '#f7fcff',
      foreground: tc.text || '#172033',
      cursor: tc.primaryDark || '#00423b',
      cursorAccent: 'transparent',
      selectionBackground: tc.primaryLight || 'rgba(0, 107, 95, 0.22)',
      selectionForeground: tc.text || '#172033',
      black: '#f7fcff',
      red: tc.statusCancel || '#dc2626',
      green: tc.statusDone || '#16a34a',
      yellow: tc.statusProgress || '#d97706',
      blue: tc.info || '#0ea5e9',
      magenta: tc.purple || '#7c3aed',
      cyan: '#00838f',
      white: '#4a5568',
      brightBlack: '#5a6672',
      brightRed: '#ef4444',
      brightGreen: '#22c55e',
      brightYellow: '#eab308',
      brightBlue: '#38bdf8',
      brightMagenta: '#7042a3',
      brightCyan: '#00698a',
      brightWhite: '#ffffff',
    },
  };
}

const themeBuilders: Record<TerminalTheme, () => TerminalThemeConfig> = {
  dark: buildDarkTheme,
  light: buildLightTheme,
  modern: () => modernTheme,
  matrix: () => matrixTheme,
};

export function getThemeColors(theme: TerminalTheme): TerminalThemeConfig {
  return themeBuilders[theme]();
}
