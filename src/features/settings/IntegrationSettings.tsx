import { useState } from 'react';
import { Form, Input, Button, message, Modal, Tag } from 'antd';
import { KeyOutlined, CheckCircleOutlined } from '@ant-design/icons';
import { useIntegrations, useCreateIntegration, useUpdateIntegration } from '../../hooks/useBuilds';
import { useThemeStore } from '../../stores/themeStore';

const PLATFORM_META = [
  { name: 'GitHub', description: '同步 GitHub 仓库、提交、PR', color: '#333' },
  { name: 'GitLab', description: '同步 GitLab 仓库、MR、Pipeline', color: '#FC6D26' },
  { name: 'Gitee', description: '同步 Gitee 仓库、提交、PR', color: '#C71D23' },
];

export default function IntegrationSettings() {
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
              border: '1px solid var(--border)',
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
