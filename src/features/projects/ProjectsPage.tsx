import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Button, Input, Select, Row, Col, Tag, Space, Modal, Form, message, Empty, Spin, Table, InputNumber, Tooltip, Checkbox } from 'antd';
import { PlusOutlined, SearchOutlined, FolderOpenOutlined, ScanOutlined, LinkOutlined, FolderOutlined, PlayCircleOutlined, DeleteOutlined, CodeOutlined, ReloadOutlined, ClockCircleOutlined, CheckCircleOutlined, CloseCircleOutlined, RocketOutlined } from '@ant-design/icons';
import { useTerminalStore } from '../../stores/terminalStore';
import { projectsApi, detectApi, terminalApi, healthApi, workspacesApi } from '../../api';
import type { CreateProjectInput, ProjectWithStats, ProjectStatus, ProjectPriority, Workspace, DetectedProject, ScanGroup, ProjectHealthResult } from '../../types';
import ProjectIcon from '../../shared/ProjectIcon';
import QuickLaunchModal from '../../shared/QuickLaunchModal';
import HealthBadge from '../../shared/HealthBadge';
import { launchHistoryStorage } from '../../lib/launchProfiles';
import { STATUS_COLORS, PROJECT_STATUSES, PRIORITY_OPTIONS } from '../../lib/constants';
import { buildLaunchRequests } from '../../lib/launchUtils';
import { getProjectPriority, getPriorityLabel, getPriorityColor } from './projectUtils';
import { useBatchLaunch } from './useBatchLaunch';
import { useScanProjects } from './useScanProjects';

const STATUS_OPTIONS = [...PROJECT_STATUSES];
const SOURCE_OPTIONS = [
  { value: 'Local', label: '本地项目' },
  { value: 'Remote', label: '远程项目' },
  { value: 'Hybrid', label: '混合项目' },
];

