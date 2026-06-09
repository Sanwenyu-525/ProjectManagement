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

/** Project status hex colors for ECharts */
export const STATUS_HEX_COLORS: Record<string, string> = {
  Idea: '#d9d9d9',
  Planning: '#1677ff',
  Development: '#fa8c16',
  Testing: '#722ed1',
  Deployed: '#52c41a',
  Maintained: '#13c2c2',
  Archived: '#8c8c8c',
};

/** All project statuses */
export const PROJECT_STATUSES = ['Idea', 'Planning', 'Development', 'Testing', 'Deployed', 'Maintained', 'Archived'] as const;

/** Priority options */
export const PRIORITY_OPTIONS = ['Low', 'Medium', 'High', 'Critical'] as const;

/** Activity action display config */
export const ACTIVITY_ACTION_CONFIG: Record<string, { label: string; color: string }> = {
  status_change: { label: '状态变更', color: '#1677ff' },
  task_created: { label: '创建任务', color: '#52c41a' },
  task_status_change: { label: '任务状态变更', color: '#fa8c16' },
  repo_synced: { label: '仓库同步', color: '#13c2c2' },
};

/** Parse activity log details JSON */
export function parseActivityDetails(action: string, detailsStr: string | null): string {
  if (!detailsStr) return '';
  try {
    const details = JSON.parse(detailsStr);
    switch (action) {
      case 'status_change':
        return `${details.from || ''} → ${details.to || ''}`;
      case 'task_created':
        return details.title || '';
      case 'task_status_change':
        return `${details.from || ''} → ${details.to || ''}`;
      case 'repo_synced':
        return details.repo || '';
      default:
        return JSON.stringify(details);
    }
  } catch {
    return detailsStr;
  }
}
