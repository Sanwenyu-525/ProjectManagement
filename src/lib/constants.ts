import { getThemeColors } from './themeColors';

/** Project status display config */
export const STATUS_COLORS: Record<string, string> = {
  Idea: 'default',
  Planning: 'blue',
  Active: 'orange',
  Completed: 'green',
  Archived: 'default',
};

/** Project status hex colors for ECharts — call at render time for theme-aware values */
export function getStatusHexColors(): Record<string, string> {
  const c = getThemeColors();
  return {
    Idea: '#d9d9d9',
    Planning: c.info,
    Active: c.amber,
    Completed: c.statusDone,
    Archived: '#8c8c8c',
  };
}

/** All project statuses */
export const PROJECT_STATUSES = ['Idea', 'Planning', 'Active', 'Completed', 'Archived'] as const;

/** Priority options */
export const PRIORITY_OPTIONS = ['Low', 'Medium', 'High', 'Critical'] as const;

// ==================== Terminal ====================

const isWindows = navigator.platform.includes('Win');

export const DEFAULT_CWD = isWindows ? 'C:\\Users' : '/Users';

export const DEFAULT_SHELL = isWindows ? 'powershell.exe' : 'bash';

export const SHELL_OPTIONS: { value: string; label: string }[] = isWindows
  ? [
      { value: 'powershell.exe', label: 'PowerShell' },
      { value: 'cmd.exe', label: 'CMD' },
      { value: 'git-bash', label: 'Git Bash' },
    ]
  : [
      { value: 'bash', label: 'Bash' },
      { value: 'zsh', label: 'Zsh' },
      { value: 'fish', label: 'Fish' },
    ];

export const SHELL_MAP: Record<string, { shell: string; args?: string[] }> = {
  'powershell.exe': { shell: 'powershell.exe', args: ['-NoProfile'] },
  'cmd.exe':        { shell: 'cmd.exe' },
  'git-bash':       { shell: 'C:\\Program Files\\Git\\bin\\bash.exe' },
  'bash':           { shell: isWindows ? 'C:\\Program Files\\Git\\bin\\bash.exe' : 'bash' },
  'zsh':            { shell: 'zsh' },
  'fish':           { shell: 'fish' },
};