export default function ProjectsPage() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<ProjectWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string | undefined>();
  const [workspaceFilter, setWorkspaceFilter] = useState<string | undefined>();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [form] = Form.useForm();
  const [detecting, setDetecting] = useState(false);
  const { requestLaunch } = useTerminalStore();
  const [healthResults, setHealthResults] = useState<Record<string, ProjectHealthResult>>({});
  const [smartSortEnabled] = useState(true);
  const [quickLaunchModalOpen, setQuickLaunchModalOpen] = useState(false);

  // ── Hooks ──

  const loadProjects = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string | undefined> = {};
      if (search) params.search = search;
      if (statusFilter) params.status = statusFilter;
      if (workspaceFilter) params.workspaceId = workspaceFilter;
      const data = await projectsApi.list(params);
      setProjects(data);
    } catch {
      message.error('加载项目失败');
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, workspaceFilter]);

  const batch = useBatchLaunch({
    projects,
    smartSortEnabled,
    onLaunchComplete: loadProjects,
  });

  const scan = useScanProjects({ onImportComplete: loadProjects });

  // ── Data Loading ──

  useEffect(() => { loadProjects(); }, [loadProjects]);

  useEffect(() => {
    workspacesApi.list().then((data) => setWorkspaces(data as Workspace[])).catch(() => {});
  }, []);

  useEffect(() => {
    healthApi.getAllLatest().then((healthData) => {
      const map: Record<string, ProjectHealthResult> = {};
      if (Array.isArray(healthData)) {
        healthData.forEach((h) => { map[h.projectId] = h; });
      }
      setHealthResults(map);
    }).catch(() => {});
  }, []);

  // ── CRUD Operations ──

  const handleDetect = async () => {
    const localPath = form.getFieldValue('localPath')?.trim();
    const repoUrl = form.getFieldValue('repoUrl')?.trim();

    if (!localPath && !repoUrl) {
      message.warning('请输入本地路径或 Git 仓库地址');
      return;
    }

    setDetecting(true);


    try {
      let result: DetectedProject;
      if (repoUrl) {
        result = await detectApi.gitRepo(repoUrl);
      } else {
        result = await detectApi.local(localPath);
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

      message.success(`检测完成，识别到 ${result.techStack?.length || 0} 项技术栈`);
    } catch (err: unknown) {
      message.error(`检测失败: ${String(err)}`);
    } finally {
      setDetecting(false);
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
      await projectsApi.create(payload);
      message.success('项目创建成功');
      setModalOpen(false);
      form.resetFields();
  
      loadProjects();
    } catch (e: unknown) {
      message.error(`创建失败: ${String(e)}`);
    }
  };

  const handleDelete = async (id: string) => {
    const confirmed = await new Promise<boolean>((resolve) => {
      Modal.confirm({
        title: '删除项目',
        content: '确定要删除这个项目吗？此操作不可恢复。',
        okText: '删除',
        okType: 'danger',
        cancelText: '取消',
        onOk: () => resolve(true),
        onCancel: () => resolve(false),
      });
    });

    if (confirmed) {
      try {
        await projectsApi.delete(id);
        message.success('项目已删除');
        loadProjects();
      } catch (e: unknown) {
        message.error(`删除失败: ${String(e)}`);
      }
    }
  };

  const handleRefreshProject = async (project: ProjectWithStats) => {
    if (!project.localPath) {
      message.warning('项目没有本地路径，无法检测');
      return;
    }
    try {
      const updated = await projectsApi.refresh(project.id);
      setProjects(prev => prev.map(p => p.id === project.id ? { ...p, ...updated } : p));
      message.success(`${project.name} 信息已更新`);
    } catch (e: unknown) {
      message.warning(String(e) || '刷新失败');
    }
  };

  const openModal = () => {

    form.resetFields();
    setModalOpen(true);
  };

  const handleBrowseFolder = async () => {
    try {
      const { open } = await import('@tauri-apps/plugin-dialog');
      const selected = await open({ directory: true });
      if (selected) {
        scan.setScanPath(selected as string);
      }
    } catch {
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
    } catch {
      message.error('无法打开文件夹选择器');
    }
  };

  // ── Launch Operations ──

  const handleLaunchProject = async (project: ProjectWithStats) => {
    if (!project.localPath) {
      message.warning('请先设置项目本地路径');
      return;
    }
    const localPath = project.localPath;
    const requests = buildLaunchRequests({ ...project, localPath });
    if (requests.length === 0) {
      message.warning('请先设置启动命令');
      return;
    }

    const launchHints = getProjectPriority(project) > 0 ? [] : [];

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
            </div>
          ),
          okText: '启动',
          cancelText: '取消',
          onOk: () => resolve(true),
          onCancel: () => resolve(false),
        });
      });
      if (!confirmed) return;
    }

    try {
      for (const req of requests) {
        await terminalApi.start(project.id, req.command || '', req.cwd || project.localPath || '');
      }
      message.success(`${project.name} 已启动`);
      // Record launch
      launchHistoryStorage.add({
        projects: [{ projectId: project.id, projectName: project.name, status: 'success' }],
        totalDuration: 0,
        successCount: 1,
        failedCount: 0,
      });
      loadProjects();
    } catch (e: unknown) {
      message.error(`启动失败: ${String(e)}`);
    }
  };

  const handleQuickLaunch = (projectIds: string[]) => {
    for (const id of projectIds) {
      const project = projects.find(p => p.id === id);
      if (project) handleLaunchProject(project);
    }
  };

  // ── Render ──

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
          {batch.selectedProjectIds.size > 0 && (
            <Tag color="success" style={{ fontSize: 12 }}>
              已选中 {batch.selectedProjectIds.size} 个项目
            </Tag>
          )}
        </div>
        <Space>
          {batch.selectedProjectIds.size > 0 && (
            <Button
              type="primary"
              icon={<PlayCircleOutlined />}
              loading={batch.batchLaunching}
              onClick={batch.handleBatchLaunch}
              size="large"
              style={{
                background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
                border: 'none',
                boxShadow: '0 4px 12px rgba(34, 197, 94, 0.3)',
              }}
            >
              启动选中 ({batch.selectedProjectIds.size})
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
            onClick={() => scan.setScanModalOpen(true)}
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
              ...workspaces.map((w: Workspace) => ({ value: w.id, label: w.name })),
            ]}
          />
        )}
        <div style={{ flex: 1 }} />
        {projects.length > 0 && (
          <Checkbox
            checked={batch.selectedProjectIds.size === projects.length}
            indeterminate={batch.selectedProjectIds.size > 0 && batch.selectedProjectIds.size < projects.length}
            onChange={batch.handleSelectAll}
          >
            全选 ({batch.selectedProjectIds.size}/{projects.length})
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
            const isSelected = batch.selectedProjectIds.has(project.id);
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
                  {/* Selection checkbox */}
                  <div style={{ position: 'absolute', top: 12, left: 12, zIndex: 1 }}>
                    <Checkbox
                      checked={isSelected}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => {
                        e.stopPropagation();
                        batch.handleToggleSelection(project.id, e as unknown as React.SyntheticEvent);
                      }}
                    />
                  </div>

                  {/* Action buttons */}
                  <div style={{
                    position: 'absolute', top: 12, right: 12,
                    display: 'flex', gap: 4, zIndex: 1,
                  }}>
                    <Tooltip title="刷新检测">
                      <Button type="text" size="small" icon={<ReloadOutlined />}
                        onClick={(e) => { e.stopPropagation(); handleRefreshProject(project); }}
                        style={{ color: '#8b95a5' }}
                      />
                    </Tooltip>
                    <Tooltip title="启动项目">
                      <Button type="text" size="small" icon={<PlayCircleOutlined />}
                        onClick={(e) => { e.stopPropagation(); handleLaunchProject(project); }}
                        style={{ color: '#22c55e' }}
                      />
                    </Tooltip>
                    <Tooltip title="打开终端">
                      <Button type="text" size="small" icon={<CodeOutlined />}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (project.localPath) {
                            requestLaunch({ cwd: project.localPath, label: project.name, projectId: project.id });
                          }
                        }}
                        style={{ color: '#8b95a5' }}
                      />
                    </Tooltip>
                    <Tooltip title="删除项目">
                      <Button type="text" size="small" icon={<DeleteOutlined />}
                        onClick={(e) => { e.stopPropagation(); handleDelete(project.id); }}
                        style={{ color: '#ef4444' }}
                      />
                    </Tooltip>
                  </div>

                  {/* Project icon & name */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8, marginTop: 4 }}>
                    <ProjectIcon name={project.name} techStack={project.techStack} iconType={project.iconType} iconUrl={project.iconUrl} iconColor={project.iconColor} size={32} />
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: 14, color: '#1a1f36', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {project.name}
                      </div>
                      <div style={{ fontSize: 11, color: '#8b95a5', display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Tag color={STATUS_COLORS[project.status]} style={{ margin: 0, fontSize: 10, padding: '0 4px', lineHeight: '16px' }}>
                          {project.status}
                        </Tag>
                        {project.repoCount > 0 && (
                          <Tag color="blue" style={{ margin: 0, fontSize: 10, padding: '0 4px', lineHeight: '16px' }}>
                            {project.repoCount} 仓库
                          </Tag>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Tech stack */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 8 }}>
                    {project.techStack?.slice(0, 3).map(tech => (
                      <Tag key={tech} style={{ fontSize: 10, padding: '0 4px', borderRadius: 4, background: 'rgba(99, 102, 241, 0.08)', color: '#6366f1', border: 'none' }}>
                        {tech}
                      </Tag>
                    ))}
                    {(project.techStack?.length || 0) > 3 && (
                      <Tag style={{ fontSize: 10, padding: '0 4px', borderRadius: 4, background: 'rgba(0,0,0,0.04)', color: '#8b95a5', border: 'none' }}>
                        +{project.techStack.length - 3}
                      </Tag>
                    )}
                  </div>

                  {/* Bottom: priority + health */}
                  <div style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    {smartSortEnabled && (
                      <Tag color={getPriorityColor(getProjectPriority(project))} style={{ fontSize: 10, margin: 0 }}>
                        {getPriorityLabel(getProjectPriority(project))}
                      </Tag>
                    )}
                    {healthResults[project.id] && (
                      <HealthBadge result={healthResults[project.id]} />
                    )}
                  </div>
                </Card>
              </Col>
            );
          })}
        </Row>
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
                <FolderOpenOutlined style={{ cursor: 'pointer', color: '#8b95a5' }} onClick={handleBrowseProjectPath} />
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
            <Button onClick={handleDetect} loading={detecting} icon={<ScanOutlined />}>检测</Button>
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
              <label style={{ display: 'block', marginBottom: 4, fontSize: 12, color: '#6b7a99' }}>扫描路径</label>
              <Input
                value={scan.scanPath}
                onChange={e => scan.setScanPath(e.target.value)}
                placeholder="输入或选择要扫描的目录..."
                suffix={
                  <FolderOpenOutlined style={{ cursor: 'pointer', color: '#8b95a5' }} onClick={handleBrowseFolder} />
                }
              />
            </div>
            <div style={{ width: 120 }}>
              <label style={{ display: 'block', marginBottom: 4, fontSize: 12, color: '#6b7a99' }}>扫描深度</label>
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
                { title: '路径', dataIndex: 'localPath', key: 'localPath', ellipsis: true, render: (path: string) => <span style={{ fontFamily: "'Fira Code', monospace", fontSize: 11, color: '#8b95a5' }}>{path}</span> },
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
            <div style={{ marginTop: 12, textAlign: 'right' }}>
              <Space>
                <span style={{ color: '#9eadc0' }}>
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
              </Space>
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
                background: progress.status === 'success' ? 'rgba(34, 197, 94, 0.05)' :
                           progress.status === 'failed' ? 'rgba(239, 68, 68, 0.05)' : 'transparent',
                marginBottom: 4,
              }}>
                <div style={{ width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  {progress.status === 'pending' && <ClockCircleOutlined style={{ fontSize: 18, color: '#8b95a5' }} />}
                  {progress.status === 'launching' && <Spin size="small" />}
                  {progress.status === 'success' && <CheckCircleOutlined style={{ fontSize: 20, color: '#52c41a' }} />}
                  {progress.status === 'failed' && <CloseCircleOutlined style={{ fontSize: 20, color: '#ff4d4f' }} />}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <ProjectIcon name={project.name} techStack={project.techStack} iconType={project.iconType} iconUrl={project.iconUrl} iconColor={project.iconColor} size={22} />
                    <span style={{ fontWeight: 600, fontSize: 14, color: '#1a1f36' }}>{project.name}</span>
                    {smartSortEnabled && (
                      <Tag color={getPriorityColor(priority)} style={{ fontSize: 10, margin: 0, padding: '0 6px' }}>
                        {getPriorityLabel(priority)}
                      </Tag>
                    )}
                  </div>
                  <div style={{ fontSize: 12, color: '#6b7a99', display: 'flex', alignItems: 'center', gap: 8 }}>
                    {progress.status === 'pending' && '等待启动...'}
                    {progress.status === 'launching' && <span style={{ color: '#3b82f6' }}>正在启动...</span>}
                    {progress.status === 'success' && <span>已启动</span>}
                    {progress.status === 'failed' && <span style={{ color: '#ff4d4f' }}>{progress.error || '启动失败'}</span>}
                  </div>
                </div>

                <Space>
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
