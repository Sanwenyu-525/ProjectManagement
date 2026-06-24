import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Tabs, Button, Skeleton, Empty, message } from 'antd';
import { ArrowLeftOutlined, PlayCircleOutlined, ReloadOutlined, CodeOutlined } from '@ant-design/icons';
import { useProject, useRefreshProject } from '../../hooks/useProjects';
import type { ProjectDetail, RemoteRepo } from '../../types';
import ConfigTab from './tabs/ConfigTab';
import TasksTab from './tabs/TasksTab';
import MilestonesTab from './tabs/MilestonesTab';
import OverviewTab from './tabs/OverviewTab';
import ReposTab from './tabs/ReposTab';
import DocumentsTab from './tabs/DocumentsTab';
import ProjectTimelineTab from './tabs/ProjectTimelineTab';
import ProjectIcon from '../../shared/ProjectIcon';
import { useTerminalStore } from '../../stores/terminalStore';
import { buildLaunchRequests } from '../../lib/launchUtils';
import GitTab from './git/GitTab';
import HealthTab from './HealthTab';
import GraphTab from './tabs/GraphTab';
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
    <div style={{ padding: 'var(--space-8) var(--layout-container-padding)', height: '100%', boxSizing: 'border-box' }}>
      <Skeleton.Button active style={{ marginBottom: 20, width: 140 }} />
      <div className="glass-panel" style={{ padding: 'var(--space-8) var(--layout-container-padding)', marginBottom: 20 }}>
        <Skeleton active avatar={{ size: 64 }} paragraph={{ rows: 2 }} />
      </div>
      <div className="glass-panel" style={{ padding: 'var(--layout-container-padding)' }}>
        <Skeleton active paragraph={{ rows: 6 }} />
      </div>
    </div>
  );
  if (!project) return (
    <div style={{ padding: 'var(--space-8)' }}>
      <Empty description="项目不存在">
        <Button onClick={() => navigate('/projects')}>返回项目列表</Button>
      </Empty>
    </div>
  );

  const p = project as ProjectDetail & Record<string, unknown>;
  const remoteRepos = (p.remoteRepos || []) as RemoteRepo[];
  const count = (p._count || {}) as Record<string, number>;

  return (
    <div style={{ padding: 'var(--space-8) var(--layout-container-padding)', display: 'flex', flexDirection: 'column', height: '100%', boxSizing: 'border-box' }}>
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
      <div className="glass-panel animate-in" style={{ padding: 'var(--space-6) var(--layout-container-padding)', marginBottom: 16, borderRadius: 12 }}>
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
                border: '1px solid var(--border)',
              }}>
                {project.priority}
              </span>
              <span style={{
                padding: '2px 8px',
                borderRadius: 4,
                background: 'var(--md-surface-container-high)',
                color: 'var(--md-on-surface-variant)',
                fontSize: 11,
                border: '1px solid var(--border)',
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
                  border: '1px solid var(--border)',
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
      <div className="glass-panel animate-in" style={{ padding: 'var(--space-1) var(--layout-container-padding) var(--layout-container-padding)', flex: 1, minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column', animationDelay: '0.2s', opacity: 0 }}>
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
            { key: 'graph', label: '图谱', children: <GraphTab projectId={project.id} /> },
          ]}
        />
      </div>
    </div>
  );
}
