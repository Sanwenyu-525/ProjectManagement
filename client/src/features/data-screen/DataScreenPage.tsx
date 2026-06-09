import { useState, useEffect, useMemo } from 'react';
import { Card, Spin, Button, Space, Typography, List, Tag } from 'antd';
import { FullscreenOutlined, ReloadOutlined } from '@ant-design/icons';
import ReactECharts from 'echarts-for-react';
import { projectsApi, timelineApi } from '../../api';

const { Title, Text } = Typography;

const STATUS_COLORS: Record<string, string> = {
  Idea: '#d9d9d9', Planning: '#1677ff', Development: '#fa8c16',
  Testing: '#722ed1', Deployed: '#52c41a', Maintained: '#13c2c2', Archived: '#8c8c8c',
};

const ACTION_LABELS: Record<string, string> = {
  status_change: '状态变更', task_created: '创建任务',
  task_status_change: '任务状态变更', repo_synced: '仓库同步',
};

function cardStyle(extend?: React.CSSProperties): React.CSSProperties {
  return { background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, ...extend };
}

export default function DataScreenPage() {
  const [projects, setProjects] = useState<any[]>([]);
  const [activityLogs, setActivityLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
    const timer = setInterval(loadData, 60000);
    return () => clearInterval(timer);
  }, []);

  async function loadData() {
    try {
      const [projRes, logRes] = await Promise.all([
        projectsApi.list(),
        timelineApi.list({ limit: 100 }),
      ]);
      setProjects(projRes.data.data);
      setActivityLogs(logRes.data.data);
    } finally {
      setLoading(false);
    }
  }

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) document.documentElement.requestFullscreen();
    else document.exitFullscreen();
  };

  // 计算数据
  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    projects.forEach(p => { counts[p.status] = (counts[p.status] || 0) + 1; });
    return counts;
  }, [projects]);

  const techCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    projects.forEach(p => (p.techStack || []).forEach((t: string) => { counts[t] = (counts[t] || 0) + 1; }));
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 10);
  }, [projects]);

  const repoCount = projects.reduce((sum, p) => sum + (p.remoteRepos?.length || 0), 0);

  // 活动热力图数据（最近 30 天）
  const heatmapData = useMemo(() => {
    const dayMap: Record<string, number> = {};
    const now = new Date();
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      dayMap[d.toISOString().slice(0, 10)] = 0;
    }
    activityLogs.forEach(log => {
      const day = new Date(log.createdAt).toISOString().slice(0, 10);
      if (dayMap[day] !== undefined) dayMap[day]++;
    });
    return Object.entries(dayMap).map(([date, count]) => [date, count]);
  }, [activityLogs]);

  // 健康度评分（基于状态、任务完成率、活跃度）
  const healthScores = useMemo(() => {
    if (projects.length === 0) return null;
    const activeRate = projects.filter(p => !['Archived', 'Idea'].includes(p.status)).length / projects.length;
    const deployedRate = projects.filter(p => ['Deployed', 'Maintained'].includes(p.status)).length / projects.length;
    const repoRate = projects.filter(p => (p.remoteRepos?.length || 0) > 0).length / projects.length;
    const docRate = projects.filter(p => (p._count?.documents || 0) > 0).length / projects.length;
    const taskRate = projects.filter(p => (p._count?.tasks || 0) > 0).length / projects.length;
    return [
      { name: '活跃度', value: Math.round(activeRate * 100) },
      { name: '部署率', value: Math.round(deployedRate * 100) },
      { name: '仓库管理', value: Math.round(repoRate * 100) },
      { name: '文档覆盖', value: Math.round(docRate * 100) },
      { name: '任务管理', value: Math.round(taskRate * 100) },
    ];
  }, [projects]);

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', padding: 100, background: '#0f172a', minHeight: '100vh' }}><Spin size="large" /></div>;

  return (
    <div style={{ background: '#0f172a', minHeight: '100vh', color: '#e2e8f0', padding: 32 }}>
      {/* 头部 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
        <Title level={2} style={{ color: '#e2e8f0', margin: 0 }}>DevHub 数据大屏</Title>
        <Space>
          <Button ghost icon={<ReloadOutlined />} onClick={loadData}>刷新</Button>
          <Button ghost icon={<FullscreenOutlined />} onClick={toggleFullscreen}>全屏</Button>
        </Space>
      </div>

      {/* 统计卡片 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
        {[
          { label: '项目总数', value: projects.length, color: '#6366F1' },
          { label: '进行中', value: projects.filter(p => !['Archived', 'Idea'].includes(p.status)).length, color: '#fa8c16' },
          { label: '已部署', value: projects.filter(p => ['Deployed', 'Maintained'].includes(p.status)).length, color: '#52c41a' },
          { label: '远程仓库', value: repoCount, color: '#1677ff' },
        ].map((item, i) => (
          <Card key={i} style={cardStyle()}>
            <div style={{ color: '#94a3b8', fontSize: 14, marginBottom: 8 }}>{item.label}</div>
            <div style={{ color: item.color, fontSize: 40, fontWeight: 700 }}>{item.value}</div>
          </Card>
        ))}
      </div>

      {/* 第一行图表 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
        {/* 状态分布饼图 */}
        <Card style={cardStyle()}>
          <Title level={4} style={{ color: '#e2e8f0' }}>项目状态分布</Title>
          <ReactECharts style={{ height: 300 }} option={{
            tooltip: { trigger: 'item' },
            series: [{
              type: 'pie', radius: ['40%', '70%'],
              itemStyle: { borderRadius: 8 },
              label: { color: '#e2e8f0' },
              data: Object.entries(statusCounts).map(([name, value]) => ({
                name, value, itemStyle: { color: STATUS_COLORS[name] },
              })),
            }],
          }} />
        </Card>

        {/* 技术栈柱状图 */}
        <Card style={cardStyle()}>
          <Title level={4} style={{ color: '#e2e8f0' }}>技术栈使用统计</Title>
          <ReactECharts style={{ height: 300 }} option={{
            tooltip: { trigger: 'axis' },
            xAxis: { type: 'value', axisLabel: { color: '#94a3b8' }, splitLine: { lineStyle: { color: 'rgba(255,255,255,0.1)' } } },
            yAxis: { type: 'category', data: techCounts.map(d => d[0]).reverse(), axisLabel: { color: '#e2e8f0' } },
            series: [{ type: 'bar', data: techCounts.map(d => d[1]).reverse(), itemStyle: { color: '#6366F1', borderRadius: [0, 4, 4, 0] } }],
          }} />
        </Card>
      </div>

      {/* 第二行图表 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 16 }}>
        {/* 健康度雷达图 */}
        <Card style={cardStyle()}>
          <Title level={4} style={{ color: '#e2e8f0' }}>项目健康度</Title>
          {healthScores && (
            <ReactECharts style={{ height: 300 }} option={{
              tooltip: {},
              radar: {
                indicator: healthScores.map(s => ({ name: s.name, max: 100 })),
                axisName: { color: '#e2e8f0' },
                splitLine: { lineStyle: { color: 'rgba(255,255,255,0.1)' } },
                splitArea: { areaStyle: { color: ['rgba(99,102,241,0.05)', 'rgba(99,102,241,0.1)'] } },
                axisLine: { lineStyle: { color: 'rgba(255,255,255,0.2)' } },
              },
              series: [{
                type: 'radar',
                data: [{
                  value: healthScores.map(s => s.value),
                  name: '健康度',
                  areaStyle: { color: 'rgba(99,102,241,0.3)' },
                  lineStyle: { color: '#6366F1' },
                  itemStyle: { color: '#6366F1' },
                }],
              }],
            }} />
          )}
        </Card>

        {/* 活动热力图 */}
        <Card style={cardStyle()}>
          <Title level={4} style={{ color: '#e2e8f0' }}>30天活动热力图</Title>
          <ReactECharts style={{ height: 300 }} option={{
            tooltip: { formatter: (p: any) => `${p.data[0]}: ${p.data[1]} 次活动` },
            xAxis: {
              type: 'category',
              data: heatmapData.map(d => (d[0] as string).slice(5)),
              axisLabel: { color: '#94a3b8', rotate: 45, fontSize: 10 },
            },
            yAxis: { type: 'value', axisLabel: { color: '#94a3b8' }, splitLine: { lineStyle: { color: 'rgba(255,255,255,0.1)' } } },
            series: [{
              type: 'bar',
              data: heatmapData.map(d => d[1]),
              itemStyle: {
                color: (params: any) => {
                  const v = params.value as number;
                  if (v === 0) return 'rgba(99,102,241,0.1)';
                  if (v <= 2) return 'rgba(99,102,241,0.3)';
                  if (v <= 5) return 'rgba(99,102,241,0.6)';
                  return '#6366F1';
                },
                borderRadius: [2, 2, 0, 0],
              },
            }],
          }} />
        </Card>

        {/* 实时活动流 */}
        <Card style={{ ...cardStyle(), maxHeight: 370, overflow: 'auto' }}>
          <Title level={4} style={{ color: '#e2e8f0' }}>最近活动</Title>
          <List
            size="small"
            dataSource={activityLogs.slice(0, 15)}
            renderItem={(log: any) => (
              <List.Item style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', padding: '8px 0' }}>
                <div style={{ width: '100%' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Tag color="blue" style={{ fontSize: 11 }}>{ACTION_LABELS[log.action] || log.action}</Tag>
                    <Text style={{ color: '#94a3b8', fontSize: 11 }}>{new Date(log.createdAt).toLocaleString('zh-CN')}</Text>
                  </div>
                  <div style={{ color: '#e2e8f0', fontSize: 13, marginTop: 4 }}>{log.project?.name}</div>
                </div>
              </List.Item>
            )}
          />
        </Card>
      </div>
    </div>
  );
}
