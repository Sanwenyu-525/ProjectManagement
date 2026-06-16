import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Tabs, Descriptions, Tag, Button, Space, Skeleton, Spin, Empty, message, Modal, Form, Input, Select, Table, Timeline } from 'antd';
import { ArrowLeftOutlined, SyncOutlined, PlusOutlined, DeleteOutlined, CheckCircleOutlined, EditOutlined, PlusCircleOutlined, ClockCircleOutlined, PlayCircleOutlined, ReloadOutlined, CodeOutlined } from '@ant-design/icons';
import { projectsApi, reposApi, documentsApi, timelineApi } from '../../api';
import type { ProjectDetail, RemoteRepo, Document, ActivityLog, CreateDocumentInput, AddRepoInput } from '../../types';
import ConfigTab from './tabs/ConfigTab';
import TasksTab from './tabs/TasksTab';
import MilestonesTab from './tabs/MilestonesTab';
import ProjectIcon from '../../shared/ProjectIcon';
import { useTerminalStore } from '../../stores/terminalStore';
import { STATUS_COLORS } from '../../lib/constants';
import { buildLaunchRequests } from '../../lib/launchUtils';
import GitTab from './git/GitTab';
import HealthTab from './HealthTab';
import './ProjectDetailPage.css';

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const { requestLaunch } = useTerminalStore();
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    if (id) {
      setLoading(true);
      projectsApi.getById(id).then(data => {
        setProject(data);
      }).catch(() => {
        message.error('加载项目失败');
      }).finally(() => setLoading(false));
    }
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
    if (!project?.localPath) return;
    const requests = buildLaunchRequests({ ...project, localPath: project.localPath });
    if (requests.length === 0) {
      message.warning('请先在"配置"标签页中设置启动命令');
      setActiveTab('config');
      return;
    }
    requests.forEach(req => requestLaunch(req));
    navigate('/');
  }

  async function handleRefresh() {
    if (!project?.localPath) {
      message.warning('项目没有本地路径，无法检测');
      return;
    }

    setRefreshing(true);
    try {
      const oldProject = { ...project };
      const updated = await projectsApi.refresh(project.id);
      setProject({ ...project, ...updated } as ProjectDetail);

      // Compare old vs new to generate context-aware message
      const changes: string[] = [];
      if (JSON.stringify(oldProject.techStack) !== JSON.stringify(updated.techStack)) {
        changes.push('技术栈');
      }
      if ((oldProject.frontendCommand || '') !== (updated.frontendCommand || '')) {
        changes.push('前端命令');
      }
      if ((oldProject.backendCommand || '') !== (updated.backendCommand || '')) {
        changes.push('后端命令');
      }
      if ((oldProject.openCommand || '') !== (updated.openCommand || '')) {
        changes.push('启动命令');
      }
      if ((oldProject.name || '') !== (updated.name || '')) {
        changes.push('项目名称');
      }
      if ((oldProject.description || '') !== (updated.description || '')) {
        changes.push('描述');
      }
      if ((oldProject.iconType || '') !== (updated.iconType || '') || (oldProject.iconUrl || '') !== (updated.iconUrl || '')) {
        changes.push('图标');
      }

      if (changes.length === 0) {
        message.info('已是最新状态');
      } else {
        message.success(`已更新：${changes.join('、')}`);
      }
    } catch (e: unknown) {
      message.warning(String(e) || '刷新失败');
    } finally {
      setRefreshing(false);
    }
  }

  if (loading) return (
    <div style={{ padding: '28px 32px', height: '100%', boxSizing: 'border-box' }}>
      <Skeleton.Button active style={{ marginBottom: 20, width: 140 }} />
      <div className="glass-panel" style={{ padding: '28px 32px', marginBottom: 20 }}>
        <Skeleton active avatar={{ size: 64 }} paragraph={{ rows: 2 }} />
      </div>
      <div className="glass-panel" style={{ padding: '24px' }}>
        <Skeleton active paragraph={{ rows: 6 }} />
      </div>
    </div>
  );
  if (!project) return <Empty description="项目不存在" />;

  const p = project as ProjectDetail & Record<string, unknown>;
  const remoteRepos = (p.remoteRepos || []) as RemoteRepo[];
  const count = (p._count || {}) as Record<string, number>;

  return (
    <div style={{ padding: '28px 32px', display: 'flex', flexDirection: 'column', height: '100%', boxSizing: 'border-box' }}>
      {/* Back button */}
      <Button
        type="text"
        icon={<ArrowLeftOutlined />}
        onClick={() => navigate('/projects')}
        className="back-link"
      >
        返回项目列表
      </Button>

      {/* Project header card */}
      <div className="glass-panel animate-in" style={{ padding: '28px 32px', marginBottom: 20 }}>
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
            <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, letterSpacing: '-0.3px', color: 'var(--color-text-primary)' }}>
              {project.name}
            </h2>
            <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
              <Tag color={STATUS_COLORS[project.status]}>{project.status}</Tag>
              <Tag style={{ background: 'var(--color-border-subtle)', color: 'var(--color-text-description)' }}>{project.priority}</Tag>
              <Tag style={{ background: 'var(--color-border-subtle)', color: 'var(--color-text-description)' }}>{project.source}</Tag>
              {project.techStack?.slice(0, 3).map((t: string) => (
                <Tag key={t} style={{ background: 'var(--color-amber-light)', color: '#b45309' }}>{t}</Tag>
              ))}
            </div>
          </div>
          {project.localPath && (
            <div style={{ display: 'flex', gap: 8 }}>
              <Button
                type="primary"
                icon={<ReloadOutlined spin={refreshing} />}
                onClick={handleRefresh}
                disabled={refreshing}
                className="action-btn action-btn-purple"
              >
                {refreshing ? '检测中...' : '刷新信息'}
              </Button>
              <Button
                type="primary"
                icon={<PlayCircleOutlined />}
                onClick={handleLaunch}
                className="action-btn action-btn-amber"
              >
                启动项目
              </Button>
              <Button
                type="primary"
                icon={<CodeOutlined />}
                onClick={() => { if (project.localPath) { requestLaunch({ cwd: project.localPath, label: project.name, projectId: project.id }); navigate('/'); } }}
                className="action-btn action-btn-green"
              >
                打开终端
              </Button>
            </div>
          )}
        </div>
        {project.description && (
          <p style={{ color: 'var(--color-text-description)', marginTop: 16, fontSize: 14, lineHeight: 1.6 }}>{project.description}</p>
        )}
      </div>

      {/* Tabs content */}
      <div className="glass-panel animate-in animate-in-delay-2" style={{ padding: '4px 24px 24px', flex: 1, minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <Tabs
          className="project-detail-tabs"
          activeKey={activeTab}
          onChange={setActiveTab}
          items={[
            { key: 'overview', label: '概览', children: <OverviewTab project={project} /> },
            { key: 'repos', label: `仓库 (${remoteRepos.length})`, children: <ReposTab projectId={project.id} repos={remoteRepos} onRefresh={() => loadProject(project.id)} /> },
            { key: 'git', label: 'Git', children: <GitTab project={project} /> },
            { key: 'tasks', label: `任务 (${count.tasks || 0})`, children: <TasksTab projectId={project.id} repos={remoteRepos} /> },
            { key: 'documents', label: `文档 (${count.documents || 0})`, children: <DocumentsTab projectId={project.id} /> },
            { key: 'milestones', label: '里程碑', children: <MilestonesTab projectId={project.id} /> },
            { key: 'config', label: '配置', children: <ConfigTab project={project} onSaved={() => loadProject(project.id)} /> },
            { key: 'timeline', label: '活动', children: <ProjectTimelineTab projectId={project.id} /> },
            { key: 'health', label: '健康检查', children: <HealthTab projectId={project.id} /> },
          ]}
        />
      </div>
    </div>
  );
}

