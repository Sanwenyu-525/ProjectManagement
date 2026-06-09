import { useState, useEffect } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Layout, Menu, Avatar, Dropdown, Spin, Input, Modal, List, Tag, Typography } from 'antd';
import {
  DashboardOutlined,
  ProjectOutlined,
  BarChartOutlined,
  UserOutlined,
  LogoutOutlined,
  FieldTimeOutlined,
  SearchOutlined,
  SettingOutlined,
  CodeOutlined,
} from '@ant-design/icons';
import { useAuthStore } from '../stores/authStore';
import { searchApi } from '../api';

const { Header, Sider, Content } = Layout;
const { Text } = Typography;

const menuItems = [
  { key: '/', icon: <DashboardOutlined />, label: '仪表盘' },
  { key: '/projects', icon: <ProjectOutlined />, label: '项目管理' },
  { key: '/timeline', icon: <FieldTimeOutlined />, label: '活动时间线' },
  { key: '/data-screen', icon: <BarChartOutlined />, label: '数据大屏' },
];

export default function MainLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, loading, logout } = useAuthStore();
  const [collapsed, setCollapsed] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any>(null);
  const [searchLoading, setSearchLoading] = useState(false);

  useEffect(() => {
    if (!loading && !user) navigate('/login');
  }, [loading, user, navigate]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  if (loading || !user) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: '#0b0f1a' }}>
        <Spin size="large" />
      </div>
    );
  }

  const userMenuItems = [
    { key: 'settings', icon: <SettingOutlined />, label: '设置', onClick: () => navigate('/settings') },
    { type: 'divider' as const },
    { key: 'logout', icon: <LogoutOutlined />, label: '退出登录', danger: true, onClick: () => { logout(); navigate('/login'); } },
  ];

  const handleSearch = async (value: string) => {
    if (!value.trim()) { setSearchResults(null); return; }
    setSearchLoading(true);
    try {
      const res = await searchApi.search(value);
      setSearchResults(res.data.data);
    } catch { setSearchResults(null); }
    finally { setSearchLoading(false); }
  };

  const selectedKey = menuItems.find(item =>
    item.key === '/' ? location.pathname === '/' : location.pathname.startsWith(item.key)
  )?.key || '/';

  return (
    <Layout style={{ minHeight: '100vh', background: '#0b0f1a' }}>
      <Sider
        collapsible
        collapsed={collapsed}
        onCollapse={setCollapsed}
        width={220}
        collapsedWidth={64}
        style={{ background: '#111827', borderRight: '1px solid #1e293b' }}
      >
        {/* Logo */}
        <div
          style={{
            height: 64,
            display: 'flex',
            alignItems: 'center',
            justifyContent: collapsed ? 'center' : 'flex-start',
            padding: collapsed ? 0 : '0 20px',
            borderBottom: '1px solid #1e293b',
            gap: 10,
            cursor: 'pointer',
          }}
          onClick={() => navigate('/')}
        >
          <div style={{
            width: 32,
            height: 32,
            borderRadius: 8,
            background: 'linear-gradient(135deg, #22c55e, #16a34a)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            boxShadow: '0 0 12px rgba(34, 197, 94, 0.3)',
          }}>
            <CodeOutlined style={{ color: '#fff', fontSize: 15 }} />
          </div>
          {!collapsed && (
            <span style={{
              color: '#f1f5f9',
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

      <Layout>
        <Header style={{
          background: '#111827',
          padding: '0 24px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderBottom: '1px solid #1e293b',
          height: 64,
          lineHeight: '64px',
        }}>
          <Input
            placeholder="搜索项目、任务、文档..."
            prefix={<SearchOutlined style={{ color: '#475569' }} />}
            suffix={
              <kbd style={{
                fontSize: 11,
                color: '#475569',
                background: '#1e293b',
                padding: '2px 6px',
                borderRadius: 4,
                border: '1px solid #2d3a52',
                fontFamily: "'Fira Code', monospace",
              }}>⌘K</kbd>
            }
            style={{ maxWidth: 360, background: '#0b0f1a', borderRadius: 8 }}
            onClick={() => setSearchOpen(true)}
            readOnly
          />
          <Dropdown menu={{ items: userMenuItems }} placement="bottomRight" trigger={['click']}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              cursor: 'pointer',
              padding: '6px 12px',
              borderRadius: 8,
              transition: 'background 0.15s ease',
            }}
              onMouseEnter={e => (e.currentTarget.style.background = '#1a2235')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              <Avatar
                size={32}
                icon={<UserOutlined />}
                style={{
                  background: 'linear-gradient(135deg, #22c55e, #16a34a)',
                  boxShadow: '0 0 8px rgba(34, 197, 94, 0.3)',
                }}
              />
              <span style={{ fontSize: 13, fontWeight: 500, color: '#f1f5f9' }}>{user.username}</span>
            </div>
          </Dropdown>
        </Header>

        {/* Search modal */}
        <Modal
          title={
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#f1f5f9' }}>
              <SearchOutlined style={{ color: '#22c55e' }} />
              <span style={{ fontWeight: 600 }}>全局搜索</span>
            </div>
          }
          open={searchOpen}
          onCancel={() => { setSearchOpen(false); setSearchQuery(''); setSearchResults(null); }}
          footer={null}
          width={520}
        >
          <Input.Search
            placeholder="输入关键词搜索..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            onSearch={handleSearch}
            loading={searchLoading}
            size="large"
            style={{ marginBottom: 16, borderRadius: 8 }}
            autoFocus
          />
          {searchResults && (
            <div>
              {searchResults.total === 0 ? (
                <div style={{ textAlign: 'center', padding: 32, color: '#64748b' }}>未找到匹配结果</div>
              ) : (
                <>
                  {searchResults.projects.length > 0 && (
                    <>
                      <Text style={{ display: 'block', marginBottom: 8, color: '#64748b', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600 }}>
                        项目 ({searchResults.projects.length})
                      </Text>
                      <List
                        size="small"
                        dataSource={searchResults.projects}
                        renderItem={(item: any) => (
                          <List.Item
                            style={{ cursor: 'pointer', borderRadius: 6, padding: '6px 10px', marginBottom: 2, color: '#f1f5f9' }}
                            onClick={() => { navigate(`/projects/${item.id}`); setSearchOpen(false); }}
                          >
                            <Tag color="green" style={{ borderRadius: 4, fontSize: 11 }}>项目</Tag> {item.name}
                          </List.Item>
                        )}
                        style={{ marginBottom: 16 }}
                      />
                    </>
                  )}
                  {searchResults.tasks.length > 0 && (
                    <>
                      <Text style={{ display: 'block', marginBottom: 8, color: '#64748b', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600 }}>
                        任务 ({searchResults.tasks.length})
                      </Text>
                      <List
                        size="small"
                        dataSource={searchResults.tasks}
                        renderItem={(item: any) => (
                          <List.Item
                            style={{ cursor: 'pointer', borderRadius: 6, padding: '6px 10px', marginBottom: 2, color: '#f1f5f9' }}
                            onClick={() => { navigate(`/projects/${item.projectId}`); setSearchOpen(false); }}
                          >
                            <Tag color="amber" style={{ borderRadius: 4, fontSize: 11 }}>任务</Tag> {item.title}
                            <Text style={{ marginLeft: 8, color: '#64748b' }}>({item.project?.name})</Text>
                          </List.Item>
                        )}
                        style={{ marginBottom: 16 }}
                      />
                    </>
                  )}
                  {searchResults.documents.length > 0 && (
                    <>
                      <Text style={{ display: 'block', marginBottom: 8, color: '#64748b', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600 }}>
                        文档 ({searchResults.documents.length})
                      </Text>
                      <List
                        size="small"
                        dataSource={searchResults.documents}
                        renderItem={(item: any) => (
                          <List.Item
                            style={{ cursor: 'pointer', borderRadius: 6, padding: '6px 10px', marginBottom: 2, color: '#f1f5f9' }}
                            onClick={() => { navigate(`/projects/${item.projectId}`); setSearchOpen(false); }}
                          >
                            <Tag style={{ borderRadius: 4, fontSize: 11, background: '#1e293b', color: '#94a3b8' }}>文档</Tag> {item.title}
                            <Text style={{ marginLeft: 8, color: '#64748b' }}>({item.project?.name})</Text>
                          </List.Item>
                        )}
                      />
                    </>
                  )}
                </>
              )}
            </div>
          )}
        </Modal>

        <Content style={{ background: '#0b0f1a', minHeight: 'calc(100vh - 64px)' }}>
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
}
