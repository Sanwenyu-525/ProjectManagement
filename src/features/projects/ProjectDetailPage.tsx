import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Tabs, Descriptions, Tag, Button, Space, Spin, Empty, message, Table, Modal, Form, Input, Select, Timeline } from 'antd';
import { ArrowLeftOutlined, SyncOutlined, PlusOutlined, DeleteOutlined, TableOutlined, AppstoreOutlined, CheckCircleOutlined, EditOutlined, PlusCircleOutlined, ClockCircleOutlined, PlayCircleOutlined, ReloadOutlined, CodeOutlined } from '@ant-design/icons';
import { projectsApi, reposApi, tasksApi, documentsApi, milestonesApi, timelineApi } from '../../api';
import ProjectIcon from '../../shared/ProjectIcon';
import KanbanBoard from '../../shared/KanbanBoard';
import { useTerminalStore } from '../../stores/terminalStore';
import { STATUS_COLORS } from '../../lib/constants';

function TerminalTab({ project }: { project: any }) {
  const { setTerminalOpen, setDefaultCwd } = useTerminalStore();

  useEffect(() => {
    setDefaultCwd(project.localPath);
    setTerminalOpen(true);
  }, [project, setDefaultCwd, setTerminalOpen]);

  return null;
}

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [project, setProject] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [cmdModalOpen, setCmdModalOpen] = useState(false);
  const [cmdInput, setCmdInput] = useState('');
  const [launching, setLaunching] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const { setTerminalOpen, setDefaultCwd } = useTerminalStore();
  const [activeTab, setActiveTab] = useState('overview');

  // Generate launch hints based on project tech stack and characteristics
  const getLaunchHints = (proj: any): string[] => {
    const hints: string[] = [];
    const techStack = proj.techStack || [];
    const command = proj.openCommand || '';

    // Mobile app development hints
    if (techStack.some((t: string) => /react.native|flutter|ionic/i.test(t))) {
      hints.push('移动端项目：启动后需要在模拟器或真机上运行');
    }

    // React Native specific
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

    // Flutter specific
    if (techStack.some((t: string) => /flutter/i.test(t))) {
      hints.push('Flutter：确保 Flutter SDK 已安装，设备已连接');
    }

    // Electron/Desktop app hints
    if (techStack.some((t: string) => /electron|tauri/i.test(t))) {
      hints.push('桌面应用：将启动独立的桌面窗口');
    }

    // Server/Backend hints
    if (techStack.some((t: string) => /express|fastify|nest|django|flask|spring|rails/i.test(t))) {
      hints.push('后端服务：启动后可通过浏览器访问应用');
    }

    // Docker hints
    if (techStack.some((t: string) => /docker|kubernetes|k8s/i.test(t))) {
      hints.push('容器化应用：确保 Docker 已安装并运行');
    }

    // Python specific
    if (techStack.some((t: string) => /python|flask|django/i.test(t))) {
      hints.push('Python 项目：确保已激活虚拟环境');
    }

    // Database required
    if (techStack.some((t: string) => /postgres|mysql|mongodb|redis|sql/i.test(t))) {
      hints.push('数据库依赖：确保数据库服务已启动');
    }

    // Node.js specific
    if (techStack.some((t: string) => /node|express|fastify|nest/i.test(t))) {
      if (command.includes('dev')) {
        hints.push('开发服务器：启动后支持热重载');
      }
    }

    return hints;
  };

  useEffect(() => {
    if (id) loadProject(id);
  }, [id]);

  async function loadProject(pid: string) {
    try {
      const data = await projectsApi.getById(pid);
      setProject(data);
    } catch {
      message.error('项目不存在');
      navigate('/projects');
    } finally {
      setLoading(false);
    }
  }

  async function handleLaunch() {
    if (!project?.openCommand) {
      setCmdInput('');
      setCmdModalOpen(true);
      return;
    }

    // Show launch confirmation with special hints
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
                启动命令：<code style={{ background: 'rgba(0,0,0,0.05)', padding: '2px 6px', borderRadius: 4 }}>{project.openCommand}</code>
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

    setLaunching(true);
    try {
      setDefaultCwd(project.localPath);
      setTerminalOpen(true);
      message.success('项目已启动');
    } catch (e: unknown) {
      message.warning(String(e) || '启动失败');
    } finally {
      setLaunching(false);
    }
  }

  async function handleRefresh() {
    if (!project?.localPath) {
      message.warning('项目没有本地路径，无法检测');
      return;
    }

    setRefreshing(true);
    try {
      const updated = await projectsApi.refresh(project.id);
      setProject(updated);
      message.success('项目信息已更新');
    } catch (e: unknown) {
      message.warning(String(e) || '刷新失败');
    } finally {
      setRefreshing(false);
    }
  }

  async function handleCmdSubmit() {
    if (!cmdInput.trim()) {
      message.warning('请输入启动命令');
      return;
    }
    try {
      const updated = await projectsApi.update(project.id, { openCommand: cmdInput.trim() });
      setCmdModalOpen(false);
      setProject(updated);
      setDefaultCwd(updated.localPath);
      setTerminalOpen(true);
      message.success('项目已启动');
    } catch (e: unknown) {
      message.error(String(e) || '操作失败');
    }
  }

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', padding: 100 }}><Spin size="large" /></div>;
  if (!project) return <Empty description="项目不存在" />;

  return (
    <div style={{ padding: '28px 32px' }}>
      {/* Back button */}
      <div
        onClick={() => navigate('/projects')}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          color: '#6b7a99',
          fontSize: 13,
          fontWeight: 500,
          cursor: 'pointer',
          marginBottom: 20,
          padding: '4px 8px',
          borderRadius: 6,
          transition: 'all 0.15s ease',
        }}
        onMouseEnter={e => { e.currentTarget.style.color = '#1a1f36'; e.currentTarget.style.background = 'rgba(0, 0, 0, 0.04)'; }}
        onMouseLeave={e => { e.currentTarget.style.color = '#6b7a99'; e.currentTarget.style.background = 'transparent'; }}
      >
        <ArrowLeftOutlined /> 返回项目列表
      </div>

      {/* Project header card */}
      <div className="animate-in" style={{
        background: 'rgba(255, 255, 255, 0.35)',
        borderRadius: 14,
        border: '1px solid rgba(255, 255, 255, 0.45)',
        boxShadow: '0 4px 16px rgba(0, 0, 0, 0.06), inset 0 1px 0 rgba(255, 255, 255, 0.6)',
        padding: '28px 32px',
        marginBottom: 20,
        backdropFilter: 'blur(24px) saturate(1.2)',
        WebkitBackdropFilter: 'blur(24px) saturate(1.2)',
      }}>
        <div style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
          <ProjectIcon
            name={project.name}
            techStack={project.techStack}
            iconType={project.iconType}
            iconUrl={project.iconUrl}
            iconColor={project.iconColor}
            size={64}
            style={{ borderRadius: 14 }}
          />
          <div style={{ flex: 1 }}>
            <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, letterSpacing: '-0.3px', color: '#1a1f36' }}>
              {project.name}
            </h2>
            <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
              <Tag color={STATUS_COLORS[project.status]}>{project.status}</Tag>
              <Tag style={{ background: 'rgba(0, 0, 0, 0.05)', color: '#6b7a99' }}>{project.priority}</Tag>
              <Tag style={{ background: 'rgba(0, 0, 0, 0.05)', color: '#6b7a99' }}>{project.source}</Tag>
              {project.techStack?.slice(0, 3).map((t: string) => (
                <Tag key={t} style={{ background: 'rgba(245, 158, 11, 0.10)', color: '#b45309' }}>{t}</Tag>
              ))}
            </div>
          </div>
          {project.localPath && (
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={handleRefresh}
                disabled={refreshing}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '10px 20px',
                  background: 'linear-gradient(135deg, #8b5cf6, #7c3aed)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 10,
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: 'pointer',
                  boxShadow: '0 2px 8px rgba(139, 92, 246, 0.3)',
                  transition: 'all 0.15s ease',
                }}
                onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 4px 16px rgba(139, 92, 246, 0.4)'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
                onMouseLeave={e => { e.currentTarget.style.boxShadow = '0 2px 8px rgba(139, 92, 246, 0.3)'; e.currentTarget.style.transform = 'translateY(0)'; }}
              >
                <ReloadOutlined spin={refreshing} /> {refreshing ? '检测中...' : '刷新信息'}
              </button>
              <button
                onClick={handleLaunch}
                disabled={launching}
                style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '10px 20px',
                background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                color: '#fff',
                border: 'none',
                borderRadius: 10,
                fontSize: 14,
                fontWeight: 600,
                cursor: 'pointer',
                boxShadow: '0 2px 8px rgba(245, 158, 11, 0.3)',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 4px 16px rgba(245, 158, 11, 0.4)'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
              onMouseLeave={e => { e.currentTarget.style.boxShadow = '0 2px 8px rgba(245, 158, 11, 0.3)'; e.currentTarget.style.transform = 'translateY(0)'; }}
            >
              <PlayCircleOutlined /> {launching ? '启动中...' : '启动项目'}
              </button>
            </div>
          )}
        </div>
        {project.description && (
          <p style={{ color: '#6b7a99', marginTop: 16, fontSize: 14, lineHeight: 1.6 }}>{project.description}</p>
        )}
      </div>

      {/* Tabs content */}
      <div className="animate-in animate-in-delay-2" style={{
        background: 'rgba(255, 255, 255, 0.35)',
        borderRadius: 14,
        border: '1px solid rgba(255, 255, 255, 0.45)',
        boxShadow: '0 4px 16px rgba(0, 0, 0, 0.06), inset 0 1px 0 rgba(255, 255, 255, 0.6)',
        padding: '4px 24px 24px',
        backdropFilter: 'blur(24px) saturate(1.2)',
        WebkitBackdropFilter: 'blur(24px) saturate(1.2)',
      }}>
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          items={[
            { key: 'overview', label: '概览', children: <OverviewTab project={project} /> },
            { key: 'repos', label: `仓库 (${project.remoteRepos?.length || 0})`, children: <ReposTab projectId={project.id} repos={project.remoteRepos || []} onRefresh={() => loadProject(project.id)} /> },
            { key: 'tasks', label: `任务 (${project._count?.tasks || 0})`, children: <TasksTab projectId={project.id} repos={project.remoteRepos || []} /> },
            { key: 'documents', label: `文档 (${project._count?.documents || 0})`, children: <DocumentsTab projectId={project.id} /> },
            { key: 'milestones', label: '里程碑', children: <MilestonesTab projectId={project.id} /> },
            { key: 'timeline', label: '活动', children: <ProjectTimelineTab projectId={project.id} /> },
            { key: 'terminal', label: '终端', children: (
              <TerminalTab project={project} />
            ) },
          ]}
        />
      </div>

      {/* 设置启动命令弹窗 */}
      <Modal
        title="设置启动命令"
        open={cmdModalOpen}
        onCancel={() => setCmdModalOpen(false)}
        onOk={handleCmdSubmit}
        okText="保存并启动"
        cancelText="取消"
      >
        <p style={{ color: '#6b7a99', marginBottom: 12 }}>
          该项目尚未配置启动命令，设置后可一键启动开发环境。
        </p>
        <Input
          value={cmdInput}
          onChange={e => setCmdInput(e.target.value)}
          placeholder="如 npm run dev、cargo run、python manage.py runserver"
          onPressEnter={handleCmdSubmit}
          autoFocus
        />
      </Modal>
    </div>
  );
}

