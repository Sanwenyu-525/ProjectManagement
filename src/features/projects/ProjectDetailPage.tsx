import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Tabs, Tag, Button, Space, Skeleton, Spin, Empty, message, Modal, Form, Input, Select, Table, Timeline } from 'antd';
import { ArrowLeftOutlined, SyncOutlined, PlusOutlined, DeleteOutlined, CheckCircleOutlined, EditOutlined, PlusCircleOutlined, ClockCircleOutlined, PlayCircleOutlined, ReloadOutlined, CodeOutlined } from '@ant-design/icons';
import { reposApi } from '../../api';
import { useProject, useRefreshProject } from '../../hooks/useProjects';
import { useProjectBrain } from '../../hooks/useProjects';
import { useDocuments, useCreateDocument } from '../../hooks/useProjects';
import { useProjectTimeline } from '../../hooks/useTimeline';
import type { ProjectDetail, RemoteRepo, CreateDocumentInput, AddRepoInput } from '../../types';
import ConfigTab from './tabs/ConfigTab';
import TasksTab from './tabs/TasksTab';
import MilestonesTab from './tabs/MilestonesTab';
import ProjectIcon from '../../shared/ProjectIcon';
import { useTerminalStore } from '../../stores/terminalStore';
import { buildLaunchRequests } from '../../lib/launchUtils';
import GitTab from './git/GitTab';
import HealthTab from './HealthTab';
import { StatusBadge } from '../../shared/components/StatusBadge';
import './ProjectDetailPage.css';

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: project, isLoading: loading } = useProject(id);
  const refreshProject = useRefreshProject();
  const { requestLaunch } = useTerminalStore();
  const [activeTab, setActiveTab] = useState('overview');

  async function handleLaunch() {
    if (!project?.localPath) return;
    const requests = buildLaunchRequests({ ...project, localPath: project.localPath });
    if (requests.length === 0) {
      message.warning('请先在"配置"标签页中设置启动命令');
      setActiveTab('config');
      return;
    }
    requests.forEach(req => requestLaunch(req));
    navigate('/');
  }

  async function handleRefresh() {
    if (!project?.localPath) {
      message.warning('项目没有本地路径，无法检测');
      return;
    }

    try {
      const oldProject = { ...project };
      const updated = await refreshProject.mutateAsync(project.id);

      // Compare old vs new to generate context-aware message
      const changes: string[] = [];
      if (JSON.stringify(oldProject.techStack) !== JSON.stringify(updated.techStack)) {
        changes.push('技术栈');
      }
      if ((oldProject.frontendCommand || '') !== (updated.frontendCommand || '')) {
        changes.push('前端命令');
      }
      if ((oldProject.backendCommand || '') !== (updated.backendCommand || '')) {
        changes.push('后端命令');
      }
      if ((oldProject.openCommand || '') !== (updated.openCommand || '')) {
        changes.push('启动命令');
      }
      if ((oldProject.name || '') !== (updated.name || '')) {
        changes.push('项目名称');
      }
      if ((oldProject.description || '') !== (updated.description || '')) {
        changes.push('描述');
      }
      if ((oldProject.iconType || '') !== (updated.iconType || '') || (oldProject.iconUrl || '') !== (updated.iconUrl || '')) {
        changes.push('图标');
      }

      if (changes.length === 0) {
        message.info('已是最新状态');
      } else {
        message.success(`已更新：${changes.join('、')}`);
      }
    } catch (e: unknown) {
      message.warning(String(e) || '刷新失败');
    }
  }

  if (loading) return (
    <div style={{ padding: '28px 32px', height: '100%', boxSizing: 'border-box' }}>
      <Skeleton.Button active style={{ marginBottom: 20, width: 140 }} />
      <div className="glass-panel" style={{ padding: '28px 32px', marginBottom: 20 }}>
        <Skeleton active avatar={{ size: 64 }} paragraph={{ rows: 2 }} />
      </div>
      <div className="glass-panel" style={{ padding: '24px' }}>
        <Skeleton active paragraph={{ rows: 6 }} />
      </div>
    </div>
  );
  if (!project) return <Empty description="项目不存在" />;

  const p = project as ProjectDetail & Record<string, unknown>;
  const remoteRepos = (p.remoteRepos || []) as RemoteRepo[];
  const count = (p._count || {}) as Record<string, number>;

  return (
    <div style={{ padding: '28px 32px', display: 'flex', flexDirection: 'column', height: '100%', boxSizing: 'border-box' }}>
      {/* Back button */}
      <Button
        type="text"
        icon={<ArrowLeftOutlined />}
        onClick={() => navigate('/projects')}
        className="back-link"
      >
        返回项目列表
      </Button>

      {/* Project header card */}
      <div className="glass-panel animate-in" style={{ padding: '20px 24px', marginBottom: 16, borderRadius: 12 }}>
        <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
          <ProjectIcon
            name={project.name}
            techStack={project.techStack}
            iconType={project.iconType}
            iconUrl={project.iconUrl}
            iconColor={project.iconColor}
            size={48}
            style={{ borderRadius: 12 }}
          />
          <div style={{ flex: 1 }}>
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 600, letterSpacing: '-0.01em', color: 'var(--md-on-surface)' }}>
              {project.name}
            </h2>
            <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <StatusBadge status={project.status} />
              <span style={{
                padding: '2px 8px',
                borderRadius: 4,
                background: 'var(--md-surface-container-high)',
                color: 'var(--md-on-surface-variant)',
                fontSize: 11,
                border: '1px solid var(--md-outline-variant)',
              }}>
                {project.priority}
              </span>
              <span style={{
                padding: '2px 8px',
                borderRadius: 4,
                background: 'var(--md-surface-container-high)',
                color: 'var(--md-on-surface-variant)',
                fontSize: 11,
                border: '1px solid var(--md-outline-variant)',
              }}>
                {project.source}
              </span>
              {project.techStack?.slice(0, 3).map((t: string) => (
                <span key={t} style={{
                  padding: '2px 8px',
                  borderRadius: 4,
                  background: 'var(--md-surface-container-high)',
                  color: 'var(--md-on-surface)',
                  fontSize: 11,
                  fontFamily: 'var(--font-mono)',
                  border: '1px solid var(--md-outline-variant)',
                }}>
                  {t}
                </span>
              ))}
            </div>
          </div>
          {project.localPath && (
            <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
              <Button
                icon={<ReloadOutlined spin={refreshProject.isPending} />}
                onClick={handleRefresh}
                disabled={refreshProject.isPending}
              >
                {refreshProject.isPending ? '检测中...' : '刷新'}
              </Button>
              <Button
                type="primary"
                icon={<PlayCircleOutlined />}
                onClick={handleLaunch}
              >
                启动
              </Button>
              <Button
                icon={<CodeOutlined />}
                onClick={() => { if (project.localPath) { requestLaunch({ cwd: project.localPath, label: project.name, projectId: project.id }); navigate('/'); } }}
              >
                终端
              </Button>
            </div>
          )}
        </div>
        {project.description && (
          <p style={{ color: 'var(--md-on-surface-variant)', marginTop: 12, fontSize: 13, lineHeight: 1.5 }}>{project.description}</p>
        )}
      </div>

      {/* Tabs content */}
      <div className="glass-panel animate-in animate-in-delay-2" style={{ padding: '4px 24px 24px', flex: 1, minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <Tabs
          className="project-detail-tabs"
          activeKey={activeTab}
          onChange={setActiveTab}
          items={[
            { key: 'overview', label: '概览', children: <OverviewTab project={project} /> },
            { key: 'repos', label: `仓库 (${remoteRepos.length})`, children: <ReposTab projectId={project.id} repos={remoteRepos} onRefresh={() => refreshProject.mutateAsync(project.id)} /> },
            { key: 'git', label: 'Git', children: <GitTab project={project} /> },
            { key: 'tasks', label: `任务 (${count.tasks || 0})`, children: <TasksTab projectId={project.id} repos={remoteRepos} /> },
            { key: 'documents', label: `文档 (${count.documents || 0})`, children: <DocumentsTab projectId={project.id} /> },
            { key: 'milestones', label: '里程碑', children: <MilestonesTab projectId={project.id} /> },
            { key: 'config', label: '配置', children: <ConfigTab project={project} onSaved={() => refreshProject.mutateAsync(project.id)} /> },
            { key: 'timeline', label: '活动', children: <ProjectTimelineTab projectId={project.id} /> },
            { key: 'health', label: '健康检查', children: <HealthTab projectId={project.id} /> },
          ]}
        />
      </div>
    </div>
  );
}

