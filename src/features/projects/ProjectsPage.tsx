import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Button, Input, Select, Row, Col, Tag, Space, Modal, Form, message, Empty, Spin, Divider, Alert, Table, InputNumber, Tooltip, Checkbox, Progress } from 'antd';
import { PlusOutlined, SearchOutlined, FolderOpenOutlined, ScanOutlined, LinkOutlined, FolderOutlined, PlayCircleOutlined, DeleteOutlined, CodeOutlined, ReloadOutlined, ClockCircleOutlined, CheckCircleOutlined, ExclamationCircleOutlined, CloseCircleOutlined, ThunderboltOutlined, RocketOutlined, StopOutlined, PauseCircleOutlined, FileTextOutlined, EditOutlined } from '@ant-design/icons';
import { useTerminalStore } from '../../stores/terminalStore';
import { projectsApi, detectApi, terminalApi, healthApi, workspacesApi } from '../../api';
import type { CreateProjectInput } from '../../types';
import ProjectIcon from '../../shared/ProjectIcon';
import QuickLaunchModal from '../../shared/QuickLaunchModal';
import HealthBadge from '../../shared/HealthBadge';
import { launchHistoryStorage, LaunchProfile } from '../../lib/launchProfiles';
import { STATUS_COLORS, PROJECT_STATUSES, PRIORITY_OPTIONS } from '../../lib/constants';
import { buildLaunchRequests, getEffectiveCommand } from '../../lib/launchUtils';

const STATUS_OPTIONS = [...PROJECT_STATUSES];
const SOURCE_OPTIONS = [
  { value: 'Local', label: '本地项目' },
  { value: 'Remote', label: '远程项目' },
  { value: 'Hybrid', label: '混合项目' },
];

