import { useState, useCallback, useRef } from 'react';
import { Modal, message } from 'antd';
import { ThunderboltOutlined } from '@ant-design/icons';
import { terminalApi } from '../../api';
import { useTerminalStore } from '../../stores/terminalStore';
import type { ProjectWithStats } from '../../types';
import { getEffectiveCommand } from '../../lib/launchUtils';
import { getProjectPriority, getPriorityColor, extractPortFromCommand } from './projectUtils';

export interface BatchLaunchProgress {
  status: 'pending' | 'launching' | 'success' | 'failed';
  error?: string;
  port?: number;
  terminalId?: string;
  order?: number;
}

interface UseBatchLaunchOptions {
  projects: ProjectWithStats[];
  smartSortEnabled: boolean;
  onLaunchComplete?: () => void;
}

export function useBatchLaunch({ projects, smartSortEnabled, onLaunchComplete }: UseBatchLaunchOptions) {
  const [selectedProjectIds, setSelectedProjectIds] = useState<Set<string>>(new Set());
  const [batchLaunching, setBatchLaunching] = useState(false);
  const [batchLaunchProgress, setBatchLaunchProgress] = useState<Map<string, BatchLaunchProgress>>(new Map());
  const [batchLaunchModalOpen, setBatchLaunchModalOpen] = useState(false);
  const cancelledRef = useRef(false);

  const handleToggleSelection = useCallback((projectId: string, e?: React.SyntheticEvent) => {
    e?.stopPropagation();
    setSelectedProjectIds(prev => {
      const next = new Set(prev);
      if (next.has(projectId)) next.delete(projectId);
      else next.add(projectId);
      return next;
    });
  }, []);

  const handleSelectAll = useCallback(() => {
    setSelectedProjectIds(prev =>
      prev.size === projects.length ? new Set() : new Set(projects.map(p => p.id))
    );
  }, [projects]);

  const showPortConflictDialog = useCallback((conflicts: Array<{ project: ProjectWithStats; port: number }>): Promise<boolean> => {
    return new Promise((resolve) => {
      Modal.confirm({
        title: '端口冲突',
        content: (
          <div>
            <p style={{ marginBottom: 8, color: 'var(--color-text-description)', fontSize: 13 }}>
              以下项目使用了相同端口，同时启动可能导致冲突：
            </p>
            {conflicts.map(({ project, port }) => (
              <div key={project.id} style={{ padding: '4px 0', fontSize: 12 }}>
                <span style={{ color: 'var(--color-text-primary)' }}>{project.name}</span>
                <span style={{ color: 'var(--color-text-muted)', marginLeft: 8 }}>端口 {port}</span>
              </div>
            ))}
          </div>
        ),
        okText: '仍然启动',
        cancelText: '取消',
        onOk: () => resolve(true),
        onCancel: () => resolve(false),
      });
    });
  }, []);

  const handleBatchLaunch = useCallback(async () => {
    if (selectedProjectIds.size === 0) {
      message.warning('请先选择要启动的项目');
      return;
    }

    const selectedProjects = projects.filter(p => selectedProjectIds.has(p.id));
    const withCommands = selectedProjects.filter(p => getEffectiveCommand(p));
    const withoutCommands = selectedProjects.filter(p => !getEffectiveCommand(p));

    if (withCommands.length === 0) {
      message.warning('选中的项目都没有设置启动命令');
      return;
    }

    if (withoutCommands.length > 0) {
      message.info(`跳过 ${withoutCommands.length} 个未设置启动命令的项目`);
    }

    // Check port conflicts
    const portConflicts: Array<{ project: ProjectWithStats; port: number }> = [];
    const usedPorts = new Set<number>();
    for (const project of withCommands) {
      const port = extractPortFromCommand(getEffectiveCommand(project) || '');
      if (port && usedPorts.has(port)) portConflicts.push({ project, port });
      else if (port) usedPorts.add(port);
    }

    if (portConflicts.length > 0) {
      const resolved = await showPortConflictDialog(portConflicts);
      if (!resolved) return;
    }

    // Confirmation dialog
    const sortedForDisplay = smartSortEnabled
      ? [...withCommands].sort((a, b) => getProjectPriority(a) - getProjectPriority(b))
      : withCommands;

    const confirmed = await new Promise<boolean>((resolve) => {
      Modal.confirm({
        title: '批量启动项目',
        icon: <ThunderboltOutlined style={{ color: 'var(--color-status-done)' }} />,
        width: 580,
        content: (
          <div>
            <div style={{ marginBottom: 12, color: 'var(--color-text-description)', fontSize: 13 }}>
              即将启动 <strong style={{ color: 'var(--color-text-primary)' }}>{withCommands.length}</strong> 个项目
              {smartSortEnabled && (
                <span style={{ marginLeft: 8, color: 'var(--color-status-done)', fontSize: 12 }}>(智能排序已启用)</span>
              )}
            </div>
            <div style={{ marginBottom: 12 }}>
              {sortedForDisplay.map((project, index) => {
                const priority = getProjectPriority(project);
                const colorMap: Record<string, string> = { blue: 'var(--color-info)', green: 'var(--color-status-done)', orange: 'var(--color-amber)', purple: 'var(--color-purple)' };
                return (
                  <div key={project.id} style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '8px 12px', background: index % 2 === 0 ? 'rgba(0,0,0,0.02)' : 'transparent',
                    borderRadius: 6, marginBottom: 4,
                  }}>
                    {smartSortEnabled && (
                      <div style={{
                        width: 24, height: 24, borderRadius: '50%',
                        background: colorMap[getPriorityColor(priority)] || 'var(--color-text-tertiary)',
                        color: '#fff', fontSize: 10, fontWeight: 600,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>{priority}</div>
                    )}
                    <span style={{ flex: 1, fontSize: 12, color: 'var(--color-text-primary)' }}>{project.name}</span>
                    <span style={{ fontSize: 11, color: 'var(--color-text-muted)', fontFamily: "'Fira Code', monospace", maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {getEffectiveCommand(project)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        ),
        okText: `启动 ${withCommands.length} 个项目`,
        cancelText: '取消',
        onOk: () => resolve(true),
        onCancel: () => resolve(false),
      });
    });

    if (!confirmed) return;

    // Start batch launch
    setBatchLaunching(true);
    cancelledRef.current = false;
    setBatchLaunchModalOpen(true);

    const initialProgress = new Map<string, BatchLaunchProgress>();
    sortedForDisplay.forEach((p, i) => initialProgress.set(p.id, { status: 'pending', order: i + 1 }));
    setBatchLaunchProgress(initialProgress);

    let successCount = 0;
    let failedCount = 0;

    for (const project of sortedForDisplay) {
      if (cancelledRef.current) break;

      setBatchLaunchProgress(prev => {
        const next = new Map(prev);
        const progress = next.get(project.id);
        next.set(project.id, { ...progress, status: 'launching' });
        return next;
      });

      try {
        const localPath = project.localPath;
        if (!localPath) {
          setBatchLaunchProgress(prev => {
            const next = new Map(prev);
            next.set(project.id, { status: 'failed', error: '缺少本地路径' });
            return next;
          });
          failedCount++;
          continue;
        }

        useTerminalStore.getState().requestLaunch({
          cwd: localPath,
          command: getEffectiveCommand(project) || undefined,
          label: project.name,
          projectId: project.id,
        });

        setBatchLaunchProgress(prev => {
          const next = new Map(prev);
          next.set(project.id, { status: 'success' });
          return next;
        });
        successCount++;

        const delay = getProjectPriority(project) === 1 ? 1000 : 500;
        await new Promise(resolve => setTimeout(resolve, delay));
      } catch (error: unknown) {
        setBatchLaunchProgress(prev => {
          const next = new Map(prev);
          next.set(project.id, { status: 'failed', error: String(error) || '启动失败' });
          return next;
        });
        failedCount++;
      }
    }

    setBatchLaunching(false);

    if (failedCount === 0) {
      message.success(`全部 ${successCount} 个项目启动成功`);
    } else {
      message.warning(`${successCount} 个成功，${failedCount} 个失败`);
    }

    setSelectedProjectIds(new Set());
    onLaunchComplete?.();
  }, [projects, selectedProjectIds, smartSortEnabled, showPortConflictDialog, onLaunchComplete]);

  const handleRetryProject = useCallback(async (projectId: string) => {
    const project = projects.find(p => p.id === projectId);
    if (!project || !project.localPath || !getEffectiveCommand(project)) return;

    setBatchLaunchProgress(prev => {
      const next = new Map(prev);
      next.set(projectId, { status: 'launching' });
      return next;
    });

    try {
      const tid = await terminalApi.start(project.id, getEffectiveCommand(project) || '', project.localPath);
      setBatchLaunchProgress(prev => {
        const next = new Map(prev);
        next.set(projectId, { status: 'success', terminalId: tid });
        return next;
      });
    } catch (error: unknown) {
      setBatchLaunchProgress(prev => {
        const next = new Map(prev);
        next.set(projectId, { status: 'failed', error: String(error) || '启动失败' });
        return next;
      });
    }
  }, [projects]);

  const handleStopAll = useCallback(async () => {
    let stoppedCount = 0;
    let failedCount = 0;

    for (const [projectId, progress] of batchLaunchProgress) {
      if (progress.status === 'success' && progress.terminalId) {
        try {
          await terminalApi.stop(progress.terminalId);
          setBatchLaunchProgress(prev => {
            const next = new Map(prev);
            next.set(projectId, { status: 'pending' });
            return next;
          });
          stoppedCount++;
        } catch {
          failedCount++;
        }
      }
    }

    if (stoppedCount > 0) message.success(`已停止 ${stoppedCount} 个项目`);
    if (failedCount > 0) message.error(`${failedCount} 个项目停止失败`);
  }, [batchLaunchProgress]);

  return {
    selectedProjectIds,
    batchLaunching,
    batchLaunchProgress,
    batchLaunchModalOpen,
    setBatchLaunchModalOpen,
    handleToggleSelection,
    handleSelectAll,
    handleBatchLaunch,
    handleRetryProject,
    handleStopAll,
    setBatchLaunchCancelled: useCallback((v: boolean) => { cancelledRef.current = v; }, []),
  };
}
