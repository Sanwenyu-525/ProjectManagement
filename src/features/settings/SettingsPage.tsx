import { useState, useEffect, useCallback } from 'react';
import { Form, Input, Button, message, Select, Table, Modal, Space, Popconfirm, InputNumber, Tag } from 'antd';
import { SaveOutlined, FolderOutlined, UndoOutlined, PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { useTerminalStore } from '../../stores/terminalStore';
import { useThemeStore } from '../../stores/themeStore';
import { open } from '@tauri-apps/plugin-dialog';
import { DEFAULT_SHELL, DEFAULT_CWD, SHELL_OPTIONS } from '../../lib/constants';
import IntegrationSettings from './IntegrationSettings';
import { GlassCard, CardHeader, InfoRow, ToggleRow } from './settingsComponents';
import { providersApi, agentConfigsApi } from '../../api';
import type { ModelProvider, AgentConfig } from '../../types';

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
      { key: 'agent-configs', icon: 'smart_toy', label: 'Agent 配置' },
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

      <GlassCard isDark={isDark}>
        <CardHeader title="平台集成" />
        <IntegrationSettings />
      </GlassCard>

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

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
        <Button icon={<UndoOutlined />}>重置默认</Button>
        <Button type="primary" icon={<SaveOutlined />} onClick={handleSave}>保存设置</Button>
      </div>
    </div>
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

// ── Agent Configs Settings ──

const PROVIDER_TYPE_OPTIONS = [
  { value: 'claude', label: 'Claude Code' },
  { value: 'openai', label: 'OpenAI' },
  { value: 'gemini', label: 'Gemini' },
  { value: 'openai-compatible', label: 'OpenAI Compatible' },
];

function AgentConfigsSettings() {
  const isDark = useThemeStore(s => s.mode === 'dark');
  const [providers, setProviders] = useState<ModelProvider[]>([]);
  const [configs, setConfigs] = useState<AgentConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [providerModalOpen, setProviderModalOpen] = useState(false);
  const [configModalOpen, setConfigModalOpen] = useState(false);
  const [editingProvider, setEditingProvider] = useState<ModelProvider | null>(null);
  const [editingConfig, setEditingConfig] = useState<AgentConfig | null>(null);
  const [selectedProviderId, setSelectedProviderId] = useState<string | null>(null);
  const [providerForm] = Form.useForm();
  const [configForm] = Form.useForm();

  const loadData = useCallback(async () => {
    try {
      const [p, c] = await Promise.all([providersApi.list(), agentConfigsApi.list()]);
      setProviders(p);
      setConfigs(c);
    } catch {
      message.error('加载配置失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleSaveProvider = async () => {
    try {
      const values = await providerForm.validateFields();
      if (editingProvider) {
        await providersApi.update(editingProvider.id, {
          name: values.name,
          apiKey: values.apiKey,
          baseUrl: values.baseUrl || null,
        });
        message.success('Provider 已更新');
      } else {
        await providersApi.create({
          name: values.name,
          type: values.type,
          apiKey: values.apiKey,
          baseUrl: values.baseUrl || undefined,
        });
        message.success('Provider 已创建');
      }
      setProviderModalOpen(false);
      providerForm.resetFields();
      setEditingProvider(null);
      loadData();
    } catch {
      // validation or API error
    }
  };

  const handleDeleteProvider = async (id: string) => {
    try {
      await providersApi.delete(id);
      message.success('Provider 已删除');
      loadData();
    } catch {
      message.error('删除失败');
    }
  };

  const handleSaveConfig = async () => {
    try {
      const values = await configForm.validateFields();
      if (editingConfig) {
        await agentConfigsApi.update(editingConfig.id, {
          name: values.name,
          icon: values.icon,
          model: values.model,
          systemPrompt: values.systemPrompt,
          temperature: values.temperature,
          maxTokens: values.maxTokens,
        });
        message.success('Agent 配置已更新');
      } else {
        await agentConfigsApi.create({
          name: values.name,
          icon: values.icon || 'smart_toy',
          providerId: values.providerId,
          model: values.model,
          systemPrompt: values.systemPrompt || '',
          temperature: values.temperature ?? 0.7,
          maxTokens: values.maxTokens ?? 4096,
        });
        message.success('Agent 配置已创建');
      }
      setConfigModalOpen(false);
      configForm.resetFields();
      setEditingConfig(null);
      loadData();
    } catch {
      // validation or API error
    }
  };

  const handleDeleteConfig = async (id: string) => {
    try {
      await agentConfigsApi.delete(id);
      message.success('Agent 配置已删除');
      loadData();
    } catch {
      message.error('删除失败');
    }
  };

  const providerColumns = [
    { title: '名称', dataIndex: 'name', key: 'name' },
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      render: (t: string) => <Tag>{PROVIDER_TYPE_OPTIONS.find(o => o.value === t)?.label ?? t}</Tag>,
    },
    {
      title: 'API Key',
      dataIndex: 'apiKey',
      key: 'apiKey',
      render: (k: string) => k ? '••••••••' : <span style={{ color: 'var(--md-on-surface-variant)' }}>未设置</span>,
    },
    {
      title: '操作',
      key: 'actions',
      width: 100,
      render: (_: unknown, record: ModelProvider) => (
        <Space size="small">
          <Button
            type="text"
            size="small"
            icon={<EditOutlined />}
            onClick={() => {
              setEditingProvider(record);
              providerForm.setFieldsValue({ name: record.name, type: record.type, apiKey: record.apiKey, baseUrl: record.baseUrl });
              setProviderModalOpen(true);
            }}
          />
          <Popconfirm title="删除此 Provider？关联的 Agent 配置也会被删除。" onConfirm={() => handleDeleteProvider(record.id)}>
            <Button type="text" size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const configColumns = [
    { title: '名称', dataIndex: 'name', key: 'name' },
    { title: '模型', dataIndex: 'model', key: 'model' },
    {
      title: 'Provider',
      dataIndex: 'providerId',
      key: 'providerId',
      render: (pid: string) => providers.find(p => p.id === pid)?.name ?? pid,
    },
    { title: '温度', dataIndex: 'temperature', key: 'temperature', width: 70 },
    {
      title: '操作',
      key: 'actions',
      width: 100,
      render: (_: unknown, record: AgentConfig) => (
        <Space size="small">
          <Button
            type="text"
            size="small"
            icon={<EditOutlined />}
            onClick={() => {
              setEditingConfig(record);
              configForm.setFieldsValue(record);
              setConfigModalOpen(true);
            }}
          />
          <Popconfirm title="删除此 Agent 配置？" onConfirm={() => handleDeleteConfig(record.id)}>
            <Button type="text" size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const filteredConfigs = selectedProviderId
    ? configs.filter(c => c.providerId === selectedProviderId)
    : configs;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <GlassCard isDark={isDark}>
        <CardHeader title="Model Providers" />
        <div style={{ padding: '12px 16px' }}>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
            <Button
              size="small"
              icon={<PlusOutlined />}
              onClick={() => { setEditingProvider(null); providerForm.resetFields(); setProviderModalOpen(true); }}
            >
              添加 Provider
            </Button>
          </div>
          <Table
            dataSource={providers}
            columns={providerColumns}
            rowKey="id"
            size="small"
            loading={loading}
            pagination={false}
            locale={{ emptyText: '暂无 Provider，点击上方按钮添加' }}
            onRow={(record) => ({
              onClick: () => setSelectedProviderId(selectedProviderId === record.id ? null : record.id),
              style: { cursor: 'pointer', background: selectedProviderId === record.id ? 'rgba(20,184,166,0.06)' : undefined },
            })}
          />
        </div>
      </GlassCard>

      <GlassCard isDark={isDark}>
        <CardHeader title={selectedProviderId ? `Agent 配置 — ${providers.find(p => p.id === selectedProviderId)?.name ?? ''}` : 'Agent 配置'} />
        <div style={{ padding: '12px 16px' }}>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
            <Button
              size="small"
              icon={<PlusOutlined />}
              disabled={providers.length === 0}
              onClick={() => { setEditingConfig(null); configForm.resetFields(); if (selectedProviderId) configForm.setFieldsValue({ providerId: selectedProviderId }); setConfigModalOpen(true); }}
            >
              添加 Agent 配置
            </Button>
          </div>
          <Table
            dataSource={filteredConfigs}
            columns={configColumns}
            rowKey="id"
            size="small"
            loading={loading}
            pagination={false}
            locale={{ emptyText: providers.length === 0 ? '请先添加 Provider' : '暂无 Agent 配置' }}
          />
        </div>
      </GlassCard>

      {/* Provider modal */}
      <Modal
        title={editingProvider ? '编辑 Provider' : '添加 Provider'}
        open={providerModalOpen}
        onOk={handleSaveProvider}
        onCancel={() => { setProviderModalOpen(false); setEditingProvider(null); }}
        destroyOnClose
      >
        <Form form={providerForm} layout="vertical" preserve={false}>
          <Form.Item name="name" label="名称" rules={[{ required: true, message: '请输入名称' }]}>
            <Input placeholder="My Claude" />
          </Form.Item>
          <Form.Item name="type" label="类型" rules={[{ required: true, message: '请选择类型' }]}>
            <Select options={PROVIDER_TYPE_OPTIONS} placeholder="选择 Provider 类型" disabled={!!editingProvider} />
          </Form.Item>
          <Form.Item name="apiKey" label="API Key" rules={[{ required: true, message: '请输入 API Key' }]}>
            <Input.Password placeholder="sk-ant-..." />
          </Form.Item>
          <Form.Item name="baseUrl" label="Base URL（可选）">
            <Input placeholder="https://api.example.com" />
          </Form.Item>
        </Form>
      </Modal>

      {/* Config modal */}
      <Modal
        title={editingConfig ? '编辑 Agent 配置' : '添加 Agent 配置'}
        open={configModalOpen}
        onOk={handleSaveConfig}
        onCancel={() => { setConfigModalOpen(false); setEditingConfig(null); }}
        destroyOnClose
        width={520}
      >
        <Form form={configForm} layout="vertical" preserve={false}>
          <Form.Item name="name" label="名称" rules={[{ required: true, message: '请输入名称' }]}>
            <Input placeholder="Claude Sonnet" />
          </Form.Item>
          <Form.Item name="providerId" label="Provider" rules={[{ required: true, message: '请选择 Provider' }]}>
            <Select
              options={providers.map(p => ({ value: p.id, label: p.name }))}
              placeholder="选择 Provider"
              disabled={!!editingConfig}
            />
          </Form.Item>
          <Form.Item name="model" label="模型" rules={[{ required: true, message: '请输入模型名称' }]}>
            <Input placeholder="claude-sonnet-4-20250514" />
          </Form.Item>
          <Form.Item name="systemPrompt" label="系统提示词">
            <Input.TextArea rows={3} placeholder="You are a helpful assistant..." />
          </Form.Item>
          <div style={{ display: 'flex', gap: 12 }}>
            <Form.Item name="temperature" label="温度" style={{ flex: 1 }}>
              <InputNumber min={0} max={2} step={0.1} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item name="maxTokens" label="最大 Token" style={{ flex: 1 }}>
              <InputNumber min={256} max={128000} step={256} style={{ width: '100%' }} />
            </Form.Item>
          </div>
        </Form>
      </Modal>
    </div>
  );
}

// ── Panel registry ──
const panels: Record<string, React.FC> = {
  general: GeneralSettings,
  integrations: IntegrationSettings,
  appearance: AppearanceSettings,
  'workspace-nav': WorkspaceSettings,
  'agent-configs': AgentConfigsSettings,
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
