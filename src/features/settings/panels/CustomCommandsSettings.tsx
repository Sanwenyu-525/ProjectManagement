import { useState, useEffect, useCallback } from 'react';
import { Form, Input, Button, message, Table, Modal, Space, Popconfirm, InputNumber } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { GlassCard, CardHeader } from '../settingsComponents';
import { customCommandsApi } from '../../../api/customCommands';
import type { CustomCommand } from '../../../api/customCommands';

export default function CustomCommandsSettings() {
  const [commands, setCommands] = useState<CustomCommand[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<CustomCommand | null>(null);
  const [form] = Form.useForm();

  const loadCommands = useCallback(async () => {
    try {
      const data = await customCommandsApi.list();
      setCommands(data);
    } catch {
      message.error('加载自定义命令失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadCommands(); }, [loadCommands]);

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      const payload = {
        name: values.name,
        description: values.description || '',
        icon: values.icon || 'terminal',
        content: values.content,
        sortOrder: values.sortOrder ?? 0,
      };
      if (editing) {
        await customCommandsApi.update(editing.id, payload);
        message.success('命令已更新');
      } else {
        await customCommandsApi.create(payload);
        message.success('命令已创建');
      }
      setModalOpen(false);
      form.resetFields();
      setEditing(null);
      loadCommands();
    } catch (err) {
      if (typeof err === 'object' && err !== null && 'errorFields' in err) return;
      message.error(`保存失败: ${String(err)}`);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await customCommandsApi.delete(id);
      message.success('已删除');
      loadCommands();
    } catch {
      message.error('删除失败');
    }
  };

  const columns = [
    { title: '命令名', dataIndex: 'name', key: 'name', width: 160 },
    { title: '描述', dataIndex: 'description', key: 'description', ellipsis: true },
    { title: '图标', dataIndex: 'icon', key: 'icon', width: 100 },
    { title: '排序', dataIndex: 'sortOrder', key: 'sortOrder', width: 80 },
    {
      title: '操作',
      key: 'actions',
      width: 120,
      render: (_: unknown, record: CustomCommand) => (
        <Space>
          <Button
            type="text"
            size="small"
            icon={<EditOutlined />}
            onClick={() => {
              setEditing(record);
              form.setFieldsValue({
                name: record.name,
                description: record.description,
                icon: record.icon,
                content: record.content,
                sortOrder: record.sortOrder,
              });
              setModalOpen(true);
            }}
          />
          <Popconfirm title="确认删除此命令？" onConfirm={() => handleDelete(record.id)}>
            <Button type="text" size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <GlassCard>
        <CardHeader title="自定义 Slash 命令" />
        <div style={{ padding: '12px 16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <span style={{ fontSize: 'var(--text-sm)', color: 'var(--md-on-surface-variant)' }}>
              创建自定义 Agent 命令，输入 / 触发
            </span>
            <Button
              size="small"
              icon={<PlusOutlined />}
              onClick={() => { setEditing(null); form.resetFields(); setModalOpen(true); }}
            >
              新建命令
            </Button>
          </div>
          <Table
            dataSource={commands}
            columns={columns}
            rowKey="id"
            loading={loading}
            size="small"
            pagination={false}
          />
        </div>
      </GlassCard>
      <Modal
        title={editing ? '编辑命令' : '新建命令'}
        open={modalOpen}
        onCancel={() => { setModalOpen(false); setEditing(null); form.resetFields(); }}
        onOk={handleSave}
        destroyOnClose
        width={520}
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item
            name="name"
            label="命令名"
            rules={[
              { required: true, message: '请输入命令名' },
              { pattern: /^\/.+/, message: '命令名必须以 / 开头' },
            ]}
          >
            <Input placeholder="/my-command" />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input placeholder="命令用途描述" />
          </Form.Item>
          <Form.Item name="icon" label="图标" initialValue="terminal">
            <Input placeholder="Material Symbols 图标名" />
          </Form.Item>
          <Form.Item
            name="content"
            label="Prompt 模板"
            rules={[{ required: true, message: '请输入 prompt 内容' }]}
          >
            <Input.TextArea rows={4} placeholder="选中此命令时注入的 prompt 文本" />
          </Form.Item>
          <Form.Item name="sortOrder" label="排序" initialValue={0}>
            <InputNumber min={0} max={999} style={{ width: 120 }} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
