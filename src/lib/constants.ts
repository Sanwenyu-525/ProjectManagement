import { getThemeColors } from './themeColors';

/** Project status display config */
export const STATUS_COLORS: Record<string, string> = {
  Idea: 'default',
  Planning: 'blue',
  Development: 'orange',
  Testing: 'purple',
  Deployed: 'green',
  Maintained: 'cyan',
  Archived: 'default',
};

/** Project status hex colors for ECharts — call at render time for theme-aware values */
export function getStatusHexColors(): Record<string, string> {
  const c = getThemeColors();
  return {
    Idea: '#d9d9d9',
    Planning: c.info,
    Development: c.amber,
    Testing: c.purple,
    Deployed: c.statusDone,
    Maintained: '#13c2c2',
    Archived: '#8c8c8c',
  };
}

/** All project statuses */
export const PROJECT_STATUSES = ['Idea', 'Planning', 'Development', 'Testing', 'Deployed', 'Maintained', 'Archived'] as const;

/** Priority options */
export const PRIORITY_OPTIONS = ['Low', 'Medium', 'High', 'Critical'] as const;

/** Activity action display config — call at render time for theme-aware values */
export function getActivityActionConfig(): Record<string, { label: string; color: string }> {
  const c = getThemeColors();
  return {
    status_change: { label: '状态变更', color: c.info },
    task_created: { label: '创建任务', color: c.statusDone },
    task_status_change: { label: '任务状态变更', color: c.amber },
    repo_synced: { label: '仓库同步', color: '#13c2c2' },
  };
}

/** Parse activity log details JSON */
export function parseActivityDetails(action: string, detailsStr: string | null): string {
  if (!detailsStr) return '';
  try {
    const details = JSON.parse(detailsStr);
    switch (action) {
      case 'status_change':
      case 'task_status_change':
        return `${details.from || ''} → ${details.to || ''}`;
      case 'task_created':
      case 'repo_synced':
        return details.repo || '';
      default:
        return JSON.stringify(details);
    }
  } catch {
    return detailsStr;
  }
}

// ==================== Terminal ====================

export const isWindows = navigator.platform.includes('Win');

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
