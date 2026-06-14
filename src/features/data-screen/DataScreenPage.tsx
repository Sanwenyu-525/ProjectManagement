import { useState, useEffect, useMemo } from 'react';
import { Card, Spin, Button, Space, Typography, List, Tag } from 'antd';
import { FullscreenOutlined, ReloadOutlined } from '@ant-design/icons';
import ReactECharts from 'echarts-for-react';
import { projectsApi, timelineApi, healthApi, workspacesApi } from '../../api';
import { STATUS_HEX_COLORS, ACTIVITY_ACTION_CONFIG } from '../../lib/constants';

const { Title, Text } = Typography;

const ACTION_LABELS: Record<string, string> = Object.fromEntries(
  Object.entries(ACTIVITY_ACTION_CONFIG).map(([k, v]) => [k, v.label])
);

function cardStyle(extend?: React.CSSProperties): React.CSSProperties {
  return { background: 'rgba(255, 255, 255, 0.35)', border: '1px solid rgba(255, 255, 255, 0.45)', borderRadius: 12, backdropFilter: 'blur(24px) saturate(1.2)', WebkitBackdropFilter: 'blur(24px) saturate(1.2)', boxShadow: '0 4px 16px rgba(0, 0, 0, 0.06), inset 0 1px 0 rgba(255, 255, 255, 0.6)', ...extend };
}

