import type { ProjectWithStats, ProjectHealthResult } from '../../types';
import type { ItemType } from 'antd/es/menu/interface';
import ProjectIcon from '../../shared/ProjectIcon';
import HealthBadge from '../../shared/HealthBadge';
import { Dropdown } from 'antd';

export interface ProjectCardProps {
  projects: ProjectWithStats[];
  isCompact: boolean;
  density: string;
  navigate: (path: string) => void;
  getStatusColorVar: (status: string) => string;
  formatRelativeTime: (iso?: string) => string;
  healthResults: Record<string, ProjectHealthResult>;
  branchMap: Record<string, string>;
  getCardMenuItems: (project: ProjectWithStats) => ItemType[];
}

export function ProjectGridView({
  projects, isCompact, density, navigate,
  getStatusColorVar, formatRelativeTime,
  healthResults, branchMap, getCardMenuItems,
}: ProjectCardProps) {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: isCompact
        ? 'repeat(auto-fill, minmax(260px, 1fr))'
        : 'repeat(auto-fill, minmax(300px, 1fr))',
      gap: isCompact ? 12 : 16,
    }}>
      {projects.map((project, index) => {
        const statusColor = getStatusColorVar(project.status);
        const hasHealth = !!healthResults[project.id];
        const isRecent = Date.now() - new Date(project.updatedAt).getTime() < 24 * 60 * 60 * 1000;

        return (
          <div
            key={project.id}
            onClick={() => navigate(`/projects/${project.id}`)}
            style={{
              background: 'var(--color-bg-card)',
              backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)',
              borderRadius: isCompact ? 10 : 12,
              border: '1px solid var(--color-border)',
              boxShadow: isRecent ? 'var(--card-shadow-elevated)' : 'var(--card-shadow)',
              cursor: 'pointer',
              transition: 'box-shadow 0.25s var(--ease-spring), transform 0.25s var(--ease-spring)',
              overflow: 'hidden',
              position: 'relative',
              animation: `cardEnter 0.3s var(--ease-spring) both`,
              animationDelay: `${index * 30}ms`,
            }}
            onMouseEnter={e => {
              e.currentTarget.style.boxShadow = 'var(--card-shadow-hover)';
              e.currentTarget.style.transform = 'translateY(-3px)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.boxShadow = isRecent ? 'var(--card-shadow-elevated)' : 'var(--card-shadow)';
              e.currentTarget.style.transform = 'translateY(0)';
            }}
          >
            {/* Top accent bar */}
            <div style={{ height: isCompact ? 2 : 3, background: statusColor }} />

            <div style={{ padding: isCompact ? (density === 'dense' ? '10px 12px' : '14px 16px') : '20px 20px 16px' }}>
              {/* Header: Icon + Name + Menu */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: isCompact ? 8 : 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: isCompact ? 8 : 12 }}>
                  <div style={{
                    width: isCompact ? (density === 'dense' ? 22 : 28) : 40,
                    height: isCompact ? (density === 'dense' ? 22 : 28) : 40,
                    borderRadius: isCompact ? 6 : 8,
                    background: 'var(--md-surface-container)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: '1px solid var(--color-border-subtle)',
                    flexShrink: 0,
                    overflow: 'hidden',
                  }}>
                    <ProjectIcon
                      name={project.name}
                      techStack={project.techStack}
                      iconType={project.iconType}
                      iconUrl={project.iconUrl}
                      iconColor={project.iconColor}
                      size={isCompact ? (density === 'dense' ? 22 : 28) : 40}
                    />
                  </div>
                  <div>
                    <div style={{
                      fontWeight: 600,
                      fontSize: isCompact ? (density === 'dense' ? 12 : 13) : 18,
                      lineHeight: isCompact ? '20px' : '24px',
                      letterSpacing: '-0.01em',
                      color: 'var(--md-on-surface)',
                      transition: 'color 0.15s ease',
                    }}>
                      {project.name}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3 }}>
                      <span style={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        background: statusColor,
                        flexShrink: 0,
                      }} />
                      <span style={{
                        fontFamily: 'var(--font-label)',
                        fontSize: 12,
                        fontWeight: 500,
                        letterSpacing: '0.02em',
                        color: 'var(--md-on-surface-variant)',
                      }}>
                        {project.status}
                      </span>
                      {isCompact && (project.frontendStatus === 'running' || project.backendStatus === 'running') && (
                        <span style={{
                          fontSize: 9,
                          padding: '1px 4px',
                          borderRadius: 3,
                          background: 'rgba(34, 197, 94, 0.15)',
                          color: 'var(--color-success, #22c55e)',
                          fontFamily: 'var(--font-mono)',
                          whiteSpace: 'nowrap' as const,
                        }}>
                          running
                        </span>
                      )}
                      {isCompact && (project.frontendStatus === 'error' || project.backendStatus === 'error') && (
                        <span style={{
                          fontSize: 9,
                          padding: '1px 4px',
                          borderRadius: 3,
                          background: 'rgba(239, 68, 68, 0.1)',
                          color: 'var(--md-error)',
                          fontFamily: 'var(--font-mono)',
                          whiteSpace: 'nowrap' as const,
                        }}>
                          error
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <Dropdown
                  menu={{ items: getCardMenuItems(project) }}
                  trigger={['click']}
                  placement="bottomRight"
                >
                  <button
                    onClick={(e) => e.stopPropagation()}
                    aria-label="项目操作菜单"
                    aria-haspopup="menu"
                    style={{
                      width: 32, height: 32, borderRadius: 6, border: 'none',
                      background: 'transparent', color: 'var(--md-outline)',
                      cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      transition: 'background 0.15s, color 0.15s',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'var(--md-surface-container-high)'; e.currentTarget.style.color = 'var(--md-on-surface)'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--md-outline)'; }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: 20 }}>more_vert</span>
                  </button>
                </Dropdown>
              </div>

              {/* Description */}
              {project.description && (
                <p style={{
                  fontSize: 13,
                  lineHeight: '18px',
                  color: 'var(--md-on-surface-variant)',
                  margin: '0 0 12px 0',
                  display: '-webkit-box',
                  WebkitLineClamp: density === 'dense' ? 1 : isCompact ? 1 : 2,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                }}>
                  {project.description}
                </p>
              )}

              {/* Tech stack */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: isCompact ? 4 : 6, marginTop: 'auto', paddingTop: isCompact ? 2 : 4 }}>
                {project.techStack?.slice(0, isCompact ? 2 : 3).map(tech => (
                  <span key={tech} style={{
                    padding: isCompact ? (density === 'dense' ? '1px 4px' : '2px 6px') : '4px 8px',
                    borderRadius: 6,
                    background: 'var(--md-surface-container-low)',
                    color: 'var(--md-on-surface-variant)',
                    fontFamily: 'var(--font-mono)',
                    fontSize: isCompact ? (density === 'dense' ? 9 : 10) : 12,
                    fontWeight: 450,
                    lineHeight: '16px',
                    border: '1px solid var(--color-border-subtle)',
                  }}>
                    {tech}
                  </span>
                ))}
                {(project.techStack?.length || 0) > (isCompact ? 2 : 3) && (
                  <span style={{
                    padding: isCompact ? '1px 3px' : '4px 6px',
                    fontSize: isCompact ? 9 : 12,
                    color: 'var(--md-on-surface-variant)',
                    fontFamily: 'var(--font-mono)',
                  }}>
                    +{project.techStack.length - (isCompact ? 2 : 3)}
                  </span>
                )}
              </div>

              {/* Footer stats */}
              {isCompact ? (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  paddingTop: density === 'dense' ? 6 : 8,
                  marginTop: density === 'dense' ? 6 : 8,
                  borderTop: '1px solid var(--color-divider)',
                  fontSize: 11,
                  color: 'var(--md-on-surface-variant)',
                }}>
                  {branchMap[project.id] && (
                    <span style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: 10,
                      padding: '1px 5px',
                      borderRadius: 3,
                      background: 'var(--md-primary-container)',
                      color: 'var(--md-primary)',
                      whiteSpace: 'nowrap' as const,
                    }}>
                      {branchMap[project.id]}
                    </span>
                  )}
                  <span style={{ fontFamily: 'var(--font-label)', fontSize: 11, fontWeight: 500 }}>
                    {project.taskCount} tasks
                  </span>
                  <div style={{
                    flex: 1,
                    height: isCompact ? 2 : 3,
                    background: 'var(--color-divider)',
                    borderRadius: 1,
                    overflow: 'hidden',
                    minWidth: 30,
                  }}>
                    <div style={{
                      width: project.taskCount > 0 ? `${Math.round(project.completedTaskCount / project.taskCount * 100)}%` : '0%',
                      height: '100%',
                      background: 'var(--md-primary)',
                      borderRadius: 1,
                    }} />
                  </div>
                  <span style={{ fontSize: 10, whiteSpace: 'nowrap' as const }}>
                    {formatRelativeTime(project.updatedAt)}
                  </span>
                </div>
              ) : (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  paddingTop: 16,
                  marginTop: 12,
                  borderTop: '1px solid var(--color-divider)',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5, color: 'var(--md-on-surface-variant)' }}>
                      <span className="material-symbols-outlined" style={{ fontSize: 16 }}>folder_open</span>
                      <span style={{ fontFamily: 'var(--font-label)', fontSize: 12, fontWeight: 500, letterSpacing: '0.02em' }}>
                        {project.repoCount}
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5, color: 'var(--md-on-surface-variant)' }}>
                      <span className="material-symbols-outlined" style={{ fontSize: 16 }}>smart_toy</span>
                      <span style={{ fontFamily: 'var(--font-label)', fontSize: 12, fontWeight: 500, letterSpacing: '0.02em' }}>
                        {project.taskCount}
                      </span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    {hasHealth ? (
                      <HealthBadge result={healthResults[project.id]} />
                    ) : (
                      <span className="material-symbols-outlined" style={{ fontSize: 16, color: 'var(--md-tertiary)' }}>
                        check_circle
                      </span>
                    )}
                    <span style={{ fontSize: 13, color: 'var(--md-on-surface-variant)' }}>
                      {formatRelativeTime(project.updatedAt)}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
