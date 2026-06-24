import { useState, useMemo, useEffect } from 'react';
import { DndContext, DragOverlay, closestCorners, PointerSensor, useSensor, useSensors, DragStartEvent, DragEndEvent, DragOverEvent } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button, Input, Select, Tag, Modal, Form, Empty, Spin, Table, InputNumber, Dropdown } from 'antd';
import { FolderOpenOutlined, ScanOutlined, LinkOutlined, FolderOutlined, PlayCircleOutlined, DeleteOutlined, CodeOutlined, ReloadOutlined, ClockCircleOutlined, CheckCircleOutlined, CloseCircleOutlined, HolderOutlined } from '@ant-design/icons';
import { useTerminalStore } from '../../stores/terminalStore';
import { useProjects, useCreateProject, useDeleteProject, useRestoreProject, useDetectLocal, useDetectGit } from '../../hooks/useProjects';
import { useAllHealth } from '../../hooks/useHealth';
import type { CreateProjectInput, ProjectWithStats, ProjectStatus, ProjectPriority, DetectedProject, ScanGroup, ProjectHealthResult } from '../../types';
import ProjectIcon from '../../shared/ProjectIcon';
import QuickLaunchModal from '../../shared/QuickLaunchModal';
import HealthBadge from '../../shared/HealthBadge';
import { launchHistoryStorage } from '../../lib/launchProfiles';
import { toastSuccess, toastError, toastWarning } from '../../lib/toast';
import { projectsApi, gitApi } from '../../api';
import { STATUS_COLORS, PROJECT_STATUSES, PRIORITY_OPTIONS } from '../../lib/constants';
import { buildLaunchRequests } from '../../lib/launchUtils';
import { getProjectPriority, getPriorityLabel, getPriorityColor } from './projectUtils';
import { useBatchLaunch } from './useBatchLaunch';
import { useScanProjects } from './useScanProjects';
import { useThemeStore } from '../../stores/themeStore';

const STATUS_OPTIONS = [...PROJECT_STATUSES];
const SOURCE_OPTIONS = [
  { value: 'Local', label: '本地项目' },
  { value: 'Remote', label: '远程项目' },
  { value: 'Hybrid', label: '混合项目' },
];