export default function ProjectsPage() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string | undefined>();
  const [workspaceFilter, setWorkspaceFilter] = useState<string | undefined>();
  const [workspaces, setWorkspaces] = useState<any[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [form] = Form.useForm();
  const [detecting, setDetecting] = useState(false);
  const [detectResult, setDetectResult] = useState<any>(null);
  const { requestLaunch } = useTerminalStore();

  // Scan directory state
  const [scanModalOpen, setScanModalOpen] = useState(false);
  const [scanPath, setScanPath] = useState('');
  const [scanMaxDepth, setScanMaxDepth] = useState(1);
  const [scanResults, setScanResults] = useState<any[]>([]);
  const [scanGroups, setScanGroups] = useState<any[]>([]);
  const [scanning, setScanning] = useState(false);
  const [selectedKeys, setSelectedKeys] = useState<React.Key[]>([]);
  const [importing, setImporting] = useState(false);

  // Batch launch state
  const [selectedProjectIds, setSelectedProjectIds] = useState<Set<string>>(new Set());
  const [batchLaunching, setBatchLaunching] = useState(false);
  const [batchLaunchProgress, setBatchLaunchProgress] = useState<Map<string, {
    status: 'pending' | 'launching' | 'success' | 'failed';
    error?: string;
    port?: number;
    terminalId?: string;
    order?: number;
  }>>(new Map());
  const [batchLaunchModalOpen, setBatchLaunchModalOpen] = useState(false);
  const [batchLaunchCancelled, setBatchLaunchCancelled] = useState(false);
  const [healthResults, setHealthResults] = useState<Record<string, any>>({});
  const [smartSortEnabled, setSmartSortEnabled] = useState(true);

  // Quick launch state
  const [quickLaunchModalOpen, setQuickLaunchModalOpen] = useState(false);

  // Get project launch priority (lower number = earlier)
  const getProjectPriority = (project: any): number => {
    const techStack = project.techStack || [];

    // Database / Cache / Message Queue - Priority 1 (start first)
    if (techStack.some((t: string) => /postgres|mysql|mongodb|redis|rabbitmq|kafka/i.test(t))) {
      return 1;
    }

    // Docker / Container - Priority 1
    if (techStack.some((t: string) => /docker|kubernetes|k8s/i.test(t))) {
      return 1;
    }

    // Backend API - Priority 2
    if (techStack.some((t: string) => /express|fastify|nest|django|flask|spring|rails/i.test(t))) {
      return 2;
    }

    // Frontend Web - Priority 3
    if (techStack.some((t: string) => /react|vue|angular|next|nuxt|svelte|vite/i.test(t))) {
      return 3;
    }

    // Mobile Apps - Priority 4
    if (techStack.some((t: string) => /react.native|flutter|ionic/i.test(t))) {
      return 4;
    }

    // Desktop Apps - Priority 4
    if (techStack.some((t: string) => /electron|tauri/i.test(t))) {
      return 4;
    }

    // Others - Priority 5
    return 5;
  };

  const getPriorityLabel = (priority: number): string => {
    switch (priority) {
      case 1: return '基础设施';
      case 2: return '后端服务';
      case 3: return '前端应用';
      case 4: return '客户端';
      case 5: return '其他';
      default: return '其他';
    }
  };

  const getPriorityColor = (priority: number): string => {
    switch (priority) {
      case 1: return 'blue';
      case 2: return 'green';
      case 3: return 'orange';
      case 4: return 'purple';
      case 5: return 'default';
      default: return 'default';
    }
  };

  const loadProjects = useCallback(async () => {
    try {
      const params: Record<string, string> = {};
      if (search) params.search = search;
      if (statusFilter) params.status = statusFilter;
      if (workspaceFilter) params.workspaceId = workspaceFilter;
      const data = await projectsApi.list(params);
      setProjects(data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, workspaceFilter]);

  useEffect(() => { loadProjects(); }, [loadProjects]);

  // Load workspaces
  useEffect(() => {
    workspacesApi.list().then((data) => setWorkspaces(data as any[])).catch(() => {});
  }, []);

  // Fetch health data once on mount (changes only after daily health check)
  useEffect(() => {
    healthApi.getAllLatest().then((healthData) => {
      const map: Record<string, any> = {};
      if (Array.isArray(healthData)) {
        healthData.forEach((h: any) => { map[h.projectId] = h; });
      }
      setHealthResults(map);
    }).catch(() => {});
  }, []);

  const handleDetect = async () => {
    const localPath = form.getFieldValue('localPath')?.trim();
    const repoUrl = form.getFieldValue('repoUrl')?.trim();

    if (!localPath && !repoUrl) {
      message.warning('请输入本地路径或 Git 仓库地址');
      return;
    }

    setDetecting(true);
    setDetectResult(null);

    try {
      let result: any;
      if (repoUrl) {
        result = await detectApi.gitRepo(repoUrl);
      } else {
        result = await detectApi.local(localPath);
      }

      setDetectResult(result);

      // Auto-fill form fields
      const updates: Record<string, any> = {};
      if (result.name) updates.name = result.name;
      if (result.description) updates.description = result.description;
      if (result.techStack?.length) updates.techStack = result.techStack;
      if (result.source) updates.source = result.source;
      if (result.localPath) updates.localPath = result.localPath;
      if (result.repoUrl) updates.repoUrl = result.repoUrl;
      if (result.openCommand) updates.openCommand = result.openCommand;
      form.setFieldsValue(updates);

      message.success(`检测完成，识别到 ${result.techStack?.length || 0} 项技术栈`);
    } catch (err: unknown) {
      message.error(`检测失败: ${String(err)}`);
    } finally {
      setDetecting(false);
    }
  };

  const handleCreate = async (values: any) => {
    // Prompt user to set openCommand if localPath is set but no command configured
    if (values.localPath?.trim() && !values.openCommand?.trim()) {
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
        // Focus the openCommand field
        form.scrollToField('openCommand');
        return;
      }
    }

    try {
      const payload: CreateProjectInput = {
        name: values.name,
        description: values.description,
        status: values.status,
        priority: values.priority,
        localPath: values.localPath,
        techStack: Array.isArray(values.techStack) ? values.techStack : (values.techStack ? values.techStack.split(',').map((s: string) => s.trim()).filter(Boolean) : []),
      };
      await projectsApi.create(payload);
      message.success('项目创建成功');
      setModalOpen(false);
      form.resetFields();
      setDetectResult(null);
      loadProjects();
    } catch (err: unknown) {
      message.error(String(err) || '创建失败');
    }
  };

  const handleDelete = async (id: string) => {
    Modal.confirm({
      title: '确认删除',
      content: '删除后不可恢复，确认要删除该项目吗？',
      okType: 'danger',
      onOk: async () => {
        await projectsApi.delete(id);
        message.success('已删除');
        loadProjects();
      },
    });
  };

  const handleRefreshProject = async (project: any) => {
    if (!project.localPath) {
      message.warning('项目没有本地路径，无法检测');
      return;
    }

    try {
      const updated = await projectsApi.refresh(project.id);
      // Update the project in the list
      setProjects(prev => prev.map(p => p.id === project.id ? updated : p));
      message.success(`${project.name} 信息已更新`);
    } catch (e: unknown) {
      message.warning(String(e) || '刷新失败');
    }
  };

  const openModal = () => {
    setDetectResult(null);
    form.resetFields();
    setModalOpen(true);
  };

  const handleBrowseFolder = async () => {
    try {
      const { open } = await import('@tauri-apps/plugin-dialog');
      const selected = await open({ directory: true });
      if (selected) {
        setScanPath(selected as string);
      }
    } catch (err) {
      message.error('无法打开文件夹选择器');
    }
  };

  const handleBrowseProjectPath = async () => {
    try {
      const { open } = await import('@tauri-apps/plugin-dialog');
      const selected = await open({ directory: true });
      if (selected) {
        form.setFieldsValue({ localPath: selected as string });
      }
    } catch (err) {
      message.error('无法打开文件夹选择器');
    }
  };

  const handleScan = async () => {
    if (!scanPath.trim()) {
      message.warning('请输入或选择扫描路径');
      return;
    }
    setScanning(true);
    setScanResults([]);
    setScanGroups([]);
    setSelectedKeys([]);
    try {
      const result = await detectApi.scanDirectory(scanPath.trim(), scanMaxDepth) as any;
      const projects = result.projects || [];
      const groups = result.groups || [];
      setScanResults(projects);
      setScanGroups(groups);
      if (projects.length === 0) {
        message.info('未发现任何项目');
      } else {
        const groupedCount = projects.filter((p: any) => p.groupId).length;
        message.success(`发现 ${projects.length} 个项目${groupedCount > 0 ? `，其中 ${groupedCount} 个存在关联` : ''}`);
      }
    } catch (err) {
      message.error(`扫描失败: ${String(err)}`);
    } finally {
      setScanning(false);
    }
  };

  const handleImportSelected = async () => {
    if (selectedKeys.length === 0) {
      message.warning('请先选择要导入的项目');
      return;
    }
    setImporting(true);
    try {
      const toImport = selectedKeys
        .map((key) => scanResults[Number(key)])
        .filter(Boolean)
        .map((project: any) => ({
          name: project.name,
          description: project.description,
          techStack: project.techStack,
          source: project.source,
          localPath: project.localPath,
          openCommand: project.openCommand,
          frontendCommand: project.frontendCommand,
          backendCommand: project.backendCommand,
          iconType: project.iconType,
          iconUrl: project.iconUrl,
          iconColor: project.iconColor,
        }));
      const result = await projectsApi.batchImport(toImport);
      if (result.imported > 0) {
        message.success(`成功导入 ${result.imported} 个项目${result.skipped > 0 ? `，${result.skipped} 个已存在跳过` : ''}`);
      } else if (result.skipped > 0) {
        message.info(`${result.skipped} 个项目已存在，无需重复导入`);
      }
      if (result.errors.length > 0) {
        message.warning(`${result.errors.length} 个导入失败`);
      }
    } catch (err) {
      message.error(`导入失败: ${String(err)}`);
    }
    setImporting(false);
    setScanModalOpen(false);
    setScanResults([]);
    setSelectedKeys([]);
    loadProjects();
  };

  const getLaunchHints = (project: any): string[] => {
    const hints: string[] = [];
    const techStack = project.techStack || [];
    const command = getEffectiveCommand(project) || '';

    if (techStack.some((t: string) => /react.native|flutter|ionic/i.test(t))) {
      hints.push('移动端项目：启动后需要在模拟器或真机上运行');
    }

    if (techStack.some((t: string) => /react.native/i.test(t))) {
      if (command.includes('android')) {
        hints.push('Android 调试：确保已连接设备或启动模拟器');
      }
      if (command.includes('ios')) {
        hints.push('iOS 调试：需要在 macOS 上运行，确保 Xcode 已安装');
      }
      if (!command.includes('android') && !command.includes('ios')) {
        hints.push('React Native：请确保已启动模拟器或连接真机');
      }
    }

    if (techStack.some((t: string) => /flutter/i.test(t))) {
      hints.push('Flutter：确保 Flutter SDK 已安装，设备已连接');
    }

    if (techStack.some((t: string) => /electron|tauri/i.test(t))) {
      hints.push('桌面应用：将启动独立的桌面窗口');
    }

    if (techStack.some((t: string) => /express|fastify|nest|django|flask|spring|rails/i.test(t))) {
      hints.push('后端服务：启动后可通过浏览器访问应用');
    }

    if (techStack.some((t: string) => /docker|kubernetes|k8s/i.test(t))) {
      hints.push('容器化应用：确保 Docker 已安装并运行');
    }

    if (techStack.some((t: string) => /python|flask|django/i.test(t))) {
      hints.push('Python 项目：确保已激活虚拟环境');
    }

    if (techStack.some((t: string) => /postgres|mysql|mongodb|redis|sql/i.test(t))) {
      hints.push('数据库依赖：确保数据库服务已启动');
    }

    if (techStack.some((t: string) => /node|express|fastify|nest/i.test(t))) {
      if (command.includes('dev')) {
        hints.push('开发服务器：启动后支持热重载');
      }
    }

    return hints;
  };

  const handleLaunchProject = async (project: any) => {
    const requests = buildLaunchRequests(project);
    if (requests.length === 0) {
      message.warning('请先设置启动命令');
      return;
    }

    const launchHints = getLaunchHints(project);

    if (launchHints.length > 0) {
      const confirmed = await new Promise<boolean>((resolve) => {
        Modal.confirm({
          title: '启动项目',
          icon: <PlayCircleOutlined style={{ color: '#52c41a' }} />,
          width: 520,
          content: (
            <div>
              <div style={{ marginBottom: 12, color: '#6b7a99', fontSize: 13 }}>
                即将启动项目：<strong style={{ color: '#1a1f36' }}>{project.name}</strong>
              </div>
              <div style={{
                background: 'rgba(245, 158, 11, 0.08)',
                border: '1px solid rgba(245, 158, 11, 0.25)',
                borderRadius: 8,
                padding: '12px 14px',
                marginBottom: 12,
              }}>
                <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8, color: '#d97706' }}>
                  <ClockCircleOutlined style={{ marginRight: 6 }} />
                  启动提示
                </div>
                <ul style={{ margin: 0, paddingLeft: 16, fontSize: 12, lineHeight: 2, color: '#92400e' }}>
                  {launchHints.map((hint, i) => (
                    <li key={i}>{hint}</li>
                  ))}
                </ul>
              </div>
              <div style={{ fontSize: 12, color: '#9eadc0' }}>
                启动命令：
                {project.frontendCommand && <code style={{ background: 'rgba(0,0,0,0.05)', padding: '2px 6px', borderRadius: 4 }}>{project.frontendCommand}</code>}
                {project.frontendCommand && project.backendCommand && ' + '}
                {project.backendCommand && <code style={{ background: 'rgba(0,0,0,0.05)', padding: '2px 6px', borderRadius: 4 }}>{project.backendCommand}</code>}
                {!project.frontendCommand && !project.backendCommand && project.openCommand && <code style={{ background: 'rgba(0,0,0,0.05)', padding: '2px 6px', borderRadius: 4 }}>{project.openCommand}</code>}
              </div>
            </div>
          ),
          okText: '继续启动',
          cancelText: '取消',
          onOk: () => resolve(true),
          onCancel: () => resolve(false),
        });
      });
      if (!confirmed) return;
    }

    // Launch using terminal - supports multiple commands
    requests.forEach(req => requestLaunch(req));
    message.success(requests.length > 1 ? '正在启动前端和后端...' : '正在启动项目...');
  };

  // Batch launch functions
  const handleToggleProjectSelection = (projectId: string, e?: React.SyntheticEvent) => {
    e?.stopPropagation();
    setSelectedProjectIds(prev => {
      const next = new Set(prev);
      if (next.has(projectId)) {
        next.delete(projectId);
      } else {
        next.add(projectId);
      }
      return next;
    });
  };

  const handleSelectAllProjects = () => {
    if (selectedProjectIds.size === projects.length) {
      setSelectedProjectIds(new Set());
    } else {
      setSelectedProjectIds(new Set(projects.map(p => p.id)));
    }
  };

  const extractPortFromCommand = (command: string): number | null => {
    // Try to extract port from command
    const portMatch = command.match(/PORT=(\d+)/);
    if (portMatch) return parseInt(portMatch[1], 10);

    const portArgMatch = command.match(/--port[=\s]+(\d+)/);
    if (portArgMatch) return parseInt(portArgMatch[1], 10);

    // Default ports for common frameworks
    if (command.includes('react') || command.includes('vue') || command.includes('next') || command.includes('vite')) {
      return 3000;
    }
    if (command.includes('django') || command.includes('flask')) {
      return 8000;
    }
    if (command.includes('express') || command.includes('fastify') || command.includes('nest')) {
      return 3000;
    }

    return 3000; // Default
  };

  const handleBatchLaunch = async () => {
    if (selectedProjectIds.size === 0) {
      message.warning('请先选择要启动的项目');
      return;
    }

    const selectedProjects = projects.filter(p => selectedProjectIds.has(p.id));
    const projectsWithCommands = selectedProjects.filter(p => getEffectiveCommand(p));
    const projectsWithoutCommands = selectedProjects.filter(p => !getEffectiveCommand(p));

    if (projectsWithCommands.length === 0) {
      message.warning('选中的项目都没有设置启动命令');
      return;
    }

    if (projectsWithoutCommands.length > 0) {
      message.info(`跳过 ${projectsWithoutCommands.length} 个未设置启动命令的项目`);
    }

    // Check for port conflicts
    const portConflicts: Array<{project: any, port: number}> = [];
    const usedPorts = new Set<number>();

    for (const project of projectsWithCommands) {
      const port = extractPortFromCommand(getEffectiveCommand(project) || '');
      if (port && usedPorts.has(port)) {
        portConflicts.push({ project, port });
      } else if (port) {
        usedPorts.add(port);
      }
    }

    if (portConflicts.length > 0) {
      // Show port conflict resolution dialog
      const resolved = await showPortConflictDialog(portConflicts);
      if (!resolved) return;
    }

    // Show launch confirmation
    const confirmed = await new Promise<boolean>((resolve) => {
      const sortedForDisplay = smartSortEnabled
        ? [...projectsWithCommands].sort((a, b) => getProjectPriority(a) - getProjectPriority(b))
        : projectsWithCommands;

      Modal.confirm({
        title: '批量启动项目',
        icon: <ThunderboltOutlined style={{ color: '#52c41a' }} />,
        width: 580,
        content: (
          <div>
            <div style={{ marginBottom: 12, color: '#6b7a99', fontSize: 13 }}>
              即将启动 <strong style={{ color: '#1a1f36' }}>{projectsWithCommands.length}</strong> 个项目
              {smartSortEnabled && (
                <span style={{ marginLeft: 8, color: '#52c41a', fontSize: 12 }}>
                  (智能排序已启用)
                </span>
              )}
            </div>
            <div style={{ marginBottom: 12 }}>
              {sortedForDisplay.map((project, index) => {
                const priority = getProjectPriority(project);
                return (
                  <div key={project.id} style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '8px 12px',
                    background: index % 2 === 0 ? 'rgba(0,0,0,0.02)' : 'transparent',
                    borderRadius: 6,
                    marginBottom: 4,
                  }}>
                    {smartSortEnabled && (
                      <div style={{
                        width: 24,
                        height: 24,
                        borderRadius: '50%',
                        background: getPriorityColor(priority) === 'blue' ? '#3b82f6' :
                                   getPriorityColor(priority) === 'green' ? '#22c55e' :
                                   getPriorityColor(priority) === 'orange' ? '#f59e0b' :
                                   getPriorityColor(priority) === 'purple' ? '#8b5cf6' : '#6b7280',
                        color: 'white',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 12,
                        fontWeight: 600,
                      }}>
                        {index + 1}
                      </div>
                    )}
                    <ProjectIcon name={project.name} techStack={project.techStack} iconType={project.iconType} iconUrl={project.iconUrl} iconColor={project.iconColor} size={20} />
                    <span style={{ flex: 1, fontSize: 13 }}>{project.name}</span>
                    <Tag color={getPriorityColor(priority)} style={{ fontSize: 11 }}>
                      {getPriorityLabel(priority)}
                    </Tag>
                    <Tag style={{ fontSize: 11 }}>{getEffectiveCommand(project)}</Tag>
                  </div>
                );
              })}
            </div>
            {portConflicts.length > 0 && (
              <div style={{
                background: 'rgba(245, 158, 11, 0.08)',
                border: '1px solid rgba(245, 158, 11, 0.25)',
                borderRadius: 8,
                padding: '12px 14px',
                marginBottom: 12,
              }}>
                <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8, color: '#d97706' }}>
                  <ExclamationCircleOutlined style={{ marginRight: 6 }} />
                  端口冲突已解决
                </div>
                <div style={{ fontSize: 12, color: '#92400e' }}>
                  {portConflicts.length} 个项目的端口冲突已通过临时端口解决
                </div>
              </div>
            )}
            <div style={{ fontSize: 12, color: '#9eadc0' }}>
              提示：启动过程中可以随时取消
            </div>
          </div>
        ),
        okText: '开始启动',
        cancelText: '取消',
        onOk: () => resolve(true),
        onCancel: () => resolve(false),
      });
    });

    if (!confirmed) return;

    // Start batch launch
    const startTime = Date.now();
    setBatchLaunching(true);
    setBatchLaunchCancelled(false);
    setBatchLaunchModalOpen(true);

    // Sort projects by priority if smart sort is enabled
    let sortedProjects = [...projectsWithCommands];
    if (smartSortEnabled) {
      sortedProjects.sort((a, b) => getProjectPriority(a) - getProjectPriority(b));
    }

    // Initialize progress
    const initialProgress = new Map<string, {
      status: 'pending' | 'launching' | 'success' | 'failed';
      error?: string;
      port?: number;
      terminalId?: string;
      order?: number;
    }>();

    sortedProjects.forEach((project, index) => {
      initialProgress.set(project.id, {
        status: 'pending',
        order: index + 1
      });
    });
    setBatchLaunchProgress(initialProgress);

    // Launch projects sequentially with smart ordering
    let successCount = 0;
    let failedCount = 0;

    for (const project of sortedProjects) {
      if (batchLaunchCancelled) break;

      // Update status to launching
      setBatchLaunchProgress(prev => {
        const next = new Map(prev);
        const progress = next.get(project.id);
        next.set(project.id, {
          ...progress,
          status: 'launching'
        });
        return next;
      });

      try {
        const tid = await terminalApi.start(project.id, getEffectiveCommand(project) || '', project.localPath);

        // Update status to success
        setBatchLaunchProgress(prev => {
          const next = new Map(prev);
          const progress = next.get(project.id);
          next.set(project.id, {
            ...progress,
            status: 'success',
            terminalId: tid,
            port: extractPortFromCommand(getEffectiveCommand(project) || '') || undefined
          });
          return next;
        });

        successCount++;

        // Smart delay between launches based on priority
        const delay = getProjectPriority(project) === 1 ? 1000 : 500;
        await new Promise(resolve => setTimeout(resolve, delay));
      } catch (error: any) {
        // Update status to failed
        setBatchLaunchProgress(prev => {
          const next = new Map(prev);
          const progress = next.get(project.id);
          next.set(project.id, {
            ...progress,
            status: 'failed',
            error: String(error) || '启动失败'
          });
          return next;
        });

        failedCount++;
      }
    }

    setBatchLaunching(false);

    // Save launch history
    launchHistoryStorage.add({
      projects: Array.from(batchLaunchProgress.entries()).map(([projectId, progress]) => {
        const project = projects.find(p => p.id === projectId);
        return {
          projectId,
          projectName: project?.name || 'Unknown',
          status: progress.status === 'success' ? 'success' as const : 'failed' as const,
          port: progress.port,
          error: progress.error,
        };
      }),
      totalDuration: Date.now() - startTime,
      successCount,
      failedCount,
    });

    if (successCount > 0) {
      message.success(`成功启动 ${successCount} 个项目${failedCount > 0 ? `，${failedCount} 个失败` : ''}`);
    } else if (failedCount > 0) {
      message.error(`所有 ${failedCount} 个项目启动失败`);
    }
  };

  const handleQuickLaunch = (projectIds: string[], profile?: LaunchProfile) => {
    setSelectedProjectIds(new Set(projectIds));

    // Set smart sort based on profile
    if (profile) {
      setSmartSortEnabled(profile.launchOrder === 'smart');
    }

    // Trigger batch launch
    setTimeout(() => {
      handleBatchLaunch();
    }, 100);
  };

  const showPortConflictDialog = (conflicts: Array<{project: any, port: number}>): Promise<boolean> => {
    return new Promise((resolve) => {
      Modal.confirm({
        title: '端口冲突',
        icon: <ExclamationCircleOutlined style={{ color: '#f59e0b' }} />,
        width: 520,
        content: (
          <div>
            <div style={{ marginBottom: 12, color: '#6b7a99', fontSize: 13 }}>
              检测到 <strong style={{ color: '#1a1f36' }}>{conflicts.length}</strong> 个项目的端口存在冲突
            </div>
            <div style={{ marginBottom: 12 }}>
              {conflicts.map(({ project, port }) => (
                <div key={project.id} style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '8px 12px',
                  background: 'rgba(245, 158, 11, 0.08)',
                  borderRadius: 6,
                  marginBottom: 8,
                }}>
                  <ProjectIcon name={project.name} techStack={project.techStack} iconType={project.iconType} iconUrl={project.iconUrl} iconColor={project.iconColor} size={24} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{project.name}</div>
                    <div style={{ fontSize: 12, color: '#92400e' }}>
                      端口 {port} 已被占用
                    </div>
                  </div>
                  <Tag color="warning">冲突</Tag>
                </div>
              ))}
            </div>
            <div style={{
              background: 'rgba(99, 102, 241, 0.08)',
              border: '1px solid rgba(99, 102, 241, 0.25)',
              borderRadius: 8,
              padding: '12px 14px',
            }}>
              <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8, color: '#4f46e5' }}>
                解决方案
              </div>
              <ul style={{ margin: 0, paddingLeft: 16, fontSize: 12, lineHeight: 2, color: '#3730a3' }}>
                <li>系统将自动使用临时端口启动这些项目</li>
                <li>不会修改项目的配置文件</li>
                <li>关闭进程后临时端口配置自动失效</li>
              </ul>
            </div>
          </div>
        ),
        okText: '使用临时端口',
        cancelText: '取消',
        onOk: () => resolve(true),
        onCancel: () => resolve(false),
      });
    });
  };

  const handleBatchLaunchCancel = () => {
    setBatchLaunchCancelled(true);
    message.info('正在取消批量启动...');
  };

  const getBatchLaunchStats = () => {
    const stats = { pending: 0, launching: 0, success: 0, failed: 0 };
    batchLaunchProgress.forEach((value) => {
      stats[value.status]++;
    });
    return stats;
  };

  const handleBatchStop = async () => {
    const runningProjects = Array.from(batchLaunchProgress.entries())
      .filter(([_, progress]) => progress.status === 'success' && progress.terminalId)
      .map(([projectId, progress]) => ({
        projectId,
        terminalId: progress.terminalId!
      }));

    if (runningProjects.length === 0) {
      message.info('没有正在运行的项目');
      return;
    }

    const confirmed = await new Promise<boolean>((resolve) => {
      Modal.confirm({
        title: '批量停止项目',
        icon: <StopOutlined style={{ color: '#ff4d4f' }} />,
        content: `确定要停止 ${runningProjects.length} 个正在运行的项目吗？`,
        okText: '停止所有',
        cancelText: '取消',
        okType: 'danger',
        onOk: () => resolve(true),
        onCancel: () => resolve(false),
      });
    });

    if (!confirmed) return;

    let successCount = 0;
    let failedCount = 0;

    for (const { projectId, terminalId } of runningProjects) {
      try {
        await terminalApi.stop(terminalId);
        setBatchLaunchProgress(prev => {
          const next = new Map(prev);
          const progress = next.get(projectId);
          if (progress) {
            next.set(projectId, { ...progress, status: 'failed', error: '已停止' });
          }
          return next;
        });
        successCount++;
      } catch (error) {
        failedCount++;
      }
    }

    if (successCount > 0) {
      message.success(`已停止 ${successCount} 个项目`);
    }
    if (failedCount > 0) {
      message.error(`${failedCount} 个项目停止失败`);
    }
  };

  const handleRetryProject = async (projectId: string) => {
    const project = projects.find(p => p.id === projectId);
    if (!project || !getEffectiveCommand(project)) return;

    // Update status to launching
    setBatchLaunchProgress(prev => {
      const next = new Map(prev);
      next.set(projectId, { status: 'launching' });
      return next;
    });

    try {
      const tid = await terminalApi.start(project.id, getEffectiveCommand(project) || '', project.localPath);

      // Update status to success
      setBatchLaunchProgress(prev => {
        const next = new Map(prev);
        next.set(projectId, {
          status: 'success',
          terminalId: tid,
          port: extractPortFromCommand(getEffectiveCommand(project) || '') || undefined
        });
        return next;
      });

      message.success(`${project.name} 已重新启动`);
    } catch (error: any) {
      setBatchLaunchProgress(prev => {
        const next = new Map(prev);
        next.set(projectId, {
          status: 'failed',
          error: String(error) || '启动失败'
        });
        return next;
      });
    }
  };

  return (
    <div style={{ padding: 24 }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 24,
        paddingBottom: 16,
        borderBottom: '1px solid rgba(0,0,0,0.06)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <h2 style={{ margin: 0, fontSize: 24, fontWeight: 600 }}>项目管理</h2>
          {selectedProjectIds.size > 0 && (
            <Tag color="success" style={{ fontSize: 12 }}>
              已选中 {selectedProjectIds.size} 个项目
            </Tag>
          )}
        </div>
        <Space>
          {selectedProjectIds.size > 0 && (
            <Button
              type="primary"
              icon={<PlayCircleOutlined />}
              loading={batchLaunching}
              onClick={handleBatchLaunch}
              size="large"
              style={{
                background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
                border: 'none',
                boxShadow: '0 4px 12px rgba(34, 197, 94, 0.3)',
              }}
            >
              启动选中 ({selectedProjectIds.size})
            </Button>
          )}
          <Button
            icon={<RocketOutlined />}
            onClick={() => setQuickLaunchModalOpen(true)}
            size="large"
            style={{
              background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
              color: 'white',
              border: 'none',
              boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)',
            }}
          >
            快速启动
          </Button>
          <Button
            icon={<ScanOutlined />}
            onClick={() => setScanModalOpen(true)}
            size="large"
          >
            扫描
          </Button>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={openModal}
            size="large"
          >
            新建项目
          </Button>
        </Space>
      </div>

      {/* Filters */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        marginBottom: 20,
        padding: '12px 16px',
        background: 'rgba(0,0,0,0.02)',
        borderRadius: 8,
      }}>
        <Input
          placeholder="搜索项目..."
          prefix={<SearchOutlined style={{ color: '#8b95a5' }} />}
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ width: 280, borderRadius: 6 }}
          allowClear
          size="large"
        />
        <Select
          placeholder="按状态筛选"
          value={statusFilter}
          onChange={setStatusFilter}
          allowClear
          style={{ width: 160 }}
          size="large"
          options={STATUS_OPTIONS.map(s => ({ value: s, label: s }))}
        />
        {workspaces.length > 0 && (
          <Select
            placeholder="按工作区筛选"
            value={workspaceFilter}
            onChange={setWorkspaceFilter}
            allowClear
            style={{ width: 160 }}
            size="large"
            options={[
              { value: 'none', label: '未分组' },
              ...workspaces.map((w: any) => ({ value: w.id, label: w.name })),
            ]}
          />
        )}
        <div style={{ flex: 1 }} />
        {projects.length > 0 && (
          <Checkbox
            checked={selectedProjectIds.size === projects.length}
            indeterminate={selectedProjectIds.size > 0 && selectedProjectIds.size < projects.length}
            onChange={handleSelectAllProjects}
          >
            全选 ({selectedProjectIds.size}/{projects.length})
          </Checkbox>
        )}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 80 }}><Spin size="large" /></div>
      ) : projects.length === 0 ? (
        <Empty description="暂无项目" />
      ) : (
        <Row gutter={[20, 20]}>
          {projects.map(project => {
            const isSelected = selectedProjectIds.has(project.id);
            return (
              <Col key={project.id} xs={24} sm={12} md={8} lg={6}>
                <Card
                  hoverable
                  onClick={() => navigate(`/projects/${project.id}`)}
                  style={{
                    borderRadius: 12,
                    height: 220,
                    position: 'relative',
                    border: isSelected ? '2px solid #22c55e' : '1px solid rgba(0,0,0,0.08)',
                    boxShadow: isSelected
                      ? '0 8px 24px rgba(34, 197, 94, 0.15)'
                      : '0 2px 8px rgba(0,0,0,0.04)',
                    transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
                    cursor: 'pointer',
                  }}
                  styles={{ body: {
                    padding: 16,
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                  } }}
                >
                  {/* 右上角操作按钮 */}
                  <div style={{
                    position: 'absolute',
                    top: 12,
                    right: 12,
                    display: 'flex',
                    gap: 4,
                    zIndex: 1,
                  }}>
                    <Tooltip title="刷新检测">
                      <Button
                        type="text"
                        size="small"
                        icon={<ReloadOutlined />}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRefreshProject(project);
                        }}
                        style={{ color: '#8b95a5' }}
                      />
                    </Tooltip>
                    <Tooltip title="启动项目">
                      <Button
                        type="text"
                        size="small"
                        icon={<PlayCircleOutlined />}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleLaunchProject(project);
                        }}
                        style={{ color: '#22c55e' }}
                      />
                    </Tooltip>
                    <Tooltip title="打开终端">
                      <Button
                        type="text"
                        size="small"
                        icon={<CodeOutlined />}
                        onClick={(e) => {
                          e.stopPropagation();
                          requestLaunch({ cwd: project.localPath, label: project.name, projectId: project.id });
                        }}
                        style={{ color: '#8b95a5' }}
                      />
                    </Tooltip>
                    <Tooltip title="删除项目">
                      <Button
                        type="text"
                        size="small"
                        icon={<DeleteOutlined />}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(project.id);
                        }}
                        style={{ color: '#ff4d4f' }}
                      />
                    </Tooltip>
                  </div>

                {/* 内容区域：左列复选框 + 右列内容 */}
                <div style={{ display: 'flex', gap: 12, flex: 1 }}>
                  {/* 左列：复选框 */}
                  <div style={{ flexShrink: 0, paddingTop: 2 }}>
                    <Checkbox
                      checked={isSelected}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => {
                        e.stopPropagation();
                        handleToggleProjectSelection(project.id, e as any);
                      }}
                    />
                  </div>

                  {/* 右列：内容 */}
                  <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
                    {/* 区域1: 头部 - 图标 + 名称 + 状态 */}
                    <div style={{ display: 'flex', gap: 10, marginBottom: 10, flexShrink: 0 }}>
                      <ProjectIcon
                        name={project.name}
                        techStack={project.techStack}
                        iconType={project.iconType}
                        iconUrl={project.iconUrl}
                        iconColor={project.iconColor}
                        size={40}
                      />
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <Tooltip title={project.name}>
                          <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {project.name}
                          </div>
                        </Tooltip>
                        <Tag color={STATUS_COLORS[project.status] || 'default'} style={{ fontSize: 11, margin: 0 }}>
                          {project.status}
                        </Tag>
                        <HealthBadge result={healthResults[project.id]} />
                      </div>
                    </div>

                    {/* 区域2: 运行状态 + 关键指标 */}
                    <div style={{
                      display: 'flex', gap: 8, marginBottom: 10, flexShrink: 0,
                      flexWrap: 'wrap', alignItems: 'center',
                    }}>
                      {/* 前端状态 */}
                      {project.frontendCommand && (
                        <Tag
                          style={{ fontSize: 11, margin: 0, cursor: 'pointer' }}
                          color={project.frontendStatus === 'running' ? 'green' : 'default'}
                          icon={project.frontendStatus === 'running' ? <CheckCircleOutlined /> : <PauseCircleOutlined />}
                        >
                          {project.frontendStatus === 'running' ? '前端运行中' : '前端'}
                        </Tag>
                      )}
                      {/* 后端状态 */}
                      {project.backendCommand && (
                        <Tag
                          style={{ fontSize: 11, margin: 0, cursor: 'pointer' }}
                          color={project.backendStatus === 'running' ? 'green' : 'default'}
                          icon={project.backendStatus === 'running' ? <CheckCircleOutlined /> : <PauseCircleOutlined />}
                        >
                          {project.backendStatus === 'running' ? '后端运行中' : '后端'}
                        </Tag>
                      )}
                      {/* 任务进度 */}
                      {project.taskCount > 0 && (
                        <Tooltip title={`${project.taskCount} 个任务`}>
                          <Tag style={{ fontSize: 11, margin: 0 }} icon={<FileTextOutlined />}>
                            {project.taskCount}
                          </Tag>
                        </Tooltip>
                      )}
                      {/* Git 信息 */}
                      {healthResults[project.id] && (
                        <>
                          {healthResults[project.id].dirtyFileCount > 0 && (
                            <Tooltip title={`${healthResults[project.id].dirtyFileCount} 个未提交文件`}>
                              <Tag color="orange" style={{ fontSize: 11, margin: 0 }} icon={<EditOutlined />}>
                                {healthResults[project.id].dirtyFileCount}
                              </Tag>
                            </Tooltip>
                          )}
                          {(healthResults[project.id].aheadCount > 0 || healthResults[project.id].behindCount > 0) && (
                            <Tag color="blue" style={{ fontSize: 11, margin: 0 }}>
                              ↑{healthResults[project.id].aheadCount} ↓{healthResults[project.id].behindCount}
                            </Tag>
                          )}
                        </>
                      )}
                    </div>

                    {/* 区域3: 描述 */}
                    <div style={{
                      flex: 1, marginBottom: 10,
                      color: '#6b7a99', fontSize: 13, lineHeight: 1.5,
                      overflow: 'hidden', display: '-webkit-box',
                      WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                    }}>
                      {project.description || (
                        <span style={{ color: '#c0c8d8', fontStyle: 'italic' }}>
                          暂无描述，点击添加项目介绍...
                        </span>
                      )}
                    </div>

                    {/* 区域4: 技术栈 */}
                    <div style={{ flexShrink: 0 }}>
                      {project.techStack?.length > 0 ? (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                          {project.techStack.slice(0, 3).map((t: string) => (
                            <Tag key={t} style={{ fontSize: 11, margin: 0 }}>{t}</Tag>
                          ))}
                          {project.techStack.length > 3 && (
                            <Tag style={{ fontSize: 11, margin: 0, color: '#9eadc0' }}>
                              +{project.techStack.length - 3}
                            </Tag>
                          )}
                        </div>
                      ) : (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#c0c8d8', fontSize: 12 }}>
                          <CodeOutlined />
                          <span style={{ fontStyle: 'italic' }}>添加技术栈标签...</span>
                        </div>
                      )}
                      {project.remoteRepos?.length > 0 && (
                        <Tag color="blue" style={{ marginTop: 4 }}>{project.remoteRepos.length} 仓库</Tag>
                      )}
                    </div>
                  </div>
                </div>
              </Card>
            </Col>
          );
          })}
        </Row>
      )}

      {/* 新建项目弹窗 */}
      <Modal
        title="新建项目"
        open={modalOpen}
        onCancel={() => { setModalOpen(false); form.resetFields(); setDetectResult(null); }}
        onOk={() => form.submit()}
        okText="创建"
        cancelText="取消"
        width={560}
      >
        <Form form={form} layout="vertical" onFinish={handleCreate}>
          {/* 自动检测区域 */}
          <div style={{
            background: 'rgba(99, 102, 241, 0.08)',
            border: '1px dashed rgba(99, 102, 241, 0.3)',
            borderRadius: 8,
            padding: '12px 16px',
            marginBottom: 16,
          }}>
            <div style={{ fontWeight: 600, marginBottom: 8, fontSize: 13 }}>
              <ScanOutlined style={{ marginRight: 6 }} />
              自动检测
            </div>
            <Row gutter={8}>
              <Col flex="auto">
                <Form.Item name="localPath" style={{ marginBottom: 8 }}>
                  <Input
                    placeholder="本地路径，如 D:\Projects\my-app"
                    prefix={<FolderOpenOutlined />}
                    suffix={
                      <FolderOutlined
                        onClick={handleBrowseProjectPath}
                        style={{ cursor: 'pointer', color: '#6b7a99' }}
                      />
                    }
                  />
                </Form.Item>
              </Col>
            </Row>
            <Row gutter={8}>
              <Col flex="auto">
                <Form.Item name="repoUrl" style={{ marginBottom: 8 }}>
                  <Input
                    placeholder="Git 仓库地址，如 https://github.com/user/repo"
                    prefix={<LinkOutlined />}
                  />
                </Form.Item>
              </Col>
            </Row>
            <Button
              type="primary"
              ghost
              icon={<ScanOutlined />}
              loading={detecting}
              onClick={handleDetect}
              block
            >
              {detecting ? '正在检测...' : '一键检测项目信息'}
            </Button>

            {detectResult && (
              <Alert
                type="success"
                showIcon
                style={{ marginTop: 8 }}
                message={
                  <span>
                    检测完成：
                    {detectResult.name && <Tag color="blue">{detectResult.name}</Tag>}
                    {detectResult.techStack?.map((t: string) => <Tag key={t}>{t}</Tag>)}
                    {detectResult.repoPlatform && <Tag color="green">{detectResult.repoPlatform}</Tag>}
                  </span>
                }
              />
            )}
          </div>

          <Divider style={{ margin: '12px 0' }}>项目信息</Divider>

          <Form.Item name="name" label="项目名称" rules={[{ required: true, message: '请输入项目名称' }]}>
            <Input placeholder="我的项目" />
          </Form.Item>
          <Form.Item name="description" label="项目描述">
            <Input.TextArea rows={2} placeholder="简要描述项目..." />
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="source" label="项目来源" initialValue="Local">
                <Select options={SOURCE_OPTIONS} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="priority" label="优先级" initialValue="Medium">
                <Select options={PRIORITY_OPTIONS.map(p => ({ value: p, label: p }))} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="openCommand" label="启动命令" tooltip="检测后自动填充，支持 {path} 占位符">
            <Input placeholder="如 npm run dev（检测后自动填充）" />
          </Form.Item>
          <Form.Item name="techStack" label="技术栈">
            <Select
              mode="tags"
              placeholder="输入后回车添加，如 React、TypeScript"
              tokenSeparators={[',']}
            />
          </Form.Item>
        </Form>
      </Modal>

      {/* 扫描目录弹窗 */}
      <Modal
        title="扫描目录"
        open={scanModalOpen}
        onCancel={() => { setScanModalOpen(false); setScanResults([]); setScanGroups([]); setSelectedKeys([]); }}
        footer={null}
        width={800}
      >
        <div style={{ marginBottom: 16 }}>
          <Row gutter={8} align="middle">
            <Col flex="auto">
              <Input
                placeholder="输入目录路径，如 D:\Develop"
                value={scanPath}
                onChange={e => setScanPath(e.target.value)}
                prefix={<FolderOpenOutlined />}
              />
            </Col>
            <Col>
              <Button icon={<FolderOutlined />} onClick={handleBrowseFolder}>
                浏览
              </Button>
            </Col>
            <Col>
              <InputNumber
                min={1}
                max={5}
                value={scanMaxDepth}
                onChange={v => setScanMaxDepth(v ?? 1)}
                addonBefore="深度"
                style={{ width: 100 }}
              />
            </Col>
            <Col>
              <Button type="primary" icon={<ScanOutlined />} loading={scanning} onClick={handleScan}>
                {scanning ? '扫描中...' : '开始扫描'}
              </Button>
            </Col>
          </Row>
        </div>

        {scanResults.length > 0 && (
          <>
            {scanGroups.length > 0 && (
              <div style={{ marginBottom: 12, padding: '8px 12px', background: 'rgba(99, 102, 241, 0.06)', borderRadius: 6, fontSize: 13 }}>
                <span style={{ marginRight: 12, color: '#6b7a99' }}>关联关系：</span>
                {scanGroups.map(g => (
                  <Tag
                    key={g.id}
                    color={g.groupType === 'git' ? 'blue' : 'orange'}
                    style={{ marginRight: 8 }}
                    icon={g.groupType === 'git' ? <LinkOutlined /> : <FolderOutlined />}
                  >
                    {g.label}
                  </Tag>
                ))}
              </div>
            )}
            <Table
              rowSelection={{
                selectedRowKeys: selectedKeys,
                onChange: setSelectedKeys,
              }}
              dataSource={scanResults.map((r, i) => ({ ...r, key: i }))}
              rowKey="key"
              pagination={false}
              size="small"
              scroll={{ y: 400 }}
              columns={[
                {
                  title: '项目名',
                  dataIndex: 'name',
                  width: 150,
                  ellipsis: true,
                },
                {
                  title: '路径',
                  dataIndex: 'localPath',
                  ellipsis: true,
                },
                {
                  title: '技术栈',
                  dataIndex: 'techStack',
                  width: 250,
                  render: (stack: string[]) => (
                    <Space size={2} wrap>
                      {stack?.slice(0, 4).map(t => <Tag key={t} style={{ fontSize: 11 }}>{t}</Tag>)}
                      {stack?.length > 4 && <Tag style={{ fontSize: 11 }}>+{stack.length - 4}</Tag>}
                    </Space>
                  ),
                },
                {
                  title: '来源',
                  dataIndex: 'source',
                  width: 80,
                  render: (s: string) => <Tag color={s === 'Hybrid' ? 'blue' : 'default'}>{s}</Tag>,
                },
                {
                  title: '仓库',
                  dataIndex: 'repoPlatform',
                  width: 80,
                  render: (p: string) => p ? <Tag color="green">{p}</Tag> : '-',
                },
                {
                  title: '关联',
                  dataIndex: 'groupId',
                  width: 120,
                  render: (groupId: string) => {
                    if (!groupId) return <Tag>独立</Tag>;
                    const group = scanGroups.find((g: any) => g.id === groupId);
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
            />
            <div style={{ marginTop: 12, textAlign: 'right' }}>
              <Space>
                <span style={{ color: '#9eadc0' }}>
                  已选择 {selectedKeys.length} / {scanResults.length} 项
                </span>
                <Button
                  type="primary"
                  loading={importing}
                  disabled={selectedKeys.length === 0}
                  onClick={handleImportSelected}
                >
                  导入选中项目
                </Button>
              </Space>
            </div>
          </>
        )}
      </Modal>

      {/* Batch launch progress modal */}
      <Modal
        title={
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <ThunderboltOutlined style={{ color: '#52c41a', fontSize: 18 }} />
              <span style={{ fontSize: 16, fontWeight: 600 }}>批量启动进度</span>
            </div>
            <Space>
              <Checkbox
                checked={smartSortEnabled}
                onChange={(e) => setSmartSortEnabled(e.target.checked)}
                disabled={batchLaunching}
              >
                智能排序
              </Checkbox>
            </Space>
          </div>
        }
        open={batchLaunchModalOpen}
        onCancel={handleBatchLaunchCancel}
        footer={[
          <Button key="stop" danger icon={<StopOutlined />} onClick={handleBatchStop} disabled={!batchLaunching || getBatchLaunchStats().success === 0}>
            停止所有
          </Button>,
          <Button key="cancel" onClick={handleBatchLaunchCancel} disabled={!batchLaunching}>
            取消启动
          </Button>,
          <Button key="close" type="primary" onClick={() => setBatchLaunchModalOpen(false)} disabled={batchLaunching}>
            {batchLaunching ? '启动中...' : '关闭'}
          </Button>,
        ]}
        width={700}
        maskClosable={false}
      >
        {/* Progress summary */}
        <div style={{
          padding: '16px 20px',
          background: 'linear-gradient(135deg, rgba(34, 197, 94, 0.05) 0%, rgba(59, 130, 246, 0.05) 100%)',
          borderRadius: 12,
          marginBottom: 20,
          border: '1px solid rgba(0,0,0,0.05)',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <span style={{ color: '#6b7a99', fontSize: 14, fontWeight: 500 }}>
              启动进度 ({getBatchLaunchStats().success + getBatchLaunchStats().failed} / {batchLaunchProgress.size})
            </span>
            <Space size={12}>
              <Tag color="processing" style={{ margin: 0, padding: '2px 8px' }}>
                {getBatchLaunchStats().launching} 运行中
              </Tag>
              <Tag color="success" style={{ margin: 0, padding: '2px 8px' }}>
                {getBatchLaunchStats().success} 成功
              </Tag>
              <Tag color="error" style={{ margin: 0, padding: '2px 8px' }}>
                {getBatchLaunchStats().failed} 失败
              </Tag>
            </Space>
          </div>
          <Progress
            percent={Math.round(((getBatchLaunchStats().success + getBatchLaunchStats().failed) / batchLaunchProgress.size) * 100)}
            status={batchLaunching ? 'active' : 'normal'}
            strokeColor={{
              '0%': '#22c55e',
              '100%': '#16a34a',
            }}
            strokeWidth={12}
            style={{ marginBottom: 0 }}
          />
        </div>

        {/* Project list */}
        <div style={{ maxHeight: 450, overflowY: 'auto' }}>
          {Array.from(batchLaunchProgress.entries())
            .sort((a, b) => {
              if (smartSortEnabled) {
                const projectA = projects.find(p => p.id === a[0]);
                const projectB = projects.find(p => p.id === b[0]);
                if (projectA && projectB) {
                  return getProjectPriority(projectA) - getProjectPriority(projectB);
                }
              }
              return (a[1].order || 0) - (b[1].order || 0);
            })
            .map(([projectId, progress], index) => {
              const project = projects.find(p => p.id === projectId);
              if (!project) return null;

              const priority = getProjectPriority(project);

              return (
                <div
                  key={projectId}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: '14px 16px',
                    background: progress.status === 'launching'
                      ? 'linear-gradient(90deg, rgba(59, 130, 246, 0.08) 0%, rgba(59, 130, 246, 0.02) 100%)'
                      : index % 2 === 0 ? 'rgba(0,0,0,0.02)' : 'transparent',
                    borderRadius: 10,
                    marginBottom: 8,
                    border: '1px solid',
                    borderColor: progress.status === 'launching' ? 'rgba(59, 130, 246, 0.2)' : 'rgba(0,0,0,0.05)',
                    transition: 'all 0.3s ease',
                  }}
                >
                  {/* Order number */}
                  {smartSortEnabled && (
                    <div style={{
                      width: 28,
                      height: 28,
                      borderRadius: '50%',
                      background: progress.status === 'success' ? '#22c55e' :
                                 progress.status === 'failed' ? '#ff4d4f' :
                                 progress.status === 'launching' ? '#3b82f6' : '#e5e7eb',
                      color: 'white',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 12,
                      fontWeight: 600,
                      flexShrink: 0,
                    }}>
                      {progress.status === 'success' ? '✓' :
                       progress.status === 'failed' ? '✗' :
                       progress.order || index + 1}
                    </div>
                  )}

                  {/* Status icon */}
                  <div style={{ width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {progress.status === 'pending' && (
                      <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#d1d5db' }} />
                    )}
                    {progress.status === 'launching' && (
                      <Spin size="small" />
                    )}
                    {progress.status === 'success' && (
                      <CheckCircleOutlined style={{ fontSize: 20, color: '#52c41a' }} />
                    )}
                    {progress.status === 'failed' && (
                      <CloseCircleOutlined style={{ fontSize: 20, color: '#ff4d4f' }} />
                    )}
                  </div>

                  {/* Project info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <ProjectIcon name={project.name} techStack={project.techStack} iconType={project.iconType} iconUrl={project.iconUrl} iconColor={project.iconColor} size={22} />
                      <span style={{ fontWeight: 600, fontSize: 14, color: '#1a1f36' }}>{project.name}</span>
                      {smartSortEnabled && (
                        <Tag
                          color={getPriorityColor(priority)}
                          style={{ fontSize: 10, margin: 0, padding: '0 6px' }}
                        >
                          {getPriorityLabel(priority)}
                        </Tag>
                      )}
                    </div>
                    <div style={{ fontSize: 12, color: '#6b7a99', display: 'flex', alignItems: 'center', gap: 8 }}>
                      {progress.status === 'pending' && '等待启动...'}
                      {progress.status === 'launching' && (
                        <span style={{ color: '#3b82f6' }}>正在启动...</span>
                      )}
                      {progress.status === 'success' && (
                        <span>
                          已启动
                          {progress.port && (
                            <Tag color="success" style={{ marginLeft: 8, fontSize: 11, margin: 0, padding: '0 4px' }}>
                              端口: {progress.port}
                            </Tag>
                          )}
                        </span>
                      )}
                      {progress.status === 'failed' && (
                        <span style={{ color: '#ff4d4f' }}>{progress.error || '启动失败'}</span>
                      )}
                    </div>
                  </div>

                  {/* Status tag and actions */}
                  <Space>
                    {progress.status === 'failed' && (
                      <Button
                        size="small"
                        icon={<ReloadOutlined />}
                        onClick={() => handleRetryProject(projectId)}
                        style={{ borderRadius: 6 }}
                      >
                        重试
                      </Button>
                    )}
                    <Tag
                      color={
                        progress.status === 'pending' ? 'default' :
                        progress.status === 'launching' ? 'processing' :
                        progress.status === 'success' ? 'success' :
                        'error'
                      }
                      style={{ margin: 0, padding: '2px 8px', borderRadius: 6 }}
                    >
                      {progress.status === 'pending' && '等待中'}
                      {progress.status === 'launching' && '启动中'}
                      {progress.status === 'success' && '成功'}
                      {progress.status === 'failed' && '失败'}
                    </Tag>
                  </Space>
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
