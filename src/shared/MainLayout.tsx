import { useState, useEffect, Suspense, lazy } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Dropdown, notification } from 'antd';
import { SettingOutlined } from '@ant-design/icons';
import FileExplorer from './FileExplorer';
import SearchBox from './components/SearchBox';
import CommandPalette from './components/CommandPalette';
import { useCommandPalette } from '../hooks/useCommandPalette';
import { healthApi } from '../api';
import { formatHealthIssues, isHealthUrgent } from '../lib/healthUtils';
import { useThemeStore } from '../stores/themeStore';

const WorkspacePage = lazy(() => import('../features/workspace/WorkspacePage'));

const navItems = [
  { key: '/workspace', icon: 'smart_toy', label: '工作区' },
  { key: '/projects', icon: 'folder_open', label: '项目' },
  { key: '/graph', icon: 'schema', label: '图谱' },
  { key: '/timeline', icon: 'calendar_month', label: '时间线' },
  { key: '/data-screen', icon: 'monitoring', label: '数据大屏' },
];

export default function MainLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [filePanelOpen, setFilePanelOpen] = useState(false);
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

  const railW = 52;
  const panelW = 220;
  const filePanelW = filePanelOpen ? panelW : 0;
  const headerLeft = railW + filePanelW;

  return (
    <div style={{
      display: 'flex',
      height: '100vh',
      overflow: 'hidden',
      background: isDark ? 'var(--md-background)' : 'var(--md-surface)',
      fontFamily: 'var(--font-sans)',
    }}>
      {contextHolder}

      {/* ── Icon Rail ── */}
      <nav
        aria-label="主导航"
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: railW,
          height: '100vh',
          zIndex: 50,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          padding: '10px 0',
          gap: 6,
          background: 'linear-gradient(180deg, #1e293b 0%, #0f172a 100%)',
          flexShrink: 0,
        }}
      >
        {/* Logo */}
        <div
          onClick={() => navigate('/workspace')}
          style={{
            width: 28,
            height: 28,
            borderRadius: 8,
            background: 'linear-gradient(135deg, var(--color-primary), var(--md-primary-container))',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 10,
            cursor: 'pointer',
            flexShrink: 0,
          }}
          title="DevHub"
        >
          <img src="/icon.png" alt="D" style={{ width: 18, height: 18, borderRadius: 4 }} />
        </div>

        {/* Navigation items */}
        {navItems.map(item => {
          const isActive = activeKey === item.key;
          return (
            <div
              key={item.key}
              onClick={() => navigate(item.key)}
              title={item.label}
              style={{
                width: 36,
                height: 36,
                borderRadius: 8,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                background: isActive ? 'var(--color-primary-light)' : 'transparent',
                borderLeft: isActive ? '2px solid var(--color-primary)' : '2px solid transparent',
              }}
              onMouseEnter={e => {
                if (!isActive) e.currentTarget.style.background = 'rgba(255,255,255,0.08)';
              }}
              onMouseLeave={e => {
                if (!isActive) e.currentTarget.style.background = 'transparent';
              }}
            >
              <span className="material-symbols-outlined" style={{
                fontSize: 18,
                color: isActive ? 'var(--color-primary)' : 'rgba(255,255,255,0.5)',
                transition: 'color 0.15s',
              }}>
                {item.icon}
              </span>
            </div>
          );
        })}

        {/* Spacer */}
        <div style={{ flex: 1 }} />

        {/* File explorer toggle */}
        <div
          onClick={() => setFilePanelOpen(!filePanelOpen)}
          title="文件浏览器"
          style={{
            width: 36,
            height: 36,
            borderRadius: 8,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
            background: filePanelOpen ? 'rgba(245, 158, 11, 0.2)' : 'transparent',
            border: filePanelOpen ? '1px solid rgba(245, 158, 11, 0.4)' : '1px solid transparent',
          }}
          onMouseEnter={e => {
            if (!filePanelOpen) e.currentTarget.style.background = 'rgba(255,255,255,0.08)';
          }}
          onMouseLeave={e => {
            if (!filePanelOpen) e.currentTarget.style.background = filePanelOpen ? 'rgba(245, 158, 11, 0.2)' : 'transparent';
          }}
        >
          <span className="material-symbols-outlined" style={{
            fontSize: 18,
            color: filePanelOpen ? '#fbbf24' : 'rgba(255,255,255,0.5)',
          }}>
            {filePanelOpen ? 'folder_open' : 'folder'}
          </span>
        </div>

        {/* Settings */}
        <div
          onClick={() => navigate('/settings')}
          title="设置"
          style={{
            width: 36,
            height: 36,
            borderRadius: 8,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            marginTop: 4,
            transition: 'all 0.15s ease',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
        >
          <span className="material-symbols-outlined" style={{
            fontSize: 18,
            color: activeKey === '/settings' ? 'var(--color-primary)' : 'rgba(255,255,255,0.5)',
          }}>
            settings
          </span>
        </div>
      </nav>

      {/* ── File Panel ── */}
      <div style={{
        position: 'fixed',
        top: 0,
        left: railW,
        width: panelW,
        height: '100vh',
        zIndex: 45,
        background: isDark ? 'rgba(15, 23, 42, 0.95)' : 'rgba(255, 255, 255, 0.95)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderRight: `1px solid ${isDark ? 'rgba(148,163,184,0.12)' : 'rgba(187, 202, 198, 0.3)'}`,
        transition: 'transform 0.2s ease, opacity 0.2s ease',
        transform: filePanelOpen ? 'translateX(0)' : `translateX(-${panelW}px)`,
        opacity: filePanelOpen ? 1 : 0,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}>
        {/* Panel header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 12px 8px',
          borderBottom: `1px solid ${isDark ? 'rgba(148,163,184,0.08)' : 'rgba(187, 202, 198, 0.2)'}`,
          flexShrink: 0,
        }}>
          <span style={{
            fontSize: 11,
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            color: isDark ? 'rgba(148,163,184,0.6)' : 'rgba(100,116,139,0.7)',
          }}>
            Explorer
          </span>
          <span
            className="material-symbols-outlined"
            onClick={() => setFilePanelOpen(false)}
            style={{
              fontSize: 16,
              color: isDark ? 'rgba(148,163,184,0.4)' : 'rgba(100,116,139,0.5)',
              cursor: 'pointer',
              padding: 2,
              borderRadius: 4,
              transition: 'color 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.color = 'var(--md-on-surface)'; }}
            onMouseLeave={e => { e.currentTarget.style.color = isDark ? 'rgba(148,163,184,0.4)' : 'rgba(100,116,139,0.5)'; }}
          >close</span>
        </div>
        {/* File tree */}
        <div style={{ flex: 1, overflowY: 'auto', scrollbarGutter: 'stable' }}>
          <FileExplorer collapsed={false} />
        </div>
      </div>

      {/* ── Main area ── */}
      <div style={{
        flex: 1,
        marginLeft: headerLeft,
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        overflow: 'hidden',
        transition: 'margin-left 0.2s ease',
      }}>

        {/* ── Topbar ── */}
        <header style={{
          position: 'fixed',
          top: 0,
          right: 0,
          left: headerLeft,
          height: 'var(--layout-topbar-height)',
          zIndex: 40,
          display: 'flex',
          alignItems: 'center',
          padding: '0 16px',
          gap: 12,
          background: isDark ? 'rgba(15, 23, 42, 0.90)' : 'rgba(255, 255, 255, 0.80)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderBottom: `1px solid ${isDark ? 'rgba(148,163,184,0.12)' : 'rgba(187, 202, 198, 0.3)'}`,
          transition: 'left 0.2s ease',
        }}>
          {/* Left: Command Palette input */}
          <div style={{ flex: 1, maxWidth: 400 }}>
            <SearchBox onOpenCommandPalette={openPalette} />
          </div>

          {/* Spacer */}
          <div style={{ flex: 1 }} />

          {/* Right: actions */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {/* Deploy */}
            <button
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '5px 14px',
                borderRadius: 6,
                border: 'none',
                background: 'var(--md-primary)',
                color: 'var(--md-on-primary)',
                cursor: 'pointer',
                fontFamily: 'var(--font-label)',
                fontSize: 12,
                fontWeight: 500,
                letterSpacing: '0.02em',
                transition: 'all 0.15s ease',
                boxShadow: 'var(--shadow-sm)',
              }}
              onMouseEnter={e => { e.currentTarget.style.opacity = '0.9'; }}
              onMouseLeave={e => { e.currentTarget.style.opacity = '1'; }}
            >
              部署
              <span className="material-symbols-outlined" style={{ fontSize: 14 }}>rocket_launch</span>
            </button>

            {/* Notifications */}
            <button
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                width: 36, height: 36, borderRadius: 6, border: 'none',
                background: 'transparent',
                color: isDark ? 'rgba(148,163,184,0.6)' : 'rgba(100,116,139,0.6)',
                cursor: 'pointer', transition: 'all 0.15s ease',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = 'var(--md-surface-container-high)';
                e.currentTarget.style.color = 'var(--md-on-surface)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.color = isDark ? 'rgba(148,163,184,0.6)' : 'rgba(100,116,139,0.6)';
              }}
              title="通知"
            >
              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>notifications</span>
            </button>

            {/* Theme toggle */}
            <button
              onClick={useThemeStore.getState().toggle}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                width: 36, height: 36, borderRadius: 6, border: 'none',
                background: 'transparent',
                color: isDark ? 'rgba(148,163,184,0.6)' : 'rgba(100,116,139,0.6)',
                cursor: 'pointer', transition: 'all 0.15s ease',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = 'var(--md-surface-container-high)';
                e.currentTarget.style.color = 'var(--md-on-surface)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.color = isDark ? 'rgba(148,163,184,0.6)' : 'rgba(100,116,139,0.6)';
              }}
              title={isDark ? '浅色模式' : '深色模式'}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
                {isDark ? 'light_mode' : 'dark_mode'}
              </span>
            </button>

            {/* Divider */}
            <div style={{
              width: 1,
              height: 20,
              background: isDark ? 'rgba(148,163,184,0.15)' : 'rgba(187, 202, 198, 0.4)',
              margin: '0 4px',
            }} />

            {/* User avatar */}
            <Dropdown menu={{ items: userMenuItems }} placement="bottomRight" trigger={['click']}>
              <button
                style={{
                  width: 36, height: 36, borderRadius: '50%', overflow: 'hidden',
                  border: `1px solid ${isDark ? 'rgba(148,163,184,0.15)' : 'rgba(187, 202, 198, 0.4)'}`,
                  cursor: 'pointer',
                  padding: 0,
                  background: 'transparent',
                  transition: 'box-shadow 0.15s ease',
                }}
                onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 0 0 2px var(--color-primary-light)'; }}
                onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none'; }}
                title="用户资料"
              >
                <div style={{
                  width: '100%', height: '100%',
                  background: 'linear-gradient(135deg, var(--md-primary), var(--md-primary-container))',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#fff', fontSize: 11, fontWeight: 700,
                }}>D</div>
              </button>
            </Dropdown>
          </div>
        </header>

        {/* ── Content area ── */}
        <main style={{
          flex: 1,
          marginTop: 'var(--layout-topbar-height)',
          overflow: 'auto',
          position: 'relative',
        }}>
          {location.pathname.startsWith('/workspace') ? <Suspense fallback={null}><WorkspacePage /></Suspense> : <Outlet />}
        </main>
      </div>

      <CommandPalette open={paletteOpen} onClose={closePalette} />
    </div>
  );
}