// ==================== 概览 Tab ====================

function OverviewTab({ project }: { project: ProjectDetail }) {
  return (
    <Descriptions column={{ xs: 1, sm: 2, md: 3 }} bordered size="small">
      <Descriptions.Item label="状态">{project.status}</Descriptions.Item>
      <Descriptions.Item label="优先级">{project.priority}</Descriptions.Item>
      <Descriptions.Item label="来源">{project.source}</Descriptions.Item>
      <Descriptions.Item label="技术栈">
        {project.techStack?.map((t: string) => <Tag key={t}>{t}</Tag>) || '-'}
      </Descriptions.Item>
      <Descriptions.Item label="本地路径">{project.localPath || '-'}</Descriptions.Item>
      <Descriptions.Item label="前端命令">
        {project.frontendCommand ? <Tag color="green">{project.frontendCommand}</Tag> : project.openCommand ? <Tag>{project.openCommand}</Tag> : '-'}
      </Descriptions.Item>
      <Descriptions.Item label="后端命令">
        {project.backendCommand ? <Tag color="blue">{project.backendCommand}</Tag> : '-'}
      </Descriptions.Item>
      <Descriptions.Item label="线上地址">
        {project.liveUrl ? <a href={project.liveUrl} target="_blank" rel="noopener noreferrer">{project.liveUrl}</a> : '-'}
      </Descriptions.Item>
      <Descriptions.Item label="域名">{project.domainName || '-'}</Descriptions.Item>
      <Descriptions.Item label="创建时间">{new Date(project.createdAt).toLocaleString('zh-CN')}</Descriptions.Item>
    </Descriptions>
  );
}