// ==================== 概览 Tab ====================

function OverviewTab({ project }: { project: any }) {
  return (
    <Descriptions column={{ xs: 1, sm: 2, md: 3 }} bordered size="small">
      <Descriptions.Item label="状态">{project.status}</Descriptions.Item>
      <Descriptions.Item label="优先级">{project.priority}</Descriptions.Item>
      <Descriptions.Item label="来源">{project.source}</Descriptions.Item>
      <Descriptions.Item label="技术栈">
        {project.techStack?.map((t: string) => <Tag key={t}>{t}</Tag>) || '-'}
      </Descriptions.Item>
      <Descriptions.Item label="本地路径">{project.localPath || '-'}</Descriptions.Item>
      <Descriptions.Item label="启动命令">{project.openCommand || '-'}</Descriptions.Item>
      <Descriptions.Item label="线上地址">
        {project.liveUrl ? <a href={project.liveUrl} target="_blank" rel="noopener noreferrer">{project.liveUrl}</a> : '-'}
      </Descriptions.Item>
      <Descriptions.Item label="域名">{project.domainName || '-'}</Descriptions.Item>
      <Descriptions.Item label="创建时间">{new Date(project.createdAt).toLocaleString('zh-CN')}</Descriptions.Item>
    </Descriptions>
  );
}

