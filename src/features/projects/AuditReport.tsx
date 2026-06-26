import { useState, useEffect, useCallback } from 'react';
import { Card, Button, Spin, Empty, Tag, Tooltip, message } from 'antd';
import {
  ReloadOutlined,
  CheckCircleOutlined,
  WarningOutlined,
  CloseCircleOutlined,
  SafetyOutlined,
  CodeOutlined,
  CloudDownloadOutlined,
  ThunderboltOutlined,
  BookOutlined,
} from '@ant-design/icons';
import { auditApi } from '../../api';
import type { ProjectAuditResult, AuditRecord, AuditItem, AuditRiskItem, AuditRecommendation } from '../../types';

const DIMENSION_CONFIG: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  architecture: { label: '架构健康', icon: <SafetyOutlined />, color: '#7c3aed' },
  code_quality: { label: '代码质量', icon: <CodeOutlined />, color: '#0891b2' },
  dependencies: { label: '依赖风险', icon: <CloudDownloadOutlined />, color: '#ea580c' },
  change_impact: { label: '变更影响', icon: <ThunderboltOutlined />, color: '#ca8a04' },
  knowledge_gap: { label: '知识缺口', icon: <BookOutlined />, color: '#e11d48' },
};

const STATUS_ICON: Record<string, React.ReactNode> = {
  good: <CheckCircleOutlined style={{ color: 'var(--md-primary, #10b981)' }} />,
  warning: <WarningOutlined style={{ color: 'var(--md-tertiary, #f59e0b)' }} />,
  critical: <CloseCircleOutlined style={{ color: 'var(--md-error, #ef4444)' }} />,
};

function ScoreRing({ score, size = 120 }: { score: number; size?: number }) {
  const radius = (size - 12) / 2;
  const circumference = 2 * Math.PI * radius;
  const pct = Math.min(score / 100, 1);
  const color = score >= 80 ? 'var(--md-primary, #10b981)' : score >= 50 ? 'var(--md-tertiary, #f59e0b)' : 'var(--md-error, #ef4444)';

  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="var(--md-outline-variant, #e5e7eb)" strokeWidth={8} />
        <circle
          cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={color} strokeWidth={8}
          strokeDasharray={circumference} strokeDashoffset={circumference * (1 - pct)}
          strokeLinecap="round" style={{ transition: 'stroke-dashoffset 0.8s ease' }}
        />
      </svg>
      <div style={{
        position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
      }}>
        <span style={{ fontSize: size * 0.3, fontWeight: 700, color }}>{score}</span>
        <span style={{ fontSize: 11, color: 'var(--md-on-surface-variant, #6b7280)' }}>/100</span>
      </div>
    </div>
  );
}

function DimensionBar({ label, icon, score, maxScore, color }: {
  label: string; icon: React.ReactNode; score: number; maxScore: number; color: string;
}) {
  const pct = maxScore > 0 ? score / maxScore : 0;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{ fontSize: 16, color, width: 20, textAlign: 'center' }}>{icon}</span>
      <span style={{ fontSize: 13, width: 72, color: 'var(--md-on-surface)' }}>{label}</span>
      <div style={{ flex: 1, height: 8, background: 'var(--md-outline-variant, #e5e7eb)', borderRadius: 4, overflow: 'hidden' }}>
        <div style={{ width: `${pct * 100}%`, height: '100%', background: color, borderRadius: 4, transition: 'width 0.6s ease' }} />
      </div>
      <span style={{ fontSize: 13, fontWeight: 600, width: 36, textAlign: 'right', color: 'var(--md-on-surface)' }}>{score}/{maxScore}</span>
    </div>
  );
}

function parseJsonArray<T>(val: string | T[] | null | undefined): T[] {
  if (Array.isArray(val)) return val;
  if (typeof val === 'string') {
    try { return JSON.parse(val); } catch { return []; }
  }
  return [];
}

