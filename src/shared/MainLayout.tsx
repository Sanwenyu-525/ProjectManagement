import { useState, useEffect } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Dropdown, notification } from 'antd';
import {
  SettingOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
} from '@ant-design/icons';
import WorkspacePage from '../features/workspace/WorkspacePage';
import FileExplorer from './FileExplorer';
import SearchBox from './components/SearchBox';
import CommandPalette from './components/CommandPalette';
import { useCommandPalette } from '../hooks/useCommandPalette';
import { healthApi } from '../api';
import { formatHealthIssues, isHealthUrgent } from '../lib/healthUtils';
import { useThemeStore } from '../stores/themeStore';

const navItems = [
  { key: '/workspace', icon: 'space_dashboard', label: '工作区' },
  { key: '/projects', icon: 'folder_open', label: '项目' },
  { key: '/settings', icon: 'settings', label: '设置' },
];

const footerItems = [
  { icon: 'description', label: '文档', href: 'https://docs.devhub.ai' },
  { icon: 'help', label: '支持', href: 'https://support.devhub.ai' },
];

export default function MainLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [notifApi, contextHolder] = notification.useNotification();
  const isDark = useThemeStore(s => s.mode === 'dark');
  const { open: paletteOpen, openPalette, closePalette } = useCommandPalette();

  const activeKey = navItems.find(item => location.pathname.startsWith(item.key))?.key || '/workspace';

  // Daily project health check — runs once per day on first app open
  useEffect(() => {
    const today = new Date().toLocaleDateString('sv-SE');
    const lastCheck = localStorage.getItem('lastHealthCheckDate');
    if (lastCheck === today) return;

    healthApi.runAll().then(({ results, changedProjects }) => {
      localStorage.setItem('lastHealthCheckDate', today);
      if (!changedProjects || changedProjects.length === 0) return;

      notifApi.info({
        message: '项目健康检查完成',
        description: `检测到 ${changedProjects.length} 个项目有变化`,
        duration: 10,
        onClick: () => navigate('/projects'),
      });

      changedProjects.forEach((projectId: string) => {
        const health = results.find(r => r.projectId === projectId);
        if (!health) return;
        const issues = formatHealthIssues(health);
        if (issues.length > 0) {
          const severity = isHealthUrgent(health) ? 'warning' : 'info';
          notifApi[severity]({
            message: health.projectName,
            description: issues.join('；'),
            duration: 8,
            onClick: () => navigate(`/projects/${health.projectId}`),
          });
        }
      });
    }).catch(() => {
      // Health check is best-effort, silent failure
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const userMenuItems = [
    { key: 'settings', icon: <SettingOutlined />, label: '设置', onClick: () => navigate('/settings') },
  ];

  const sidebarW = sidebarCollapsed ? 64 : 260;

  return (
    <div style={{
      display: 'flex',
      height: '100vh',
      overflow: 'hidden',
      background: isDark ? 'var(--md-background)' : 'var(--md-surface)',
      fontFamily: 'var(--font-sans)',
    }}>
      {contextHolder}

      {/* ── Sidebar ── */}
      <nav
        aria-label="侧栏导航"
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: sidebarW,
          height: '100vh',
          zIndex: 50,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '16px 8px',
          background: isDark ? 'rgba(7, 11, 18, 0.92)' : 'rgba(255, 255, 255, 0.70)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderRight: `1px solid ${isDark ? 'var(--md-outline-variant)' : 'var(--color-border)'}`,
          transition: 'width 0.2s ease',
        }}
      >
        {/* Top section */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1, minHeight: 0 }}>
          {/* Logo + collapse toggle */}
          <div style={{
            display: 'flex',
            flexDirection: sidebarCollapsed ? 'column' : 'row',
            alignItems: 'center',
            gap: sidebarCollapsed ? 4 : 10,
            padding: sidebarCollapsed ? '8px 0' : '8px 12px',
            marginBottom: 12,
          }}>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                background: 'var(--md-primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                boxShadow: '0 2px 8px rgba(0, 107, 95, 0.22)',
              }}
              onClick={() => navigate('/workspace')}
              role="button"
              title="返回首页"
            >
              <img src="/icon.png" alt="D" style={{ width: 20, height: 20, borderRadius: 4 }} />
            </div>
            {!sidebarCollapsed && (
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: 16,
                  fontWeight: 700,
                  color: 'var(--md-on-surface)',
                  lineHeight: '20px',
                }}>
                  DevHub
                </div>
                <span style={{
                  fontSize: 12,
                  fontFamily: 'var(--font-label)',
                  color: 'var(--md-on-surface-variant)',
                  opacity: 0.7,
                }}>
                  v1.0.4
                </span>
              </div>
            )}
            <button
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 28,
                height: 28,
                borderRadius: 8,
                border: 'none',
                background: 'transparent',
                color: 'var(--md-on-surface-variant)',
                cursor: 'pointer',
                flexShrink: 0,
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = 'var(--md-surface-container-high)';
                e.currentTarget.style.color = 'var(--md-on-surface)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.color = 'var(--md-on-surface-variant)';
              }}
              title={sidebarCollapsed ? '展开侧栏' : '收起侧栏'}
            >
              {sidebarCollapsed ? <MenuUnfoldOutlined style={{ fontSize: 14 }} /> : <MenuFoldOutlined style={{ fontSize: 14 }} />}
            </button>
          </div>

          {/* New Project CTA */}
          {!sidebarCollapsed && (
            <div style={{ padding: '0 8px', marginBottom: 12 }}>
              <button
                onClick={() => navigate('/projects')}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  background: 'var(--md-primary)',
                  color: 'var(--md-on-primary)',
                  fontFamily: 'var(--font-label)',
                  fontSize: 12,
                  fontWeight: 500,
                  letterSpacing: '0.02em',
                  padding: '8px 16px',
                  borderRadius: 8,
                  border: 'none',
                  boxShadow: '0 2px 8px rgba(0, 107, 95, 0.22)',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                }}
                onMouseEnter={e => { e.currentTarget.style.opacity = '0.9'; }}
                onMouseLeave={e => { e.currentTarget.style.opacity = '1'; }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>add</span>
                新建项目
              </button>
            </div>
          )}

          {/* Navigation links */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {navItems.map(item => {
              const isActive = activeKey === item.key;
              const handleClick = () => {
                navigate(item.key);
              };

              return (
                <button
                  key={item.key}
                  onClick={handleClick}
                  title={sidebarCollapsed ? item.label : undefined}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: sidebarCollapsed ? '8px 4px' : '8px 12px',
                    justifyContent: sidebarCollapsed ? 'center' : 'flex-start',
                    border: 'none',
                    borderRadius: isActive ? '0 8px 8px 0' : 8,
                    borderLeft: isActive ? '2px solid var(--md-primary)' : '2px solid transparent',
                    background: isActive
                      ? 'rgba(20, 184, 166, 0.10)'
                      : 'transparent',
                    color: isActive ? 'var(--md-primary)' : 'var(--md-on-surface-variant)',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    fontFamily: 'var(--font-sans)',
                    fontSize: 14,
                    textAlign: 'left',
                    width: '100%',
                  }}
                  onMouseEnter={e => {
                    if (!isActive) {
                      e.currentTarget.style.background = isDark ? 'var(--md-surface-container-high)' : 'var(--md-surface-container-high)';
                      e.currentTarget.style.color = 'var(--md-on-surface)';
                    }
                  }}
                  onMouseLeave={e => {
                    if (!isActive) {
                      e.currentTarget.style.background = 'transparent';
                      e.currentTarget.style.color = 'var(--md-on-surface-variant)';
                    }
                  }}
                >
                  <span className="material-symbols-outlined" style={{
                    fontSize: 20,
                    color: isActive ? 'var(--md-primary)' : undefined,
                    transition: 'color 0.2s',
                  }}>
                    {item.icon}
                  </span>
                  {!sidebarCollapsed && (
                    <span style={{ fontWeight: isActive ? 500 : 400 }}>
                      {item.label}
                    </span>
                  )}
                </button>
              );
            })}

          </div>

          {/* ── Explorer file tree ── */}
          <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', scrollbarGutter: 'stable' }}>
            <FileExplorer collapsed={sidebarCollapsed} />
          </div>
        </div>

        {/* Footer links */}
        <div style={{
          borderTop: `1px solid ${isDark ? 'var(--md-outline-variant)' : 'rgba(187, 202, 198, 0.3)'}`,
          paddingTop: 12,
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
        }}>
          {footerItems.map(item => (
            <button
              key={item.label}
              onClick={() => window.open(item.href, '_blank')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: sidebarCollapsed ? '8px 0' : '8px 12px',
                justifyContent: sidebarCollapsed ? 'center' : 'flex-start',
                border: 'none',
                borderRadius: 8,
                background: 'transparent',
                color: 'var(--md-on-surface-variant)',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                fontFamily: 'var(--font-sans)',
                fontSize: 14,
                textAlign: 'left',
                width: '100%',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = isDark ? 'var(--md-surface-container-high)' : 'var(--md-surface-container-high)';
                e.currentTarget.style.color = 'var(--md-on-surface)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.color = 'var(--md-on-surface-variant)';
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 20 }}>{item.icon}</span>
              {!sidebarCollapsed && <span>{item.label}</span>}
            </button>
          ))}

          {/* User Profile */}
          {!sidebarCollapsed && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '8px 12px',
                marginTop: 16,
                borderRadius: 8,
                border: `1px solid ${isDark ? 'rgba(148,163,184,0.12)' : 'rgba(187,202,198,0.30)'}`,
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = isDark ? 'var(--md-surface-container-high)' : 'var(--md-surface-container-high)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = 'transparent';
              }}
            >
              <div style={{
                width: 32,
                height: 32,
                borderRadius: '50%',
                background: 'var(--md-secondary-container)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--md-on-secondary-container)',
                fontSize: 12,
                fontWeight: 700,
                flexShrink: 0,
              }}>JD</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: 13,
                  color: 'var(--md-on-surface)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}>用户名</div>
                <div style={{
                  fontSize: 12,
                  fontFamily: 'var(--font-label)',
                  color: 'var(--md-on-surface-variant)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}>user@example.com</div>
              </div>
            </div>
          )}
        </div>
      </nav>

      {/* ── Main area (offset by sidebar width) ── */}
      <div style={{
        flex: 1,
        marginLeft: sidebarW,
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        overflow: 'hidden',
        background: 'transparent',
        transition: 'margin-left 0.2s ease',
      }}>

        {/* ── Topbar ── */}
        <header style={{
          position: 'fixed',
          top: 0,
          right: 0,
          left: sidebarW,
          height: 56,
          zIndex: 40,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '0 24px',
          background: isDark ? 'rgba(7, 11, 18, 0.90)' : 'rgba(255, 255, 255, 0.70)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderBottom: `1px solid ${isDark ? 'var(--md-outline-variant)' : 'var(--color-border)'}`,
          transition: 'left 0.2s ease',
        }}>
          {/* Left: nav links */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 0, height: '100%' }}>
            {['最近', '收藏'].map(label => (
              <button
                key={label}
                style={{
                  height: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  fontFamily: 'var(--font-sans)',
                  fontSize: 14,
                  color: 'var(--md-on-surface-variant)',
                  cursor: 'pointer',
                  padding: '0 12px',
                  borderRadius: 0,
                  border: 'none',
                  background: 'transparent',
                  transition: 'all 0.15s ease',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.background = isDark ? 'var(--md-surface-container-low)' : 'var(--md-surface-container-low)';
                  e.currentTarget.style.color = 'var(--md-on-surface)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.color = 'var(--md-on-surface-variant)';
                }}
              >{label}</button>
            ))}
          </div>

          {/* Center: search (command palette) */}
          <div style={{ flex: 1, maxWidth: 672, margin: '0 32px', display: 'flex', alignItems: 'center' }}>
            <SearchBox onOpenCommandPalette={openPalette} />
          </div>

          {/* Right: actions */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            {/* Deploy */}
            <button
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '6px 16px',
                borderRadius: 8,
                border: 'none',
                background: 'var(--md-primary)',
                color: 'var(--md-on-primary)',
                cursor: 'pointer',
                fontFamily: 'var(--font-label)',
                fontSize: 12,
                fontWeight: 500,
                letterSpacing: '0.02em',
                transition: 'all 0.15s ease',
                boxShadow: '0 2px 8px rgba(0, 107, 95, 0.22)',
              }}
              onMouseEnter={e => { e.currentTarget.style.opacity = '0.9'; }}
              onMouseLeave={e => { e.currentTarget.style.opacity = '1'; }}
            >
              部署
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>rocket_launch</span>
            </button>

            {/* Divider */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              borderLeft: `1px solid ${isDark ? 'var(--md-outline-variant)' : 'rgba(187, 202, 198, 0.50)'}`,
              paddingLeft: 16,
            }}>
              {/* Notifications */}
              <button
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  width: 32, height: 32, borderRadius: 8, border: 'none',
                  background: 'transparent', color: 'var(--md-on-surface-variant)',
                  cursor: 'pointer', transition: 'all 0.15s ease',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.background = isDark ? 'var(--md-surface-container-low)' : 'var(--md-surface-container-low)';
                  e.currentTarget.style.color = 'var(--md-on-surface)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.color = 'var(--md-on-surface-variant)';
                }}
                title="通知"
              >
                <span className="material-symbols-outlined" style={{ fontSize: 20 }}>notifications</span>
              </button>

              {/* Theme toggle */}
              <button
                onClick={useThemeStore.getState().toggle}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  width: 32, height: 32, borderRadius: 8, border: 'none',
                  background: 'transparent', color: 'var(--md-on-surface-variant)',
                  cursor: 'pointer', transition: 'all 0.15s ease',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.background = isDark ? 'var(--md-surface-container-low)' : 'var(--md-surface-container-low)';
                  e.currentTarget.style.color = 'var(--md-on-surface)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.color = 'var(--md-on-surface-variant)';
                }}
                title={isDark ? '浅色模式' : '深色模式'}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 20 }}>
                  {isDark ? 'light_mode' : 'dark_mode'}
                </span>
              </button>
            </div>

            {/* User avatar */}
            <Dropdown menu={{ items: userMenuItems }} placement="bottomRight" trigger={['click']}>
              <button
                style={{
                  marginLeft: 8,
                  width: 32, height: 32, borderRadius: '50%', overflow: 'hidden',
                  border: `1px solid ${isDark ? 'var(--md-outline-variant)' : 'var(--color-border)'}`,
                  cursor: 'pointer',
                  padding: 0,
                  background: 'transparent',
                  transition: 'box-shadow 0.15s ease',
                }}
                onMouseEnter={e => { e.currentTarget.style.boxShadow = `0 0 0 2px rgba(0, 107, 95, 0.20)`; }}
                onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none'; }}
                title="用户资料"
              >
                <div style={{
                  width: '100%', height: '100%',
                  background: 'linear-gradient(135deg, var(--md-primary), var(--md-primary-container))',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#fff', fontSize: 12, fontWeight: 700,
                }}>D</div>
              </button>
            </Dropdown>
          </div>
        </header>

        {/* ── Content area ── */}
        <main style={{
          flex: 1,
          marginTop: 56,
          overflow: location.pathname.startsWith('/workspace') ? 'hidden' : 'auto',
          position: 'relative',
        }}>
          {location.pathname.startsWith('/workspace') ? <WorkspacePage /> : <Outlet />}
        </main>
      </div>

      <CommandPalette open={paletteOpen} onClose={closePalette} />
    </div>
  );
}