// ==================== 仓库 Tab ====================

function ReposTab({ projectId, repos, onRefresh }: { projectId: string; repos: any[]; onRefresh: () => void }) {
  const [modalOpen, setModalOpen] = useState(false);
  const [form] = Form.useForm();
  const [syncing, setSyncing] = useState<string | null>(null);

  const handleAdd = async (values: any) => {
    try {
      await reposApi.add(projectId, values);
      message.success('仓库关联成功');
      setModalOpen(false);
      form.resetFields();
      onRefresh();
    } catch (err: unknown) {
      message.error(String(err) || '关联失败');
    }
  };

  const handleSync = async (repoId: string) => {
    setSyncing(repoId);
    try {
      await reposApi.sync(repoId);
      message.success('同步完成');
      onRefresh();
    } catch (err: unknown) {
      message.error(String(err) || '同步失败');
    } finally {
      setSyncing(null);
    }
  };

  const handleRemove = async (repoId: string) => {
    Modal.confirm({
      title: '确认移除',
      content: '移除仓库关联不会删除远程仓库，仅解除本项目的关联。',
      onOk: async () => {
        await reposApi.remove(repoId);
        message.success('已移除');
        onRefresh();
      },
    });
  };

  const columns = [
    { title: '平台', dataIndex: 'platform', render: (v: string) => <Tag>{v}</Tag> },
    { title: '仓库', dataIndex: 'repoFullName' },
    { title: '分支', dataIndex: 'defaultBranch', render: (v: string) => v || '-' },
    { title: '状态', dataIndex: 'repoStatus', render: (v: string) => <Tag color={v === 'Synced' ? 'green' : v === 'Error' ? 'red' : 'orange'}>{v}</Tag> },
    { title: '最后同步', dataIndex: 'lastSyncAt', render: (v: string) => v ? new Date(v).toLocaleString('zh-CN') : '从未' },
    { title: '任务数', render: (_: any, r: any) => r._count?.tasks || 0 },
    {
      title: '操作', render: (_: any, record: any) => (
        <Space>
          <Button size="small" icon={<SyncOutlined />} loading={syncing === record.id} onClick={() => handleSync(record.id)}>同步</Button>
          <Button size="small" icon={<DeleteOutlined />} danger onClick={() => handleRemove(record.id)} />
        </Space>
      ),
    },
  ];

  return (
    <>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'flex-end' }}>
        <Button icon={<PlusOutlined />} type="primary" onClick={() => setModalOpen(true)}>关联远程仓库</Button>
      </div>
      <Table columns={columns} dataSource={repos} rowKey="id" pagination={false} />

      <Modal title="关联远程仓库" open={modalOpen} onCancel={() => { setModalOpen(false); form.resetFields(); }} onOk={() => form.submit()} okText="关联">
        <Form form={form} layout="vertical" onFinish={handleAdd}>
          <Form.Item name="platform" label="平台" rules={[{ required: true }]}>
            <Select options={['GitHub', 'GitLab', 'Gitee', 'Bitbucket'].map(p => ({ value: p, label: p }))} />
          </Form.Item>
          <Form.Item name="repoFullName" label="仓库全名" rules={[{ required: true, message: '如 user/repo' }]}>
            <Input placeholder="user/repo" />
          </Form.Item>
          <Form.Item name="repoUrl" label="仓库地址" rules={[{ required: true, type: 'url' }]}>
            <Input placeholder="https://github.com/user/repo" />
          </Form.Item>
          <Form.Item name="defaultBranch" label="默认分支">
            <Input placeholder="main" />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}

