import { useState } from 'react';
import { Form, Input, Button, message, Modal, Select, Tag } from 'antd';
import { SaveOutlined, KeyOutlined, FolderOutlined, UndoOutlined, CheckCircleOutlined } from '@ant-design/icons';
import { useIntegrations, useCreateIntegration, useUpdateIntegration } from '../../hooks/useBuilds';
import { useTerminalStore } from '../../stores/terminalStore';
import { useThemeStore } from '../../stores/themeStore';
import { open } from '@tauri-apps/plugin-dialog';
import { DEFAULT_SHELL, DEFAULT_CWD, SHELL_OPTIONS } from '../../lib/constants';

// ── Sub-navigation structure ──
const navGroups: Array<{
  title: string;
  items: Array<{ key: string; icon: string; label: string; badge?: string }>;
}> = [
  {
    title: '偏好设置',
    items: [
      { key: 'general', icon: 'tune', label: '通用' },
      { key: 'integrations', icon: 'link', label: '平台集成' },
      { key: 'appearance', icon: 'palette', label: '外观' },
      { key: 'workspace-nav', icon: 'workspaces', label: '工作区' },
    ],
  },
  {
    title: 'AI 与智能体',
    items: [
      { key: 'mcp-servers', icon: 'dns', label: 'MCP 服务器', badge: '测试版' },
    ],
  },
  {
    title: '工具',
    items: [
      { key: 'terminal', icon: 'terminal', label: '终端' },
      { key: 'git-tools', icon: 'account_tree', label: 'Git' },
      { key: 'build', icon: 'build', label: '构建' },
      { key: 'data', icon: 'cloud_download', label: '数据管理' },
    ],
  },
];

// ── Settings content panels ──
function GeneralSettings() {
  const isDark = useThemeStore(s => s.mode === 'dark');
  const [defaultCmd, setDefaultCmd] = useState(localStorage.getItem('devhub_default_open_cmd') || 'code {path}');

  const handleSave = () => {
    localStorage.setItem('devhub_default_open_cmd', defaultCmd);
    message.success('设置已保存');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Profile info */}
      <GlassCard isDark={isDark}>
        <CardHeader title="应用信息" />
        <div style={{ padding: '16px 24px 20px' }}>
          <div style={{ display: 'grid', gap: 12 }}>
            <InfoRow label="应用名称" value="DevHub" />
            <InfoRow label="版本" value="v0.1.0" />
            <InfoRow label="模式" value="单用户本地模式" />
          </div>
        </div>
      </GlassCard>

      {/* Platform integrations */}
      <GlassCard isDark={isDark}>
        <CardHeader title="平台集成" />
        <IntegrationSettings />
      </GlassCard>

      {/* Preferences */}
      <GlassCard isDark={isDark}>
        <CardHeader title="偏好设置" />
        <div style={{ padding: '16px 24px 20px' }}>
          <Form layout="vertical">
            <Form.Item label="默认打开命令">
              <Input
                value={defaultCmd}
                onChange={e => setDefaultCmd(e.target.value)}
                placeholder="code {path}"
              />
              <div style={{ color: 'var(--md-on-surface-variant)', fontSize: 12, marginTop: 4 }}>
                {'{path}'} 会被替换为项目本地路径。常用: code {'{path}'}、webstorm {'{path}'}
              </div>
            </Form.Item>
          </Form>
        </div>
      </GlassCard>

      {/* Save bar */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
        <Button icon={<UndoOutlined />}>重置默认</Button>
        <Button type="primary" icon={<SaveOutlined />} onClick={handleSave}>保存设置</Button>
      </div>
    </div>
  );
}

const PLATFORM_META = [
  { name: 'GitHub', description: '同步 GitHub 仓库、提交、PR', color: '#333' },
  { name: 'GitLab', description: '同步 GitLab 仓库、MR、Pipeline', color: '#FC6D26' },
  { name: 'Gitee', description: '同步 Gitee 仓库、提交、PR', color: '#C71D23' },
];