function SortableProjectCard({ project, isDark, navigate }: { project: ProjectWithStats; isDark: boolean; navigate: (path: string) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: project.id });

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.3 : 1,
      }}
    >
      <div
        {...attributes}
        {...listeners}
        onClick={() => navigate(`/projects/${project.id}`)}
        style={{
          padding: '10px 12px',
          borderRadius: 8,
          background: 'var(--color-bg-card)',
          border: '1px solid var(--color-border)',
          cursor: 'grab',
          transition: 'all 0.15s ease',
        }}
        onMouseEnter={e => { e.currentTarget.style.boxShadow = 'var(--shadow-sm)'; }}
        onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none'; }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
          <div style={{ fontWeight: 500, fontSize: 13, color: 'var(--md-on-surface)' }}>{project.name}</div>
          <HolderOutlined style={{ fontSize: 12, color: 'var(--md-on-surface-variant)', flexShrink: 0, marginTop: 2 }} />
        </div>
        {project.description && (
          <div style={{ fontSize: 12, color: 'var(--md-on-surface-variant)', marginBottom: 8, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {project.description}
          </div>
        )}
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {project.techStack?.slice(0, 2).map(tech => (
            <span key={tech} style={{ fontSize: 10, padding: '1px 5px', borderRadius: 3, background: isDark ? 'var(--md-surface-container-high)' : 'var(--md-surface-container-high)', color: 'var(--md-on-surface-variant)' }}>
              {tech}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function ProjectsPage() {
  const navigate = useNavigate();
  const [statusFilter, setStatusFilter] = useState<string | undefined>();
  const [modalOpen, setModalOpen] = useState(false);
  const [searchParams] = useSearchParams();

  // Open new project modal when navigated with ?new=true (Ctrl+N shortcut)
  useEffect(() => {
    if (searchParams.get('new') === 'true') {
      setModalOpen(true);
    }
  }, [searchParams]);

  const [form] = Form.useForm();
  const [quickLaunchModalOpen, setQuickLaunchModalOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list' | 'kanban'>('grid');
  const [sortBy, setSortBy] = useState<'name' | 'status' | 'updated'>('updated');
  const isDark = useThemeStore(s => s.mode === 'dark');
  const density = useThemeStore(s => s.density);
  const isCompact = density === 'compact' || density === 'dense';

  // ── Queries ──
  const projectsParams: Record<string, string | undefined> = {};
  if (statusFilter) projectsParams.status = statusFilter;
  const { data: projects = [], isLoading: loading, refetch } = useProjects(
    Object.keys(projectsParams).length > 0 ? projectsParams : undefined,
  );
  const { data: healthData = [] } = useAllHealth();
  const healthResults: Record<string, ProjectHealthResult> = useMemo(() => {
    const map: Record<string, ProjectHealthResult> = {};
    if (Array.isArray(healthData)) {
      healthData.forEach((h) => { map[h.projectId] = h; });
    }
    return map;
  }, [healthData]);

  // ── Mutations ──
  const createProject = useCreateProject();
  const deleteProject = useDeleteProject();
  const restoreProject = useRestoreProject();
  const detectLocal = useDetectLocal();
  const detectGit = useDetectGit();

  // Fetch current git branch for projects with local paths
  const [branchMap, setBranchMap] = useState<Record<string, string>>({});

  useEffect(() => {
    const fetchBranches = async () => {
      const projectsWithPath = projects.filter(p => p.localPath);
      const results = await Promise.allSettled(
        projectsWithPath.map(async (p) => {
          try {
            const branches = await gitApi.branches(p.localPath!);
            const current = Array.isArray(branches) ? branches.find((b: { current: boolean }) => b.current) : null;
            return { id: p.id, branch: current?.name ?? '' };
          } catch {
            return { id: p.id, branch: '' };
          }
        })
      );
      const map: Record<string, string> = {};
      results.forEach(r => {
        if (r.status === 'fulfilled') map[r.value.id] = r.value.branch;
      });
      setBranchMap(map);
    };
    if (projects.length > 0) fetchBranches();
  }, [projects]);

  const batch = useBatchLaunch({
    projects,
    smartSortEnabled: true,
    onLaunchComplete: () => refetch(),
  });

  const scan = useScanProjects({ onImportComplete: () => refetch() });

  // ── CRUD Operations ──

  const handleDetect = async () => {
    const localPath = form.getFieldValue('localPath')?.trim();
    const repoUrl = form.getFieldValue('repoUrl')?.trim();

    if (!localPath && !repoUrl) {
      toastWarning('请输入本地路径或 Git 仓库地址');
      return;
    }

    try {
      let result: DetectedProject;
      if (repoUrl) {
        result = await detectGit.mutateAsync({ repoUrl });
      } else {
        result = await detectLocal.mutateAsync({ path: localPath });
      }

      const updates: Record<string, unknown> = {};
      if (result.name) updates.name = result.name;
      if (result.description) updates.description = result.description;
      if (result.techStack?.length) updates.techStack = result.techStack;
      if (result.source) updates.source = result.source;
      if (result.localPath) updates.localPath = result.localPath;
      if (result.repoUrl) updates.repoUrl = result.repoUrl;
      if (result.openCommand) updates.openCommand = result.openCommand;
      form.setFieldsValue(updates);

      toastSuccess(`检测完成，识别到 ${result.techStack?.length || 0} 项技术栈`);
    } catch (err: unknown) {
      toastError(`检测失败: ${String(err)}`);
    }
  };

  const handleCreate = async (values: Record<string, unknown>) => {
    const name = String(values.name || '');
    const description = values.description ? String(values.description) : undefined;
    const status = String(values.status || 'Active') as ProjectStatus;
    const priority = String(values.priority || 'Medium') as ProjectPriority;
    const localPath = values.localPath ? String(values.localPath) : undefined;
    const openCommand = values.openCommand ? String(values.openCommand) : undefined;

    if (localPath?.trim() && !openCommand?.trim()) {
      const proceed = await new Promise<boolean>((resolve) => {
        Modal.confirm({
          title: '设置启动命令',
          content: '检测到项目路径但未设置启动命令，设置后可一键启动项目开发。是否现在设置？',
          okText: '去设置',
          cancelText: '跳过，用默认',
          onOk: () => resolve(false),
          onCancel: () => resolve(true),
        });
      });
      if (!proceed) {
        form.scrollToField('openCommand');
        return;
      }
    }

    try {
      const techStackRaw = values.techStack;
      const techStack = Array.isArray(techStackRaw)
        ? techStackRaw
        : (techStackRaw ? String(techStackRaw).split(',').map((s: string) => s.trim()).filter(Boolean) : []);

      const payload: CreateProjectInput = {
        name,
        description,
        status,
        priority,
        localPath,
        techStack,
      };
      await createProject.mutateAsync(payload);
      toastSuccess('项目创建成功');
      setModalOpen(false);
      form.resetFields();
    } catch (e: unknown) {
      toastError(`创建失败: ${String(e)}`);
    }
  };

  const handleDelete = async (id: string) => {
    const confirmed = await new Promise<boolean>((resolve) => {
      Modal.confirm({
        title: '删除项目',
        content: '确定要删除这个项目吗？可在 5 秒内撤销。',
        okText: '删除',
        okType: 'danger',
        cancelText: '取消',
        onOk: () => resolve(true),
        onCancel: () => resolve(false),
      });
    });
    if (confirmed) {
      try {
        await deleteProject.mutateAsync(id);
        toastSuccess('项目已删除', () => {
          restoreProject.mutateAsync(id);
        });
      } catch (e: unknown) {
        toastError(`删除失败: ${String(e)}`);
      }
    }
  };

  const getCardMenuItems = (project: ProjectWithStats) => [
    {
      key: 'launch',
      icon: <PlayCircleOutlined />,
      label: '启动项目',
      onClick: () => handleLaunchProject(project),
    },
    {
      key: 'terminal',
      icon: <CodeOutlined />,
      label: '打开终端',
      onClick: () => {
        if (project.localPath) {
          useTerminalStore.getState().requestLaunch({ cwd: project.localPath, label: project.name, projectId: project.id });
          navigate('/');
        } else {
          toastWarning('项目没有本地路径');
        }
      },
    },
    { type: 'divider' as const },
    {
      key: 'delete',
      icon: <DeleteOutlined style={{ color: 'var(--md-error)' }} />,
      label: <span style={{ color: 'var(--md-error)' }}>删除项目</span>,
      danger: true,
      onClick: () => handleDelete(project.id),
    },
  ];

  const handleBrowseFolder = async () => {
    try {
      const { open } = await import('@tauri-apps/plugin-dialog');
      const selected = await open({ directory: true });
      if (selected) {
        scan.setScanPath(selected as string);
      }
    } catch {
      toastError('无法打开文件夹选择器');
    }
  };

  const handleBrowseProjectPath = async () => {
    try {
      const { open } = await import('@tauri-apps/plugin-dialog');
      const selected = await open({ directory: true });
      if (selected) {
        form.setFieldsValue({ localPath: selected as string });
      }
    } catch {
      toastError('无法打开文件夹选择器');
    }
  };

  // ── Launch Operations ──

  const handleLaunchProject = async (project: ProjectWithStats) => {
    if (!project.localPath) {
      toastWarning('请先设置项目本地路径');
      return;
    }
    const localPath = project.localPath;
    const requests = buildLaunchRequests({ ...project, localPath });
    if (requests.length === 0) {
      toastWarning('请先设置启动命令');
      return;
    }

    try {
      for (const req of requests) {
        useTerminalStore.getState().requestLaunch({
          cwd: req.cwd || project.localPath || '',
          command: req.command || undefined,
          label: req.label,
          projectId: project.id,
        });
      }
      toastSuccess(`${project.name} 已启动`);
      // Navigate to workspace to show the launching terminals
      navigate('/');
      // Record launch
      launchHistoryStorage.add({
        projects: [{ projectId: project.id, projectName: project.name, status: 'success' }],
        totalDuration: 0,
        successCount: 1,
        failedCount: 0,
      });
      refetch();
    } catch (e: unknown) {
      toastError(`启动失败: ${String(e)}`);
    }
  };

  const handleQuickLaunch = (projectIds: string[]) => {
    for (const id of projectIds) {
      const project = projects.find(p => p.id === id);
      if (project) handleLaunchProject(project);
    }
  };

  // ── Sorted projects ──
  const sortedProjects = [...projects].sort((a, b) => {
    if (sortBy === 'name') return a.name.localeCompare(b.name);
    if (sortBy === 'status') return a.status.localeCompare(b.status);
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
  });

  // ── Relative time helper ──
  const formatRelativeTime = (iso?: string) => {
    if (!iso) return '';
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return '刚刚';
    if (mins < 60) return `${mins}分钟前`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}小时前`;
    const days = Math.floor(hours / 24);
    return `${days}天前`;
  };

  // ── Status color CSS variable ──
  const getStatusColorVar = (status: string) => {
    const mapped = STATUS_COLORS[status];
    if (mapped === 'green') return 'var(--md-tertiary)';
    if (mapped === 'purple') return 'var(--md-secondary)';
    if (mapped === 'orange') return 'var(--md-primary)';
    return 'var(--md-outline)';
  };

  // ── Kanban DnD ──
  const KANBAN_COLUMNS = [
    { key: 'Idea', label: '想法' },
    { key: 'Planning', label: '规划中' },
    { key: 'Active', label: '进行中' },
    { key: 'Completed', label: '已完成' },
    { key: 'Archived', label: '已归档' },
  ];
  const kanbanSensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);

  const projectsByStatus = useMemo(() => {
    const grouped: Record<string, ProjectWithStats[]> = {};
    KANBAN_COLUMNS.forEach(col => { grouped[col.key] = []; });
    projects.forEach(p => { if (grouped[p.status]) grouped[p.status].push(p); });
    return grouped;
  }, [projects]);

  const activeProject = useMemo(() => projects.find(p => p.id === activeProjectId) || null, [projects, activeProjectId]);

  function kanbanFindColumn(projectId: string): string | undefined {
    for (const [status, list] of Object.entries(projectsByStatus)) {
      if (list.some(p => p.id === projectId)) return status;
    }
    return undefined;
  }

  function handleKanbanDragStart(e: DragStartEvent) { setActiveProjectId(e.active.id as string); }

  function handleKanbanDragOver(e: DragOverEvent) {
    const { active, over } = e;
    if (!over) return;
    const activeId = active.id as string;
    const overId = over.id as string;
    const fromCol = kanbanFindColumn(activeId);
    const toCol = kanbanFindColumn(overId);
    if (!fromCol || !toCol || fromCol === toCol) return;
    const proj = projectsByStatus[fromCol].find(p => p.id === activeId);
    if (!proj) return;
    projectsByStatus[fromCol] = projectsByStatus[fromCol].filter(p => p.id !== activeId);
    (proj as ProjectWithStats).status = toCol as ProjectStatus;
    projectsByStatus[toCol].push(proj);
  }

  async function handleKanbanDragEnd(e: DragEndEvent) {
    setActiveProjectId(null);
    const { active, over } = e;
    if (!over) return;
    const activeId = active.id as string;
    const original = projects.find(p => p.id === activeId);
    if (!original) return;
    const newStatus = kanbanFindColumn(activeId);
    if (!newStatus || newStatus === original.status) return;
    try {
      await projectsApi.updateStatus(activeId, newStatus);
      refetch();
    } catch { refetch(); }
  }

  // ── Render ──

  return (
    <div style={{ padding: 'var(--layout-container-padding)', maxWidth: 1600, margin: '0 auto' }}>
      {/* ── Page Header ── */}
      <div style={{
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'space-between',
        gap: 16,
        paddingBottom: 16,
        borderBottom: '1px solid var(--color-divider)',
        marginBottom: 24,
      }}>
        <div>
          <h1 style={{
            fontSize: 32,
            fontWeight: 600,
            color: 'var(--md-on-surface)',
            lineHeight: '40px',
            letterSpacing: '-0.02em',
            margin: 0,
          }}>
            项目管理
          </h1>
          <p style={{
            fontSize: 14,
            color: 'var(--md-on-surface-variant)',
            marginTop: 4,
            marginBottom: 0,
          }}>
            管理工作区、智能体和部署。
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {/* Filter/Sort group */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            background: 'var(--color-bg-card)',
            borderRadius: 8,
            padding: '2px 4px',
            boxShadow: 'var(--shadow-xs)',
            gap: 2,
          }}>
            <Select
              placeholder="筛选"
              value={statusFilter}
              onChange={setStatusFilter}
              allowClear
              style={{ width: 110 }}
              size="small"
              variant="borderless"
              suffixIcon={<span className="material-symbols-outlined" style={{ fontSize: 16, color: 'var(--md-on-surface-variant)' }}>filter_list</span>}
              options={PROJECT_STATUSES.map(s => ({ value: s, label: s }))}
            />
            <div style={{ width: 1, height: 16, background: 'var(--color-divider)' }} />
            <Select
              value={sortBy}
              onChange={setSortBy}
              style={{ width: 110 }}
              size="small"
              variant="borderless"
              suffixIcon={<span className="material-symbols-outlined" style={{ fontSize: 16, color: 'var(--md-on-surface-variant)' }}>sort</span>}
              options={[
                { value: 'updated', label: '最近' },
                { value: 'name', label: '名称' },
                { value: 'status', label: '状态' },
              ]}
            />
          </div>

          {/* View switcher group */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            background: 'var(--color-bg-card)',
            borderRadius: 8,
            padding: 4,
            boxShadow: 'var(--shadow-xs)',
          }}>
            {(['grid', 'list', 'kanban'] as const).map(mode => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                aria-label={mode === 'grid' ? '网格视图' : mode === 'list' ? '列表视图' : '看板视图'}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  width: 36, height: 36, borderRadius: 6, border: 'none',
                  background: viewMode === mode
                    ? 'var(--md-primary-container)'
                    : 'transparent',
                  color: viewMode === mode ? 'var(--md-primary)' : 'var(--md-on-surface-variant)',
                  cursor: 'pointer', transition: 'background 0.15s, color 0.15s',
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
                  {mode === 'grid' ? 'grid_view' : mode === 'list' ? 'view_list' : 'view_column'}
                </span>
              </button>
            ))}
          </div>

          {/* New Project button */}
          <button
            onClick={() => navigate('/projects/new')}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '8px 16px', borderRadius: 8, border: 'none',
              background: 'var(--md-primary)', color: 'var(--md-on-primary)',
              cursor: 'pointer', fontFamily: 'var(--font-label)',
              fontSize: 12, fontWeight: 500, letterSpacing: '0.02em',
              boxShadow: '0 2px 8px var(--md-primary-container)',
              transition: 'opacity 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.opacity = '0.9'; }}
            onMouseLeave={e => { e.currentTarget.style.opacity = '1'; }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>add</span>
            新建项目
          </button>
        </div>
      </div>

      {/* ── Project Grid ── */}
      {loading ? (
        <div style={{
          display: 'grid',
          gridTemplateColumns: isCompact
            ? 'repeat(auto-fill, minmax(260px, 1fr))'
            : 'repeat(auto-fill, minmax(300px, 1fr))',
          gap: isCompact ? 12 : 16,
        }}>
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} style={{
              borderRadius: isCompact ? 10 : 12,
              border: '1px solid var(--color-border)',
              overflow: 'hidden',
              background: 'var(--color-bg-card)',
            }}>
              <div className="skeleton" style={{ height: isCompact ? 2 : 3, borderRadius: 0 }} />
              <div style={{ padding: isCompact ? 14 : 20 }}>
                <div className="skeleton" style={{ width: '70%', height: 16, marginBottom: 8 }} />
                <div className="skeleton" style={{ width: '100%', height: 12, marginBottom: 6 }} />
                <div className="skeleton" style={{ width: '40%', height: 12, marginBottom: 12 }} />
                <div className="skeleton" style={{ width: '50%', height: 10 }} />
              </div>
            </div>
          ))}
        </div>
      ) : projects.length === 0 ? (
        <Empty description={statusFilter ? `没有${statusFilter === 'active' ? '进行中' : statusFilter === 'completed' ? '已完成' : statusFilter === 'paused' ? '已暂停' : ''}的项目` : '暂无项目'} />
      ) : viewMode === 'grid' ? (
        /* ── Grid View ── */
        <div style={{
          display: 'grid',
          gridTemplateColumns: isCompact
            ? 'repeat(auto-fill, minmax(260px, 1fr))'
            : 'repeat(auto-fill, minmax(300px, 1fr))',
          gap: isCompact ? 12 : 16,
        }}>
          {sortedProjects.map((project, index) => {
            const statusColor = getStatusColorVar(project.status);
            const hasHealth = !!healthResults[project.id];
            const isRecent = Date.now() - new Date(project.updatedAt).getTime() < 24 * 60 * 60 * 1000;

            return (
              <div
                key={project.id}
                onClick={() => navigate(`/projects/${project.id}`)}
                style={{
                  background: 'var(--color-bg-card)',
                  backdropFilter: 'blur(16px)',
                  WebkitBackdropFilter: 'blur(16px)',
                  borderRadius: isCompact ? 10 : 12,
                  border: '1px solid var(--color-border)',
                  boxShadow: isRecent ? 'var(--card-shadow-elevated)' : 'var(--card-shadow)',
                  cursor: 'pointer',
                  transition: 'box-shadow 0.25s var(--ease-spring), transform 0.25s var(--ease-spring)',
                  overflow: 'hidden',
                  position: 'relative',
                  animation: `cardEnter 0.3s var(--ease-spring) both`,
                  animationDelay: `${index * 30}ms`,
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.boxShadow = 'var(--card-shadow-hover)';
                  e.currentTarget.style.transform = 'translateY(-3px)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.boxShadow = isRecent ? 'var(--card-shadow-elevated)' : 'var(--card-shadow)';
                  e.currentTarget.style.transform = 'translateY(0)';
                }}
              >
                {/* Top accent bar */}
                <div style={{ height: isCompact ? 2 : 3, background: statusColor }} />

                <div style={{ padding: isCompact ? (density === 'dense' ? '10px 12px' : '14px 16px') : '20px 20px 16px' }}>
                  {/* Header: Icon + Name + Menu */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: isCompact ? 8 : 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: isCompact ? 8 : 12 }}>
                      <div style={{
                        width: isCompact ? (density === 'dense' ? 22 : 28) : 40,
                        height: isCompact ? (density === 'dense' ? 22 : 28) : 40,
                        borderRadius: isCompact ? 6 : 8,
                        background: 'var(--md-surface-container)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        border: '1px solid var(--color-border-subtle)',
                        flexShrink: 0,
                        overflow: 'hidden',
                      }}>
                        <ProjectIcon
                          name={project.name}
                          techStack={project.techStack}
                          iconType={project.iconType}
                          iconUrl={project.iconUrl}
                          iconColor={project.iconColor}
                          size={isCompact ? (density === 'dense' ? 22 : 28) : 40}
                        />
                      </div>
                      <div>
                        <div style={{
                          fontWeight: 600,
                          fontSize: isCompact ? (density === 'dense' ? 12 : 13) : 18,
                          lineHeight: isCompact ? '20px' : '24px',
                          letterSpacing: '-0.01em',
                          color: 'var(--md-on-surface)',
                          transition: 'color 0.15s ease',
                        }}>
                          {project.name}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3 }}>
                          <span style={{
                            width: 8,
                            height: 8,
                            borderRadius: '50%',
                            background: statusColor,
                            flexShrink: 0,
                          }} />
                          <span style={{
                            fontFamily: 'var(--font-label)',
                            fontSize: 12,
                            fontWeight: 500,
                            letterSpacing: '0.02em',
                            color: 'var(--md-on-surface-variant)',
                          }}>
                            {project.status}
                          </span>
                          {isCompact && (project.frontendStatus === 'running' || project.backendStatus === 'running') && (
                            <span style={{
                              fontSize: 9,
                              padding: '1px 4px',
                              borderRadius: 3,
                              background: 'rgba(34, 197, 94, 0.15)',
                              color: 'var(--color-success, #22c55e)',
                              fontFamily: 'var(--font-mono)',
                              whiteSpace: 'nowrap' as const,
                            }}>
                              running
                            </span>
                          )}
                          {isCompact && (project.frontendStatus === 'error' || project.backendStatus === 'error') && (
                            <span style={{
                              fontSize: 9,
                              padding: '1px 4px',
                              borderRadius: 3,
                              background: 'rgba(239, 68, 68, 0.1)',
                              color: 'var(--md-error)',
                              fontFamily: 'var(--font-mono)',
                              whiteSpace: 'nowrap' as const,
                            }}>
                              error
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <Dropdown
                      menu={{ items: getCardMenuItems(project) }}
                      trigger={['click']}
                      placement="bottomRight"
                    >
                      <button
                        onClick={(e) => e.stopPropagation()}
                        aria-label="项目操作菜单"
                        aria-haspopup="menu"
                        style={{
                          width: 32, height: 32, borderRadius: 6, border: 'none',
                          background: 'transparent', color: 'var(--md-outline)',
                          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                          transition: 'background 0.15s, color 0.15s',
                        }}
                        onMouseEnter={e => { e.currentTarget.style.background = 'var(--md-surface-container-high)'; e.currentTarget.style.color = 'var(--md-on-surface)'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--md-outline)'; }}
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: 20 }}>more_vert</span>
                      </button>
                    </Dropdown>
                  </div>

                  {/* Description */}
                  {project.description && (
                    <p style={{
                      fontSize: 13,
                      lineHeight: '18px',
                      color: 'var(--md-on-surface-variant)',
                      margin: '0 0 12px 0',
                      display: '-webkit-box',
                      WebkitLineClamp: density === 'dense' ? 1 : isCompact ? 1 : 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                    }}>
                      {project.description}
                    </p>
                  )}

                  {/* Tech stack */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: isCompact ? 4 : 6, marginTop: 'auto', paddingTop: isCompact ? 2 : 4 }}>
                    {project.techStack?.slice(0, isCompact ? 2 : 3).map(tech => (
                      <span key={tech} style={{
                        padding: isCompact ? (density === 'dense' ? '1px 4px' : '2px 6px') : '4px 8px',
                        borderRadius: 6,
                        background: 'var(--md-surface-container-low)',
                        color: 'var(--md-on-surface-variant)',
                        fontFamily: 'var(--font-mono)',
                        fontSize: isCompact ? (density === 'dense' ? 9 : 10) : 12,
                        fontWeight: 450,
                        lineHeight: '16px',
                        border: '1px solid var(--color-border-subtle)',
                      }}>
                        {tech}
                      </span>
                    ))}
                    {(project.techStack?.length || 0) > (isCompact ? 2 : 3) && (
                      <span style={{
                        padding: isCompact ? '1px 3px' : '4px 6px',
                        fontSize: isCompact ? 9 : 12,
                        color: 'var(--md-on-surface-variant)',
                        fontFamily: 'var(--font-mono)',
                      }}>
                        +{project.techStack.length - (isCompact ? 2 : 3)}
                      </span>
                    )}
                  </div>

                  {/* Footer stats */}
                  {isCompact ? (
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      paddingTop: density === 'dense' ? 6 : 8,
                      marginTop: density === 'dense' ? 6 : 8,
                      borderTop: '1px solid var(--color-divider)',
                      fontSize: 11,
                      color: 'var(--md-on-surface-variant)',
                    }}>
                      {branchMap[project.id] && (
                        <span style={{
                          fontFamily: 'var(--font-mono)',
                          fontSize: 10,
                          padding: '1px 5px',
                          borderRadius: 3,
                          background: 'var(--md-primary-container)',
                          color: 'var(--md-primary)',
                          whiteSpace: 'nowrap' as const,
                        }}>
                          {branchMap[project.id]}
                        </span>
                      )}
                      <span style={{ fontFamily: 'var(--font-label)', fontSize: 11, fontWeight: 500 }}>
                        {project.taskCount} tasks
                      </span>
                      <div style={{
                        flex: 1,
                        height: isCompact ? 2 : 3,
                        background: 'var(--color-divider)',
                        borderRadius: 1,
                        overflow: 'hidden',
                        minWidth: 30,
                      }}>
                        <div style={{
                          width: project.taskCount > 0 ? `${Math.round(project.completedTaskCount / project.taskCount * 100)}%` : '0%',
                          height: '100%',
                          background: 'var(--md-primary)',
                          borderRadius: 1,
                        }} />
                      </div>
                      <span style={{ fontSize: 10, whiteSpace: 'nowrap' as const }}>
                        {formatRelativeTime(project.updatedAt)}
                      </span>
                    </div>
                  ) : (
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      paddingTop: 16,
                      marginTop: 12,
                      borderTop: '1px solid var(--color-divider)',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5, color: 'var(--md-on-surface-variant)' }}>
                          <span className="material-symbols-outlined" style={{ fontSize: 16 }}>folder_open</span>
                          <span style={{ fontFamily: 'var(--font-label)', fontSize: 12, fontWeight: 500, letterSpacing: '0.02em' }}>
                            {project.repoCount}
                          </span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5, color: 'var(--md-on-surface-variant)' }}>
                          <span className="material-symbols-outlined" style={{ fontSize: 16 }}>smart_toy</span>
                          <span style={{ fontFamily: 'var(--font-label)', fontSize: 12, fontWeight: 500, letterSpacing: '0.02em' }}>
                            {project.taskCount}
                          </span>
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        {hasHealth ? (
                          <HealthBadge result={healthResults[project.id]} />
                        ) : (
                          <span className="material-symbols-outlined" style={{ fontSize: 16, color: 'var(--md-tertiary)' }}>
                            check_circle
                          </span>
                        )}
                        <span style={{ fontSize: 13, color: 'var(--md-on-surface-variant)' }}>
                          {formatRelativeTime(project.updatedAt)}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : viewMode === 'list' ? (
        /* ── List View ── */
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {sortedProjects.map(project => {
            const statusColor = getStatusColorVar(project.status);
            return (
              <div
                key={project.id}
                onClick={() => navigate(`/projects/${project.id}`)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 16,
                  padding: '12px 16px',
                  borderRadius: 10,
                  background: 'transparent',
                  cursor: 'pointer',
                  transition: 'background 0.15s',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.background = isDark ? 'var(--md-surface-container-high)' : 'var(--md-surface-container-high)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = 'transparent';
                }}
              >
                <ProjectIcon name={project.name} techStack={project.techStack} iconType={project.iconType} iconUrl={project.iconUrl} iconColor={project.iconColor} size={28} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 500, fontSize: 14, color: 'var(--md-on-surface)' }}>{project.name}</div>
                  {project.description && (
                    <div style={{ fontSize: 12, color: 'var(--md-on-surface-variant)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {project.description}
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 4 }}>
                  {project.techStack?.slice(0, 2).map(tech => (
                    <span key={tech} style={{ fontSize: 11, padding: '2px 6px', borderRadius: 4, background: 'var(--md-surface-container-high)', color: 'var(--md-on-surface-variant)', fontFamily: 'var(--font-mono)' }}>
                      {tech}
                    </span>
                  ))}
                </div>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: statusColor, flexShrink: 0 }} />
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--md-on-surface-variant)' }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 16 }}>folder_open</span>
                  <span style={{ fontFamily: 'var(--font-label)', fontSize: 12, fontWeight: 500 }}>{project.repoCount}</span>
                  <span style={{ width: 1, height: 16, background: 'var(--color-divider)', margin: '0 4px' }} />
                  <span className="material-symbols-outlined" style={{ fontSize: 16 }}>smart_toy</span>
                  <span style={{ fontFamily: 'var(--font-label)', fontSize: 12, fontWeight: 500 }}>{project.taskCount}</span>
                </div>
                <span style={{ fontSize: 13, color: 'var(--md-on-surface-variant)' }}>
                  {formatRelativeTime(project.updatedAt)}
                </span>
                <div style={{ display: 'flex', gap: 2 }}>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleLaunchProject(project); }}
                    aria-label="启动项目"
                    style={{ width: 32, height: 32, borderRadius: 6, border: 'none', background: 'transparent', color: 'var(--md-on-surface-variant)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 0.15s' }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'var(--md-surface-container-high)'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                    title="启动"
                  >
                    <PlayCircleOutlined style={{ fontSize: 14 }} />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (project.localPath) {
                        useTerminalStore.getState().requestLaunch({ cwd: project.localPath, label: project.name, projectId: project.id });
                        navigate('/');
                      }
                    }}
                    aria-label="打开终端"
                    style={{ width: 32, height: 32, borderRadius: 6, border: 'none', background: 'transparent', color: 'var(--md-on-surface-variant)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 0.15s' }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'var(--md-surface-container-high)'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                    title="终端"
                  >
                    <CodeOutlined style={{ fontSize: 14 }} />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDelete(project.id); }}
                    aria-label="删除项目"
                    style={{ width: 32, height: 32, borderRadius: 6, border: 'none', background: 'transparent', color: 'var(--md-on-surface-variant)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 0.15s, color 0.15s' }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'var(--md-surface-container-high)'; e.currentTarget.style.color = 'var(--md-error)'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--md-on-surface-variant)'; }}
                    title="删除"
                  >
                    <DeleteOutlined style={{ fontSize: 14 }} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* ── Kanban View ── */
        <DndContext
          sensors={kanbanSensors}
          collisionDetection={closestCorners}
          onDragStart={handleKanbanDragStart}
          onDragOver={handleKanbanDragOver}
          onDragEnd={handleKanbanDragEnd}
        >
          <div style={{ display: 'flex', gap: 16, overflowX: 'auto', paddingBottom: 8 }}>
            {KANBAN_COLUMNS.map(({ key, label }) => {
              const columnProjects = projectsByStatus[key] || [];
              return (
                <div key={key} style={{ flex: 1, minWidth: 220 }}>
                  <div style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: 'var(--md-on-surface)',
                    padding: '8px 12px',
                    marginBottom: 8,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                  }}>
                    <span style={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      background: getStatusColorVar(key),
                    }} />
                    {label}
                    <span style={{ fontSize: 11, color: 'var(--md-on-surface-variant)', fontWeight: 400 }}>
                      ({columnProjects.length})
                    </span>
                  </div>
                  <SortableContext items={columnProjects.map(p => p.id)} strategy={verticalListSortingStrategy}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minHeight: 120 }}>
                      {columnProjects.map(project => (
                        <SortableProjectCard
                          key={project.id}
                          project={project}
                          isDark={isDark}
                          navigate={navigate}
                        />
                      ))}
                    </div>
                  </SortableContext>
                </div>
              );
            })}
          </div>
          <DragOverlay>
            {activeProject ? (
              <div style={{
                padding: '10px 12px',
                borderRadius: 8,
                background: 'var(--color-bg-card)',
                border: '1px solid var(--md-primary)',
                boxShadow: 'var(--shadow-xl)',
                transform: 'rotate(1.5deg)',
                maxWidth: 260,
              }}>
                <div style={{ fontWeight: 500, fontSize: 13, color: 'var(--md-on-surface)' }}>{activeProject.name}</div>
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      )}

      {/* Create Project Modal */}
      <Modal
        title="新建项目"
        open={modalOpen}
        onCancel={() => { setModalOpen(false); form.resetFields(); }}
        footer={null}
        width={640}
      >
        <Form form={form} layout="vertical" onFinish={handleCreate} initialValues={{ status: 'Active', priority: 'Medium', source: 'Local' }}>
          <div style={{ display: 'flex', gap: 12 }}>
            <Form.Item name="name" label="项目名称" rules={[{ required: true, message: '请输入项目名称' }]} style={{ flex: 1 }}>
              <Input placeholder="我的项目" />
            </Form.Item>
            <Form.Item name="status" label="状态" style={{ width: 140 }}>
              <Select options={STATUS_OPTIONS.map(s => ({ value: s, label: s }))} />
            </Form.Item>
            <Form.Item name="priority" label="优先级" style={{ width: 140 }}>
              <Select options={PRIORITY_OPTIONS.map(p => ({ value: p, label: p }))} />
            </Form.Item>
          </div>
          <Form.Item name="description" label="描述">
            <Input.TextArea rows={2} placeholder="项目描述（可选）" />
          </Form.Item>
          <Form.Item name="source" label="来源" style={{ width: 200 }}>
            <Select options={SOURCE_OPTIONS} />
          </Form.Item>
          <div style={{ display: 'flex', gap: 12 }}>
            <Form.Item name="localPath" label="本地路径" style={{ flex: 1 }}>
              <Input placeholder="D:\Projects\my-app" suffix={
                <FolderOpenOutlined style={{ cursor: 'pointer', color: 'var(--color-text-placeholder)' }} onClick={handleBrowseProjectPath} />
              } />
            </Form.Item>
            <Form.Item name="repoUrl" label="Git 仓库" style={{ flex: 1 }}>
              <Input placeholder="https://github.com/user/repo" />
            </Form.Item>
          </div>
          <Form.Item name="openCommand" label="启动命令">
            <Input placeholder="npm run dev" />
          </Form.Item>
          <div style={{ display: 'flex', gap: 12 }}>
            <Form.Item name="frontendCommand" label="前端命令" style={{ flex: 1 }}>
              <Input placeholder="npm run dev (前端)" />
            </Form.Item>
            <Form.Item name="backendCommand" label="后端命令" style={{ flex: 1 }}>
              <Input placeholder="npm run server (后端)" />
            </Form.Item>
          </div>
          <Form.Item name="techStack" label="技术栈">
            <Input placeholder="React, Node.js, PostgreSQL（逗号分隔）" />
          </Form.Item>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
            <Button onClick={() => { setModalOpen(false); form.resetFields(); }}>取消</Button>
            <Button onClick={handleDetect} loading={detectLocal.isPending || detectGit.isPending} icon={<ScanOutlined />}>检测</Button>
            <Button type="primary" htmlType="submit">创建</Button>
          </div>
        </Form>
      </Modal>

      {/* Scan Directory Modal */}
      <Modal
        title="扫描目录"
        open={scan.scanModalOpen}
        onCancel={() => { scan.setScanModalOpen(false); scan.resetScan(); }}
        footer={null}
        width={800}
      >
        <div style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end' }}>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', marginBottom: 4, fontSize: 12, color: 'var(--color-text-description)' }}>扫描路径</label>
              <Input
                value={scan.scanPath}
                onChange={e => scan.setScanPath(e.target.value)}
                placeholder="输入或选择要扫描的目录..."
                suffix={
                  <FolderOpenOutlined style={{ cursor: 'pointer', color: 'var(--color-text-placeholder)' }} onClick={handleBrowseFolder} />
                }
              />
            </div>
            <div style={{ width: 120 }}>
              <label style={{ display: 'block', marginBottom: 4, fontSize: 12, color: 'var(--color-text-description)' }}>扫描深度</label>
              <InputNumber
                value={scan.scanMaxDepth}
                onChange={v => scan.setScanMaxDepth(v || 1)}
                min={1}
                max={5}
                style={{ width: '100%' }}
              />
            </div>
            <Button
              type="primary"
              onClick={scan.handleScan}
              loading={scan.scanning}
              icon={<ScanOutlined />}
            >
              扫描
            </Button>
          </div>
        </div>

        {scan.scanResults.length > 0 && (
          <>
            <Table
              rowSelection={{
                selectedRowKeys: scan.selectedKeys,
                onChange: (keys) => scan.setSelectedKeys(keys),
              }}
              dataSource={scan.scanResults.map((p, i) => ({ ...p, key: i }))}
              columns={[
                { title: '名称', dataIndex: 'name', key: 'name', render: (name: string) => <strong>{name}</strong> },
                {
                  title: '技术栈', dataIndex: 'techStack', key: 'techStack',
                  render: (stacks: string[]) => (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                      {stacks?.slice(0, 3).map((s: string) => <Tag key={s} style={{ fontSize: 10 }}>{s}</Tag>)}
                      {(stacks?.length || 0) > 3 && <Tag style={{ fontSize: 10 }}>+{stacks.length - 3}</Tag>}
                    </div>
                  ),
                },
                { title: '路径', dataIndex: 'localPath', key: 'localPath', ellipsis: true, render: (path: string) => <span style={{ fontFamily: "'Fira Code', monospace", fontSize: 11, color: 'var(--color-text-placeholder)' }}>{path}</span> },
                {
                  title: '关联', dataIndex: 'groupId', key: 'groupId', width: 120,
                  render: (groupId: string) => {
                    if (!groupId) return <Tag>独立</Tag>;
                    const group = scan.scanGroups.find((g: ScanGroup) => g.id === groupId);
                    const color = group?.groupType === 'git' ? 'blue' : 'orange';
                    const Icon = group?.groupType === 'git' ? LinkOutlined : FolderOutlined;
                    return (
                      <Tag color={color} icon={<Icon />}>
                        {group?.label || '关联'}
                      </Tag>
                    );
                  },
                },
              ]}
              pagination={false}
              size="small"
            />
            <div style={{ marginTop: 12, textAlign: 'right', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 12 }}>
                <span style={{ color: 'var(--color-text-light)' }}>
                  已选择 {scan.selectedKeys.length} / {scan.scanResults.length} 项
                </span>
                <Button
                  type="primary"
                  loading={scan.importing}
                  disabled={scan.selectedKeys.length === 0}
                  onClick={scan.handleImportSelected}
                >
                  导入选中项目
                </Button>
            </div>
          </>
        )}
      </Modal>

      {/* Batch Launch Progress Modal */}
      <Modal
        title="批量启动进度"
        open={batch.batchLaunchModalOpen}
        onCancel={() => batch.setBatchLaunchModalOpen(false)}
        footer={[
          <Button key="close" onClick={() => batch.setBatchLaunchModalOpen(false)}>关闭</Button>,
        ]}
        width={600}
      >
        <div style={{ maxHeight: 400, overflow: 'auto' }}>
          {Array.from(batch.batchLaunchProgress.entries()).map(([projectId, progress]) => {
            const project = projects.find(p => p.id === projectId);
            if (!project) return null;
            const priority = getProjectPriority(project);
            return (
              <div key={projectId} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '10px 12px', borderRadius: 8,
                background: progress.status === 'success' ? 'var(--color-success-light, rgba(34, 197, 94, 0.05))' :
                           progress.status === 'failed' ? 'var(--color-error-light, rgba(239, 68, 68, 0.05))' : 'transparent',
                marginBottom: 4,
              }}>
                <div style={{ width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  {progress.status === 'pending' && <ClockCircleOutlined style={{ fontSize: 18, color: 'var(--color-text-placeholder)' }} />}
                  {progress.status === 'launching' && <Spin size="small" />}
                  {progress.status === 'success' && <CheckCircleOutlined style={{ fontSize: 20, color: 'var(--color-status-done)' }} />}
                  {progress.status === 'failed' && <CloseCircleOutlined style={{ fontSize: 20, color: 'var(--color-status-cancel)' }} />}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <ProjectIcon name={project.name} techStack={project.techStack} iconType={project.iconType} iconUrl={project.iconUrl} iconColor={project.iconColor} size={22} />
                    <span style={{ fontWeight: 600, fontSize: 14, color: 'var(--color-text-primary)' }}>{project.name}</span>
                    <Tag color={getPriorityColor(priority)} style={{ fontSize: 10, margin: 0, padding: '0 6px' }}>
                      {getPriorityLabel(priority)}
                    </Tag>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--color-text-description)', display: 'flex', alignItems: 'center', gap: 8 }}>
                    {progress.status === 'pending' && '等待启动...'}
                    {progress.status === 'launching' && <span style={{ color: 'var(--color-info)' }}>正在启动...</span>}
                    {progress.status === 'success' && <span>已启动</span>}
                    {progress.status === 'failed' && <span style={{ color: 'var(--color-status-cancel)' }}>{progress.error || '启动失败'}</span>}
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                  {progress.status === 'failed' && (
                    <Button size="small" icon={<ReloadOutlined />} onClick={() => batch.handleRetryProject(projectId)} style={{ borderRadius: 6 }}>
                      重试
                    </Button>
                  )}
                  <Tag
                    color={progress.status === 'pending' ? 'default' : progress.status === 'launching' ? 'processing' : progress.status === 'success' ? 'success' : 'error'}
                    style={{ margin: 0, padding: '2px 8px', borderRadius: 6 }}
                  >
                    {progress.status === 'pending' && '等待中'}
                    {progress.status === 'launching' && '启动中'}
                    {progress.status === 'success' && '成功'}
                    {progress.status === 'failed' && '失败'}
                  </Tag>
                </div>
              </div>
            );
          })}
        </div>
      </Modal>

      {/* Quick Launch Modal */}
      <QuickLaunchModal
        visible={quickLaunchModalOpen}
        onClose={() => setQuickLaunchModalOpen(false)}
        projects={projects}
        onLaunch={handleQuickLaunch}
      />
    </div>
  );
}
