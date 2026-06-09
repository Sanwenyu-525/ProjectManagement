import { useState, useEffect } from 'react';
import { Row, Col, Typography, List, Tag, Spin, Empty } from 'antd';
import { ProjectOutlined, CheckCircleOutlined, ClockCircleOutlined, PauseCircleOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { projectsApi } from '../../api';
import ProjectIcon from '../../shared/ProjectIcon';

const { Title, Text } = Typography;

const STATUS_COLORS: Record<string, string> = {
  Idea: 'default', Planning: 'blue', Development: 'orange',
  Testing: 'purple', Deployed: 'green', Maintained: 'cyan', Archived: 'default',
};

const STAT_CONFIG = [
  { key: 'total', title: '项目总数', icon: ProjectOutlined, gradient: 'linear-gradient(135deg, #1e293b, #0f172a)', border: '#2d3a52' },
  { key: 'active', title: '进行中', icon: ClockCircleOutlined, gradient: 'linear-gradient(135deg, #422006, #78350f)', border: '#92400e' },
  { key: 'deployed', title: '已部署', icon: CheckCircleOutlined, gradient: 'linear-gradient(135deg, #052e16, #14532d)', border: '#166534' },
  { key: 'archived', title: '已归档', icon: PauseCircleOutlined, gradient: 'linear-gradient(135deg, #1e293b, #1e293b)', border: '#334155' },
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
        transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
      }}
      onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.3)'; }}
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
          <div style={{ fontSize: 12, color: '#94a3b8', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 10 }}>
            {title}
          </div>
          <div style={{ fontSize: 32, fontWeight: 700, color: '#f1f5f9', fontFamily: "'Fira Code', monospace", letterSpacing: '-1px', lineHeight: 1 }}>
            {value}
          </div>
        </div>
        <div style={{
          width: 36,
          height: 36,
          borderRadius: 8,
          background: 'rgba(255,255,255,0.06)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <Icon style={{ fontSize: 18, color: '#64748b' }} />
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
        <Title level={3} style={{ margin: 0, fontWeight: 700, color: '#f1f5f9', letterSpacing: '-0.3px' }}>仪表盘</Title>
        <Text style={{ color: '#64748b', fontSize: 14 }}>概览你的所有项目和开发状态</Text>
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
      <div className="animate-in animate-in-delay-3" style={{
        background: '#151d2e',
        borderRadius: 12,
        border: '1px solid #1e293b',
        overflow: 'hidden',
      }}>
        <div style={{ padding: '18px 24px', borderBottom: '1px solid #1e293b' }}>
          <Text strong style={{ fontSize: 14, color: '#f1f5f9' }}>最近活跃项目</Text>
        </div>
        {recentProjects.length === 0 ? (
          <div style={{ padding: 48 }}><Empty description={<span style={{ color: '#64748b' }}>还没有项目</span>} /></div>
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
                    borderRight: index % 3 !== 2 ? '1px solid #1e293b' : 'none',
                    borderBottom: index < recentProjects.length - 3 ? '1px solid #1e293b' : 'none',
                    transition: 'background 0.15s ease',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(34, 197, 94, 0.03)')}
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
                        color: '#f1f5f9',
                      }}>
                        {project.name}
                      </div>
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                        <Tag color={STATUS_COLORS[project.status] || 'default'} style={{ fontSize: 11, margin: 0 }}>
                          {project.status}
                        </Tag>
                        {project.techStack?.slice(0, 2).map((t: string) => (
                          <Tag key={t} style={{ fontSize: 11, margin: 0, background: '#1e293b', color: '#94a3b8' }}>{t}</Tag>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </List.Item>
            )}
          />
        )}
      </div>
    </div>
  );
}
