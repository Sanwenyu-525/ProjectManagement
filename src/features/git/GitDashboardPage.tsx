import { useState, useEffect, useCallback } from 'react';
import { Typography, Table, Tag, Space, Button, Tooltip, Spin, message, Empty } from 'antd';
import {
  ReloadOutlined, BranchesOutlined, CloudUploadOutlined, CloudDownloadOutlined,
  FileOutlined, CheckCircleOutlined, ProjectOutlined, FolderOpenOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { projectsApi, gitApi, healthApi } from '../../api';

const { Title } = Typography;

interface ProjectGitInfo {
  id: string;
  name: string;
  localPath: string;
  currentBranch: string | null;
  dirtyCount: number;
  aheadCount: number;
  behindCount: number;
  lastCommitMsg: string | null;
  lastCommitTime: string | null;
  loading: boolean;
}

export default function GitDashboardPage() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<ProjectGitInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState<Set<string>>(new Set());

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const list = await projectsApi.list() as any[];
      const withPaths = list.filter((p: any) => p.localPath);

      // Initialize with loading state
      const initial: ProjectGitInfo[] = withPaths.map((p: any) => ({
        id: p.id,
        name: p.name,
        localPath: p.localPath,
        currentBranch: null,
        dirtyCount: 0,
        aheadCount: 0,
        behindCount: 0,
        lastCommitMsg: null,
        lastCommitTime: null,
        loading: true,
      }));
      setProjects(initial);

      // Fetch shared data once
      const allHealth = await healthApi.getAllLatest().catch(() => []) as any[];

      // Fetch git info for each project in parallel
      const promises = withPaths.map(async (p: any) => {
        try {
          const [status, log, branches] = await Promise.all([
            gitApi.status(p.localPath).catch(() => []),
            gitApi.log(p.localPath, 1).catch(() => []),
            gitApi.branches(p.localPath).catch(() => ({ current: null })),
          ]);

          const currentBranch = (branches as any)?.current || null;
          const dirtyCount = Array.isArray(status) ? status.length : 0;
          const lastCommit = Array.isArray(log) && log.length > 0 ? log[0] : null;

          // Get ahead/behind from pre-fetched health data
          const health = allHealth?.find((h: any) => h.projectId === p.id);
          const aheadCount = health?.aheadCount || 0;
          const behindCount = health?.behindCount || 0;

          return {
            id: p.id,
            name: p.name,
            localPath: p.localPath,
            currentBranch,
            dirtyCount,
            aheadCount,
            behindCount,
            lastCommitMsg: lastCommit?.message?.trim() || null,
            lastCommitTime: lastCommit?.date || null,
            loading: false,
          } as ProjectGitInfo;
        } catch {
          return {
            id: p.id,
            name: p.name,
            localPath: p.localPath,
            currentBranch: null,
            dirtyCount: 0,
            aheadCount: 0,
            behindCount: 0,
            lastCommitMsg: null,
            lastCommitTime: null,
            loading: false,
          } as ProjectGitInfo;
        }
      });

      const results = await Promise.all(promises);
      setProjects(results);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  const handlePush = async (localPath: string, projectId: string) => {
    setRefreshing(prev => new Set(prev).add(projectId));
    try {
      await gitApi.push(localPath);
      message.success('推送成功');
      await loadAll();
    } catch (err) {
      message.error(`推送失败: ${String(err)}`);
    } finally {
      setRefreshing(prev => { const n = new Set(prev); n.delete(projectId); return n; });
    }
  };

  const columns = [
    {
      title: '项目',
      dataIndex: 'name',
      key: 'name',
      render: (name: string, record: ProjectGitInfo) => (
        <a onClick={() => navigate(`/projects/${record.id}`)} style={{ fontWeight: 500 }}>
          {name}
        </a>
      ),
    },
    {
      title: '分支',
      dataIndex: 'currentBranch',
      key: 'branch',
      width: 160,
      render: (branch: string | null) => branch ? (
        <Tag icon={<BranchesOutlined />} color="blue">{branch}</Tag>
      ) : (
        <Tag color="default">—</Tag>
      ),
    },
    {
      title: '状态',
      key: 'status',
      width: 200,
      render: (_: any, record: ProjectGitInfo) => (
        <Space size={4}>
          {record.dirtyCount > 0 && (
            <Tooltip title={`${record.dirtyCount} 个未提交文件`}>
              <Tag icon={<FileOutlined />} color="orange">{record.dirtyCount}</Tag>
            </Tooltip>
          )}
          {record.aheadCount > 0 && (
            <Tooltip title={`${record.aheadCount} 个提交待推送`}>
              <Tag icon={<CloudUploadOutlined />} color="green">{record.aheadCount}↑</Tag>
            </Tooltip>
          )}
          {record.behindCount > 0 && (
            <Tooltip title={`落后远程 ${record.behindCount} 个提交`}>
              <Tag icon={<CloudDownloadOutlined />} color="red">{record.behindCount}↓</Tag>
            </Tooltip>
          )}
          {record.dirtyCount === 0 && record.aheadCount === 0 && record.behindCount === 0 && (
            <Tag color="success">✓ 干净</Tag>
          )}
        </Space>
      ),
    },
    {
      title: '最近提交',
      dataIndex: 'lastCommitMsg',
      key: 'lastCommit',
      ellipsis: true,
      render: (msg: string | null) => msg ? (
        <Tooltip title={msg}>
          <span style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>{msg}</span>
        </Tooltip>
      ) : (
        <span style={{ color: 'var(--color-text-muted)' }}>—</span>
      ),
    },
    {
      title: '操作',
      key: 'actions',
      width: 100,
      render: (_: any, record: ProjectGitInfo) => (
        <Space>
          {record.aheadCount > 0 && (
            <Button
              type="link"
              size="small"
              icon={<CloudUploadOutlined />}
              loading={refreshing.has(record.id)}
              onClick={() => handlePush(record.localPath, record.id)}
            >
              推送
            </Button>
          )}
          <Button
            type="link"
            size="small"
            onClick={() => navigate(`/projects/${record.id}`)}
          >
            详情
          </Button>
        </Space>
      ),
    },
  ];

  const totalDirty = projects.reduce((s, p) => s + p.dirtyCount, 0);
  const totalAhead = projects.reduce((s, p) => s + p.aheadCount, 0);
  const totalBehind = projects.reduce((s, p) => s + p.behindCount, 0);
  const cleanCount = projects.filter(p => p.dirtyCount === 0 && p.aheadCount === 0 && p.behindCount === 0 && !p.loading).length;

  if (loading) {
    return <div style={{ padding: 40, textAlign: 'center' }}><Spin size="large" /></div>;
  }

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <Title level={4} style={{ margin: 0 }}>Git 控制中心</Title>
        <Button icon={<ReloadOutlined />} onClick={loadAll}>刷新全部</Button>
      </div>

      <div style={{
        display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap',
      }}>
        <StatCard icon={<ProjectOutlined />} label="项目总数" value={projects.length} color="#3b82f6" />
        <StatCard icon={<CheckCircleOutlined />} label="干净" value={cleanCount} color="#22c55e" />
        {totalDirty > 0 && (
          <StatCard icon={<FileOutlined />} label="未提交" value={totalDirty} color="#f59e0b" />
        )}
        {totalAhead > 0 && (
          <StatCard icon={<CloudUploadOutlined />} label="待推送" value={totalAhead} color="#22c55e" />
        )}
        {totalBehind > 0 && (
          <StatCard icon={<CloudDownloadOutlined />} label="落后" value={totalBehind} color="#ef4444" />
        )}
      </div>

      {projects.length === 0 ? (
        <Empty
          image={<FolderOpenOutlined style={{ fontSize: 48, color: 'var(--color-text-muted)' }} />}
          description={
            <span style={{ color: 'var(--color-text-secondary)' }}>
              暂无已配置本地路径的项目，请先在项目设置中配置本地路径
            </span>
          }
        />
      ) : (
        <Table
          dataSource={projects}
          columns={columns}
          rowKey="id"
          pagination={false}
          size="middle"
          style={{ background: 'var(--color-bg-card)', borderRadius: 12, backdropFilter: 'blur(12px)' }}
          rowClassName={(record) => record.loading ? 'ant-table-row-loading' : ''}
        />
      )}
    </div>
  );
}

function StatCard({ icon, label, value, color }: {
  icon: React.ReactNode;
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '10px 16px', borderRadius: 10,
      background: 'var(--color-bg-card)',
      backdropFilter: 'blur(12px)',
      border: '1px solid var(--color-border)',
      minWidth: 120,
    }}>
      <div style={{
        width: 32, height: 32, borderRadius: 8,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: `${color}12`, color, fontSize: 15,
      }}>
        {icon}
      </div>
      <div>
        <div style={{ fontSize: 18, fontWeight: 600, color: 'var(--color-text-primary)', lineHeight: 1.2 }}>
          {value}
        </div>
        <div style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>{label}</div>
      </div>
    </div>
  );
}
