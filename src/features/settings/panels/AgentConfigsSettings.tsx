import { useState, useEffect, useCallback } from 'react';
import { Form, Input, Button, message, Select, Table, Modal, Space, Popconfirm, InputNumber, Tag } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { GlassCard, CardHeader } from '../settingsComponents';
import { providersApi, agentConfigsApi } from '../../../api';
import type { ModelProvider, AgentConfig } from '../../../types';

const PROVIDER_TYPE_OPTIONS = [
  { value: 'claude', label: 'Claude Code' },
  { value: 'openai', label: 'OpenAI' },
  { value: 'gemini', label: 'Gemini' },
  { value: 'openai-compatible', label: 'OpenAI Compatible' },
];

export default function AgentConfigsSettings() {
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
