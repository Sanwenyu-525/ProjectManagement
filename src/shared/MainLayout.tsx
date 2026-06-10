import { useState, useEffect } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Layout, Menu, Avatar, Dropdown, Input, Modal, List, Tag, Typography } from 'antd';
import {
  DashboardOutlined,
  ProjectOutlined,
  BarChartOutlined,
  UserOutlined,
  FieldTimeOutlined,
  SearchOutlined,
  SettingOutlined,
  CodeOutlined,
} from '@ant-design/icons';
import { useAuthStore } from '../stores/authStore';
import { searchApi } from '../api';
import GlobalTerminalPanel from './GlobalTerminalPanel';
import SearchBox from './components/SearchBox';

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
  const { user } = useAuthStore();
  const [collapsed, setCollapsed] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any>(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [terminalOpen, setTerminalOpen] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setSearchOpen(true);
      }
      if ((e.ctrlKey || e.metaKey) && e.key === '`') {
        e.preventDefault();
        setTerminalOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const userMenuItems = [
    { key: 'settings', icon: <SettingOutlined />, label: '设置', onClick: () => navigate('/settings') },
  ];

  const handleSearch = async (value: string) => {
    if (!value.trim()) { setSearchResults(null); return; }
    setSearchLoading(true);
    try {
      const data = await searchApi.search(value);
      setSearchResults(data);
    } catch { setSearchResults(null); }
    finally { setSearchLoading(false); }
  };

  const selectedKey = menuItems.find(item =>
    item.key === '/' ? location.pathname === '/' : location.pathname.startsWith(item.key)
  )?.key || '/';

  return (
    <Layout className="bg-gradient-main" style={{ minHeight: '100vh', position: 'relative' }}>
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
          <div style={{
            width: 32,
            height: 32,
            borderRadius: 8,
            background: 'linear-gradient(135deg, #22c55e, #16a34a)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            boxShadow: '0 2px 12px rgba(34, 197, 94, 0.2)',
          }}>
            <CodeOutlined style={{ color: '#fff', fontSize: 15 }} />
          </div>
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

      <Layout style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
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
              onClick={() => setTerminalOpen(prev => !prev)}
              title="终端 (Ctrl+`)"
              style={{
                background: terminalOpen ? 'rgba(34, 197, 94, 0.15)' : 'transparent',
                border: terminalOpen ? '1px solid rgba(34, 197, 94, 0.3)' : '1px solid transparent',
                color: terminalOpen ? '#16a34a' : '#6b7a99',
                cursor: 'pointer',
                padding: '6px 10px',
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
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              cursor: 'pointer',
              padding: '6px 12px',
              borderRadius: 8,
              transition: 'background 0.15s ease',
            }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255, 255, 255, 0.4)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              <Avatar
                size={32}
                icon={<UserOutlined />}
                style={{
                  background: 'linear-gradient(135deg, #22c55e, #16a34a)',
                  boxShadow: '0 2px 8px rgba(34, 197, 94, 0.2)',
                }}
              />
              <span style={{ fontSize: 13, fontWeight: 500, color: '#1a1f36' }}>{user!.username}</span>
            </div>
          </Dropdown>
          </div>
        </Header>

        {/* Search modal */}
        <Modal
          title={
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#1a1f36' }}>
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
              {(searchResults.projects?.length || 0) + (searchResults.tasks?.length || 0) + (searchResults.documents?.length || 0) === 0 ? (
                <div style={{ textAlign: 'center', padding: 32, color: '#9eadc0' }}>未找到匹配结果</div>
              ) : (
                <>
                  {searchResults.projects.length > 0 && (
                    <>
                      <Text style={{ display: 'block', marginBottom: 8, color: '#9eadc0', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600 }}>
                        项目 ({searchResults.projects.length})
                      </Text>
                      <List
                        size="small"
                        dataSource={searchResults.projects}
                        renderItem={(item: any) => (
                          <List.Item
                            style={{ cursor: 'pointer', borderRadius: 6, padding: '6px 10px', marginBottom: 2, color: '#1a1f36' }}
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
                      <Text style={{ display: 'block', marginBottom: 8, color: '#9eadc0', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600 }}>
                        任务 ({searchResults.tasks.length})
                      </Text>
                      <List
                        size="small"
                        dataSource={searchResults.tasks}
                        renderItem={(item: any) => (
                          <List.Item
                            style={{ cursor: 'pointer', borderRadius: 6, padding: '6px 10px', marginBottom: 2, color: '#1a1f36' }}
                            onClick={() => { navigate(`/projects/${item.projectId}`); setSearchOpen(false); }}
                          >
                            <Tag color="amber" style={{ borderRadius: 4, fontSize: 11 }}>任务</Tag> {item.title}
                            {item.projectName && <Text style={{ marginLeft: 8, color: '#9eadc0' }}>({item.projectName})</Text>}
                          </List.Item>
                        )}
                        style={{ marginBottom: 16 }}
                      />
                    </>
                  )}
                  {searchResults.documents.length > 0 && (
                    <>
                      <Text style={{ display: 'block', marginBottom: 8, color: '#9eadc0', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600 }}>
                        文档 ({searchResults.documents.length})
                      </Text>
                      <List
                        size="small"
                        dataSource={searchResults.documents}
                        renderItem={(item: any) => (
                          <List.Item
                            style={{ cursor: 'pointer', borderRadius: 6, padding: '6px 10px', marginBottom: 2, color: '#1a1f36' }}
                            onClick={() => { navigate(`/projects/${item.projectId}`); setSearchOpen(false); }}
                          >
                            <Tag style={{ borderRadius: 4, fontSize: 11, background: 'rgba(0, 0, 0, 0.05)', color: '#6b7a99' }}>文档</Tag> {item.title}
                            {item.projectName && <Text style={{ marginLeft: 8, color: '#9eadc0' }}>({item.projectName})</Text>}
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

        <Content style={{
          background: 'transparent',
          flex: 1,
          position: 'relative',
          zIndex: 1,
          overflow: 'auto',
          marginLeft: collapsed ? 64 : 220,
        }}>
          <Outlet />
        </Content>

        {/* Global terminal panel */}
        <div
          style={{
            height: terminalOpen ? 300 : 0,
            transition: 'height 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
            overflow: 'hidden',
            position: 'relative',
            zIndex: 10,
            borderTop: terminalOpen ? '1px solid rgba(255, 255, 255, 0.4)' : 'none',
            flexShrink: 0,
          }}
        >
          <GlobalTerminalPanel visible={terminalOpen} />
        </div>
      </Layout>
    </Layout>
  );
}