// ==================== 任务 Tab ====================

function TasksTab({ projectId, repos }: { projectId: string; repos: any[] }) {
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [scopeFilter, setScopeFilter] = useState<string | undefined>();
  const [modalOpen, setModalOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'table' | 'kanban'>('kanban');
  const [form] = Form.useForm();

  useEffect(() => {
    loadTasks();
  }, [scopeFilter]);

  async function loadTasks() {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (scopeFilter !== undefined) params.repoScope = scopeFilter;
      const data = await tasksApi.list(projectId, params);
      setTasks(data);
    } finally {
      setLoading(false);
    }
  }

  const handleCreate = async (values: any) => {
    await tasksApi.create(projectId, { ...values, repoScope: values.repoScope || null });
    message.success('任务创建成功');
    setModalOpen(false);
    form.resetFields();
    loadTasks();
  };

  const handleStatusChange = async (taskId: string, status: string) => {
    await tasksApi.updateStatus(taskId, status);
    loadTasks();
  };

  const columns = [
    { title: '标题', dataIndex: 'title', ellipsis: true },
    { title: '状态', dataIndex: 'status', render: (v: string, record: any) => (
      <Select value={v} size="small" style={{ width: 110 }} onChange={(s) => handleStatusChange(record.id, s)}
        options={['Todo', 'InProgress', 'Done', 'Cancelled'].map(s => ({ value: s, label: s }))} />
    )},
    { title: '优先级', dataIndex: 'priority', render: (v: string) => <Tag>{v}</Tag> },
    { title: '仓库范围', render: (_: any, r: any) => r.scopedRepo ? <Tag>{r.scopedRepo.platform}: {r.scopedRepo.repoFullName}</Tag> : <Tag color="blue">全部</Tag> },
    { title: '截止日期', dataIndex: 'dueDate', render: (v: string) => v ? new Date(v).toLocaleDateString('zh-CN') : '-' },
  ];

  return (
    <>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Space>
          <Select placeholder="按仓库筛选" allowClear value={scopeFilter} onChange={setScopeFilter} style={{ width: 200 }}
            options={[
              { value: 'null', label: '所有仓库共享' },
              ...repos.map(r => ({ value: r.id, label: `${r.platform}: ${r.repoFullName}` })),
            ]}
          />
          <Button.Group>
            <Button icon={<AppstoreOutlined />} type={viewMode === 'kanban' ? 'primary' : 'default'} onClick={() => setViewMode('kanban')}>看板</Button>
            <Button icon={<TableOutlined />} type={viewMode === 'table' ? 'primary' : 'default'} onClick={() => setViewMode('table')}>列表</Button>
          </Button.Group>
        </Space>
        <Button icon={<PlusOutlined />} type="primary" onClick={() => setModalOpen(true)}>新建任务</Button>
      </div>

      {loading ? (
        <Spin />
      ) : viewMode === 'kanban' ? (
        <KanbanBoard tasks={tasks} onTaskUpdated={loadTasks} />
      ) : (
        <Table columns={columns} dataSource={tasks} rowKey="id" pagination={false} />
      )}

      <Modal title="新建任务" open={modalOpen} onCancel={() => { setModalOpen(false); form.resetFields(); }} onOk={() => form.submit()} okText="创建">
        <Form form={form} layout="vertical" onFinish={handleCreate}>
          <Form.Item name="title" label="标题" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.Item name="priority" label="优先级" initialValue="Medium">
            <Select options={['Low', 'Medium', 'High', 'Critical'].map(p => ({ value: p, label: p }))} />
          </Form.Item>
          <Form.Item name="repoScope" label="仓库范围">
            <Select allowClear placeholder="全部仓库共享"
              options={[
                { value: null, label: '全部仓库共享' },
                ...repos.map(r => ({ value: r.id, label: `${r.platform}: ${r.repoFullName}` })),
              ]}
            />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}

// ==================== 文档 Tab ====================

function DocumentsTab({ projectId }: { projectId: string }) {
  const [docs, setDocs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [form] = Form.useForm();

  useEffect(() => { loadDocs(); }, []);

  async function loadDocs() {
    try {
      const data = await documentsApi.list(projectId);
      setDocs(data);
    } finally {
      setLoading(false);
    }
  }

  const handleCreate = async (values: any) => {
    await documentsApi.create(projectId, values);
    message.success('文档创建成功');
    setModalOpen(false);
    form.resetFields();
    loadDocs();
  };

  return (
    <>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'flex-end' }}>
        <Button icon={<PlusOutlined />} type="primary" onClick={() => setModalOpen(true)}>新建文档</Button>
      </div>
      {docs.length === 0 && !loading ? (
        <Empty description="暂无文档" />
      ) : (
        <Table
          dataSource={docs}
          rowKey="id"
          loading={loading}
          pagination={false}
          columns={[
            { title: '标题', dataIndex: 'title' },
            { title: '类型', dataIndex: 'type', render: (v: string) => <Tag>{v}</Tag> },
            { title: '更新时间', dataIndex: 'updatedAt', render: (v: string) => new Date(v).toLocaleString('zh-CN') },
          ]}
        />
      )}

      <Modal title="新建文档" open={modalOpen} onCancel={() => { setModalOpen(false); form.resetFields(); }} onOk={() => form.submit()} okText="创建">
        <Form form={form} layout="vertical" onFinish={handleCreate}>
          <Form.Item name="title" label="标题" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="type" label="类型" initialValue="Doc">
            <Select options={['Doc', 'Note', 'Changelog', 'Decision'].map(t => ({ value: t, label: t }))} />
          </Form.Item>
          <Form.Item name="content" label="内容">
            <Input.TextArea rows={6} placeholder="支持 Markdown" />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}

// ==================== 里程碑 Tab ====================

function MilestonesTab({ projectId }: { projectId: string }) {
  const [milestones, setMilestones] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [form] = Form.useForm();

  useEffect(() => { loadMilestones(); }, []);

  async function loadMilestones() {
    try {
      const data = await milestonesApi.list(projectId);
      setMilestones(data);
    } finally {
      setLoading(false);
    }
  }

  const handleCreate = async (values: any) => {
    await milestonesApi.create(projectId, values);
    message.success('里程碑创建成功');
    setModalOpen(false);
    form.resetFields();
    loadMilestones();
  };

  const handleDelete = async (id: string) => {
    Modal.confirm({
      title: '确认删除',
      content: '删除里程碑不会删除关联的任务。',
      okType: 'danger',
      onOk: async () => {
        await milestonesApi.delete(id);
        message.success('已删除');
        loadMilestones();
      },
    });
  };

  const STATUS_MAP: Record<string, { color: string; label: string }> = {
    Pending: { color: 'default', label: '待开始' },
    InProgress: { color: 'processing', label: '进行中' },
    Completed: { color: 'success', label: '已完成' },
    Overdue: { color: 'error', label: '已逾期' },
  };

  return (
    <>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'flex-end' }}>
        <Button icon={<PlusOutlined />} type="primary" onClick={() => setModalOpen(true)}>新建里程碑</Button>
      </div>
      {milestones.length === 0 && !loading ? (
        <Empty description="暂无里程碑" />
      ) : (
        <Table
          dataSource={milestones}
          rowKey="id"
          loading={loading}
          pagination={false}
          columns={[
            { title: '名称', dataIndex: 'name' },
            { title: '描述', dataIndex: 'description', ellipsis: true, render: (v: string) => v || '-' },
            {
              title: '状态', dataIndex: 'status',
              render: (v: string) => {
                const s = STATUS_MAP[v] || { color: 'default', label: v };
                return <Tag color={s.color}>{s.label}</Tag>;
              },
            },
            { title: '截止日期', dataIndex: 'dueDate', render: (v: string) => v ? new Date(v).toLocaleDateString('zh-CN') : '-' },
            { title: '任务数', render: (_: any, r: any) => r._count?.tasks || 0 },
            {
              title: '操作', render: (_: any, record: any) => (
                <Space>
                  <Select
                    value={record.status}
                    size="small"
                    style={{ width: 100 }}
                    onChange={async (status) => {
                      await milestonesApi.update(record.id, { status });
                      loadMilestones();
                    }}
                    options={Object.entries(STATUS_MAP).map(([k, v]) => ({ value: k, label: v.label }))}
                  />
                  <Button size="small" icon={<DeleteOutlined />} danger onClick={() => handleDelete(record.id)} />
                </Space>
              ),
            },
          ]}
        />
      )}

      <Modal title="新建里程碑" open={modalOpen} onCancel={() => { setModalOpen(false); form.resetFields(); }} onOk={() => form.submit()} okText="创建">
        <Form form={form} layout="vertical" onFinish={handleCreate}>
          <Form.Item name="name" label="名称" rules={[{ required: true }]}>
            <Input placeholder="v1.0 发布" />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.Item name="dueDate" label="截止日期">
            <Input type="date" />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}

