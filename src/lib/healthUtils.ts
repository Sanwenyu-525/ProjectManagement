/** Shared utilities for health check feature — single source of truth for issues, severity, and health predicates. */

export interface HealthData {
  dirtyFileCount: number;
  aheadCount: number;
  behindCount: number;
  outdatedDepCount: number;
  healthScore?: number | null;
  healthStatus?: string | null;
  error?: string | null;
}

/** Build human-readable issue list from a health result. */
export function formatHealthIssues(r: HealthData): string[] {
  const issues: string[] = [];
  if (r.dirtyFileCount > 0) issues.push(`${r.dirtyFileCount} 个未提交文件`);
  if (r.aheadCount > 0) issues.push(`${r.aheadCount} 个本地提交未推送`);
  if (r.behindCount > 0) issues.push(`落后远程 ${r.behindCount} 个提交`);
  if (r.outdatedDepCount > 0) issues.push(`${r.outdatedDepCount} 个依赖待更新`);
  if (r.error) issues.push(r.error);
  return issues;
}

/** Whether the health result has any outstanding issues. */
export function hasHealthIssues(r: HealthData): boolean {
  return r.dirtyFileCount > 0 || r.aheadCount > 0 || r.behindCount > 0 || r.outdatedDepCount > 0 || !!r.error;
}

/** Whether the result warrants an urgent/high-severity indicator. */
export function isHealthUrgent(r: HealthData): boolean {
  return r.aheadCount > 5 || r.behindCount > 10;
}

import { getThemeColors } from './themeColors';

/** Get health score color. */
export function getScoreColor(score: number): string {
  const c = getThemeColors();
  if (score >= 80) return c.statusDone;
  if (score >= 50) return c.statusProgress;
  return c.statusCancel;
}

/** Get health status label. */
export function getHealthStatusLabel(status: string): string {
  switch (status) {
    case 'healthy': return '健康';
    case 'needs_attention': return '需要关注';
    case 'critical': return '风险';
    default: return '未知';
  }
}