// ==================== 仓库 Tab ====================

function ReposTab({ projectId, repos, onRefresh }: { projectId: string; repos: RemoteRepo[]; onRefresh: () => void }) {
  const [modalOpen, setModalOpen] = useState(false);
  const [form] = Form.useForm();
  const [syncing, setSyncing] = useState<string | null>(null);

  const handleAdd = async (values: AddRepoInput) => {
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    { title: '任务数', render: (_: unknown, r: any) => r._count?.tasks || 0 },
    {
      title: '操作', render: (_: unknown, record: RemoteRepo) => (
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

// ==================== 文档 Tab ====================

function DocumentsTab({ projectId }: { projectId: string }) {
  const [docs, setDocs] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [form] = Form.useForm();

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { loadDocs(); }, []);

  async function loadDocs() {
    try {
      const data = await documentsApi.list(projectId);
      setDocs(data);
    } finally {
      setLoading(false);
    }
  }

  const handleCreate = async (values: CreateDocumentInput) => {
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

// ==================== 项目活动 Tab ====================

const ACTION_MAP: Record<string, { icon: React.ReactNode; color: string; label: string }> = {
  status_change: { icon: <EditOutlined />, color: 'blue', label: '状态变更' },
  task_created: { icon: <PlusCircleOutlined />, color: 'green', label: '创建任务' },
  task_status_change: { icon: <CheckCircleOutlined />, color: 'orange', label: '任务状态变更' },
  repo_synced: { icon: <SyncOutlined />, color: 'cyan', label: '仓库同步' },
};

function formatLogDetails(action: string, details: string | null | undefined): string {
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
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);

  /* eslint-disable react-hooks/exhaustive-deps */
  useEffect(() => {
    loadTimeline();
  }, []);
  /* eslint-enable react-hooks/exhaustive-deps */

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
                {details && <span style={{ color: 'var(--color-text-description)' }}>- {details}</span>}
              </Space>
              <div style={{ fontSize: 12, color: 'var(--color-text-light)', marginTop: 2 }}>
                {new Date(log.createdAt).toLocaleString('zh-CN')}
              </div>
            </div>
          ),
        };
      })}
    />
  );
}
