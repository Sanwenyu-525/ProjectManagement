import { useState, useEffect, useRef } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Layout, Menu, Avatar, Dropdown, notification } from 'antd';
import {
  DashboardOutlined,
  ProjectOutlined,
  BarChartOutlined,
  UserOutlined,
  FieldTimeOutlined,
  SettingOutlined,
  ShareAltOutlined,
  BranchesOutlined,
  CodeOutlined,
  AppstoreOutlined,
} from '@ant-design/icons';
import { useTerminalStore } from '../stores/terminalStore';
import TerminalManager from './TerminalManager';
import WorkspacePreview from './workspace/WorkspacePreview';
import SearchBox from './components/SearchBox';
import { healthApi } from '../api';
import { formatHealthIssues, isHealthUrgent } from '../lib/healthUtils';

const { Header, Sider, Content } = Layout;

const menuItems = [
  { key: '/', icon: <DashboardOutlined />, label: '仪表盘' },
  { key: '/projects', icon: <ProjectOutlined />, label: '项目管理' },
  { key: '/git', icon: <BranchesOutlined />, label: 'Git 控制中心' },
  { key: '/graph', icon: <ShareAltOutlined />, label: '关系图' },
  { key: '/timeline', icon: <FieldTimeOutlined />, label: '活动时间线' },
  { key: '/data-screen', icon: <BarChartOutlined />, label: '数据大屏' },
  { key: '/settings', icon: <SettingOutlined />, label: '设置' },
];

