import { useState, useEffect, useCallback } from 'react';
import { Form, Input, Button, message, Select, Table, Modal, Space, Popconfirm, InputNumber, Tag, Switch } from 'antd';
import { SaveOutlined, FolderOutlined, UndoOutlined, PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { useTerminalStore } from '../../stores/terminalStore';
import { useThemeStore } from '../../stores/themeStore';
import { open } from '@tauri-apps/plugin-dialog';
import { DEFAULT_SHELL, DEFAULT_CWD, SHELL_OPTIONS } from '../../lib/constants';
import { GlassCard, CardHeader, InfoRow, ToggleRow } from './settingsComponents';
import IntegrationSettings from './IntegrationSettings';
import { COMMANDS_WITH_SHORTCUTS, CATEGORY_LABELS } from '../../lib/commands';
import { providersApi, agentConfigsApi, mcpServersApi } from '../../api';
import type { ModelProvider, AgentConfig, McpServer } from '../../types';

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
  const [defaultCmd, setDefaultCmd] = useState(localStorage.getItem('devhub_default_open_cmd') || 'code {path}');

  const handleSave = () => {
    localStorage.setItem('devhub_default_open_cmd', defaultCmd);
    message.success('设置已保存');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <GlassCard>
        <CardHeader title="应用信息" />
        <div style={{ padding: '16px 24px 20px' }}>
          <div style={{ display: 'grid', gap: 12 }}>
            <InfoRow label="应用名称" value="DevHub" />
            <InfoRow label="版本" value="v0.1.0" />
            <InfoRow label="模式" value="单用户本地模式" />
          </div>
        </div>
      </GlassCard>

      <GlassCard>
        <CardHeader title="偏好设置" />
        <div style={{ padding: '16px 24px 20px' }}>
          <Form layout="vertical">
            <Form.Item label="默认打开命令">
              <Input
                value={defaultCmd}
                onChange={e => setDefaultCmd(e.target.value)}
                placeholder="code {path}"
              />
              <div style={{ color: 'var(--md-on-surface-variant)', fontSize: 'var(--text-sm)', marginTop: 4 }}>
                {'{path}'} 会被替换为项目本地路径。常用: code {'{path}'}、webstorm {'{path}'}
              </div>
            </Form.Item>
          </Form>
        </div>
      </GlassCard>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
        <Button
          icon={<UndoOutlined />}
          onClick={() => {
            setDefaultCmd('code {path}');
            localStorage.removeItem('devhub_default_open_cmd');
            message.info('已重置为默认值');
          }}
        >
          重置默认
        </Button>
        <Button type="primary" icon={<SaveOutlined />} onClick={handleSave}>保存设置</Button>
      </div>
    </div>
  );
}

// ── Accent color / font size option definitions ──

const ACCENT_OPTIONS: Array<{ key: 'default' | 'blue' | 'violet' | 'rose'; label: string; color: string; colorDark: string }> = [
  { key: 'default', label: 'Teal', color: '#006b5f', colorDark: '#4fdbc8' },
  { key: 'blue', label: 'Blue', color: '#2563eb', colorDark: '#60a5fa' },
  { key: 'violet', label: 'Violet', color: '#7c3aed', colorDark: '#a78bfa' },
  { key: 'rose', label: 'Rose', color: '#e11d48', colorDark: '#fb7185' },
];

const FONT_SIZE_OPTIONS: Array<{ key: 'sm' | 'base' | 'lg'; label: string; desc: string }> = [
  { key: 'sm', label: '小', desc: 'Smaller text' },
  { key: 'base', label: '默认', desc: 'Default size' },
  { key: 'lg', label: '大', desc: 'Larger text' },
];

const DENSITY_OPTIONS: Array<{ key: 'comfortable' | 'compact' | 'dense'; label: string; desc: string }> = [
  { key: 'comfortable', label: '宽松', desc: 'Comfortable spacing' },
  { key: 'compact', label: '紧凑', desc: 'Compact spacing' },
  { key: 'dense', label: '密集', desc: 'Dense layout' },
];

