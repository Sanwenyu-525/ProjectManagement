import { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { gitApi, workspacesApi } from '../../../api';
import { queryKeys } from '../../../api/queryKeys';
import { useTerminalStore } from '../../../stores/terminalStore';
import { formatRelativeTime } from '../../../lib/format';

/**
 * 工作区延迟数据加载 hook。
 * 从 WorkspacePage 提取，减少主组件的 store 依赖。
 */
export function useWorkspaceData() {
  // 延迟加载非关键查询，让首屏先渲染
  const [deferredReady, setDeferredReady] = useState(false);
  useEffect(() => {
    const id = setTimeout(() => setDeferredReady(true), 500);
    return () => clearTimeout(id);
  }, []);

  const defaultCwd = useTerminalStore(s => s.defaultCwd);

  // 工作区统计（延迟）
  const { data: stats } = useQuery({
    queryKey: ['workspaceStats'] as const,
    queryFn: workspacesApi.stats,
    staleTime: 30_000,
    enabled: deferredReady,
  });

  // Git log（延迟）
  const { data: gitLog } = useQuery({
    queryKey: queryKeys.git.log(defaultCwd),
    queryFn: () => gitApi.log(defaultCwd, 1),
    staleTime: 60_000,
    enabled: deferredReady,
  });

  const lastCommitTime = useMemo(() => {
    if (!gitLog?.commits?.[0]?.date) return null;
    return formatRelativeTime(gitLog.commits[0].date);
  }, [gitLog]);

  return { stats, gitLog, lastCommitTime, defaultCwd, deferredReady };
}