export default function AuditReport({ projectId }: { projectId: string }) {
  const [latest, setLatest] = useState<ProjectAuditResult | null>(null);
  const [history, setHistory] = useState<AuditRecord[]>([]);
  const [items, setItems] = useState<AuditItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const hist = await auditApi.getProjectHistory(projectId, 10);
      const histArr = Array.isArray(hist) ? hist : [];
      setHistory(histArr);
      if (histArr.length > 0) {
        const latestRecord = histArr[0];
        const auditItems = await auditApi.getItems(latestRecord.id);
        const riskItems = parseJsonArray<AuditRiskItem>(latestRecord.riskItems);
        const recs = parseJsonArray<AuditRecommendation>(latestRecord.recommendations);
        setLatest({
          id: latestRecord.id,
          projectId: latestRecord.projectId,
          auditDate: latestRecord.auditDate,
          scoreArchitecture: latestRecord.scoreArchitecture,
          scoreCodeQuality: latestRecord.scoreCodeQuality,
          scoreDependencies: latestRecord.scoreDependencies,
          scoreChangeImpact: latestRecord.scoreChangeImpact,
          scoreKnowledgeGap: latestRecord.scoreKnowledgeGap,
          totalScore: latestRecord.totalScore,
          riskItems,
          recommendations: recs,
          triggerSource: latestRecord.triggerSource,
          durationMs: latestRecord.durationMs,
          items: auditItems,
        });
        setItems(auditItems);
      } else {
        setLatest(null);
        setItems([]);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => { load(); }, [load]);

  const handleRun = async () => {
    setRunning(true);
    try {
      const result = await auditApi.runForProject(projectId);
      setLatest(result);
      setItems(result.items ?? []);
      message.success('巡检完成');
      // Reload history
      const hist = await auditApi.getProjectHistory(projectId, 10);
      setHistory(Array.isArray(hist) ? hist : []);
    } catch {
      message.error('巡检失败');
    } finally {
      setRunning(false);
    }
  };

  if (loading) {
    return <Spin size="large" style={{ display: 'block', margin: '80px auto' }} />;
  }

  if (!latest) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, padding: 60 }}>
        <Empty description="暂无巡检记录" />
        <Button type="primary" icon={<ReloadOutlined />} loading={running} onClick={handleRun}>
          执行首次巡检
        </Button>
      </div>
    );
  }

  const riskItems = latest.riskItems ?? [];
  const recs = latest.recommendations ?? [];
  const itemsByDim = new Map<string, AuditItem[]>();
  for (const item of items) {
    const arr = itemsByDim.get(item.dimension) ?? [];
    arr.push(item);
    itemsByDim.set(item.dimension, arr);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: 16, overflow: 'auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
        <ScoreRing score={latest.totalScore} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 18, fontWeight: 600, color: 'var(--md-on-surface)', marginBottom: 4 }}>
            项目巡检报告
          </div>
          <div style={{ fontSize: 13, color: 'var(--md-on-surface-variant)' }}>
            {latest.auditDate?.replace('T', ' ').slice(0, 19)}
            {latest.durationMs != null && ` · 耗时 ${(latest.durationMs / 1000).toFixed(1)}s`}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 12 }}>
            {Object.entries(DIMENSION_CONFIG).map(([key, cfg]) => (
              <DimensionBar
                key={key}
                label={cfg.label}
                icon={cfg.icon}
                score={latest[`score_${key}` as keyof ProjectAuditResult] as number ?? 0}
                maxScore={20}
                color={cfg.color}
              />
            ))}
          </div>
        </div>
        <Button icon={<ReloadOutlined />} loading={running} onClick={handleRun}>
          重新巡检
        </Button>
      </div>

      {/* Risk items */}
      {riskItems.length > 0 && (
        <Card size="small" title="风险项" style={{ background: 'var(--md-surface-container-low)' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {riskItems.map((r, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                {r.severity === 'critical'
                  ? <CloseCircleOutlined style={{ color: 'var(--md-error)', marginTop: 3 }} />
                  : <WarningOutlined style={{ color: 'var(--md-tertiary, #f59e0b)', marginTop: 3 }} />}
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--md-on-surface)' }}>{r.label}</div>
                  <div style={{ fontSize: 12, color: 'var(--md-on-surface-variant)' }}>{r.detail}</div>
                </div>
                <Tag style={{ marginLeft: 'auto', flexShrink: 0 }}>
                  {DIMENSION_CONFIG[r.dimension]?.label ?? r.dimension}
                </Tag>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Recommendations */}
      {recs.length > 0 && (
        <Card size="small" title="改进建议" style={{ background: 'var(--md-surface-container-low)' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {recs.map((r, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                <Tooltip title={r.priority}>
                  <Tag color={r.priority === 'high' ? 'red' : r.priority === 'medium' ? 'orange' : 'blue'} style={{ flexShrink: 0 }}>
                    {r.priority}
                  </Tag>
                </Tooltip>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--md-on-surface)' }}>{r.label}</div>
                  <div style={{ fontSize: 12, color: 'var(--md-on-surface-variant)' }}>{r.detail}</div>
                </div>
                <Tag style={{ marginLeft: 'auto', flexShrink: 0 }}>
                  {DIMENSION_CONFIG[r.dimension]?.label ?? r.dimension}
                </Tag>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Detail items by dimension */}
      <Card size="small" title="评分明细" style={{ background: 'var(--md-surface-container-low)' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {Object.entries(DIMENSION_CONFIG).map(([dim, cfg]) => {
            const dimItems = itemsByDim.get(dim) ?? [];
            if (dimItems.length === 0) return null;
            return (
              <div key={dim}>
                <div style={{ fontSize: 13, fontWeight: 600, color: cfg.color, marginBottom: 6 }}>
                  {cfg.icon} {cfg.label}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, paddingLeft: 24 }}>
                  {dimItems.map((item) => (
                    <div key={item.itemKey} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                      {STATUS_ICON[item.status]}
                      <span style={{ color: 'var(--md-on-surface)' }}>{item.label}</span>
                      <span style={{ marginLeft: 'auto', color: 'var(--md-on-surface-variant)', fontSize: 12 }}>
                        {item.score}/{item.maxScore}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* History trend */}
      {history.length > 1 && (
        <Card size="small" title="历史趋势" style={{ background: 'var(--md-surface-container-low)' }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', height: 80 }}>
            {history.slice().reverse().map((h) => {
              const h2 = h as AuditRecord;
              const pct = h2.totalScore / 100;
              return (
                <Tooltip key={h2.id} title={`${h2.auditDate?.slice(0, 10)}: ${h2.totalScore}/100`}>
                  <div style={{
                    width: 24, height: `${Math.max(pct * 100, 4)}%`,
                    background: h2.totalScore >= 80 ? 'var(--md-primary)' : h2.totalScore >= 50 ? 'var(--md-tertiary, #f59e0b)' : 'var(--md-error)',
                    borderRadius: 3, transition: 'height 0.3s ease',
                  }} />
                </Tooltip>
              );
            })}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
            <span style={{ fontSize: 11, color: 'var(--md-on-surface-variant)' }}>
              {history[history.length - 1]?.auditDate?.slice(0, 10)}
            </span>
            <span style={{ fontSize: 11, color: 'var(--md-on-surface-variant)' }}>
              {history[0]?.auditDate?.slice(0, 10)}
            </span>
          </div>
        </Card>
      )}
    </div>
  );
}