export default function DataScreenPage() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [projects, setProjects] = useState<any[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [activityLogs, setActivityLogs] = useState<any[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [healthData, setHealthData] = useState<any[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [workspaceData, setWorkspaceData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
    const timer = setInterval(loadData, 60000);
    return () => clearInterval(timer);
  }, []);

  async function loadData() {
    try {
      const [projData, logData, healthAll, wsData] = await Promise.all([
        projectsApi.list(),
        timelineApi.list({ limit: 100 }),
        healthApi.getAllLatest().catch(() => []),
        workspacesApi.list().catch(() => []),
      ]);
      setProjects(projData);
      setActivityLogs(logData);
      setHealthData(healthAll);
      setWorkspaceData(wsData);
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

  // 健康评分分布
  const healthScoreDist = useMemo(() => {
    if (healthData.length === 0) return null;
    const buckets: Record<string, number> = { healthy: 0, needs_attention: 0, critical: 0, unknown: 0 };
    healthData.forEach((h) => {
      const status = (h.healthStatus || 'unknown') as string;
      if (status in buckets) buckets[status as keyof typeof buckets]++;
      else buckets.unknown++;
    });
    return [
      { name: '健康 (80-100)', value: buckets.healthy, itemStyle: { color: '#52c41a' } },
      { name: '需关注 (50-79)', value: buckets.needs_attention, itemStyle: { color: '#faad14' } },
      { name: '风险 (0-49)', value: buckets.critical, itemStyle: { color: '#ff4d4f' } },
      { name: '未检测', value: projects.length - healthData.length, itemStyle: { color: '#d9d9d9' } },
    ].filter(d => d.value > 0);
  }, [healthData, projects.length]);

  // 平均健康评分
  const avgHealthScore = useMemo(() => {
    const scores = healthData.filter((h) => h.healthScore != null).map((h) => h.healthScore as number);
    if (scores.length === 0) return null;
    return Math.round(scores.reduce((a: number, b: number) => a + b, 0) / scores.length);
  }, [healthData]);

  // 运行状态统计
  const runtimeStats = useMemo(() => {
    let frontendRunning = 0, backendRunning = 0;
    projects.forEach(p => {
      if (p.frontendStatus === 'running') frontendRunning++;
      if (p.backendStatus === 'running') backendRunning++;
    });
    return { frontendRunning, backendRunning, stopped: projects.length - frontendRunning - backendRunning };
  }, [projects]);

  // 工作区分布
  const workspaceDist = useMemo(() => {
    if (workspaceData.length === 0) return null;
    const items = workspaceData
      .map((w) => ({ name: w.name as string, value: (w.projectCount as number) || 0, itemStyle: { color: (w.color as string) || '#6366F1' } }))
      .filter((d) => d.value > 0);
    const assignedCount = workspaceData.reduce((s: number, w) => s + ((w.projectCount as number) || 0), 0);
    const unassigned = projects.length - assignedCount;
    if (unassigned > 0) {
      items.push({ name: '未分组', value: unassigned, itemStyle: { color: '#d9d9d9' } });
    }
    return items.length > 0 ? items : null;
  }, [workspaceData, projects.length]);

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

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', padding: 100, minHeight: '100vh' }}><Spin size="large" /></div>;

  return (
    <div style={{ minHeight: '100vh', color: '#1a1f36', padding: 32 }}>
      {/* 头部 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
        <Title level={2} style={{ color: '#1a1f36', margin: 0 }}>DevHub 数据大屏</Title>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={loadData}>刷新</Button>
          <Button icon={<FullscreenOutlined />} onClick={toggleFullscreen}>全屏</Button>
        </Space>
      </div>

      {/* 统计卡片 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 16, marginBottom: 24 }}>
        {[
          { label: '项目总数', value: projects.length, color: '#6366F1' },
          { label: '进行中', value: projects.filter(p => !['Archived', 'Idea'].includes(p.status)).length, color: '#fa8c16' },
          { label: '已部署', value: projects.filter(p => ['Deployed', 'Maintained'].includes(p.status)).length, color: '#52c41a' },
          { label: '远程仓库', value: repoCount, color: '#1677ff' },
          { label: '前端运行中', value: runtimeStats.frontendRunning, color: '#22c55e' },
          { label: '平均健康分', value: avgHealthScore ?? '—', color: avgHealthScore != null ? (avgHealthScore >= 80 ? '#52c41a' : avgHealthScore >= 50 ? '#faad14' : '#ff4d4f') : '#9eadc0' },
        ].map((item, i) => (
          <Card key={i} style={cardStyle()}>
            <div style={{ color: '#6b7a99', fontSize: 13, marginBottom: 8 }}>{item.label}</div>
            <div style={{ color: item.color, fontSize: 36, fontWeight: 700 }}>{item.value}</div>
          </Card>
        ))}
      </div>

      {/* 第一行图表 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 16, marginBottom: 16 }}>
        {/* 状态分布饼图 */}
        <Card style={cardStyle()}>
          <Title level={4} style={{ color: '#1a1f36' }}>项目状态分布</Title>
          <ReactECharts style={{ height: 300 }} option={{
            tooltip: { trigger: 'item' },
            series: [{
              type: 'pie', radius: ['40%', '70%'],
              itemStyle: { borderRadius: 8 },
              label: { color: '#1a1f36' },
              data: Object.entries(statusCounts).map(([name, value]) => ({
                name, value, itemStyle: { color: STATUS_HEX_COLORS[name] },
              })),
            }],
          }} />
        </Card>

        {/* 技术栈柱状图 */}
        <Card style={cardStyle()}>
          <Title level={4} style={{ color: '#1a1f36' }}>技术栈使用统计</Title>
          <ReactECharts style={{ height: 300 }} option={{
            tooltip: { trigger: 'axis' },
            xAxis: { type: 'value', axisLabel: { color: '#6b7a99' }, splitLine: { lineStyle: { color: 'rgba(0, 0, 0, 0.06)' } } },
            yAxis: { type: 'category', data: techCounts.map(d => d[0]).reverse(), axisLabel: { color: '#1a1f36' } },
            series: [{ type: 'bar', data: techCounts.map(d => d[1]).reverse(), itemStyle: { color: '#6366F1', borderRadius: [0, 4, 4, 0] } }],
          }} />
        </Card>
      </div>

      {/* 第二行图表 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16, marginBottom: 16 }}>
        {/* 健康度雷达图 */}
        <Card style={cardStyle()}>
          <Title level={4} style={{ color: '#1a1f36' }}>项目健康度</Title>
          {healthScores && (
            <ReactECharts style={{ height: 300 }} option={{
              tooltip: {},
              radar: {
                indicator: healthScores.map(s => ({ name: s.name, max: 100 })),
                axisName: { color: '#1a1f36' },
                splitLine: { lineStyle: { color: 'rgba(0, 0, 0, 0.06)' } },
                splitArea: { areaStyle: { color: ['rgba(99,102,241,0.03)', 'rgba(99,102,241,0.06)'] } },
                axisLine: { lineStyle: { color: 'rgba(0, 0, 0, 0.08)' } },
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
          <Title level={4} style={{ color: '#1a1f36' }}>30天活动热力图</Title>
          <ReactECharts style={{ height: 300 }} option={{
            tooltip: { formatter: (p: { data: [string, number] }) => `${p.data[0]}: ${p.data[1]} 次活动` },
            xAxis: {
              type: 'category',
              data: heatmapData.map(d => (d[0] as string).slice(5)),
              axisLabel: { color: '#6b7a99', rotate: 45, fontSize: 10 },
            },
            yAxis: { type: 'value', axisLabel: { color: '#6b7a99' }, splitLine: { lineStyle: { color: 'rgba(0, 0, 0, 0.06)' } } },
            series: [{
              type: 'bar',
              data: heatmapData.map(d => d[1]),
              itemStyle: {
                color: (params: { value: number }) => {
                  const v = params.value;
                  if (v === 0) return 'rgba(99,102,241,0.08)';
                  if (v <= 2) return 'rgba(99,102,241,0.25)';
                  if (v <= 5) return 'rgba(99,102,241,0.5)';
                  return '#6366F1';
                },
                borderRadius: [2, 2, 0, 0],
              },
            }],
          }} />
        </Card>

        {/* 实时活动流 */}
        <Card style={{ ...cardStyle(), maxHeight: 370, overflow: 'auto' }}>
          <Title level={4} style={{ color: '#1a1f36' }}>最近活动</Title>
          <List
            size="small"
            dataSource={activityLogs.slice(0, 15)}
            renderItem={(log) => (
              <List.Item style={{ borderBottom: '1px solid rgba(0, 0, 0, 0.04)', padding: '8px 0' }}>
                <div style={{ width: '100%' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Tag color="blue" style={{ fontSize: 11 }}>{ACTION_LABELS[log.action as string] || log.action}</Tag>
                    <Text style={{ color: '#6b7a99', fontSize: 11 }}>{new Date(log.createdAt as string).toLocaleString('zh-CN')}</Text>
                  </div>
                  <div style={{ color: '#1a1f36', fontSize: 13, marginTop: 4 }}>{log.project?.name}</div>
                </div>
              </List.Item>
            )}
          />
        </Card>
      </div>

      {/* 第三行图表：健康评分分布 + 工作区分布 */}
      {(healthScoreDist || workspaceDist) && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 16, marginBottom: 16 }}>
          {healthScoreDist && (
            <Card style={cardStyle()}>
              <Title level={4} style={{ color: '#1a1f36' }}>健康评分分布</Title>
              <ReactECharts style={{ height: 300 }} option={{
                tooltip: { trigger: 'item', formatter: '{b}: {c} 个 ({d}%)' },
                legend: { bottom: 0, textStyle: { color: '#6b7a99' } },
                series: [{
                  type: 'pie', radius: ['40%', '65%'],
                  itemStyle: { borderRadius: 6 },
                  label: { color: '#1a1f36', formatter: '{b}\n{c}个' },
                  data: healthScoreDist,
                }],
              }} />
            </Card>
          )}
          {workspaceDist && (
            <Card style={cardStyle()}>
              <Title level={4} style={{ color: '#1a1f36' }}>工作区分布</Title>
              <ReactECharts style={{ height: 300 }} option={{
                tooltip: { trigger: 'item', formatter: '{b}: {c} 个项目 ({d}%)' },
                legend: { bottom: 0, textStyle: { color: '#6b7a99' } },
                series: [{
                  type: 'pie', radius: ['40%', '65%'],
                  itemStyle: { borderRadius: 6 },
                  roseType: 'radius',
                  label: { color: '#1a1f36' },
                  data: workspaceDist,
                }],
              }} />
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
