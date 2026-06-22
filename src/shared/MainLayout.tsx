import { useState, useEffect, useRef, useCallback, Suspense, lazy } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Dropdown, notification } from 'antd';
import { SettingOutlined } from '@ant-design/icons';
import SearchBox from './components/SearchBox';
import { useCommandPalette } from '../hooks/useCommandPalette';
import { useThemeStore } from '../stores/themeStore';
import type { FileExplorerHandle } from './FileExplorer';

// Lazy-load heavy components — only needed when panels are open
const FileExplorer = lazy(() => import('./FileExplorer'));
const CommandPalette = lazy(() => import('./components/CommandPalette'));

const WorkspacePage = lazy(() => import('../features/workspace/WorkspacePage'));

const navItems = [
  { key: '/workspace', icon: 'smart_toy', label: '工作区' },
  { key: '/projects', icon: 'work', label: '项目' },
  { key: '/timeline', icon: 'calendar_month', label: '时间线' },
  { key: '/data-screen', icon: 'monitoring', label: '数据大屏' },
  { key: '__file-explorer', icon: 'folder', label: '文件浏览器' },
  { key: '/knowledge', icon: 'menu_book', label: '知识库' },
];

export default function MainLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [filePanelOpen, setFilePanelOpen] = useState(false);
  const fileExplorerRef = useRef<FileExplorerHandle>(null);
  const [notifApi, contextHolder] = notification.useNotification();
  const isDark = useThemeStore(s => s.mode === 'dark');
  const { open: paletteOpen, openPalette, closePalette } = useCommandPalette();

  const activeKey = navItems.find(item =>
    item.key !== '__file-explorer' && location.pathname.startsWith(item.key)
  )?.key || '/workspace';

  // Daily project health check — defers to after first paint to avoid blocking UI
  useEffect(() => {
    const today = new Date().toLocaleDateString('sv-SE');
    const lastCheck = localStorage.getItem('lastHealthCheckDate');
    if (lastCheck === today) return;

    const runHealthCheck = async () => {
      const { healthApi } = await import('../api');
      const { formatHealthIssues, isHealthUrgent } = await import('../lib/healthUtils');
      const { results, changedProjects } = await healthApi.runAll();
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
    };

    // Defer to after first paint
    const id = setTimeout(runHealthCheck, 0);
    return () => clearTimeout(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const userMenuItems = [
    { key: 'settings', icon: <SettingOutlined />, label: '设置', onClick: () => navigate('/settings') },
  ];

  // Escape key to close file panel
  useEffect(() => {
    if (!filePanelOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setFilePanelOpen(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [filePanelOpen]);

  const railW = 52;
  const [filePanelWidth, setFilePanelWidth] = useState(220);
  const [filePanelHover, setFilePanelHover] = useState(false);
  const [filePanelDragging, setFilePanelDragging] = useState(false);
  const filePanelW = filePanelOpen ? filePanelWidth : 0;
  const headerLeft = railW + filePanelW;

  const handleFilePanelDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setFilePanelDragging(true);
    const startX = e.clientX;
    const startWidth = filePanelWidth;

    const onMouseMove = (ev: MouseEvent) => {
      const delta = ev.clientX - startX;
      setFilePanelWidth(Math.min(500, Math.max(160, startWidth + delta)));
    };
    const onMouseUp = () => {
      setFilePanelDragging(false);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  }, [filePanelWidth]);

  return (
    <div style={{
      display: 'flex',
      height: '100vh',
      overflow: 'hidden',
      background: isDark ? 'var(--md-background)' : 'var(--md-surface)',
      fontFamily: 'var(--font-sans)',
    }}>
      {contextHolder}

      {/* Skip to content — visible only on keyboard focus */}
      <a
        href="#main-content"
        onClick={e => {
          e.preventDefault();
          document.getElementById('main-content')?.focus();
        }}
        style={{
          position: 'fixed',
          top: -100,
          left: 16,
          zIndex: 200,
          padding: '8px 16px',
          borderRadius: 8,
          background: 'var(--md-primary)',
          color: 'var(--md-on-primary)',
          fontSize: 13,
          fontWeight: 600,
          fontFamily: 'var(--font-sans)',
          textDecoration: 'none',
          transition: 'top 0.15s',
        }}
        onFocus={e => { e.currentTarget.style.top = '8px'; }}
        onBlur={e => { e.currentTarget.style.top = '-100px'; }}
      >
        跳转到内容
      </a>

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
          background: isDark
            ? 'linear-gradient(180deg, #1e293b 0%, #0f172a 100%)'
            : 'linear-gradient(180deg, rgba(230, 237, 245, 0.92) 0%, rgba(220, 228, 240, 0.88) 100%)',
          boxShadow: isDark ? 'none' : '1px 0 0 rgba(0,0,0,0.06)',
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
          const isFileExplorer = item.key === '__file-explorer';
          const isActive = isFileExplorer ? filePanelOpen : activeKey === item.key;
          const handleNavClick = () => isFileExplorer ? setFilePanelOpen(!filePanelOpen) : navigate(item.key);
          const handleNavKey = (e: React.KeyboardEvent) => {
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleNavClick(); }
          };
          const handleFocus = (e: React.FocusEvent<HTMLDivElement>) => {
            if (!isActive) e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)';
          };
          const handleBlur = (e: React.FocusEvent<HTMLDivElement>) => {
            if (!isActive) e.currentTarget.style.background = 'transparent';
          };
          return (
            <div
              key={item.key}
              onClick={handleNavClick}
              onKeyDown={handleNavKey}
              onFocus={handleFocus}
              onBlur={handleBlur}
              tabIndex={0}
              role="button"
              aria-current={isActive && !isFileExplorer ? 'page' : undefined}
              aria-label={item.label}
              title={item.label}
              style={{
                width: 36,
                height: 36,
                borderRadius: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                background: isActive
                  ? (isFileExplorer ? (isDark ? 'rgba(245, 158, 11, 0.2)' : 'rgba(245, 158, 11, 0.12)') : 'var(--color-primary-light)')
                  : 'transparent',
                borderLeft: isFileExplorer
                  ? (isActive ? '1px solid rgba(245, 158, 11, 0.4)' : `1px solid ${isDark ? 'transparent' : 'rgba(0,0,0,0.06)'}`)
                  : (isActive ? '2px solid var(--color-primary)' : '2px solid transparent'),
                border: isFileExplorer
                  ? (isActive ? '1px solid rgba(245, 158, 11, 0.4)' : '1px solid transparent')
                  : undefined,
                outline: 'none',
              }}
              onMouseEnter={e => {
                if (!isActive) e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)';
              }}
              onMouseLeave={e => {
                if (!isActive) e.currentTarget.style.background = 'transparent';
              }}
            >
              <span className="material-symbols-outlined" aria-hidden="true" style={{
                fontSize: 18,
                color: isActive
                  ? (isFileExplorer ? '#f59e0b' : 'var(--color-primary)')
                  : (isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.4)'),
                transition: 'color 0.15s',
              }}>
                {isFileExplorer
                  ? (filePanelOpen ? 'folder_open' : 'folder')
                  : item.icon}
              </span>
            </div>
          );
        })}

        {/* Spacer */}
        <div style={{ flex: 1 }} />

        {/* Settings */}
        <div
          onClick={() => navigate('/settings')}
          onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigate('/settings'); } }}
          tabIndex={0}
          role="button"
          aria-label="设置"
          title="设置"
          style={{
            width: 36,
            height: 36,
            borderRadius: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            marginTop: 4,
            transition: 'all 0.15s ease',
            outline: 'none',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
        >
          <span className="material-symbols-outlined" aria-hidden="true" style={{
            fontSize: 18,
            color: activeKey === '/settings' ? 'var(--color-primary)' : (isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.4)'),
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
        width: filePanelWidth,
        height: '100vh',
        zIndex: 45,
        background: isDark ? 'rgba(15, 23, 42, 0.95)' : 'rgba(255, 255, 255, 0.95)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderRight: `1px solid ${isDark ? 'rgba(148,163,184,0.12)' : 'rgba(187, 202, 198, 0.3)'}`,
        transition: filePanelDragging ? 'none' : 'transform 0.2s ease, opacity 0.2s ease',
        transform: filePanelOpen ? 'translateX(0)' : `translateX(-${filePanelWidth}px)`,
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
          <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <span
              className="material-symbols-outlined"
              onClick={() => fileExplorerRef.current?.openAddDirectory()}
              title="添加目录"
              style={{
                fontSize: 16,
                color: isDark ? 'rgba(148,163,184,0.4)' : 'rgba(100,116,139,0.5)',
                cursor: 'pointer',
                padding: 2,
                borderRadius: 4,
                transition: 'color 0.15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.color = 'var(--md-primary)'; }}
              onMouseLeave={e => { e.currentTarget.style.color = isDark ? 'rgba(148,163,184,0.4)' : 'rgba(100,116,139,0.5)'; }}
            >add</span>
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
        </div>
        {/* File tree */}
        <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', scrollbarGutter: 'stable' }}>
          <Suspense fallback={null}>
            <FileExplorer collapsed={false} ref={fileExplorerRef} />
          </Suspense>
        </div>

        {/* Drag handle — right edge */}
        <div
          onMouseDown={handleFilePanelDragStart}
          onMouseEnter={() => setFilePanelHover(true)}
          onMouseLeave={() => { if (!filePanelDragging) setFilePanelHover(false); }}
          style={{
            position: 'absolute',
            top: 0,
            right: 0,
            width: filePanelHover || filePanelDragging ? 6 : 4,
            height: '100%',
            cursor: 'col-resize',
            background: filePanelHover || filePanelDragging
              ? (isDark ? 'rgba(99, 144, 255, 0.4)' : 'rgba(99, 144, 255, 0.5)')
              : 'transparent',
            transition: filePanelDragging ? 'none' : 'width 0.15s ease, background 0.15s ease',
            zIndex: 10,
          }}
        />
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
        <main
          id="main-content"
          tabIndex={-1}
          style={{
            flex: 1,
            marginTop: 'var(--layout-topbar-height)',
            overflow: 'auto',
            position: 'relative',
            outline: 'none',
          }}
        >
          {location.pathname.startsWith('/workspace') ? <Suspense fallback={null}><WorkspacePage /></Suspense> : <Outlet />}
        </main>
      </div>

      <Suspense fallback={null}>
        <CommandPalette open={paletteOpen} onClose={closePalette} />
      </Suspense>
    </div>
  );
}
