import { useState, useEffect, useRef, useCallback, Suspense, lazy } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { SwitchTransition, CSSTransition } from 'react-transition-group';
import { Dropdown, notification } from 'antd';
import { SettingOutlined } from '@ant-design/icons';
import SearchBox from './components/SearchBox';
import ShortcutsModal from './ShortcutsModal';
import { useThemeStore } from '../stores/themeStore';
import { useGlobalEditorStore } from '../stores/globalEditorStore';
import { COMMANDS, matchesShortcut, setCommandNavigate, setToggleFilePanel } from '../lib/commands';
import type { FileExplorerHandle } from './FileExplorer';

// Lazy-load heavy components — only needed when panels are open
const FileExplorer = lazy(() => import('./FileExplorer'));
const CodeEditorPane = lazy(() => import('../features/workspace/editor/CodeEditorPane'));

const WorkspacePage = lazy(() => import('../features/workspace/WorkspacePage'));

const navItems = [
  { key: '/workspace', icon: 'smart_toy', label: '工作区' },
  { key: '__file-explorer', icon: 'folder', label: '文件浏览器' },
  { key: '/projects', icon: 'dashboard', label: '项目' },
  { key: '/timeline', icon: 'calendar_month', label: '时间线' },
  { key: '/data-screen', icon: 'monitoring', label: '数据大屏' },
  { key: '/knowledge', icon: 'menu_book', label: '知识库' },
  { key: '/graph', icon: 'hub', label: '图谱' },
];

