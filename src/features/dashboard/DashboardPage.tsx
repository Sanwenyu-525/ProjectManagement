import { useState, useEffect } from 'react';
import { Row, Col, Card, Tag, Empty, Button, Tooltip, Progress, Skeleton } from 'antd';
import {
  CheckCircleOutlined,
  ArrowRightOutlined,
  PlusOutlined,
  FolderOutlined,
  RocketOutlined,
  DatabaseOutlined,
  ClockCircleOutlined,
  ReloadOutlined,
  DashboardOutlined,
  WarningOutlined,
  CloseCircleOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { projectsApi } from '../../api';
import ProjectIcon from '../../shared/ProjectIcon';

// 统计卡片配置
const STAT_CONFIG = [
  { key: 'total', title: '项目总数', icon: FolderOutlined, iconColor: '#6366f1' },
  { key: 'active', title: '进行中', icon: RocketOutlined, iconColor: '#f59e0b' },
  { key: 'deployed', title: '已部署', icon: CheckCircleOutlined, iconColor: '#22c55e' },
  { key: 'archived', title: '已归档', icon: DatabaseOutlined, iconColor: '#94a3b8' },
];

// 状态监控配置
const STATUS_MONITOR_CONFIG = [
  { key: 'running', title: '运行中', icon: CheckCircleOutlined, color: '#52c41a' },
  { key: 'stopped', title: '已停止', icon: CloseCircleOutlined, color: '#8b95a5' },
  { key: 'error', title: '异常', icon: WarningOutlined, color: '#ff4d4f' },
  { key: 'total', title: '总数', icon: DashboardOutlined, color: '#3b82f6' },
];

// 统计卡片
function StatCard({ title, value, icon: Icon, iconColor, delay }: {
  title: string; value: number; icon: any; iconColor: string; delay: number;
}) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <Card
      className={`animate-in animate-in-delay-${delay}`}
      hoverable
      style={{
        borderRadius: 12,
        height: 120,
        borderColor: isHovered ? `${iconColor}40` : undefined,
        boxShadow: isHovered ? `0 4px 12px ${iconColor}15` : undefined,
        transition: 'all 0.3s ease',
      }}
      bodyStyle={{ padding: '20px', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div style={{ fontSize: 13, color: '#6b7a99' }}>{title}</div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div style={{ fontSize: 28, fontWeight: 700, color: '#1a1f36', fontFamily: "'Fira Code', monospace" }}>
          {value}
        </div>
        <div style={{
          width: 36, height: 36, borderRadius: 8,
          background: `${iconColor}10`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Icon style={{ fontSize: 16, color: iconColor }} />
        </div>
      </div>
    </Card>
  );
}

// 状态监控卡片
function StatusMonitorCard({ title, value, icon: Icon, color, delay }: {
  title: string; value: number; icon: any; color: string; delay: number;
}) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <Card
      className={`animate-in animate-in-delay-${delay}`}
      hoverable
      style={{
        borderRadius: 12,
        height: 100,
        background: `linear-gradient(135deg, ${color}08 0%, ${color}02 100%)`,
        border: `1px solid ${color}20`,
        boxShadow: isHovered ? `0 4px 12px ${color}15` : undefined,
        transition: 'all 0.3s ease',
      }}
      bodyStyle={{ padding: '16px', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Icon style={{ fontSize: 16, color }} />
        <span style={{ fontSize: 13, color: '#6b7a99' }}>{title}</span>
      </div>
      <div style={{ fontSize: 28, fontWeight: 700, color, fontFamily: "'Fira Code', monospace" }}>
        {value}
      </div>
    </Card>
  );
}

// 项目状态卡片
function ProjectStatusCard({ project }: { project: any }) {
  const navigate = useNavigate();
  const isRunning = project.status === 'Running';
  const statusColor = isRunning ? '#52c41a' : '#8b95a5';
  const healthScore = calculateHealthScore(project);

  return (
    <Col xs={24} sm={12} md={8} lg={6}>
      <Card
        hoverable
        onClick={() => navigate(`/projects/${project.id}`)}
        style={{
          borderRadius: 12,
          height: 200,
          border: `1px solid ${statusColor}20`,
          boxShadow: `0 2px 8px ${statusColor}10`,
          transition: 'all 0.3s ease',
        }}
        bodyStyle={{ padding: 16, height: '100%', display: 'flex', flexDirection: 'column' }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <ProjectIcon
              name={project.name}
              iconType={project.iconType}
              iconUrl={project.iconUrl}
              iconColor={project.iconColor}
              techStack={project.techStack}
              size={32}
            />
            <div>
              <Tooltip title={project.name}>
                <div style={{ fontWeight: 600, fontSize: 14, maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {project.name}
                </div>
              </Tooltip>
              <Tag
                color={statusColor}
                style={{ fontSize: 11, margin: 0, padding: '0 6px' }}
              >
                {isRunning ? '运行中' : '已停止'}
              </Tag>
            </div>
          </div>
          {isRunning ? (
            <CheckCircleOutlined style={{ color: '#52c41a', fontSize: 18 }} />
          ) : (
            <CloseCircleOutlined style={{ color: '#8b95a5', fontSize: 18 }} />
          )}
        </div>

        {/* Info */}
        <div style={{ flex: 1, marginBottom: 12, fontSize: 12, color: '#6b7a99' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <span>运行时间</span>
            <span style={{ color: '#1a1f36' }}>{isRunning ? '2h 30m' : 'N/A'}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>端口</span>
            <span style={{ color: '#1a1f36' }}>{extractPortFromCommand(project.openCommand) || 'N/A'}</span>
          </div>
        </div>

        {/* Health Score */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 12, color: '#6b7a99' }}>健康度</span>
          <Progress
            type="circle"
            percent={healthScore}
            size={36}
            strokeColor={getHealthColor(healthScore)}
            format={(percent) => `${percent}`}
          />
        </div>
      </Card>
    </Col>
  );
}

// 辅助函数
function extractPortFromCommand(command?: string): number | undefined {
  if (!command) return undefined;
  const portMatch = command.match(/PORT=(\d+)/);
  if (portMatch) return parseInt(portMatch[1], 10);
  return 3000;
}

function calculateHealthScore(project: any): number {
  // 活跃度 (40分): 按最后更新时间衰减
  const updated = new Date(project.updatedAt).getTime();
  const daysSinceUpdate = (Date.now() - updated) / (1000 * 60 * 60 * 24);
  let activity = 0;
  if (daysSinceUpdate <= 1) activity = 40;
  else if (daysSinceUpdate <= 7) activity = 40 - (daysSinceUpdate - 1) * (20 / 6);
  else if (daysSinceUpdate <= 30) activity = 20 - (daysSinceUpdate - 7) * (15 / 23);
  else activity = Math.max(0, 5 - (daysSinceUpdate - 30) * (5 / 60));

  // 项目状态 (30分)
  const statusMap: Record<string, number> = {
    Running: 30, Deployed: 25, Maintained: 25,
    InProgress: 20, Planning: 15, Idea: 10,
    Paused: 5, Archived: 0, Cancelled: 0,
  };
  const statusScore = statusMap[project.status] ?? 5;

  // 信息完整度 (30分)
  let completeness = 0;
  if (project.description) completeness += 10;
  if (project.techStack?.length) completeness += 10;
  if (project.openCommand) completeness += 10;

  return Math.round(Math.max(0, Math.min(100, activity + statusScore + completeness)));
}

function getHealthColor(score: number): string {
  if (score >= 90) return '#52c41a';
  if (score >= 70) return '#3b82f6';
  if (score >= 50) return '#f59e0b';
  return '#ff4d4f';
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => { loadProjects(); }, []);

  async function loadProjects() {
    try {
      const data = await projectsApi.list();
      setProjects(data);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadProjects();
    setRefreshing(false);
  };

  const stats = {
    total: projects.length,
    active: projects.filter(p => !['Archived', 'Idea'].includes(p.status)).length,
    deployed: projects.filter(p => p.status === 'Deployed' || p.status === 'Maintained').length,
    archived: projects.filter(p => p.status === 'Archived').length,
  };

  const statusStats = {
    running: projects.filter(p => p.status === 'Running').length,
    stopped: projects.filter(p => p.status !== 'Running').length,
    error: 0, // Will be calculated based on actual errors
    total: projects.length,
  };

  const recentProjects = [...projects]
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, 6);

  if (loading) {
    return (
      <div style={{ padding: 24 }}>
        <Skeleton active paragraph={{ rows: 0 }} style={{ marginBottom: 24 }} />
        <Row gutter={[20, 20]} style={{ marginBottom: 24 }}>
          {[0,1,2,3].map(i => (
            <Col xs={12} sm={6} key={i}>
              <Card style={{ height: 120 }}><Skeleton active paragraph={{ rows: 2 }} /></Card>
            </Col>
          ))}
        </Row>
        <Row gutter={[16, 16]}>
          {[0,1,2,3].map(i => (
            <Col xs={24} sm={12} md={8} lg={6} key={i}>
              <Card style={{ height: 200 }}><Skeleton active avatar paragraph={{ rows: 3 }} /></Card>
            </Col>
          ))}
        </Row>
      </div>
    );
  }

  return (
    <div style={{ padding: 24 }}>
      {/* Header */}
      <div className="animate-in" style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 24,
        paddingBottom: 16,
        borderBottom: '1px solid rgba(0,0,0,0.06)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <DashboardOutlined style={{ fontSize: 24, color: '#3b82f6' }} />
          <h2 style={{ margin: 0, fontSize: 24, fontWeight: 600 }}>仪表盘</h2>
        </div>
        <Button
          icon={<ReloadOutlined />}
          onClick={handleRefresh}
          loading={refreshing}
          size="large"
        >
          刷新
        </Button>
      </div>

      {/* Stats Overview */}
      <Row gutter={[20, 20]} style={{ marginBottom: 24 }}>
        {STAT_CONFIG.map((cfg, i) => (
          <Col xs={12} sm={6} key={cfg.key}>
            <StatCard
              title={cfg.title}
              value={stats[cfg.key as keyof typeof stats]}
              icon={cfg.icon}
              iconColor={cfg.iconColor}
              delay={i + 1}
            />
          </Col>
        ))}
      </Row>

      {/* Status Monitor */}
      <div className="animate-in animate-in-delay-3" style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <DashboardOutlined style={{ color: '#3b82f6' }} />
          <span style={{ fontWeight: 600, fontSize: 16 }}>项目状态监控</span>
        </div>
        <Row gutter={[16, 16]}>
          {STATUS_MONITOR_CONFIG.map((cfg, i) => (
            <Col xs={12} sm={6} key={cfg.key}>
              <StatusMonitorCard
                title={cfg.title}
                value={statusStats[cfg.key as keyof typeof statusStats]}
                icon={cfg.icon}
                color={cfg.color}
                delay={i + 1}
              />
            </Col>
          ))}
        </Row>
      </div>

      {/* Project Status Grid */}
      <div className="animate-in animate-in-delay-4" style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <CheckCircleOutlined style={{ color: '#52c41a' }} />
            <span style={{ fontWeight: 600 }}>项目状态</span>
            <Tag style={{ fontSize: 11, background: 'rgba(52, 196, 26, 0.1)', color: '#52c41a', border: 'none' }}>
              {statusStats.running} 运行中
            </Tag>
          </div>
        </div>
        <Row gutter={[16, 16]}>
          {projects.slice(0, 8).map((project) => (
            <ProjectStatusCard key={project.id} project={project} />
          ))}
        </Row>
      </div>

      {/* Recent Active Projects */}
      <div className="animate-in animate-in-delay-5">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <ClockCircleOutlined style={{ color: '#6b7a99' }} />
            <span style={{ fontWeight: 600 }}>最近活跃项目</span>
            <Tag style={{ fontSize: 11, background: 'rgba(34, 197, 94, 0.1)', color: '#22c55e', border: 'none' }}>
              {recentProjects.length}
            </Tag>
          </div>
          {recentProjects.length > 0 && (
            <Button type="link" size="small" onClick={() => navigate('/projects')} style={{ padding: 0 }}>
              查看全部 <ArrowRightOutlined />
            </Button>
          )}
        </div>

        {recentProjects.length === 0 ? (
          <Card style={{ borderRadius: 12 }}>
            <Empty
              description={<span style={{ color: '#9eadc0' }}>还没有项目，点击"新建项目"开始</span>}
            >
              <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/projects/new')}>
                新建项目
              </Button>
            </Empty>
          </Card>
        ) : (
          <Row gutter={[16, 16]}>
            {recentProjects.map((project) => (
              <ProjectStatusCard key={project.id} project={project} />
            ))}
          </Row>
        )}
      </div>
    </div>
  );
}
