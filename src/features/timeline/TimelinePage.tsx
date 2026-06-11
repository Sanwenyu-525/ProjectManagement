import { useState, useEffect } from 'react';
import { Card, Timeline, Tag, Spin, Empty, Typography, Row, Col, Statistic, Button, Select, Tooltip } from 'antd';
import {
  CheckCircleOutlined,
  SyncOutlined,
  EditOutlined,
  PlusCircleOutlined,
  ClockCircleOutlined,
  UserOutlined,
  ProjectOutlined,
  FileTextOutlined,
  RocketOutlined,
  BellOutlined,
  CalendarOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { timelineApi } from '../../api';

const { Text } = Typography;

const ACTION_MAP: Record<string, { icon: React.ReactNode; color: string; label: string; category: string }> = {
  status_change: { icon: <EditOutlined />, color: 'blue', label: '状态变更', category: '项目' },
  task_created: { icon: <PlusCircleOutlined />, color: 'green', label: '创建任务', category: '任务' },
  task_status_change: { icon: <CheckCircleOutlined />, color: 'orange', label: '任务状态变更', category: '任务' },
  repo_synced: { icon: <SyncOutlined />, color: 'cyan', label: '仓库同步', category: '仓库' },
  milestone_created: { icon: <RocketOutlined />, color: 'purple', label: '创建里程碑', category: '里程碑' },
  document_created: { icon: <FileTextOutlined />, color: 'geekblue', label: '创建文档', category: '文档' },
  member_joined: { icon: <UserOutlined />, color: 'lime', label: '成员加入', category: '团队' },
};

const CATEGORY_COLORS: Record<string, string> = {
  '项目': '#3b82f6',
  '任务': '#22c55e',
  '仓库': '#06b6d4',
  '里程碑': '#8b5cf6',
  '文档': '#1d4ed8',
  '团队': '#84cc16',
  '系统': '#6b7280',
};

function formatDetails(action: string, details: string | null): string {
  if (!details) return '';
  try {
    const d = JSON.parse(details);
    if (action === 'status_change') return `${d.from} → ${d.to}`;
    if (action === 'task_status_change') return `${d.from} → ${d.to}`;
    if (action === 'task_created') return d.title || '';
    if (action === 'repo_synced') return `${d.platform}: ${d.repo}`;
    if (action === 'milestone_created') return d.name || '';
    if (action === 'document_created') return d.title || '';
    if (action === 'member_joined') return d.username || '';
    return '';
  } catch {
    return '';
  }
}

function formatTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return '刚刚';
  if (diffMins < 60) return `${diffMins} 分钟前`;
  if (diffHours < 24) return `${diffHours} 小时前`;
  if (diffDays < 7) return `${diffDays} 天前`;
  return date.toLocaleDateString('zh-CN');
}

export default function TimelinePage() {
  const navigate = useNavigate();
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');

  useEffect(() => {
    loadTimeline();
  }, []);

  async function loadTimeline() {
    try {
      setLoading(true);
      const data = await timelineApi.list({ limit: 100 });
      setLogs(data);
    } finally {
      setLoading(false);
    }
  }

  const filteredLogs = logs.filter(log => {
    if (filter !== 'all') {
      const action = ACTION_MAP[log.action];
      if (!action || action.category !== filter) return false;
    }
    return true;
  });

  const stats = {
    total: logs.length,
    today: logs.filter(log => {
      const date = new Date(log.createdAt);
      const today = new Date();
      return date.toDateString() === today.toDateString();
    }).length,
    thisWeek: logs.filter(log => {
      const date = new Date(log.createdAt);
      const now = new Date();
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      return date >= weekAgo;
    }).length,
  };

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', padding: 100 }}><Spin size="large" /></div>;

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
          <ClockCircleOutlined style={{ fontSize: 24, color: '#8b5cf6' }} />
          <h2 style={{ margin: 0, fontSize: 24, fontWeight: 600 }}>活动时间线</h2>
        </div>
        <Button onClick={loadTimeline}>刷新</Button>
      </div>

      {/* Stats */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col span={8}>
          <Card size="small">
            <Statistic title="总活动" value={stats.total} prefix={<BellOutlined />} />
          </Card>
        </Col>
        <Col span={8}>
          <Card size="small">
            <Statistic title="今日活动" value={stats.today} prefix={<ClockCircleOutlined />} valueStyle={{ color: '#3b82f6' }} />
          </Card>
        </Col>
        <Col span={8}>
          <Card size="small">
            <Statistic title="本周活动" value={stats.thisWeek} prefix={<CalendarOutlined />} valueStyle={{ color: '#22c55e' }} />
          </Card>
        </Col>
      </Row>

      {/* Filters */}
      <div style={{ marginBottom: 16, display: 'flex', gap: 12 }}>
        <Select
          value={filter}
          onChange={setFilter}
          style={{ width: 150 }}
          options={[
            { value: 'all', label: '全部' },
            { value: '项目', label: '项目' },
            { value: '任务', label: '任务' },
            { value: '仓库', label: '仓库' },
            { value: '里程碑', label: '里程碑' },
            { value: '文档', label: '文档' },
            { value: '团队', label: '团队' },
          ]}
        />
      </div>

      {/* Timeline */}
      {filteredLogs.length === 0 ? (
        <Empty description="暂无活动记录" />
      ) : (
        <Card>
          <Timeline
            items={filteredLogs.map(log => {
              const action = ACTION_MAP[log.action] || { icon: <ClockCircleOutlined />, color: 'gray', label: log.action, category: '系统' };
              const details = formatDetails(log.action, log.details);
              const timeAgo = formatTime(log.createdAt);
              const categoryColor = CATEGORY_COLORS[action.category] || '#6b7280';

              return {
                dot: (
                  <div style={{
                    width: 24,
                    height: 24,
                    borderRadius: '50%',
                    background: `${categoryColor}15`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: `2px solid ${categoryColor}`,
                  }}>
                    {action.icon}
                  </div>
                ),
                children: (
                  <div style={{
                    padding: '12px 16px',
                    background: 'rgba(0,0,0,0.02)',
                    borderRadius: 8,
                    marginBottom: 8,
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                          <Tag color={action.color} style={{ margin: 0 }}>{action.label}</Tag>
                          <Tag color={categoryColor} style={{ margin: 0, fontSize: 11 }}>{action.category}</Tag>
                        </div>
                        <Text strong style={{ display: 'block', marginTop: 8 }}>{log.entityType}</Text>
                        {details && <div style={{ marginTop: 4, color: '#6b7a99', fontSize: 13 }}>{details}</div>}
                      </div>
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <Tooltip title={log.project?.name}>
                          <Tag
                            color="blue"
                            style={{ cursor: 'pointer' }}
                            onClick={() => navigate(`/projects/${log.projectId}`)}
                          >
                            <ProjectOutlined style={{ marginRight: 4 }} />
                            {log.project?.name || '未知项目'}
                          </Tag>
                        </Tooltip>
                        <div style={{ fontSize: 12, color: '#9eadc0', marginTop: 8 }}>
                          <ClockCircleOutlined style={{ marginRight: 4 }} />
                          {timeAgo}
                        </div>
                        <div style={{ fontSize: 11, color: '#c0c8d8', marginTop: 4 }}>
                          {new Date(log.createdAt).toLocaleString('zh-CN')}
                        </div>
                      </div>
                    </div>
                  </div>
                ),
              };
            })}
          />
        </Card>
      )}
    </div>
  );
}