function AppearanceSettings() {
  const toggle = useThemeStore(s => s.toggle);
  const mode = useThemeStore(s => s.mode);
  const accent = useThemeStore(s => s.accent);
  const setAccent = useThemeStore(s => s.setAccent);
  const fontSize = useThemeStore(s => s.fontSize);
  const setFontSize = useThemeStore(s => s.setFontSize);
  const density = useThemeStore(s => s.density);
  const setDensity = useThemeStore(s => s.setDensity);
  const isDark = mode === 'dark';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <GlassCard>
        <CardHeader title="外观设置" />
        <div style={{ padding: '16px 24px 20px', display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Dark mode toggle */}
          <ToggleRow
            label="深色模式"
            description="使用深色界面主题"
            checked={isDark}
            onChange={toggle}
          />

          {/* Accent color */}
          <div>
            <div style={{ fontSize: 'var(--text-base)', color: 'var(--md-on-surface)', marginBottom: 4 }}>主题色</div>
            <div style={{ fontSize: 'var(--text-sm)', color: 'var(--md-on-surface-variant)', marginBottom: 12 }}>选择应用的强调色</div>
            <div style={{ display: 'flex', gap: 12 }}>
              {ACCENT_OPTIONS.map(opt => {
                const active = accent === opt.key;
                const swatchColor = isDark ? opt.colorDark : opt.color;
                return (
                  <button
                    key={opt.key}
                    onClick={() => setAccent(opt.key)}
                    title={opt.label}
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: '50%',
                      border: active ? `2px solid ${swatchColor}` : '2px solid var(--border)',
                      background: swatchColor,
                      cursor: 'pointer',
                      position: 'relative',
                      transition: 'border-color 0.15s, transform 0.15s',
                      transform: active ? 'scale(1.1)' : 'scale(1)',
                      padding: 0,
                    }}
                  >
                    {active && (
                      <span className="material-symbols-outlined" style={{
                        position: 'absolute',
                        top: '50%',
                        left: '50%',
                        transform: 'translate(-50%, -50%)',
                        fontSize: 18,
                        color: '#fff',
                      }}>
                        check
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Font size */}
          <div>
            <div style={{ fontSize: 'var(--text-base)', color: 'var(--md-on-surface)', marginBottom: 4 }}>字体大小</div>
            <div style={{ fontSize: 'var(--text-sm)', color: 'var(--md-on-surface-variant)', marginBottom: 12 }}>调整全局文字大小</div>
            <div style={{ display: 'flex', gap: 8 }}>
              {FONT_SIZE_OPTIONS.map(opt => {
                const active = fontSize === opt.key;
                return (
                  <button
                    key={opt.key}
                    onClick={() => setFontSize(opt.key)}
                    style={{
                      padding: '6px 16px',
                      borderRadius: 8,
                      border: '1px solid',
                      borderColor: active ? 'var(--md-primary)' : 'var(--border)',
                      background: active ? 'var(--md-primary-container)' : 'transparent',
                      color: active ? 'var(--md-primary)' : 'var(--md-on-surface-variant)',
                      cursor: 'pointer',
                      fontSize: 'var(--text-sm)',
                      fontWeight: active ? 500 : 400,
                      fontFamily: 'var(--font-sans)',
                      transition: 'all 0.15s',
                    }}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Density */}
          <div>
            <div style={{ fontSize: 'var(--text-base)', color: 'var(--md-on-surface)', marginBottom: 4 }}>界面密度</div>
            <div style={{ fontSize: 'var(--text-sm)', color: 'var(--md-on-surface-variant)', marginBottom: 12 }}>控制间距和信息密度</div>
            <div style={{ display: 'flex', gap: 8 }}>
              {DENSITY_OPTIONS.map(opt => {
                const active = density === opt.key;
                return (
                  <button
                    key={opt.key}
                    onClick={() => setDensity(opt.key)}
                    style={{
                      padding: '6px 16px',
                      borderRadius: 8,
                      border: '1px solid',
                      borderColor: active ? 'var(--md-primary)' : 'var(--border)',
                      background: active ? 'var(--md-primary-container)' : 'transparent',
                      color: active ? 'var(--md-primary)' : 'var(--md-on-surface-variant)',
                      cursor: 'pointer',
                      fontSize: 'var(--text-sm)',
                      fontWeight: active ? 500 : 400,
                      fontFamily: 'var(--font-sans)',
                      transition: 'all 0.15s',
                    }}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </GlassCard>
    </div>
  );
}

function WorkspaceSettings() {
  const [defaultLayout, setDefaultLayout] = useState(localStorage.getItem('devhub_workspace_default_layout') || 'agent-terminal');
  const [showHidden, setShowHidden] = useState(localStorage.getItem('devhub_show_hidden_files') === 'true');
  const [fileSort, setFileSort] = useState(localStorage.getItem('devhub_file_sort') || 'name');

  const handleSave = () => {
    localStorage.setItem('devhub_workspace_default_layout', defaultLayout);
    localStorage.setItem('devhub_show_hidden_files', String(showHidden));
    localStorage.setItem('devhub_file_sort', fileSort);
    message.success('工作区设置已保存');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <GlassCard>
        <CardHeader title="工作区设置" />
        <div style={{ padding: '16px 24px 20px', display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div>
            <div style={{ fontSize: 'var(--text-base)', color: 'var(--md-on-surface)', marginBottom: 4 }}>默认面板布局</div>
            <div style={{ fontSize: 'var(--text-sm)', color: 'var(--md-on-surface-variant)', marginBottom: 12 }}>启动工作区时的初始面板排列</div>
            <Select
              value={defaultLayout}
              onChange={setDefaultLayout}
              style={{ width: 260 }}
              options={[
                { value: 'agent-terminal', label: 'Agent + 终端' },
                { value: 'editor-only', label: '仅编辑器' },
                { value: 'full-width', label: '全宽布局' },
              ]}
            />
          </div>

          <ToggleRow
            label="显示隐藏文件"
            description="在文件浏览器中显示以 . 开头的文件和文件夹"
            checked={showHidden}
            onChange={() => setShowHidden(!showHidden)}
          />

          <div>
            <div style={{ fontSize: 'var(--text-base)', color: 'var(--md-on-surface)', marginBottom: 4 }}>文件排序方式</div>
            <div style={{ fontSize: 'var(--text-sm)', color: 'var(--md-on-surface-variant)', marginBottom: 12 }}>文件浏览器中的默认排序</div>
            <Select
              value={fileSort}
              onChange={setFileSort}
              style={{ width: 220 }}
              options={[
                { value: 'name', label: '按名称' },
                { value: 'modified', label: '按修改时间' },
                { value: 'size', label: '按大小' },
              ]}
            />
          </div>
        </div>
      </GlassCard>

      <GlassCard>
        <CardHeader title="快捷键" badge="只读" />
        <div style={{ padding: '16px 24px 20px' }}>
          <div style={{ color: 'var(--md-on-surface-variant)', fontSize: 'var(--text-sm)', marginBottom: 12 }}>
            当前快捷键列表（不可自定义）
          </div>
          {Object.entries(CATEGORY_LABELS).map(([cat, label]) => {
            const cmds = COMMANDS_WITH_SHORTCUTS.filter(c => c.category === cat);
            if (cmds.length === 0) return null;
            return (
              <div key={cat} style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--md-on-surface-variant)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 6 }}>
                  {label}
                </div>
                {cmds.map(cmd => (
                  <div key={cmd.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0' }}>
                    <span style={{ fontSize: 'var(--text-sm)', color: 'var(--md-on-surface)' }}>{cmd.label}</span>
                    <kbd style={{
                      fontSize: 10, color: 'var(--md-on-surface-variant)',
                      background: 'var(--md-surface-container-high)',
                      padding: '2px 6px', borderRadius: 4,
                      border: '1px solid var(--border)',
                      fontFamily: "'Fira Code', monospace",
                    }}>
                      {cmd.shortcut}
                    </kbd>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </GlassCard>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
        <Button
          icon={<UndoOutlined />}
          onClick={() => {
            setDefaultLayout('agent-terminal');
            setShowHidden(false);
            setFileSort('name');
            localStorage.removeItem('devhub_workspace_default_layout');
            localStorage.removeItem('devhub_show_hidden_files');
            localStorage.removeItem('devhub_file_sort');
            message.info('已重置为默认值');
          }}
        >
          重置默认
        </Button>
        <Button type="primary" icon={<SaveOutlined />} onClick={handleSave}>保存设置</Button>
      </div>
    </div>
  );
}

function McpServersSettings() {
  const [servers, setServers] = useState<McpServer[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<McpServer | null>(null);
  const [form] = Form.useForm();

  const loadServers = useCallback(async () => {
    try {
      const data = await mcpServersApi.list();
      setServers(data);
    } catch {
      message.error('加载 MCP 服务器失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadServers(); }, [loadServers]);

  const transport = Form.useWatch('transport', form) || 'stdio';

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      const payload = {
        name: values.name,
        transport: values.transport,
        command: values.command || undefined,
        args: values.args || undefined,
        url: values.url || undefined,
        env: values.env || undefined,
        autoConnect: values.autoConnect ?? false,
        enabled: values.enabled ?? true,
      };
      if (editing) {
        await mcpServersApi.update(editing.id, payload);
        message.success('MCP 服务器已更新');
      } else {
        await mcpServersApi.create(payload);
        message.success('MCP 服务器已创建');
      }
      setModalOpen(false);
      form.resetFields();
      setEditing(null);
      loadServers();
    } catch (err) {
      if (typeof err === 'object' && err !== null && 'errorFields' in err) return;
      message.error(`保存失败: ${String(err)}`);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await mcpServersApi.delete(id);
      message.success('已删除');
      loadServers();
    } catch {
      message.error('删除失败');
    }
  };

  const handleToggleEnabled = async (record: McpServer) => {
    try {
      await mcpServersApi.update(record.id, { enabled: !record.enabled });
      loadServers();
    } catch {
      message.error('切换失败');
    }
  };

  const columns = [
    { title: '名称', dataIndex: 'name', key: 'name' },
    {
      title: '传输类型',
      dataIndex: 'transport',
      key: 'transport',
      width: 130,
      render: (t: string) => <Tag>{t === 'stdio' ? 'Stdio' : t === 'sse' ? 'SSE' : 'Streamable HTTP'}</Tag>,
    },
    {
      title: '连接目标',
      key: 'target',
      render: (_: unknown, record: McpServer) => (
        <span style={{ fontSize: 'var(--text-sm)', color: 'var(--md-on-surface-variant)', fontFamily: "'Fira Code', monospace" }}>
          {record.transport === 'stdio' ? record.command : record.url}
          {!record.command && !record.url && '—'}
        </span>
      ),
    },
    {
      title: '状态',
      dataIndex: 'enabled',
      key: 'enabled',
      width: 80,
      render: (enabled: boolean, record: McpServer) => (
        <Switch size="small" checked={enabled} onChange={() => handleToggleEnabled(record)} />
      ),
    },
    {
      title: '操作',
      key: 'actions',
      width: 100,
      render: (_: unknown, record: McpServer) => (
        <Space size="small">
          <Button
            type="text"
            size="small"
            icon={<EditOutlined />}
            onClick={() => {
              setEditing(record);
              form.setFieldsValue({
                name: record.name,
                transport: record.transport,
                command: record.command || '',
                args: record.args || '',
                url: record.url || '',
                env: record.env || '',
                autoConnect: record.autoConnect,
                enabled: record.enabled,
              });
              setModalOpen(true);
            }}
          />
          <Popconfirm title="删除此 MCP 服务器？" onConfirm={() => handleDelete(record.id)}>
            <Button type="text" size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <GlassCard>
        <CardHeader title="MCP 服务器" badge="Beta" />
        <div style={{ padding: '12px 16px' }}>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
            <Button
              size="small"
              icon={<PlusOutlined />}
              onClick={() => { setEditing(null); form.resetFields(); setModalOpen(true); }}
            >
              添加服务器
            </Button>
          </div>
          <Table
            dataSource={servers}
            columns={columns}
            rowKey="id"
            size="small"
            loading={loading}
            pagination={false}
            locale={{ emptyText: '暂无 MCP 服务器' }}
          />
        </div>
      </GlassCard>

      <Modal
        title={editing ? '编辑 MCP 服务器' : '添加 MCP 服务器'}
        open={modalOpen}
        onOk={handleSave}
        onCancel={() => { setModalOpen(false); setEditing(null); }}
        destroyOnClose
        width={520}
      >
        <Form form={form} layout="vertical" preserve={false} initialValues={{ transport: 'stdio', autoConnect: false, enabled: true }}>
          <Form.Item name="name" label="名称" rules={[{ required: true, message: '请输入名称' }]}>
            <Input placeholder="my-mcp-server" />
          </Form.Item>
          <Form.Item name="transport" label="传输类型" rules={[{ required: true }]}>
            <Select
              options={[
                { value: 'stdio', label: 'Stdio（本地进程）' },
                { value: 'sse', label: 'SSE（Server-Sent Events）' },
                { value: 'streamable-http', label: 'Streamable HTTP' },
              ]}
            />
          </Form.Item>

          {transport === 'stdio' && (
            <>
              <Form.Item name="command" label="启动命令" rules={[{ required: true, message: '请输入启动命令' }]}>
                <Input placeholder="npx -y @modelcontextprotocol/server-filesystem" style={{ fontFamily: "'Fira Code', monospace" }} />
              </Form.Item>
              <Form.Item name="args" label="参数（可选）">
                <Input.TextArea rows={2} placeholder='["/path/to/dir"]' style={{ fontFamily: "'Fira Code', monospace", fontSize: 'var(--text-sm)' }} />
                <div style={{ color: 'var(--md-on-surface-variant)', fontSize: 'var(--text-xs)', marginTop: 4 }}>
                  JSON 数组格式，如 ["--verbose", "/home/user"]
                </div>
              </Form.Item>
            </>
          )}

          {(transport === 'sse' || transport === 'streamable-http') && (
            <Form.Item name="url" label="服务器 URL" rules={[{ required: true, message: '请输入 URL' }]}>
              <Input placeholder="http://localhost:3001/sse" style={{ fontFamily: "'Fira Code', monospace" }} />
            </Form.Item>
          )}

          <Form.Item name="env" label="环境变量（可选）">
            <Input.TextArea rows={3} placeholder='{"KEY": "value"}' style={{ fontFamily: "'Fira Code', monospace", fontSize: 'var(--text-sm)' }} />
            <div style={{ color: 'var(--md-on-surface-variant)', fontSize: 'var(--text-xs)', marginTop: 4 }}>
              JSON 对象格式
            </div>
          </Form.Item>

          <Form.Item name="autoConnect" label="自动连接" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

function TerminalSettings() {
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
      <GlassCard>
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
              <div style={{ color: 'var(--md-on-surface-variant)', fontSize: 'var(--text-sm)', marginTop: 4 }}>
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
              <div style={{ color: 'var(--md-on-surface-variant)', fontSize: 'var(--text-sm)', marginTop: 4 }}>
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
  const [defaultBranch, setDefaultBranch] = useState(localStorage.getItem('devhub_git_default_branch') || 'main');
  const [commitTemplate, setCommitTemplate] = useState(localStorage.getItem('devhub_git_commit_template') || '');
  const [autoFetch, setAutoFetch] = useState(localStorage.getItem('devhub_git_auto_fetch') === 'true');
  const [verbose, setVerbose] = useState(localStorage.getItem('devhub_git_verbose') === 'true');

  const handleSave = () => {
    localStorage.setItem('devhub_git_default_branch', defaultBranch);
    localStorage.setItem('devhub_git_commit_template', commitTemplate);
    localStorage.setItem('devhub_git_auto_fetch', String(autoFetch));
    localStorage.setItem('devhub_git_verbose', String(verbose));
    message.success('Git 设置已保存');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <GlassCard>
        <CardHeader title="Git 设置" />
        <div style={{ padding: '16px 24px 20px', display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div>
            <div style={{ fontSize: 'var(--text-base)', color: 'var(--md-on-surface)', marginBottom: 4 }}>默认分支名</div>
            <div style={{ fontSize: 'var(--text-sm)', color: 'var(--md-on-surface-variant)', marginBottom: 12 }}>新项目初始化时使用的默认分支名</div>
            <Input
              value={defaultBranch}
              onChange={e => setDefaultBranch(e.target.value)}
              placeholder="main"
              style={{ width: 220 }}
            />
          </div>

          <div>
            <div style={{ fontSize: 'var(--text-base)', color: 'var(--md-on-surface)', marginBottom: 4 }}>提交模板</div>
            <div style={{ fontSize: 'var(--text-sm)', color: 'var(--md-on-surface-variant)', marginBottom: 12 }}>默认的 commit message 模板</div>
            <Input.TextArea
              value={commitTemplate}
              onChange={e => setCommitTemplate(e.target.value)}
              placeholder={"feat: \n\n描述变更内容"}
              rows={3}
              style={{ fontFamily: "'Fira Code', monospace", fontSize: 'var(--text-sm)' }}
            />
          </div>

          <ToggleRow
            label="自动 Fetch"
            description="后台定期从远程仓库获取最新状态"
            checked={autoFetch}
            onChange={() => setAutoFetch(!autoFetch)}
          />

          <ToggleRow
            label="详细日志"
            description="显示详细的 git 操作日志输出"
            checked={verbose}
            onChange={() => setVerbose(!verbose)}
          />
        </div>
      </GlassCard>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
        <Button
          icon={<UndoOutlined />}
          onClick={() => {
            setDefaultBranch('main');
            setCommitTemplate('');
            setAutoFetch(false);
            setVerbose(false);
            localStorage.removeItem('devhub_git_default_branch');
            localStorage.removeItem('devhub_git_commit_template');
            localStorage.removeItem('devhub_git_auto_fetch');
            localStorage.removeItem('devhub_git_verbose');
            message.info('已重置为默认值');
          }}
        >
          重置默认
        </Button>
        <Button type="primary" icon={<SaveOutlined />} onClick={handleSave}>保存设置</Button>
      </div>
    </div>
  );
}

function BuildSettings() {
  const [defaultBuildCmd, setDefaultBuildCmd] = useState(localStorage.getItem('devhub_build_default_cmd') || '');
  const [defaultRunCmd, setDefaultRunCmd] = useState(localStorage.getItem('devhub_build_default_run') || '');
  const [timeout, setTimeout_] = useState(Number(localStorage.getItem('devhub_build_timeout')) || 300);
  const [envVars, setEnvVars] = useState<Array<{ key: string; value: string }>>(() => {
    try {
      return JSON.parse(localStorage.getItem('devhub_build_global_env') || '[]');
    } catch { return []; }
  });

  const addEnvVar = () => setEnvVars([...envVars, { key: '', value: '' }]);
  const removeEnvVar = (index: number) => setEnvVars(envVars.filter((_, i) => i !== index));
  const updateEnvVar = (index: number, field: 'key' | 'value', val: string) => {
    const next = [...envVars];
    next[index] = { ...next[index], [field]: val };
    setEnvVars(next);
  };

  const handleSave = () => {
    localStorage.setItem('devhub_build_default_cmd', defaultBuildCmd);
    localStorage.setItem('devhub_build_default_run', defaultRunCmd);
    localStorage.setItem('devhub_build_timeout', String(timeout));
    localStorage.setItem('devhub_build_global_env', JSON.stringify(envVars.filter(e => e.key)));
    message.success('构建设置已保存');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <GlassCard>
        <CardHeader title="构建设置" />
        <div style={{ padding: '16px 24px 20px', display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div>
            <div style={{ fontSize: 'var(--text-base)', color: 'var(--md-on-surface)', marginBottom: 4 }}>默认构建命令</div>
            <div style={{ fontSize: 'var(--text-sm)', color: 'var(--md-on-surface-variant)', marginBottom: 12 }}>项目未配置时使用的 fallback 构建命令</div>
            <Input
              value={defaultBuildCmd}
              onChange={e => setDefaultBuildCmd(e.target.value)}
              placeholder="npm run build"
              style={{ fontFamily: "'Fira Code', monospace", fontSize: 'var(--text-sm)' }}
            />
          </div>

          <div>
            <div style={{ fontSize: 'var(--text-base)', color: 'var(--md-on-surface)', marginBottom: 4 }}>默认运行命令</div>
            <div style={{ fontSize: 'var(--text-sm)', color: 'var(--md-on-surface-variant)', marginBottom: 12 }}>项目未配置时使用的 fallback 运行命令</div>
            <Input
              value={defaultRunCmd}
              onChange={e => setDefaultRunCmd(e.target.value)}
              placeholder="npm run dev"
              style={{ fontFamily: "'Fira Code', monospace", fontSize: 'var(--text-sm)' }}
            />
          </div>

          <div>
            <div style={{ fontSize: 'var(--text-base)', color: 'var(--md-on-surface)', marginBottom: 4 }}>构建超时（秒）</div>
            <div style={{ fontSize: 'var(--text-sm)', color: 'var(--md-on-surface-variant)', marginBottom: 12 }}>构建过程的最大等待时间</div>
            <InputNumber
              value={timeout}
              onChange={v => setTimeout_(v || 300)}
              min={30}
              max={3600}
              step={30}
              style={{ width: 160 }}
            />
          </div>

          <div>
            <div style={{ fontSize: 'var(--text-base)', color: 'var(--md-on-surface)', marginBottom: 4 }}>全局环境变量</div>
            <div style={{ fontSize: 'var(--text-sm)', color: 'var(--md-on-surface-variant)', marginBottom: 12 }}>所有构建过程中注入的环境变量</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {envVars.map((env, i) => (
                <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <Input
                    value={env.key}
                    onChange={e => updateEnvVar(i, 'key', e.target.value)}
                    placeholder="KEY"
                    style={{ width: 180, fontFamily: "'Fira Code', monospace", fontSize: 'var(--text-sm)' }}
                  />
                  <span style={{ color: 'var(--md-on-surface-variant)' }}>=</span>
                  <Input
                    value={env.value}
                    onChange={e => updateEnvVar(i, 'value', e.target.value)}
                    placeholder="value"
                    style={{ flex: 1, fontFamily: "'Fira Code', monospace", fontSize: 'var(--text-sm)' }}
                  />
                  <Button
                    type="text"
                    danger
                    icon={<DeleteOutlined />}
                    onClick={() => removeEnvVar(i)}
                  />
                </div>
              ))}
              <Button
                type="dashed"
                icon={<PlusOutlined />}
                onClick={addEnvVar}
                style={{ alignSelf: 'flex-start' }}
              >
                添加变量
              </Button>
            </div>
          </div>
        </div>
      </GlassCard>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
        <Button
          icon={<UndoOutlined />}
          onClick={() => {
            setDefaultBuildCmd('');
            setDefaultRunCmd('');
            setTimeout_(300);
            setEnvVars([]);
            localStorage.removeItem('devhub_build_default_cmd');
            localStorage.removeItem('devhub_build_default_run');
            localStorage.removeItem('devhub_build_timeout');
            localStorage.removeItem('devhub_build_global_env');
            message.info('已重置为默认值');
          }}
        >
          重置默认
        </Button>
        <Button type="primary" icon={<SaveOutlined />} onClick={handleSave}>保存设置</Button>
      </div>
    </div>
  );
}

function DataManagementSettings() {
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
      <GlassCard>
        <CardHeader title="数据导出" />
        <div style={{ padding: '16px 24px 20px' }}>
          <div style={{ color: 'var(--md-on-surface-variant)', fontSize: 'var(--text-base)', marginBottom: 12 }}>
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
    } catch (err) {
      if (typeof err === 'object' && err !== null && 'errorFields' in err) return; // form validation
      message.error(`保存 Provider 失败: ${String(err)}`);
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
    } catch (err) {
      if (typeof err === 'object' && err !== null && 'errorFields' in err) return; // form validation
      message.error(`保存 Agent 配置失败: ${String(err)}`);
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
      <GlassCard>
        <CardHeader title="Model Providers" />
        <div style={{ padding: '4px 16px 0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 'var(--text-sm)', color: 'var(--md-on-surface-variant)' }}>
            <span className="material-symbols-outlined" style={{ fontSize: 14 }}>info</span>
            API 密钥以明文存储在本地数据库中，请勿共享数据库文件
          </div>
        </div>
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
              style: { cursor: 'pointer', background: selectedProviderId === record.id ? 'var(--md-primary-container)' : undefined },
            })}
          />
        </div>
      </GlassCard>

      <GlassCard>
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
        borderRight: '1px solid var(--border)',
        background: 'transparent',
      }}>
        {/* Page title */}
        <div style={{
          padding: '8px 12px 16px',
          fontSize: 'var(--text-xl)',
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
              fontSize: 'var(--text-xs)',
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
                    padding: '8px 12px 8px 10px',
                    border: 'none',
                    borderLeft: isActive ? '2px solid var(--md-primary)' : '2px solid transparent',
                    borderRadius: 8,
                    background: isActive
                      ? 'var(--md-primary-container)'
                      : 'transparent',
                    color: isActive ? 'var(--md-primary)' : 'var(--md-on-surface-variant)',
                    cursor: 'pointer',
                    fontFamily: 'var(--font-sans)',
                    fontSize: 'var(--text-base)',
                    textAlign: 'left',
                    transition: 'background 0.15s, color 0.15s',
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
                      fontSize: 'var(--text-xs)',
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
