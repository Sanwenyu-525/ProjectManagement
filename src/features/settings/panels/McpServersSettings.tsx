import { useState, useEffect, useCallback } from 'react';
import { Form, Input, Button, message, Select, Table, Modal, Space, Popconfirm, Tag, Switch } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { GlassCard, CardHeader } from '../settingsComponents';
import { mcpServersApi } from '../../../api';
import type { McpServer } from '../../../types';

export default function McpServersSettings() {
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
