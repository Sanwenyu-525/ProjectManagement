import { useState, useEffect } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Layout, Menu, Avatar, Dropdown, notification } from 'antd';
import {
  ProjectOutlined,
  UserOutlined,
  SettingOutlined,
  AppstoreOutlined,
} from '@ant-design/icons';
import WorkspacePage from './workspace/WorkspacePage';
import SearchBox from './components/SearchBox';
import { healthApi } from '../api';
import { formatHealthIssues, isHealthUrgent } from '../lib/healthUtils';

const { Header, Sider, Content } = Layout;

const menuItems = [
  { key: '/', icon: <AppstoreOutlined />, label: '工作区' },
  { key: '/projects', icon: <ProjectOutlined />, label: '项目管理' },
  { key: '/settings', icon: <SettingOutlined />, label: '设置' },
];

// Routes that render as full-page overlays (not Workspace)
const fullPageRoutes = ['/projects', '/settings', '/git', '/graph', '/timeline', '/data-screen'];

export default function MainLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [notifApi, contextHolder] = notification.useNotification();

  const isFullPage = fullPageRoutes.some(r => location.pathname.startsWith(r));
  const showWorkspace = !isFullPage;

  // Daily project health check — runs once per day on first app open
  useEffect(() => {
    const today = new Date().toLocaleDateString('sv-SE');
    const lastCheck = localStorage.getItem('lastHealthCheckDate');
    if (lastCheck === today) return;

    healthApi.runAll().then(({ results, changedProjects }) => {
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
          {/* Left spacer */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }} />

          {/* Search - center */}
          <div style={{
            flex: 1,
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
          }}>
            <SearchBox />
          </div>

          {/* User menu - right */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
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
          bottom: 0,
          overflow: 'hidden',
          zIndex: 1,
        }}>
          {showWorkspace ? <WorkspacePage /> : <Outlet />}
        </Content>
      </Layout>
    </Layout>
  );
}