// ==================== 概览 Tab ====================

function OverviewTab({ project }: { project: ProjectDetail }) {
  const navigate = useNavigate();
  const { requestLaunch } = useTerminalStore();
  const [agentInput, setAgentInput] = useState('');
  const [activityTab, setActivityTab] = useState<'tasks' | 'files'>('tasks');

  const { data: brain } = useProjectBrain(project.id);
  const { data: activityLogs = [] } = useProjectTimeline(project.id);

  const agentOutput = (() => {
    if (!brain) return ['> 正在加载项目分析...'];
    const lines: string[] = [];
    lines.push(`> 项目结构: ${brain.stats.totalFiles} 个文件`);
    if (brain.stats.sourceFiles > 0) lines.push(`> 源文件: ${brain.stats.sourceFiles}, 测试: ${brain.stats.testFiles}`);
    if (brain.stats.languages.length > 0) lines.push(`> 语言: ${brain.stats.languages.map(l => l.name).join(', ')}`);
    if (brain.entryPoints.main) lines.push(`> 入口: ${brain.entryPoints.main}`);
    if (brain.environment.requiredTools.length > 0) lines.push(`> 依赖工具: ${brain.environment.requiredTools.join(', ')}`);
    lines.push(`> 就绪，等待指令`);
    return lines;
  })();

  const activityRows = activityLogs.map(log => {
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
  });

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
            borderTop: '1px solid var(--md-outline-variant)',
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
              border: '1px solid var(--md-outline-variant)',
            }}>
              <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--md-on-surface)', display: 'flex', alignItems: 'center', gap: 6 }}>
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>commit</span>
                main
              </span>
              <span style={{ fontSize: 12, fontFamily: 'var(--font-label)', color: 'var(--md-on-surface-variant)' }}>最新</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 4px' }}>
              <span style={{ fontSize: 13, color: 'var(--md-on-surface-variant)' }}>未提交文件</span>
              <span style={{ fontSize: 12, fontFamily: 'var(--font-label)', color: 'var(--md-error)', display: 'flex', alignItems: 'center', gap: 4 }}>
                <span className="material-symbols-outlined" style={{ fontSize: 14 }}>error</span>
                —
              </span>
            </div>
            <button
              style={{
                width: '100%',
                marginTop: 6,
                padding: '6px 0',
                background: 'var(--md-surface-container-lowest)',
                border: '1px solid var(--md-outline-variant)',
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
                border: '1px solid var(--md-outline-variant)',
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
                e.currentTarget.style.borderColor = 'var(--md-outline-variant)';
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
      <div style={{ gridColumn: 'span 8', background: 'var(--md-surface-container-lowest)', borderRadius: 12, border: '1px solid var(--md-outline-variant)', boxShadow: '0 4px 12px rgba(0,0,0,0.03)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {/* Header with tabs */}
        <div style={{
          padding: '12px 16px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderBottom: '1px solid var(--md-outline-variant)',
          background: 'var(--md-surface-container-lowest)',
        }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--md-on-surface)' }}>工作区活动</div>
          <div style={{ display: 'flex', gap: 6 }}>
            {(['tasks', 'files'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActivityTab(tab)}
                style={{
                  padding: '4px 12px',
                  borderRadius: 6,
                  border: 'none',
                  fontSize: 12,
                  fontFamily: 'var(--font-label)',
                  fontWeight: 500,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  background: activityTab === tab ? 'var(--md-surface-container-high)' : 'transparent',
                  color: activityTab === tab ? 'var(--md-on-surface)' : 'var(--md-on-surface-variant)',
                }}
              >
                {tab === 'tasks' ? '任务' : '文件'}
              </button>
            ))}
          </div>
        </div>
        {/* Table */}
        <div style={{ overflow: 'auto', flex: 1 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--md-outline-variant)' }}>
                <th style={{ fontSize: 12, fontFamily: 'var(--font-label)', fontWeight: 500, color: 'var(--md-on-surface-variant)', padding: '8px 16px' }}>任务 / 文件</th>
                <th style={{ fontSize: 12, fontFamily: 'var(--font-label)', fontWeight: 500, color: 'var(--md-on-surface-variant)', padding: '8px 16px' }}>状态</th>
                <th style={{ fontSize: 12, fontFamily: 'var(--font-label)', fontWeight: 500, color: 'var(--md-on-surface-variant)', padding: '8px 16px', textAlign: 'right' }}>时间</th>
              </tr>
            </thead>
            <tbody>
              {activityRows.map((row, i) => (
                <tr
                  key={i}
                  style={{
                    borderBottom: i < activityRows.length - 1 ? '1px solid var(--md-outline-variant)' : 'none',
                    cursor: 'pointer',
                    transition: 'background 0.15s ease',
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--md-surface-container-low)'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                >
                  <td style={{ padding: '10px 16px', fontSize: 13, color: 'var(--md-on-surface)', display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 16, color: row.iconColor }}>{row.icon}</span>
                    {row.label}
                  </td>
                  <td style={{ padding: '10px 16px' }}>
                    <span style={{
                      padding: '2px 8px',
                      borderRadius: 4,
                      fontSize: 10,
                      fontFamily: 'var(--font-mono)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      background: row.statusBg,
                      color: row.statusColor,
                    }}>
                      {row.status}
                    </span>
                  </td>
                  <td style={{ padding: '10px 16px', fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--md-on-surface-variant)', textAlign: 'right' }}>
                    {row.time}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Right Column: AI Agent + Mini Terminal (4 cols nested) ── */}
      <div style={{ gridColumn: 'span 4', display: 'flex', flexDirection: 'column', gap: 16, minHeight: 0 }}>
        {/* AI Agent */}
        <DashboardCard colSpan={0}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--md-on-surface)', display: 'flex', alignItems: 'center', gap: 6 }}>
              <span className="material-symbols-outlined" style={{ fontSize: 16, color: 'var(--md-primary)' }}>smart_toy</span>
              AI 智能体
            </div>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--md-tertiary)', animation: 'pulse 2s ease-in-out infinite' }} />
          </div>
          <div style={{
            background: 'var(--md-surface-container)',
            borderRadius: 8,
            padding: 10,
            border: '1px solid var(--md-outline-variant)',
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
          <div style={{ marginTop: 10, position: 'relative' }}>
            <input
              value={agentInput}
              onChange={e => setAgentInput(e.target.value)}
              placeholder="询问智能体..."
              style={{
                width: '100%',
                padding: '7px 32px 7px 10px',
                background: 'var(--md-surface-container-lowest)',
                border: '1px solid var(--md-outline-variant)',
                borderRadius: 6,
                fontSize: 13,
                color: 'var(--md-on-surface)',
                outline: 'none',
                fontFamily: 'var(--font-sans)',
                transition: 'border-color 0.15s ease',
                boxSizing: 'border-box',
              }}
              onFocus={e => { e.currentTarget.style.borderColor = 'var(--md-primary)'; }}
              onBlur={e => { e.currentTarget.style.borderColor = 'var(--md-outline-variant)'; }}
            />
            <span
              className="material-symbols-outlined"
              style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', fontSize: 16, color: 'var(--md-on-surface-variant)', cursor: 'pointer' }}
            >
              send
            </span>
          </div>
          <style>{`@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }`}</style>
        </DashboardCard>

        {/* Mini Terminal */}
        <div style={{
          flex: 1,
          minHeight: 140,
          background: '#0F172A',
          borderRadius: 12,
          border: '1px solid var(--md-outline-variant)',
          boxShadow: '0 4px 12px rgba(0,0,0,0.03)',
          padding: 14,
          fontFamily: 'var(--font-mono)',
          fontSize: 12,
          lineHeight: '18px',
          color: '#94a3b8',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}>
          {/* Terminal header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, paddingBottom: 8, borderBottom: '1px solid rgba(71, 85, 105, 0.4)' }}>
            <span className="material-symbols-outlined" style={{ fontSize: 16, color: '#64748b' }}>terminal</span>
            <span style={{ color: '#cbd5e1', fontWeight: 600, fontSize: 12 }}>zsh - devhub</span>
          </div>
          {/* Terminal content */}
          <div style={{ flex: 1, overflowY: 'auto' }}>
            <div>
              <span style={{ color: '#006c49' }}>{'➜'}</span>{' '}
              <span style={{ color: '#006b5f' }}>devhub</span>{' '}
              <span style={{ color: '#6b38d4' }}>git:(</span><span style={{ color: '#ba1a1a' }}>main</span><span style={{ color: '#6b38d4' }}>)</span>{' '}
              <span style={{ color: '#d97706' }}>{'✗'}</span>{' '}
              <span>npm run dev</span>
            </div>
            <div style={{ color: '#64748b' }}>&gt; devhub@1.0.4 dev</div>
            <div style={{ color: '#64748b' }}>&gt; tauri dev</div>
            <div style={{ color: '#475569', marginTop: 4 }}>...</div>
            <div style={{ color: '#006c49', marginTop: 2 }}>{'✔'} 编译前端...</div>
            <div style={{ color: '#006c49' }}>{'✔'} 编译 Rust 后端...</div>
            <div style={{ color: '#006b5f', marginTop: 2 }}>就绪 http://localhost:1420</div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Dashboard sub-components ──

function DashboardCard({ children, colSpan, style: extraStyle }: { children: React.ReactNode; colSpan: number; style?: React.CSSProperties }) {
  return (
    <div style={{
      ...(colSpan > 0 ? { gridColumn: `span ${colSpan}` } : {}),
      background: 'var(--md-surface-container-lowest)',
      borderRadius: 12,
      border: '1px solid var(--md-outline-variant)',
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

// ==================== 仓库 Tab ====================

function ReposTab({ projectId, repos, onRefresh }: { projectId: string; repos: RemoteRepo[]; onRefresh: () => void }) {
  const [modalOpen, setModalOpen] = useState(false);
  const [form] = Form.useForm();
  const [syncing, setSyncing] = useState<string | null>(null);

  const handleAdd = async (values: AddRepoInput) => {
    try {
      await reposApi.add(projectId, values);
      message.success('仓库关联成功');
      setModalOpen(false);
      form.resetFields();
      onRefresh();
    } catch (err: unknown) {
      message.error(String(err) || '关联失败');
    }
  };

  const handleSync = async (repoId: string) => {
    setSyncing(repoId);
    try {
      await reposApi.sync(repoId);
      message.success('同步完成');
      onRefresh();
    } catch (err: unknown) {
      message.error(String(err) || '同步失败');
    } finally {
      setSyncing(null);
    }
  };

  const handleRemove = async (repoId: string) => {
    Modal.confirm({
      title: '确认移除',
      content: '移除仓库关联不会删除远程仓库，仅解除本项目的关联。',
      onOk: async () => {
        await reposApi.remove(repoId);
        message.success('已移除');
        onRefresh();
      },
    });
  };

  const columns = [
    { title: '平台', dataIndex: 'platform', render: (v: string) => <Tag>{v}</Tag> },
    { title: '仓库', dataIndex: 'repoFullName' },
    { title: '分支', dataIndex: 'defaultBranch', render: (v: string) => v || '-' },
    { title: '状态', dataIndex: 'repoStatus', render: (v: string) => <Tag color={v === 'Synced' ? 'green' : v === 'Error' ? 'red' : 'orange'}>{v}</Tag> },
    { title: '最后同步', dataIndex: 'lastSyncAt', render: (v: string) => v ? new Date(v).toLocaleString('zh-CN') : '从未' },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    { title: '任务数', render: (_: unknown, r: any) => r._count?.tasks || 0 },
    {
      title: '操作', render: (_: unknown, record: RemoteRepo) => (
        <Space>
          <Button size="small" icon={<SyncOutlined />} loading={syncing === record.id} onClick={() => handleSync(record.id)}>同步</Button>
          <Button size="small" icon={<DeleteOutlined />} danger onClick={() => handleRemove(record.id)} />
        </Space>
      ),
    },
  ];

  return (
    <>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'flex-end' }}>
        <Button icon={<PlusOutlined />} type="primary" onClick={() => setModalOpen(true)}>关联远程仓库</Button>
      </div>
      <Table columns={columns} dataSource={repos} rowKey="id" pagination={false} />

      <Modal title="关联远程仓库" open={modalOpen} onCancel={() => { setModalOpen(false); form.resetFields(); }} onOk={() => form.submit()} okText="关联">
        <Form form={form} layout="vertical" onFinish={handleAdd}>
          <Form.Item name="platform" label="平台" rules={[{ required: true }]}>
            <Select options={['GitHub', 'GitLab', 'Gitee', 'Bitbucket'].map(p => ({ value: p, label: p }))} />
          </Form.Item>
          <Form.Item name="repoFullName" label="仓库全名" rules={[{ required: true, message: '如 user/repo' }]}>
            <Input placeholder="user/repo" />
          </Form.Item>
          <Form.Item name="repoUrl" label="仓库地址" rules={[{ required: true, type: 'url' }]}>
            <Input placeholder="https://github.com/user/repo" />
          </Form.Item>
          <Form.Item name="defaultBranch" label="默认分支">
            <Input placeholder="main" />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}

// ==================== 文档 Tab ====================

function DocumentsTab({ projectId }: { projectId: string }) {
  const { data: docs = [], isLoading: loading } = useDocuments(projectId);
  const createDoc = useCreateDocument(projectId);
  const [modalOpen, setModalOpen] = useState(false);
  const [form] = Form.useForm();

  const handleCreate = async (values: CreateDocumentInput) => {
    await createDoc.mutateAsync(values);
    message.success('文档创建成功');
    setModalOpen(false);
    form.resetFields();
  };

  return (
    <>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'flex-end' }}>
        <Button icon={<PlusOutlined />} type="primary" onClick={() => setModalOpen(true)}>新建文档</Button>
      </div>
      {docs.length === 0 && !loading ? (
        <Empty description="暂无文档" />
      ) : (
        <Table
          dataSource={docs}
          rowKey="id"
          loading={loading}
          pagination={false}
          columns={[
            { title: '标题', dataIndex: 'title' },
            { title: '类型', dataIndex: 'type', render: (v: string) => <Tag>{v}</Tag> },
            { title: '更新时间', dataIndex: 'updatedAt', render: (v: string) => new Date(v).toLocaleString('zh-CN') },
          ]}
        />
      )}

      <Modal title="新建文档" open={modalOpen} onCancel={() => { setModalOpen(false); form.resetFields(); }} onOk={() => form.submit()} okText="创建">
        <Form form={form} layout="vertical" onFinish={handleCreate}>
          <Form.Item name="title" label="标题" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="type" label="类型" initialValue="Doc">
            <Select options={['Doc', 'Note', 'Changelog', 'Decision'].map(t => ({ value: t, label: t }))} />
          </Form.Item>
          <Form.Item name="content" label="内容">
            <Input.TextArea rows={6} placeholder="支持 Markdown" />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}

// ==================== 项目活动 Tab ====================

const ACTION_MAP: Record<string, { icon: React.ReactNode; color: string; label: string }> = {
  status_change: { icon: <EditOutlined />, color: 'blue', label: '状态变更' },
  task_created: { icon: <PlusCircleOutlined />, color: 'green', label: '创建任务' },
  task_status_change: { icon: <CheckCircleOutlined />, color: 'orange', label: '任务状态变更' },
  repo_synced: { icon: <SyncOutlined />, color: 'cyan', label: '仓库同步' },
};

function formatLogDetails(action: string, details: string | null | undefined): string {
  if (!details) return '';
  try {
    const d = JSON.parse(details);
    if (action === 'status_change' || action === 'task_status_change') return `${d.from} → ${d.to}`;
    if (action === 'task_created') return d.title || '';
    if (action === 'repo_synced') return `${d.platform}: ${d.repo}`;
    return '';
  } catch { return ''; }
}

function ProjectTimelineTab({ projectId }: { projectId: string }) {
  const { data: logs = [], isLoading: loading } = useProjectTimeline(projectId);

  if (loading) return <Spin />;
  if (logs.length === 0) return <Empty description="暂无活动记录" />;

  return (
    <Timeline
      items={logs.map(log => {
        const action = ACTION_MAP[log.action] || { icon: <ClockCircleOutlined />, color: 'gray', label: log.action };
        const details = formatLogDetails(log.action, log.details);
        return {
          dot: action.icon,
          color: action.color,
          children: (
            <div>
              <Space>
                <Tag color={action.color}>{action.label}</Tag>
                <span>{log.entityType}</span>
                {details && <span style={{ color: 'var(--color-text-description)' }}>- {details}</span>}
              </Space>
              <div style={{ fontSize: 12, color: 'var(--color-text-light)', marginTop: 2 }}>
                {new Date(log.createdAt).toLocaleString('zh-CN')}
              </div>
            </div>
          ),
        };
      })}
    />
  );
}
