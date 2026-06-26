import { useState, useEffect, useCallback } from 'react';
import { Card, Tag, Table, Button, Spin, Empty, Space, message } from 'antd';
import {
  BranchesOutlined,
  CloudDownloadOutlined,
  ReloadOutlined,
  CheckCircleOutlined,
  WarningOutlined,
  BugOutlined,
} from '@ant-design/icons';
import { healthApi } from '../../api';
import { hasHealthIssues } from '../../lib/healthUtils';

interface HealthRecord {
  id: string;
  projectId: string;
  checkDate: string;
  dirtyFileCount: number;
  currentBranch?: string;
  aheadCount: number;
  behindCount: number;
  outdatedDeps: string; // JSON string from DB
  outdatedDepCount: number;
  vulnerabilityCount: number;
  vulnerabilities: string; // JSON string from DB
  hasChanges: boolean;
  error?: string | null;
}

export default function HealthTab({ projectId }: { projectId: string }) {
  const [history, setHistory] = useState<HealthRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [rechecking, setRechecking] = useState(false);

  const loadHistory = useCallback(async () => {
    setLoading(true);
    try {
      const data = await healthApi.getProjectHistory(projectId, 7);
      setHistory(Array.isArray(data) ? data : []);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => { loadHistory(); }, [loadHistory]);

  const handleRecheck = async () => {
    setRechecking(true);
    try {
      await healthApi.runForProject(projectId);
      // Update daily check guard so MainLayout doesn't re-run all projects
      localStorage.setItem('lastHealthCheckDate', new Date().toLocaleDateString('sv-SE'));
      message.success('健康检查已完成');
      await loadHistory();
    } catch {
      message.error('健康检查失败');
    } finally {
      setRechecking(false);
    }
  };

  if (loading) return <Spin size="large" style={{ display: 'block', margin: '40px auto' }} />;

  const latest = history[0];
  if (!latest) {
    return (
      <div style={{ textAlign: 'center', padding: 60 }}>
        <Empty description="暂无健康检查数据">
          <Button type="primary" icon={<ReloadOutlined />} onClick={handleRecheck} loading={rechecking}>
            立即检查
          </Button>
        </Empty>
      </div>
    );
  }

  let outdatedDeps: Array<{ name: string; current: string; wanted: string; latest: string }> = [];
  try {
    outdatedDeps = JSON.parse(latest.outdatedDeps || '[]');
  } catch { /* ignore */ }

  let vulns: Array<{ name: string; severity: string; via: string; fixAvailable: boolean }> = [];
  try {
    vulns = JSON.parse(latest.vulnerabilities || '[]');
  } catch { /* ignore */ }

  const overallHealthy = !hasHealthIssues(latest);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Space>
          {overallHealthy ? (
            <Tag icon={<CheckCircleOutlined />} color="success">状态正常</Tag>
          ) : (
            <Tag icon={<WarningOutlined />} color="warning">有变化</Tag>
          )}
          <span style={{ color: 'var(--color-text-placeholder)', fontSize: 13 }}>
            最近检查：{latest.checkDate}
          </span>
        </Space>
        <Button
          icon={<ReloadOutlined />}
          onClick={handleRecheck}
          loading={rechecking}
          size="small"
        >
          重新检查
        </Button>
      </div>

      {/* Git Status Card */}
      <Card size="small" title={<><BranchesOutlined /> Git 状态</>}>
        <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
          {latest.currentBranch && (
            <div>
              <span style={{ color: 'var(--color-text-placeholder)', fontSize: 12 }}>当前分支</span>
              <div style={{ fontWeight: 600 }}>{latest.currentBranch}</div>
            </div>
          )}
          <div>
            <span style={{ color: 'var(--color-text-placeholder)', fontSize: 12 }}>未提交文件</span>
            <div style={{ fontWeight: 600, color: latest.dirtyFileCount > 0 ? 'var(--color-amber)' : 'var(--color-status-done)' }}>
              {latest.dirtyFileCount}
            </div>
          </div>
          <div>
            <span style={{ color: 'var(--color-text-placeholder)', fontSize: 12 }}>待推送提交</span>
            <div style={{ fontWeight: 600, color: latest.aheadCount > 0 ? 'var(--color-info)' : 'var(--color-status-done)' }}>
              {latest.aheadCount}
            </div>
          </div>
          <div>
            <span style={{ color: 'var(--color-text-placeholder)', fontSize: 12 }}>落后远程</span>
            <div style={{ fontWeight: 600, color: latest.behindCount > 0 ? 'var(--color-status-cancel)' : 'var(--color-status-done)' }}>
              {latest.behindCount}
            </div>
          </div>
        </div>
      </Card>

      {/* Outdated Dependencies Card */}
      {outdatedDeps.length > 0 && (
        <Card size="small" title={<><CloudDownloadOutlined /> 依赖更新 ({outdatedDeps.length})</>}>
          <Table
            dataSource={outdatedDeps}
            rowKey="name"
            size="small"
            pagination={false}
            columns={[
              { title: '包名', dataIndex: 'name', key: 'name' },
              { title: '当前版本', dataIndex: 'current', key: 'current' },
              { title: '推荐版本', dataIndex: 'wanted', key: 'wanted' },
              {
                title: '最新版本',
                dataIndex: 'latest',
                key: 'latest',
                render: (v: string) => <Tag color="blue">{v}</Tag>,
              },
            ]}
          />
        </Card>
      )}

      {/* Vulnerabilities Card */}
      {latest.vulnerabilityCount > 0 && (
        <Card size="small" title={<><BugOutlined /> 安全漏洞 ({latest.vulnerabilityCount})</>}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            {['critical', 'high', 'moderate', 'low'].map(sev => {
              const count = vulns.filter(v => v.severity === sev).length;
              if (count === 0) return null;
              const color = sev === 'critical' ? 'red' : sev === 'high' ? 'orange' : sev === 'moderate' ? 'gold' : 'default';
              return <Tag key={sev} color={color}>{sev}: {count}</Tag>;
            })}
          </div>
          <Table
            dataSource={vulns}
            rowKey="name"
            size="small"
            pagination={false}
            columns={[
              { title: '包名', dataIndex: 'name', key: 'name' },
              {
                title: '严重程度',
                dataIndex: 'severity',
                key: 'severity',
                render: (v: string) => {
                  const color = v === 'critical' ? 'red' : v === 'high' ? 'orange' : v === 'moderate' ? 'gold' : 'default';
                  return <Tag color={color}>{v}</Tag>;
                },
              },
              { title: '描述', dataIndex: 'via', key: 'via', ellipsis: true },
              {
                title: '可修复',
                dataIndex: 'fixAvailable',
                key: 'fix',
                render: (v: boolean) => v ? <Tag color="success">是</Tag> : <Tag>否</Tag>,
              },
            ]}
          />
        </Card>
      )}

      {/* History Timeline */}
      {history.length > 1 && (
        <Card size="small" title="历史趋势">
          <Table
            dataSource={history}
            rowKey="id"
            size="small"
            pagination={false}
            columns={[
              { title: '日期', dataIndex: 'checkDate', key: 'checkDate' },
              {
                title: '状态',
                key: 'status',
                render: (_: unknown, r: HealthRecord) => {
                  return hasHealthIssues(r)
                    ? <Tag color="warning">有变化</Tag>
                    : <Tag color="success">正常</Tag>;
                },
              },
              { title: '未提交', dataIndex: 'dirtyFileCount', key: 'dirty' },
              { title: '待推送', dataIndex: 'aheadCount', key: 'ahead' },
              { title: '落后', dataIndex: 'behindCount', key: 'behind' },
              { title: '依赖更新', dataIndex: 'outdatedDepCount', key: 'deps' },
            ]}
          />
        </Card>
      )}
    </div>
  );
}