function IntegrationSettings() {
  const isDark = useThemeStore(s => s.mode === 'dark');
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedPlatform, setSelectedPlatform] = useState('');
  const [form] = Form.useForm();

  const { data: integrations = [], isFetching: loading } = useIntegrations();
  const createIntegration = useCreateIntegration();
  const updateIntegration = useUpdateIntegration();

  const findIntegration = (platform: string) =>
    integrations.find(i => i.platform.toLowerCase() === platform.toLowerCase());

  const handleConnect = (platform: string) => {
    setSelectedPlatform(platform);
    const existing = findIntegration(platform);
    if (existing) {
      form.setFieldsValue({ accessToken: '', username: existing.username || '' });
    } else {
      form.resetFields();
    }
    setModalOpen(true);
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      const existing = findIntegration(selectedPlatform);
      if (existing) {
        await updateIntegration.mutateAsync({
          id: existing.id,
          data: {
            accessToken: values.accessToken || undefined,
            username: values.username || undefined,
          },
        });
      } else {
        await createIntegration.mutateAsync({
          platform: selectedPlatform,
          accessToken: values.accessToken,
          username: values.username || undefined,
        });
      }
      message.success(`${selectedPlatform} 集成已保存`);
      setModalOpen(false);
      form.resetFields();
    } catch {
      message.error('保存失败，请重试');
    }
  };

  return (
    <>
      <div style={{ padding: '16px 24px 20px', display: 'grid', gap: 12 }}>
        {PLATFORM_META.map(p => {
          const connected = findIntegration(p.name);
          return (
            <div key={p.name} style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '12px 16px',
              borderRadius: 8,
              border: `1px solid ${isDark ? 'var(--md-outline-variant)' : '#E2E8F0'}`,
              background: isDark ? 'var(--md-surface-container-low)' : 'rgba(255,255,255,0.5)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: p.color }} />
                <div>
                  <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--md-on-surface)' }}>
                    {p.name}
                    {connected && (
                      <Tag
                        icon={<CheckCircleOutlined />}
                        color="success"
                        style={{ marginLeft: 8, fontSize: 12 }}
                      >
                        已连接
                      </Tag>
                    )}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--md-on-surface-variant)' }}>{p.description}</div>
                </div>
              </div>
              <Button size="small" icon={<KeyOutlined />} onClick={() => handleConnect(p.name)} loading={loading}>
                {connected ? '更新 Token' : '配置 Token'}
              </Button>
            </div>
          );
        })}
      </div>

      <Modal
        title={`配置 ${selectedPlatform}`}
        open={modalOpen}
        onCancel={() => { setModalOpen(false); form.resetFields(); }}
        onOk={() => form.submit()}
        okText="保存"
      >
        <Form form={form} layout="vertical" onFinish={handleSave}>
          <Form.Item name="accessToken" label="Personal Access Token" rules={[{ required: !findIntegration(selectedPlatform), message: '请输入 Token' }]}>
            <Input.Password placeholder={findIntegration(selectedPlatform) ? '留空则保持原有 Token 不变' : '粘贴你的 Token'} />
          </Form.Item>
          <Form.Item name="username" label="用户名（可选）">
            <Input placeholder="用于验证 Token 有效性" />
          </Form.Item>
          <div style={{ background: 'rgba(34, 197, 94, 0.06)', padding: 12, borderRadius: 6, fontSize: 13, color: 'var(--md-on-surface-variant)' }}>
            {selectedPlatform === 'GitHub' && '前往 GitHub → Settings → Developer settings → Personal access tokens 生成 Token，需要 repo 权限。'}
            {selectedPlatform === 'GitLab' && '前往 GitLab → User Settings → Access Tokens 生成 Token，需要 api 权限。'}
            {selectedPlatform === 'Gitee' && '前往 Gitee → 设置 → 私人令牌 生成 Token，需要 projects 权限。'}
          </div>
        </Form>
      </Modal>
    </>
  );
}

