import { useState, useMemo, useEffect } from 'react';
import { Table } from 'antd';
import { useNavigate } from 'react-router-dom';
import type { ProjectDetail } from '../../../types';
import { useProjectBrain } from '../../../hooks/useProjects';
import { useProjectTimeline } from '../../../hooks/useTimeline';
import { useTerminalStore } from '../../../stores/terminalStore';
import { gitApi } from '../../../api';
import ProjectIcon from '../../../shared/ProjectIcon';
import { StatusBadge } from '../../../shared/components/StatusBadge';

export default function OverviewTab({ project }: { project: ProjectDetail }) {
  const navigate = useNavigate();
  const requestLaunch = useTerminalStore(s => s.requestLaunch);

  const { data: brain } = useProjectBrain(project.id);
  const { data: activityLogs = [] } = useProjectTimeline(project.id);

  // Real git data for the status card
  const [gitBranch, setGitBranch] = useState('—');
  const [uncommittedCount, setUncommittedCount] = useState<number | null>(null);
  useEffect(() => {
    if (!project.localPath) return;
    let cancelled = false;
    Promise.all([
      gitApi.branches(project.localPath).catch(() => []),
      gitApi.status(project.localPath).catch(() => []),
    ]).then(([branches, status]) => {
      if (cancelled) return;
      if (Array.isArray(branches)) {
        const current = branches.find((b: { current: boolean }) => b.current);
        if (current) setGitBranch(current.name);
      }
      if (Array.isArray(status)) {
        setUncommittedCount(status.length);
      }
    });
    return () => { cancelled = true; };
  }, [project.localPath]);

  const agentOutput = useMemo(() => {
    if (!brain) return ['> 正在加载项目分析...'];
    const lines: string[] = [];
    lines.push(`> 项目结构: ${brain.stats.totalFiles} 个文件`);
    if (brain.stats.sourceFiles > 0) lines.push(`> 源文件: ${brain.stats.sourceFiles}, 测试: ${brain.stats.testFiles}`);
    if (brain.stats.languages.length > 0) lines.push(`> 语言: ${brain.stats.languages.map(l => l.name).join(', ')}`);
    if (brain.entryPoints.main) lines.push(`> 入口: ${brain.entryPoints.main}`);
    if (brain.environment.requiredTools.length > 0) lines.push(`> 依赖工具: ${brain.environment.requiredTools.join(', ')}`);
    lines.push(`> 就绪，等待指令`);
    return lines;
  }, [brain]);

  const activityRows = useMemo(() => activityLogs.map(log => {
    const actionLower = log.action.toLowerCase();
    const isCreate = actionLower.includes('create') || actionLower.includes('add');
    const isDelete = actionLower.includes('delete') || actionLower.includes('remove');
    const isUpdate = actionLower.includes('update') || actionLower.includes('edit');
    const label = log.details ? (() => { try { const d = JSON.parse(log.details); return d.name || d.title || log.action; } catch { return log.action; } })() : log.action;

    const diffMs = Date.now() - new Date(log.createdAt).getTime();
    const diffMin = Math.floor(diffMs / 60000);
    const time = diffMin < 1 ? '刚刚' : diffMin < 60 ? `${diffMin}分钟前` : diffMin < 1440 ? `${Math.floor(diffMin / 60)}小时前` : `${Math.floor(diffMin / 1440)}天前`;

    return {
      icon: isDelete ? 'error' : isCreate ? 'add_circle' : isUpdate ? 'edit' : 'check_circle',
      iconColor: isDelete ? 'var(--md-error)' : isCreate ? 'var(--md-primary)' : 'var(--md-tertiary)',
      label,
      status: isDelete ? '已删除' : isCreate ? '已创建' : isUpdate ? '已更新' : log.action,
      statusBg: isDelete ? 'var(--md-error-container)' : isCreate ? 'var(--md-primary-container)' : 'var(--md-tertiary-container)',
      statusColor: isDelete ? 'var(--md-error)' : isCreate ? 'var(--md-primary)' : 'var(--md-tertiary)',
      time,
    };
  }), [activityLogs]);

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(12, 1fr)',
      gap: 16,
      padding: '4px 0',
    }}>
      {/* ── Left Column: Project Info + Git Status (8 cols nested) ── */}
      <div style={{ gridColumn: 'span 8', display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
        {/* Project Info */}
        <DashboardCard colSpan={1}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <ProjectIcon name={project.name} techStack={project.techStack} iconType={project.iconType} iconUrl={project.iconUrl} iconColor={project.iconColor} size={40} />
              <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--md-on-surface)', lineHeight: '22px' }}>
                {project.name}
              </div>
            </div>
            <StatusBadge status={project.status} />
          </div>
          {project.description && (
            <p style={{ fontSize: 13, color: 'var(--md-on-surface-variant)', lineHeight: '18px', margin: '0 0 12px 0' }}>
              {project.description}
            </p>
          )}
          <div style={{
            borderTop: '1px solid var(--border)',
            paddingTop: 10,
            marginTop: 'auto',
            fontSize: 12,
            color: 'var(--md-on-surface-variant)',
            fontFamily: 'var(--font-mono)',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}>
            <span className="material-symbols-outlined" style={{ fontSize: 14 }}>folder</span>
            {project.localPath || '未设置路径'}
          </div>
        </DashboardCard>

        {/* Git Status */}
        <DashboardCard colSpan={1}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--md-on-surface)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
            <span className="material-symbols-outlined" style={{ fontSize: 16, color: 'var(--md-on-surface-variant)' }}>account_tree</span>
            Git 状态
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '8px 10px',
              background: 'var(--md-surface-container-low)',
              borderRadius: 8,
              border: '1px solid var(--border)',
            }}>
              <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--md-on-surface)', display: 'flex', alignItems: 'center', gap: 6 }}>
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>commit</span>
                {gitBranch}
              </span>
              <span style={{ fontSize: 12, fontFamily: 'var(--font-label)', color: 'var(--md-on-surface-variant)' }}>最新</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 4px' }}>
              <span style={{ fontSize: 13, color: 'var(--md-on-surface-variant)' }}>未提交文件</span>
              <span style={{ fontSize: 12, fontFamily: 'var(--font-label)', color: uncommittedCount && uncommittedCount > 0 ? 'var(--md-error)' : 'var(--md-on-surface-variant)', display: 'flex', alignItems: 'center', gap: 4 }}>
                {uncommittedCount !== null && uncommittedCount > 0 && (
                  <span className="material-symbols-outlined" style={{ fontSize: 14 }}>error</span>
                )}
                {uncommittedCount !== null ? uncommittedCount : '—'}
              </span>
            </div>
            <button
              style={{
                width: '100%',
                marginTop: 6,
                padding: '6px 0',
                background: 'var(--md-surface-container-lowest)',
                border: '1px solid var(--border)',
                borderRadius: 6,
                fontSize: 12,
                fontFamily: 'var(--font-label)',
                color: 'var(--md-on-surface)',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--md-surface-container-low)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'var(--md-surface-container-lowest)'; }}
              onClick={() => navigate('/git')}
            >
              查看变更
            </button>
          </div>
        </DashboardCard>
      </div>

      {/* ── Quick Actions (4 cols) ── */}
      <DashboardCard colSpan={4}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--md-on-surface)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
          <span className="material-symbols-outlined" style={{ fontSize: 16, color: 'var(--md-on-surface-variant)' }}>bolt</span>
          快捷操作
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {[
            { icon: 'build', label: '构建应用', action: () => { if (project.localPath) requestLaunch({ cwd: project.localPath, command: 'npm run build', label: `${project.name} build`, projectId: project.id }); navigate('/'); } },
            { icon: 'bug_report', label: '运行测试', action: () => { if (project.localPath) requestLaunch({ cwd: project.localPath, command: 'npm test', label: `${project.name} test`, projectId: project.id }); navigate('/'); } },
            { icon: 'sync', label: '同步依赖', action: () => { if (project.localPath) requestLaunch({ cwd: project.localPath, command: 'npm install', label: `${project.name} install`, projectId: project.id }); navigate('/'); } },
            { icon: 'delete', label: '清理缓存', action: () => { if (project.localPath) requestLaunch({ cwd: project.localPath, command: 'rm -rf node_modules/.cache', label: `${project.name} clean`, projectId: project.id }); navigate('/'); } },
          ].map(btn => (
            <button
              key={btn.label}
              onClick={btn.action}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                padding: '10px 8px',
                borderRadius: 8,
                border: '1px solid var(--border)',
                background: 'transparent',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                fontFamily: 'var(--font-sans)',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.borderColor = 'var(--md-primary)';
                e.currentTarget.style.background = 'var(--md-surface-container-low)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.borderColor = 'var(--border)';
                e.currentTarget.style.background = 'transparent';
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 18, color: 'var(--md-on-surface-variant)', transition: 'color 0.15s' }}>{btn.icon}</span>
              <span style={{ fontSize: 12, fontFamily: 'var(--font-label)', color: 'var(--md-on-surface)', fontWeight: 500 }}>{btn.label}</span>
            </button>
          ))}
        </div>
      </DashboardCard>

      {/* ── Workspace Activity (8 cols) ── */}
      <div style={{ gridColumn: 'span 8', background: 'var(--md-surface-container-lowest)', borderRadius: 12, border: '1px solid var(--border)', boxShadow: '0 4px 12px rgba(0,0,0,0.03)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {/* Header with tabs */}
        <div style={{
          padding: '12px 16px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderBottom: '1px solid var(--border)',
          background: 'var(--md-surface-container-lowest)',
        }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--md-on-surface)' }}>工作区活动</div>
          <div style={{ display: 'flex', gap: 6 }}>
            <span style={{
              padding: '4px 12px',
              borderRadius: 6,
              fontSize: 12,
              fontFamily: 'var(--font-label)',
              fontWeight: 500,
              background: 'var(--md-surface-container-high)',
              color: 'var(--md-on-surface)',
            }}>
              全部
            </span>
          </div>
        </div>
        {/* Table */}
        <Table
          dataSource={activityRows}
          rowKey={(_, i) => String(i)}
          pagination={false}
          size="small"
          columns={[
            {
              title: '任务 / 文件',
              dataIndex: 'label',
              render: (v: string, row) => (
                <span style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: 'var(--md-on-surface)' }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 16, color: row.iconColor }}>{row.icon}</span>
                  {v}
                </span>
              ),
            },
            {
              title: '状态',
              dataIndex: 'status',
              width: 120,
              render: (v: string, row) => (
                <span style={{
                  padding: '2px 8px', borderRadius: 4, fontSize: 10,
                  fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.05em',
                  background: row.statusBg, color: row.statusColor,
                }}>
                  {v}
                </span>
              ),
            },
            {
              title: '时间',
              dataIndex: 'time',
              width: 120,
              align: 'right' as const,
              render: (v: string) => (
                <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--md-on-surface-variant)' }}>
                  {v}
                </span>
              ),
            },
          ]}
        />
      </div>

      {/* ── Right Column: AI Agent + Mini Terminal (4 cols nested) ── */}
      <div style={{ gridColumn: 'span 4', display: 'flex', flexDirection: 'column', gap: 16, minHeight: 0 }}>
        {/* AI Agent — analysis output + link to workspace */}
        <DashboardCard colSpan={0}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--md-on-surface)', display: 'flex', alignItems: 'center', gap: 6 }}>
              <span className="material-symbols-outlined" aria-hidden="true" style={{ fontSize: 16, color: 'var(--md-primary)' }}>smart_toy</span>
              AI 分析
            </div>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--md-tertiary)' }} />
          </div>
          <div style={{
            background: 'var(--md-surface-container)',
            borderRadius: 8,
            padding: 10,
            border: '1px solid var(--border)',
            fontFamily: 'var(--font-mono)',
            fontSize: 12,
            lineHeight: '18px',
          }}>
            {agentOutput.map((line, i) => (
              <div key={i} style={{ color: i === agentOutput.length - 1 ? 'var(--md-primary)' : 'var(--md-on-surface-variant)', marginBottom: 2 }}>
                {line}
              </div>
            ))}
          </div>
          <button
            onClick={() => navigate('/workspace')}
            style={{
              marginTop: 10,
              width: '100%',
              padding: '7px 10px',
              background: 'var(--md-primary-container)',
              border: '1px solid var(--md-primary)',
              borderRadius: 6,
              fontSize: 12,
              fontWeight: 500,
              color: 'var(--md-on-primary-container)',
              cursor: 'pointer',
              fontFamily: 'var(--font-sans)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              transition: 'opacity 0.15s',
            }}
          >
            <span className="material-symbols-outlined" aria-hidden="true" style={{ fontSize: 14 }}>open_in_new</span>
            在工作区中与 Agent 对话
          </button>
        </DashboardCard>

        {/* Quick actions */}
        <DashboardCard colSpan={0}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--md-on-surface)', marginBottom: 10 }}>
            快捷操作
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {[
              { label: '在工作区打开', icon: 'workspaces', action: () => navigate('/workspace') },
              { label: '查看时间线', icon: 'calendar_month', action: () => navigate('/timeline') },
            ].map(a => (
              <button
                key={a.label}
                onClick={a.action}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '8px 10px',
                  borderRadius: 6,
                  border: '1px solid var(--border)',
                  background: 'var(--md-surface-container-low)',
                  color: 'var(--md-on-surface)',
                  cursor: 'pointer',
                  fontSize: 12,
                  fontFamily: 'var(--font-sans)',
                  transition: 'background 0.15s',
                  textAlign: 'left',
                }}
              >
                <span className="material-symbols-outlined" aria-hidden="true" style={{ fontSize: 16, color: 'var(--md-primary)' }}>{a.icon}</span>
                {a.label}
              </button>
            ))}
          </div>
        </DashboardCard>
      </div>
    </div>
  );
}

function DashboardCard({ children, colSpan, style: extraStyle }: { children: React.ReactNode; colSpan: number; style?: React.CSSProperties }) {
  return (
    <div style={{
      ...(colSpan > 0 ? { gridColumn: `span ${colSpan}` } : {}),
      background: 'var(--md-surface-container-lowest)',
      borderRadius: 12,
      border: '1px solid var(--border)',
      padding: 16,
      boxShadow: '0 4px 12px rgba(0,0,0,0.03)',
      display: 'flex',
      flexDirection: 'column',
      ...extraStyle,
    }}>
      {children}
    </div>
  );
}
