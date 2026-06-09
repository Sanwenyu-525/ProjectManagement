import { useState, useEffect } from 'react';
import { Row, Col, Typography, List, Tag, Spin, Empty } from 'antd';
import { ProjectOutlined, CheckCircleOutlined, ClockCircleOutlined, PauseCircleOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { projectsApi } from '../../api';
import ProjectIcon from '../../shared/ProjectIcon';
import GlassCard from '../../shared/components/GlassCard';

const { Title, Text } = Typography;

const STATUS_COLORS: Record<string, string> = {
  Idea: 'default', Planning: 'blue', Development: 'orange',
  Testing: 'purple', Deployed: 'green', Maintained: 'cyan', Archived: 'default',
};

const STAT_CONFIG = [
  { key: 'total', title: '项目总数', icon: ProjectOutlined, gradient: 'linear-gradient(135deg, rgba(99, 102, 241, 0.08), rgba(139, 92, 246, 0.08))', border: 'rgba(99, 102, 241, 0.15)' },
  { key: 'active', title: '进行中', icon: ClockCircleOutlined, gradient: 'linear-gradient(135deg, rgba(245, 158, 11, 0.10), rgba(251, 191, 36, 0.08))', border: 'rgba(245, 158, 11, 0.18)' },
  { key: 'deployed', title: '已部署', icon: CheckCircleOutlined, gradient: 'linear-gradient(135deg, rgba(34, 197, 94, 0.10), rgba(74, 222, 128, 0.08))', border: 'rgba(34, 197, 94, 0.18)' },
  { key: 'archived', title: '已归档', icon: PauseCircleOutlined, gradient: 'linear-gradient(135deg, rgba(148, 163, 184, 0.08), rgba(203, 213, 225, 0.06))', border: 'rgba(148, 163, 184, 0.15)' },
];

function StatCard({ title, value, icon: Icon, gradient, border, delay }: {
  title: string; value: number; icon: any; gradient: string; border: string; delay: number;
}) {
  return (
    <div
      className={`animate-in animate-in-delay-${delay}`}
      style={{
        background: gradient,
        borderRadius: 12,
        padding: '22px 20px',
        border: `1px solid ${border}`,
        position: 'relative',
        overflow: 'hidden',
        cursor: 'default',
        transition: 'all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
      }}
      onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.08)'; }}
      onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none'; }}
    >
      {/* Glow dot */}
      <div style={{
        position: 'absolute',
        right: -10,
        top: -10,
        width: 80,
        height: 80,
        borderRadius: '50%',
        background: 'rgba(34, 197, 94, 0.06)',
        filter: 'blur(20px)',
      }} />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontSize: 12, color: '#6b7a99', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 10 }}>
            {title}
          </div>
          <div style={{ fontSize: 32, fontWeight: 700, color: '#1a1f36', fontFamily: "'Fira Code', monospace", letterSpacing: '-1px', lineHeight: 1 }}>
            {value}
          </div>
        </div>
        <div style={{
          width: 36,
          height: 36,
          borderRadius: 8,
          background: 'rgba(0, 0, 0, 0.04)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <Icon style={{ fontSize: 18, color: '#9eadc0' }} />
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadProjects(); }, []);

  async function loadProjects() {
    try {
      const data = await projectsApi.list();
      setProjects(data);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }

  const stats = {
    total: projects.length,
    active: projects.filter(p => !['Archived', 'Idea'].includes(p.status)).length,
    deployed: projects.filter(p => p.status === 'Deployed' || p.status === 'Maintained').length,
    archived: projects.filter(p => p.status === 'Archived').length,
  };

  const recentProjects = [...projects]
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, 6);

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 100 }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div style={{ padding: '28px 32px' }}>
      <div className="animate-in" style={{ marginBottom: 28 }}>
        <Title level={3} style={{ margin: 0, fontWeight: 700, color: '#1a1f36', letterSpacing: '-0.3px' }}>仪表盘</Title>
        <Text style={{ color: '#9eadc0', fontSize: 14 }}>概览你的所有项目和开发状态</Text>
      </div>

      {/* Stat cards */}
      <Row gutter={[16, 16]} style={{ marginBottom: 28 }}>
        {STAT_CONFIG.map((cfg, i) => (
          <Col xs={12} sm={6} key={cfg.key}>
            <StatCard
              title={cfg.title}
              value={stats[cfg.key as keyof typeof stats]}
              icon={cfg.icon}
              gradient={cfg.gradient}
              border={cfg.border}
              delay={i + 1}
            />
          </Col>
        ))}
      </Row>

      {/* Recent projects */}
      <GlassCard
        className="animate-in animate-in-delay-3"
        style={{
          overflow: 'hidden',
        }}
      >
        <div style={{ padding: '18px 24px', borderBottom: '1px solid rgba(0, 0, 0, 0.04)' }}>
          <Text strong style={{ fontSize: 14, color: '#1a1f36' }}>最近活跃项目</Text>
        </div>
        {recentProjects.length === 0 ? (
          <div style={{ padding: 48 }}><Empty description={<span style={{ color: '#9eadc0' }}>还没有项目</span>} /></div>
        ) : (
          <List
            grid={{ gutter: 0, xs: 1, sm: 2, md: 3 }}
            dataSource={recentProjects}
            renderItem={(project, index) => (
              <List.Item style={{ padding: 0 }}>
                <div
                  onClick={() => navigate(`/projects/${project.id}`)}
                  style={{
                    padding: '18px 24px',
                    cursor: 'pointer',
                    borderRight: index % 3 !== 2 ? '1px solid rgba(0, 0, 0, 0.04)' : 'none',
                    borderBottom: index < recentProjects.length - 3 ? '1px solid rgba(0, 0, 0, 0.04)' : 'none',
                    transition: 'background 0.15s ease',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(34, 197, 94, 0.04)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                    <ProjectIcon
                      name={project.name}
                      techStack={project.techStack}
                      iconType={project.iconType}
                      iconUrl={project.iconUrl}
                      iconColor={project.iconColor}
                      size={40}
                    />
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{
                        fontWeight: 600,
                        fontSize: 13,
                        marginBottom: 6,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        color: '#1a1f36',
                      }}>
                        {project.name}
                      </div>
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                        <Tag color={STATUS_COLORS[project.status] || 'default'} style={{ fontSize: 11, margin: 0 }}>
                          {project.status}
                        </Tag>
                        {project.techStack?.slice(0, 2).map((t: string) => (
                          <Tag key={t} style={{ fontSize: 11, margin: 0, background: 'rgba(0, 0, 0, 0.05)', color: '#6b7a99' }}>{t}</Tag>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </List.Item>
            )}
          />
        )}
      </GlassCard>
    </div>
  );
}