// ==================== 项目活动 Tab ====================

const ACTION_MAP: Record<string, { icon: React.ReactNode; color: string; label: string }> = {
  status_change: { icon: <EditOutlined />, color: 'blue', label: '状态变更' },
  task_created: { icon: <PlusCircleOutlined />, color: 'green', label: '创建任务' },
  task_status_change: { icon: <CheckCircleOutlined />, color: 'orange', label: '任务状态变更' },
  repo_synced: { icon: <SyncOutlined />, color: 'cyan', label: '仓库同步' },
};

function formatLogDetails(action: string, details: string | null): string {
  if (!details) return '';
  try {
    const d = JSON.parse(details);
    if (action === 'status_change' || action === 'task_status_change') return `${d.from} → ${d.to}`;
    if (action === 'task_created') return d.title || '';
    if (action === 'repo_synced') return `${d.platform}: ${d.repo}`;
    return '';
  } catch { return ''; }
}

function ProjectTimelineTab({ projectId }: { projectId: string }) {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTimeline();
  }, []);

  async function loadTimeline() {
    try {
      const data = await timelineApi.byProject(projectId, { limit: 50 });
      setLogs(data);
    } finally {
      setLoading(false);
    }
  }

  if (loading) return <Spin />;
  if (logs.length === 0) return <Empty description="暂无活动记录" />;

  return (
    <Timeline
      items={logs.map(log => {
        const action = ACTION_MAP[log.action] || { icon: <ClockCircleOutlined />, color: 'gray', label: log.action };
        const details = formatLogDetails(log.action, log.details);
        return {
          dot: action.icon,
          color: action.color,
          children: (
            <div>
              <Space>
                <Tag color={action.color}>{action.label}</Tag>
                <span>{log.entityType}</span>
                {details && <span style={{ color: '#6b7a99' }}>- {details}</span>}
              </Space>
              <div style={{ fontSize: 12, color: '#9eadc0', marginTop: 2 }}>
                {new Date(log.createdAt).toLocaleString('zh-CN')}
              </div>
            </div>
          ),
        };
      })}
    />
  );
}
