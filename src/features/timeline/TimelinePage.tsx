import { useState, useEffect } from 'react';
import { Card, Timeline, Tag, Spin, Empty, Typography, Space } from 'antd';
import { CheckCircleOutlined, SyncOutlined, EditOutlined, PlusCircleOutlined, ClockCircleOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { timelineApi } from '../../api';

const { Title, Text } = Typography;

const ACTION_MAP: Record<string, { icon: React.ReactNode; color: string; label: string }> = {
  status_change: { icon: <EditOutlined />, color: 'blue', label: '状态变更' },
  task_created: { icon: <PlusCircleOutlined />, color: 'green', label: '创建任务' },
  task_status_change: { icon: <CheckCircleOutlined />, color: 'orange', label: '任务状态变更' },
  repo_synced: { icon: <SyncOutlined />, color: 'cyan', label: '仓库同步' },
};

function formatDetails(action: string, details: string | null): string {
  if (!details) return '';
  try {
    const d = JSON.parse(details);
    if (action === 'status_change') return `${d.from} → ${d.to}`;
    if (action === 'task_status_change') return `${d.from} → ${d.to}`;
    if (action === 'task_created') return d.title || '';
    if (action === 'repo_synced') return `${d.platform}: ${d.repo}`;
    return '';
  } catch {
    return '';
  }
}

export default function TimelinePage() {
  const navigate = useNavigate();
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTimeline();
  }, []);

  async function loadTimeline() {
    try {
      const data = await timelineApi.list({ limit: 100 });
      setLogs(data);
    } finally {
      setLoading(false);
    }
  }

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', padding: 100 }}><Spin size="large" /></div>;

  return (
    <div style={{ padding: 24 }}>
      <Title level={3} style={{ marginBottom: 24 }}>活动时间线</Title>

      {logs.length === 0 ? (
        <Empty description="暂无活动记录" />
      ) : (
        <Card>
          <Timeline
            items={logs.map(log => {
              const action = ACTION_MAP[log.action] || { icon: <ClockCircleOutlined />, color: 'gray', label: log.action };
              const details = formatDetails(log.action, log.details);
              return {
                dot: action.icon,
                color: action.color,
                children: (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 }}>
                    <div>
                      <Space>
                        <Tag color={action.color}>{action.label}</Tag>
                        <Text strong>{log.entityType}</Text>
                      </Space>
                      {details && <div style={{ marginTop: 4, color: '#666' }}>{details}</div>}
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <Tag
                        color="blue"
                        style={{ cursor: 'pointer' }}
                        onClick={() => navigate(`/projects/${log.projectId}`)}
                      >
                        {log.project?.name || '未知项目'}
                      </Tag>
                      <div style={{ fontSize: 12, color: '#999', marginTop: 4 }}>
                        {new Date(log.createdAt).toLocaleString('zh-CN')}
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