export default function MainLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const terminalOpen = useTerminalStore(s => s.terminalOpen);
  const setTerminalOpen = useTerminalStore(s => s.setTerminalOpen);
  const consumeLaunchRequest = useTerminalStore(s => s.consumeLaunchRequest);
  const [terminalHeight, setTerminalHeight] = useState(400);
  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef({ dragging: false, startY: 0, startHeight: 0 });
  const [notifApi, contextHolder] = notification.useNotification();
  const [workspaceMode, setWorkspaceMode] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === '`') {
        e.preventDefault();
        setTerminalOpen(!terminalOpen);
        if (!terminalOpen) setWorkspaceMode(false);
      }
      // Ctrl+Shift+` to toggle workspace mode
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === '~') {
        e.preventDefault();
        setWorkspaceMode(prev => !prev);
        if (!terminalOpen) setTerminalOpen(true);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [terminalOpen, setTerminalOpen]);

  // Daily project health check — runs once per day on first app open
  useEffect(() => {
    const today = new Date().toLocaleDateString('sv-SE');
    const lastCheck = localStorage.getItem('lastHealthCheckDate');
    if (lastCheck === today) return;

    healthApi.runAll().then(({ changedProjects }) => {
      localStorage.setItem('lastHealthCheckDate', today);
      if (!changedProjects || changedProjects.length === 0) return;

      // Summary notification
      notifApi.info({
        message: '项目健康检查完成',
        description: `检测到 ${changedProjects.length} 个项目有变化`,
        duration: 10,
        onClick: () => navigate('/projects'),
      });

      // Per-project notifications
      changedProjects.forEach((p: any) => {
        const issues = formatHealthIssues(p);
        if (issues.length > 0) {
          const severity = isHealthUrgent(p) ? 'warning' : 'info';
          notifApi[severity]({
            message: p.projectName,
            description: issues.join('；'),
            duration: 8,
            onClick: () => navigate(`/projects/${p.projectId}`),
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

  // Terminal drag-to-resize handlers
  const handleDragStart = (e: React.MouseEvent) => {
    e.preventDefault();
    dragRef.current = { dragging: true, startY: e.clientY, startHeight: terminalHeight };
    setIsDragging(true);
    document.body.style.cursor = 'row-resize';
    document.body.style.userSelect = 'none';

    const handleDragMove = (ev: MouseEvent) => {
      if (!dragRef.current.dragging) return;
      const delta = dragRef.current.startY - ev.clientY;
      const newHeight = Math.min(Math.max(dragRef.current.startHeight + delta, 150), window.innerHeight * 0.7);
      setTerminalHeight(newHeight);
    };

    const handleDragEnd = () => {
      dragRef.current.dragging = false;
      setIsDragging(false);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      document.removeEventListener('mousemove', handleDragMove);
      document.removeEventListener('mouseup', handleDragEnd);
    };

    document.addEventListener('mousemove', handleDragMove);
    document.addEventListener('mouseup', handleDragEnd);
  };

  const selectedKey = menuItems.find(item =>
    item.key === '/' ? location.pathname === '/' : location.pathname.startsWith(item.key)
  )?.key || '/';

  return (
    <Layout className="bg-gradient-main" style={{ minHeight: '100vh', position: 'relative' }}>
      {contextHolder}
      <Sider
        collapsible
        collapsed={collapsed}
        onCollapse={setCollapsed}
        width={220}
        collapsedWidth={64}
        style={{
          background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.25) 0%, rgba(255, 255, 255, 0.15) 100%), rgba(255, 255, 255, 0.3)',
          borderRight: '1px solid rgba(255, 255, 255, 0.45)',
          backdropFilter: 'blur(20px) saturate(1.8)',
          WebkitBackdropFilter: 'blur(20px) saturate(1.8)',
          position: 'fixed',
          top: 0,
          left: 0,
          height: '100vh',
          zIndex: 10,
          boxShadow: 'inset -1px 0 0 rgba(255, 255, 255, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.3), 0 4px 16px rgba(0, 0, 0, 0.06)',
        }}
      >
        {/* Logo */}
        <div
          style={{
            height: 64,
            display: 'flex',
            alignItems: 'center',
            justifyContent: collapsed ? 'center' : 'flex-start',
            padding: collapsed ? 0 : '0 20px',
            borderBottom: '1px solid rgba(0, 0, 0, 0.06)',
            gap: 10,
            cursor: 'pointer',
          }}
          onClick={() => navigate('/')}
        >
          <img
            src="/icon.png"
            alt="DevHub"
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              flexShrink: 0,
            }}
          />
          {!collapsed && (
            <span style={{
              color: '#1a1f36',
              fontSize: 16,
              fontWeight: 700,
              fontFamily: "'Fira Code', monospace",
              letterSpacing: '-0.3px',
            }}>
              DevHub
            </span>
          )}
        </div>
        <Menu
          mode="inline"
          selectedKeys={[selectedKey]}
          items={menuItems}
          onClick={({ key }) => navigate(key)}
          style={{ borderRight: 'none', marginTop: 8 }}
        />
      </Sider>

      <Layout style={{ flex: 1, marginLeft: collapsed ? 64 : 220, height: '100vh', overflow: 'hidden', position: 'relative' }}>
        <Header style={{
          background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.2) 0%, rgba(255, 255, 255, 0.12) 100%), rgba(255, 255, 255, 0.25)',
          padding: '0 24px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderBottom: '1px solid rgba(255, 255, 255, 0.45)',
          height: 64,
          lineHeight: '64px',
          backdropFilter: 'blur(20px) saturate(1.8)',
          WebkitBackdropFilter: 'blur(20px) saturate(1.8)',
          position: 'relative',
          zIndex: 10,
          boxShadow: 'inset 0 -1px 0 rgba(255, 255, 255, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.3), 0 4px 12px rgba(0, 0, 0, 0.06)',
          flexWrap: 'nowrap',
          flexShrink: 0,
        }}>
          {/* Logo和菜单 - 左侧 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {/* Logo已在Sider中，这里不需要添加 */}
          </div>

          {/* 搜索框 - 中间 */}
          <div style={{
            flex: 1,
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
          }}>
            <SearchBox />
          </div>

          {/* 用户菜单 - 右侧 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              onClick={() => {
                setWorkspaceMode(true);
                if (!terminalOpen) setTerminalOpen(true);
              }}
              title="工作区 (Ctrl+Shift+`)"
              aria-label="工作区"
              aria-pressed={workspaceMode && terminalOpen}
              style={{
                background: workspaceMode && terminalOpen ? 'rgba(99, 102, 241, 0.15)' : 'transparent',
                border: workspaceMode && terminalOpen ? '1px solid rgba(99, 102, 241, 0.3)' : '1px solid transparent',
                color: workspaceMode && terminalOpen ? '#6366f1' : '#6b7a99',
                cursor: 'pointer',
                padding: '8px 14px',
                borderRadius: 8,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                fontSize: 12,
                fontWeight: 500,
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={e => { if (!workspaceMode || !terminalOpen) { e.currentTarget.style.background = 'rgba(99, 102, 241, 0.15)'; e.currentTarget.style.color = '#6366f1'; } }}
              onMouseLeave={e => { if (!workspaceMode || !terminalOpen) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#6b7a99'; } }}
            >
              <AppstoreOutlined style={{ fontSize: 14 }} />
              <span>工作区</span>
            </button>
            <button
              onClick={() => {
                setWorkspaceMode(false);
                setTerminalOpen(!terminalOpen);
              }}
              title="终端 (Ctrl+`)"
              aria-label="终端"
              aria-pressed={terminalOpen}
              style={{
                background: terminalOpen ? 'rgba(34, 197, 94, 0.15)' : 'transparent',
                border: terminalOpen ? '1px solid rgba(34, 197, 94, 0.3)' : '1px solid transparent',
                color: terminalOpen ? '#16a34a' : '#6b7a99',
                cursor: 'pointer',
                padding: '8px 14px',
                borderRadius: 8,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                fontSize: 12,
                fontWeight: 500,
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(34, 197, 94, 0.15)'; e.currentTarget.style.color = '#16a34a'; }}
              onMouseLeave={e => { e.currentTarget.style.background = terminalOpen ? 'rgba(34, 197, 94, 0.15)' : 'transparent'; e.currentTarget.style.color = terminalOpen ? '#16a34a' : '#6b7a99'; }}
            >
              <CodeOutlined style={{ fontSize: 14 }} />
              <span>终端</span>
            </button>
          <Dropdown menu={{ items: userMenuItems }} placement="bottomRight" trigger={['click']}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                cursor: 'pointer',
                padding: '6px 10px',
                borderRadius: 8,
                border: '1px solid transparent',
                background: 'transparent',
                color: '#1a1f36',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = 'rgba(34, 197, 94, 0.15)';
                e.currentTarget.style.borderColor = 'rgba(34, 197, 94, 0.3)';
                e.currentTarget.style.color = '#16a34a';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.borderColor = 'transparent';
                e.currentTarget.style.color = '#1a1f36';
              }}
            >
              <Avatar
                size={36}
                icon={<UserOutlined />}
                style={{
                  background: 'linear-gradient(135deg, #22c55e, #16a34a)',
                  boxShadow: '0 2px 8px rgba(34, 197, 94, 0.2)',
                }}
              />
              <span style={{ fontSize: 13, fontWeight: 500, color: '#1a1f36' }}>开发者</span>
            </div>
          </Dropdown>
          </div>
        </Header>

        <Content style={{
          background: 'transparent',
          flex: 1,
          position: 'absolute',
          top: 64,
          left: 0,
          right: 0,
          bottom: terminalOpen ? terminalHeight : 0,
          overflow: 'auto',
          zIndex: 1,
          transition: isDragging ? 'none' : 'bottom 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
        }}>
          <Outlet />
        </Content>

        {/* Global terminal panel — absolute bottom, overlays content */}
        <div
          onMouseDown={e => {
            const rect = e.currentTarget.getBoundingClientRect();
            if (e.clientY - rect.top <= 4) handleDragStart(e);
          }}
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: terminalOpen ? terminalHeight : 0,
            transition: isDragging ? 'none' : 'height 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
            overflow: 'hidden',
            zIndex: 10,
            borderTop: terminalOpen ? '3px solid rgba(255, 255, 255, 0.25)' : 'none',
            background: '#1a1b26',
          }}
        >
          {/* Hover cursor zone — only for showing row-resize cursor */}
          {terminalOpen && (
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 6, cursor: 'row-resize', zIndex: 12 }} />
          )}
          <TerminalManager visible={terminalOpen && !workspaceMode} consumeLaunchRequest={consumeLaunchRequest} />
          {workspaceMode && <WorkspacePreview />}
        </div>
      </Layout>
    </Layout>
  );
}