export default function MainLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [filePanelOpen, setFilePanelOpen] = useState(false);
  const fileExplorerRef = useRef<FileExplorerHandle>(null);
  const isDark = useThemeStore(s => s.mode === 'dark');
  const [notifApi, contextHolder] = notification.useNotification();
  const shortcutsModalOpen = useThemeStore(s => s.shortcutsModalOpen);
  const toggleShortcutsModal = useThemeStore(s => s.toggleShortcutsModal);
  const setShortcutsModalOpen = useThemeStore(s => s.setShortcutsModalOpen);

  // Register navigate bridge for command palette
  useEffect(() => {
    setCommandNavigate(navigate);
  }, [navigate]);

  // Register file panel toggle bridge
  useEffect(() => {
    setToggleFilePanel(() => setFilePanelOpen(prev => !prev));
  }, []);

  // Global keyboard shortcuts — ? handled locally, Ctrl+ via command registry
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // ? — open shortcuts panel (skip if in input)
      const tag = (e.target as HTMLElement).tagName;
      const isInput = tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement).isContentEditable;
      if (e.key === '?' && !e.ctrlKey && !e.metaKey && !isInput) {
        e.preventDefault();
        toggleShortcutsModal();
        return;
      }
      // Ctrl+ shortcuts via command registry
      for (const cmd of COMMANDS) {
        if (cmd.keys && matchesShortcut(e, cmd)) {
          e.preventDefault();
          cmd.action();
          return;
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [navigate, toggleShortcutsModal]);

  // Auto-collapse file panel on narrow viewports to prevent covering content
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 768 && filePanelOpen) {
        setFilePanelOpen(false);
      }
    };
    window.addEventListener('resize', handleResize);
    // Also check on mount
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
  }, [filePanelOpen]);

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

    // Defer health check — let first paint complete before heavy IPC
    const id = setTimeout(runHealthCheck, 3000);
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

  const railW = 48;
  const [filePanelWidth, setFilePanelWidth] = useState(() => {
    const stored = localStorage.getItem('devhub_filePanelWidth');
    return stored ? Math.min(500, Math.max(160, Number(stored))) : 220;
  });

  const [filePanelDragging, setFilePanelDragging] = useState(false);
  const filePanelW = filePanelOpen ? filePanelWidth : 0;
  const headerLeft = railW + filePanelW;

  const handleFilePanelDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setFilePanelDragging(true);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    const startX = e.clientX;
    const startWidth = filePanelWidth;
    const widthRef = { current: filePanelWidth };

    const onMouseMove = (ev: MouseEvent) => {
      const delta = ev.clientX - startX;
      const newWidth = Math.min(500, Math.max(160, startWidth + delta));
      widthRef.current = newWidth;
      setFilePanelWidth(newWidth);
    };
    const onMouseUp = () => {
      setFilePanelDragging(false);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      localStorage.setItem('devhub_filePanelWidth', String(widthRef.current));
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  }, [filePanelWidth]);

  // ── Global Editor Drawer (right side) ──
  const editorDrawerOpen = useGlobalEditorStore(s => s.drawerOpen);
  const setEditorDrawerOpen = useGlobalEditorStore(s => s.setDrawerOpen);
  const [editorDrawerWidth, setEditorDrawerWidth] = useState(() => {
    const stored = localStorage.getItem('devhub_globalEditorWidth');
    return stored ? Math.min(800, Math.max(300, Number(stored))) : 500;
  });

  const [editorDrawerDragging, setEditorDrawerDragging] = useState(false);
  const [editorDrawerHover, setEditorDrawerHover] = useState(false);
  const editorDrawerW = editorDrawerOpen ? editorDrawerWidth : 0;

  // Escape key to close editor drawer
  useEffect(() => {
    if (!editorDrawerOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setEditorDrawerOpen(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [editorDrawerOpen, setEditorDrawerOpen]);

  // Auto-collapse editor drawer on narrow viewports
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 768 && editorDrawerOpen) {
        setEditorDrawerOpen(false);
      }
    };
    window.addEventListener('resize', handleResize);
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
  }, [editorDrawerOpen, setEditorDrawerOpen]);

  const handleEditorDrawerDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setEditorDrawerDragging(true);
    const startX = e.clientX;
    const startWidth = editorDrawerWidth;
    const widthRef = { current: editorDrawerWidth };

    const onMouseMove = (ev: MouseEvent) => {
      const delta = ev.clientX - startX;
      const newWidth = Math.min(800, Math.max(300, startWidth + delta));
      widthRef.current = newWidth;
      setEditorDrawerWidth(newWidth);
    };
    const onMouseUp = () => {
      setEditorDrawerDragging(false);
      localStorage.setItem('devhub_globalEditorWidth', String(widthRef.current));
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  }, [editorDrawerWidth]);

  return (
    <div style={{
      display: 'flex',
      height: '100vh',
      overflow: 'hidden',
      background: isDark ? 'var(--md-background)' : 'var(--md-surface)',
      fontFamily: 'var(--font-sans)',
    }}>
      {contextHolder}
      <ShortcutsModal open={shortcutsModalOpen} onClose={() => setShortcutsModalOpen(false)} />

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
          fontSize: 'var(--text-sm)',
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
          background: 'linear-gradient(180deg, var(--color-rail-start) 0%, var(--color-rail-end) 100%)',
          boxShadow: `1px 0 0 ${isDark || filePanelOpen ? 'transparent' : 'var(--color-divider)'}`,
          transition: 'box-shadow 0.2s ease',
          flexShrink: 0,
        }}
      >
        {/* Navigation items */}
        {navItems.map(item => {
          const isFileExplorer = item.key === '__file-explorer';
          const isActive = isFileExplorer ? filePanelOpen : activeKey === item.key;
          const handleNavClick = () => isFileExplorer ? setFilePanelOpen(!filePanelOpen) : navigate(item.key);
          const handleNavKey = (e: React.KeyboardEvent) => {
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleNavClick(); }
          };
          const handleFocus = (e: React.FocusEvent<HTMLDivElement>) => {
            if (!isActive) e.currentTarget.style.background = isDark ? 'var(--ws-hover)' : 'var(--color-primary-light)';
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
                borderRadius: 10,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                background: isActive
                  ? (isFileExplorer ? 'var(--color-amber-light)' : 'var(--color-primary-light)')
                  : 'transparent',
                outline: 'none',
              }}
              onMouseEnter={e => {
                if (!isActive) e.currentTarget.style.background = isDark ? 'var(--ws-hover)' : 'var(--color-primary-light)';
              }}
              onMouseLeave={e => {
                if (!isActive) e.currentTarget.style.background = 'transparent';
              }}
            >
              <span className="material-symbols-outlined" aria-hidden="true" style={{
                fontSize: 18,
                color: isActive
                  ? (isFileExplorer ? '#f59e0b' : 'var(--color-primary)')
                  : (isDark ? 'var(--ws-icon-muted)' : 'var(--color-text-tertiary)'),
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
          onMouseEnter={e => { e.currentTarget.style.background = isDark ? 'var(--ws-hover)' : 'var(--color-primary-light)'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
        >
          <span className="material-symbols-outlined" aria-hidden="true" style={{
            fontSize: 18,
            color: activeKey === '/settings' ? 'var(--color-primary)' : (isDark ? 'var(--ws-icon-muted)' : 'var(--color-text-muted)'),
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
        zIndex: 47,
        background: 'var(--color-file-panel)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderRight: '1px solid var(--color-border)',
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
          borderBottom: '1px solid var(--color-divider)',
          flexShrink: 0,
        }}>
          <span style={{
            fontSize: 'var(--text-xs)',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            color: isDark ? 'var(--ws-text-tertiary)' : 'var(--color-text-tertiary)',
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
                color: isDark ? 'var(--ws-icon-muted)' : 'var(--color-text-tertiary)',
                cursor: 'pointer',
                padding: 2,
                borderRadius: 4,
                transition: 'color 0.15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.color = 'var(--md-primary)'; }}
              onMouseLeave={e => { e.currentTarget.style.color = isDark ? 'var(--ws-icon-muted)' : 'var(--color-text-tertiary)'; }}
            >add</span>
            <span
              className="material-symbols-outlined"
              onClick={() => setFilePanelOpen(false)}
              style={{
                fontSize: 16,
                color: isDark ? 'var(--ws-icon-muted)' : 'var(--color-text-tertiary)',
                cursor: 'pointer',
                padding: 2,
                borderRadius: 4,
                transition: 'color 0.15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.color = 'var(--md-on-surface)'; }}
              onMouseLeave={e => { e.currentTarget.style.color = isDark ? 'var(--ws-icon-muted)' : 'var(--color-text-tertiary)'; }}
            >close</span>
          </div>
        </div>
        {/* File tree */}
        <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>
          <Suspense fallback={null}>
            <FileExplorer collapsed={false} ref={fileExplorerRef} />
          </Suspense>
        </div>

        {/* Drag handle — VS Code style */}
        <div
          className={`resize-handle resize-handle--right${filePanelDragging ? ' is-active' : ''}`}
          onMouseDown={handleFilePanelDragStart}
          onDoubleClick={() => {
            setFilePanelWidth(220);
            localStorage.setItem('devhub_filePanelWidth', '220');
          }}
        />
      </div>

      {/* ── Main area ── */}
      <div style={{
        flex: 1,
        marginLeft: headerLeft + editorDrawerW,
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        overflow: 'hidden',
        transition: 'margin-left 0.2s ease',
        position: 'relative',
        zIndex: 46,
      }}>

        {/* ── Topbar ── */}
        <header style={{
          position: 'fixed',
          top: 0,
          right: 0,
          left: headerLeft + editorDrawerW,
          height: 'var(--layout-topbar-height)',
          zIndex: 40,
          display: 'flex',
          alignItems: 'center',
          padding: '0 16px',
          gap: 12,
          background: 'var(--color-bg-glass-header)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderBottom: '1px solid var(--color-divider)',
          transition: 'left 0.2s ease',
        }}>
          {/* Center: Command Palette input — absolute centered in full header width */}
          <div style={{
            position: 'absolute',
            left: '50%',
            transform: 'translateX(-50%)',
            width: '100%',
            maxWidth: 500,
            padding: '0 16px',
            boxSizing: 'border-box',
            pointerEvents: 'none',
          }}>
            <div style={{ pointerEvents: 'auto' }}>
              <SearchBox />
            </div>
          </div>

          {/* Right: actions */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 'auto', position: 'relative', zIndex: 1 }}>
            {/* Deploy — placeholder, not yet functional */}
            <button
              disabled
              title="部署功能即将上线"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '5px 14px',
                borderRadius: 6,
                border: 'none',
                background: 'var(--md-primary)',
                color: 'var(--md-on-primary)',
                cursor: 'not-allowed',
                fontFamily: 'var(--font-label)',
                fontSize: 'var(--text-sm)',
                fontWeight: 500,
                letterSpacing: '0.02em',
                opacity: 0.5,
                boxShadow: 'var(--shadow-sm)',
              }}
            >
              部署
              <span className="material-symbols-outlined" style={{ fontSize: 14 }}>rocket_launch</span>
            </button>

            {/* Notifications — placeholder, not yet functional */}
            <button
              disabled
              title="通知功能即将上线"
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                width: 36, height: 36, borderRadius: 6, border: 'none',
                background: 'transparent',
                color: isDark ? 'var(--ws-text-secondary)' : 'var(--color-text-secondary)',
                cursor: 'not-allowed', opacity: 0.5,
              }}
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
                color: isDark ? 'var(--ws-text-secondary)' : 'var(--color-text-secondary)',
                cursor: 'pointer', transition: 'all 0.15s ease',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = 'var(--md-surface-container-high)';
                e.currentTarget.style.color = 'var(--md-on-surface)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.color = isDark ? 'var(--ws-text-secondary)' : 'var(--color-text-secondary)';
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
              background: 'var(--color-divider)',
              margin: '0 4px',
            }} />

            {/* User avatar */}
            <Dropdown menu={{ items: userMenuItems }} placement="bottomRight" trigger={['click']}>
              <button
                style={{
                  width: 36, height: 36, borderRadius: '50%', overflow: 'hidden',
                  border: '1px solid var(--color-border-subtle)',
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
                  color: 'var(--md-on-primary)', fontSize: 11, fontWeight: 700,
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
            display: 'flex',
            flexDirection: 'column',
            flex: 1,
            minHeight: 0,
            marginTop: 'var(--layout-topbar-height)',
            overflow: location.pathname.startsWith('/workspace') ? 'hidden' : 'auto',
            position: 'relative',
            outline: 'none',
          }}
        >
          {/* WorkspacePage is always mounted to preserve agent conversations; hidden via CSS when inactive */}
          <div style={{ display: location.pathname.startsWith('/workspace') ? 'contents' : 'none' }}>
            <Suspense fallback={null}><WorkspacePage /></Suspense>
          </div>
          {!location.pathname.startsWith('/workspace') && (
            <SwitchTransition>
              <CSSTransition key={location.pathname} classNames="page" timeout={250}>
                <Outlet />
              </CSSTransition>
            </SwitchTransition>
          )}
        </main>
      </div>

      {/* ── Global Editor (between file explorer and content) ── */}
      {editorDrawerOpen && (
      <div style={{
        position: 'fixed',
        top: 0,
        left: headerLeft,
        width: editorDrawerWidth,
        height: '100vh',
        zIndex: 47,
        background: 'var(--color-file-panel)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderRight: '1px solid var(--color-border)',
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
          borderBottom: '1px solid var(--color-divider)',
          flexShrink: 0,
        }}>
          <span style={{
            fontSize: 'var(--text-xs)',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            color: isDark ? 'var(--ws-text-tertiary)' : 'var(--color-text-tertiary)',
          }}>
            Editor
          </span>
          <span
            className="material-symbols-outlined"
            onClick={() => setEditorDrawerOpen(false)}
            style={{
              fontSize: 16,
              color: isDark ? 'var(--ws-icon-muted)' : 'var(--color-text-tertiary)',
              cursor: 'pointer',
              padding: 2,
              borderRadius: 4,
              transition: 'color 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.color = 'var(--md-on-surface)'; }}
            onMouseLeave={e => { e.currentTarget.style.color = isDark ? 'var(--ws-icon-muted)' : 'var(--color-text-tertiary)'; }}
          >close</span>
        </div>
        {/* Editor content */}
        <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <Suspense fallback={null}>
            <CodeEditorPane variant="global" onEmpty={() => setEditorDrawerOpen(false)} />
          </Suspense>
        </div>

        {/* Drag handle — right edge */}
        <div
          onMouseDown={handleEditorDrawerDragStart}
          onDoubleClick={() => {
            setEditorDrawerWidth(500);
            localStorage.setItem('devhub_globalEditorWidth', '500');
          }}
          onMouseEnter={() => setEditorDrawerHover(true)}
          onMouseLeave={() => { if (!editorDrawerDragging) setEditorDrawerHover(false); }}
          style={{
            position: 'absolute',
            top: 0,
            right: 0,
            width: 8,
            height: '100%',
            cursor: 'col-resize',
            zIndex: 10,
            background: 'transparent',
          }}
        >
          <div style={{
            position: 'absolute',
            top: 0,
            right: 0,
            width: editorDrawerHover || editorDrawerDragging ? 1 : 0,
            height: '100%',
            background: editorDrawerDragging
              ? 'var(--color-primary)'
              : 'var(--color-drag-highlight)',
            transition: editorDrawerDragging ? 'none' : 'width 0.15s ease, background 0.15s ease',
          }} />
        </div>
      </div>
      )}

    </div>
  );
}