function AppearanceSettings() {
  const isDark = useThemeStore(s => s.mode === 'dark');
  const toggle = useThemeStore(s => s.toggle);
  const mode = useThemeStore(s => s.mode);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <GlassCard isDark={isDark}>
        <CardHeader title="外观设置" />
        <div style={{ padding: '16px 24px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <ToggleRow
            label="深色模式"
            description="使用深色界面主题"
            checked={mode === 'dark'}
            onChange={toggle}
          />
        </div>
      </GlassCard>
    </div>
  );
}

function WorkspaceSettings() {
  const isDark = useThemeStore(s => s.mode === 'dark');
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <GlassCard isDark={isDark}>
        <CardHeader title="工作区设置" />
        <div style={{ padding: '16px 24px 20px', color: 'var(--md-on-surface-variant)', fontSize: 14 }}>
          工作区相关设置将在后续版本中开放。
        </div>
      </GlassCard>
    </div>
  );
}

function McpServersSettings() {
  const isDark = useThemeStore(s => s.mode === 'dark');
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <GlassCard isDark={isDark}>
        <CardHeader title="MCP 服务器" badge="Beta" />
        <div style={{ padding: '16px 24px 20px', color: 'var(--md-on-surface-variant)', fontSize: 14 }}>
          MCP 服务器管理功能将在后续版本中开放。
        </div>
      </GlassCard>
    </div>
  );
}

function TerminalSettings() {
  const isDark = useThemeStore(s => s.mode === 'dark');
  const [terminalShell, setTerminalShell] = useState(localStorage.getItem('devhub_terminal_shell') || DEFAULT_SHELL);
  const [defaultCwd, setDefaultCwd] = useState(localStorage.getItem('devhub_terminal_default_cwd') || DEFAULT_CWD);

  const handleSave = () => {
    localStorage.setItem('devhub_terminal_shell', terminalShell);
    localStorage.setItem('devhub_terminal_default_cwd', defaultCwd);
    useTerminalStore.setState({ defaultCwd });
    message.success('终端设置已保存');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <GlassCard isDark={isDark}>
        <CardHeader title="终端设置" />
        <div style={{ padding: '16px 24px 20px' }}>
          <Form layout="vertical">
            <Form.Item label="终端 Shell">
              <Select
                value={terminalShell}
                onChange={setTerminalShell}
                options={SHELL_OPTIONS.map(o => ({ ...o, label: o.value === DEFAULT_SHELL ? `${o.label}（默认）` : o.label }))}
                style={{ width: 220 }}
              />
              <div style={{ color: 'var(--md-on-surface-variant)', fontSize: 12, marginTop: 4 }}>
                新建终端时使用的 Shell。修改后需重新打开终端面板生效。
              </div>
            </Form.Item>
            <Form.Item label="终端默认路径">
              <div style={{ display: 'flex', gap: 8 }}>
                <Input
                  value={defaultCwd}
                  onChange={e => setDefaultCwd(e.target.value)}
                  placeholder={DEFAULT_CWD}
                  style={{ flex: 1 }}
                />
                <Button
                  icon={<FolderOutlined />}
                  onClick={async () => {
                    const selected = await open({
                      directory: true,
                      multiple: false,
                      defaultPath: defaultCwd || undefined,
                    });
                    if (selected) setDefaultCwd(selected);
                  }}
                >
                  选择
                </Button>
              </div>
              <div style={{ color: 'var(--md-on-surface-variant)', fontSize: 12, marginTop: 4 }}>
                点击全局终端按钮时打开的默认路径。启动项目时会使用项目路径。
              </div>
            </Form.Item>
            <Form.Item>
              <Button type="primary" icon={<SaveOutlined />} onClick={handleSave}>保存</Button>
            </Form.Item>
          </Form>
        </div>
      </GlassCard>
    </div>
  );
}

function GitToolsSettings() {
  const isDark = useThemeStore(s => s.mode === 'dark');
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <GlassCard isDark={isDark}>
        <CardHeader title="Git 设置" />
        <div style={{ padding: '16px 24px 20px', color: 'var(--md-on-surface-variant)', fontSize: 14 }}>
          Git 全局设置将在后续版本中开放。
        </div>
      </GlassCard>
    </div>
  );
}

function BuildSettings() {
  const isDark = useThemeStore(s => s.mode === 'dark');
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <GlassCard isDark={isDark}>
        <CardHeader title="构建设置" />
        <div style={{ padding: '16px 24px 20px', color: 'var(--md-on-surface-variant)', fontSize: 14 }}>
          构建相关设置将在后续版本中开放。
        </div>
      </GlassCard>
    </div>
  );
}

function DataManagementSettings() {
  const isDark = useThemeStore(s => s.mode === 'dark');
  const handleExport = async () => {
    try {
      const data = {
        preferences: { defaultOpenCmd: localStorage.getItem('devhub_default_open_cmd') },
        exportedAt: new Date().toISOString(),
      };
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `devhub-export-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      message.success('导出成功');
    } catch {
      message.error('导出失败');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <GlassCard isDark={isDark}>
        <CardHeader title="数据导出" />
        <div style={{ padding: '16px 24px 20px' }}>
          <div style={{ color: 'var(--md-on-surface-variant)', fontSize: 14, marginBottom: 12 }}>
            导出本地偏好设置。项目数据存储在服务端数据库中。
          </div>
          <Button onClick={handleExport}>导出设置</Button>
        </div>
      </GlassCard>
    </div>
  );
}

// ── Reusable sub-components ──

function GlassCard({ children, isDark }: { children: React.ReactNode; isDark: boolean }) {
  return (
    <div style={{
      background: isDark ? 'var(--md-surface-container)' : '#ffffff',
      borderRadius: 12,
      border: `1px solid ${isDark ? 'var(--md-outline-variant)' : '#E2E8F0'}`,
      boxShadow: '0 4px 12px rgba(0,0,0,0.03)',
      overflow: 'hidden',
    }}>
      {children}
    </div>
  );
}

function CardHeader({ title, badge }: { title: string; badge?: string }) {
  const isDark = useThemeStore(s => s.mode === 'dark');
  return (
    <div style={{
      padding: '14px 24px',
      borderBottom: `1px solid ${isDark ? 'rgba(187, 202, 198, 0.15)' : 'rgba(187, 202, 198, 0.3)'}`,
      background: isDark ? 'var(--md-surface-container-lowest)' : 'rgba(255,255,255,0.5)',
      display: 'flex',
      alignItems: 'center',
      gap: 8,
    }}>
      <h3 style={{
        fontSize: 16,
        fontWeight: 600,
        color: 'var(--md-on-surface)',
        lineHeight: '24px',
        letterSpacing: '-0.01em',
        margin: 0,
      }}>
        {title}
      </h3>
      {badge && (
        <span style={{
          background: 'var(--md-primary)',
          color: 'var(--md-on-primary)',
          fontFamily: 'var(--font-label)',
          fontSize: 10,
          fontWeight: 500,
          padding: '2px 8px',
          borderRadius: 4,
          letterSpacing: '0.02em',
        }}>
          {badge}
        </span>
      )}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <span style={{ fontSize: 14, color: 'var(--md-on-surface-variant)' }}>{label}</span>
      <span style={{ fontSize: 14, color: 'var(--md-on-surface)' }}>{value}</span>
    </div>
  );
}

function ToggleRow({ label, description, checked, onChange }: {
  label: string;
  description: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <div>
        <div style={{ fontSize: 14, color: 'var(--md-on-surface)' }}>{label}</div>
        <div style={{ fontSize: 12, color: 'var(--md-on-surface-variant)', marginTop: 2 }}>{description}</div>
      </div>
      <label style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', cursor: 'pointer' }}>
        <input
          type="checkbox"
          checked={checked}
          onChange={onChange}
          style={{ position: 'absolute', opacity: 0, width: 0, height: 0 }}
        />
        <div style={{
          width: 36,
          height: 20,
          borderRadius: 10,
          background: checked ? 'var(--md-primary)' : 'rgba(187, 202, 198, 0.5)',
          position: 'relative',
          transition: 'background 0.2s ease',
        }}>
          <div style={{
            width: 16,
            height: 16,
            borderRadius: '50%',
            background: '#ffffff',
            border: '1px solid var(--md-outline-variant)',
            position: 'absolute',
            top: 1,
            left: checked ? 17 : 1,
            transition: 'left 0.2s ease',
          }} />
        </div>
      </label>
    </div>
  );
}

// ── Panel registry ──
const panels: Record<string, React.FC> = {
  general: GeneralSettings,
  integrations: IntegrationSettings,
  appearance: AppearanceSettings,
  'workspace-nav': WorkspaceSettings,
  'mcp-servers': McpServersSettings,
  terminal: TerminalSettings,
  'git-tools': GitToolsSettings,
  build: BuildSettings,
  data: DataManagementSettings,
};

// ── Main Component ──

export default function SettingsPage() {
  const [activeKey, setActiveKey] = useState('general');
  const isDark = useThemeStore(s => s.mode === 'dark');

  const ActivePanel = panels[activeKey] || GeneralSettings;

  return (
    <div style={{
      display: 'flex',
      height: '100%',
      overflow: 'hidden',
    }}>
      {/* Left sub-navigation (260px) */}
      <aside style={{
        width: 260,
        flexShrink: 0,
        padding: '16px 8px',
        overflowY: 'auto',
        borderRight: `1px solid ${isDark ? 'var(--md-outline-variant)' : 'var(--color-border)'}`,
        background: isDark ? 'var(--md-surface)' : 'transparent',
      }}>
        {/* Page title */}
        <div style={{
          padding: '8px 12px 16px',
          fontSize: 18,
          fontWeight: 600,
          color: 'var(--md-on-surface)',
          letterSpacing: '-0.01em',
        }}>
          设置
        </div>

        {/* Nav groups */}
        {navGroups.map(group => (
          <div key={group.title} style={{ marginBottom: 16 }}>
            <div style={{
              padding: '4px 12px 6px',
              fontSize: 11,
              fontWeight: 600,
              color: 'var(--md-on-surface-variant)',
              fontFamily: 'var(--font-label)',
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
              opacity: 0.7,
            }}>
              {group.title}
            </div>
            {group.items.map(item => {
              const isActive = activeKey === item.key;
              return (
                <button
                  key={item.key}
                  onClick={() => setActiveKey(item.key)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    width: '100%',
                    padding: '8px 12px',
                    border: 'none',
                    borderRadius: 8,
                    background: isActive
                      ? 'rgba(20, 184, 166, 0.10)'
                      : 'transparent',
                    color: isActive ? 'var(--md-primary)' : 'var(--md-on-surface-variant)',
                    cursor: 'pointer',
                    fontFamily: 'var(--font-sans)',
                    fontSize: 14,
                    textAlign: 'left',
                    transition: 'all 0.15s ease',
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
                  <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
                    {item.icon}
                  </span>
                  <span style={{ flex: 1, fontWeight: isActive ? 500 : 400 }}>
                    {item.label}
                  </span>
                  {item.badge && (
                    <span style={{
                      background: 'var(--md-primary)',
                      color: 'var(--md-on-primary)',
                      fontFamily: 'var(--font-label)',
                      fontSize: 9,
                      fontWeight: 600,
                      padding: '1px 6px',
                      borderRadius: 3,
                      letterSpacing: '0.03em',
                    }}>
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </aside>

      {/* Right content area */}
      <main style={{
        flex: 1,
        overflowY: 'auto',
        padding: 'var(--layout-container-padding)',
      }}>
        <div style={{ maxWidth: 800, margin: '0 auto' }}>
          <ActivePanel />
        </div>
      </main>
    </div>
  );
}
