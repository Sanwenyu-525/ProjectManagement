import { useState } from 'react';
import { Card, Form, Input, Button, Typography, Tabs, message, Space, Modal } from 'antd';
import { SaveOutlined, KeyOutlined } from '@ant-design/icons';
import { useAuthStore } from '../../stores/authStore';

const { Title, Text } = Typography;

export default function SettingsPage() {
  return (
    <div style={{ padding: 24, maxWidth: 800, margin: '0 auto' }}>
      <Title level={3} style={{ marginBottom: 24 }}>设置</Title>
      <Tabs
        items={[
          { key: 'profile', label: '个人信息', children: <ProfileSettings /> },
          { key: 'integrations', label: '平台集成', children: <IntegrationSettings /> },
          { key: 'preferences', label: '偏好设置', children: <PreferenceSettings /> },
          { key: 'data', label: '数据管理', children: <DataSettings /> },
        ]}
      />
    </div>
  );
}

// ==================== 个人信息 ====================

function ProfileSettings() {
  const { user } = useAuthStore();

  return (
    <Card>
      <Form layout="vertical" initialValues={user || {}}>
        <Form.Item label="用户名">
          <Input value={user?.username} disabled />
        </Form.Item>
        <Form.Item label="邮箱">
          <Input value={user?.email} disabled />
        </Form.Item>
        <Form.Item label="注册时间">
          <Input value={user?.createdAt ? new Date(user.createdAt).toLocaleString('zh-CN') : ''} disabled />
        </Form.Item>
      </Form>
    </Card>
  );
}

// ==================== 平台集成 ====================

function IntegrationSettings() {
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedPlatform, setSelectedPlatform] = useState('');
  const [form] = Form.useForm();

  const platforms = [
    { name: 'GitHub', description: '同步 GitHub 仓库、提交、PR', color: '#333' },
    { name: 'GitLab', description: '同步 GitLab 仓库、MR、Pipeline', color: '#FC6D26' },
    { name: 'Gitee', description: '同步 Gitee 仓库、提交、PR', color: '#C71D23' },
  ];

  const handleConnect = (platform: string) => {
    setSelectedPlatform(platform);
    setModalOpen(true);
  };

  const handleSave = () => {
    message.success(`${selectedPlatform} 集成已保存（功能开发中）`);
    setModalOpen(false);
    form.resetFields();
  };

  return (
    <>
      <div style={{ display: 'grid', gap: 16 }}>
        {platforms.map(p => (
          <Card key={p.name}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <Space>
                  <div style={{ width: 12, height: 12, borderRadius: '50%', background: p.color }} />
                  <Text strong>{p.name}</Text>
                </Space>
                <div style={{ color: '#6b7a99', marginTop: 4 }}>{p.description}</div>
              </div>
              <Button icon={<KeyOutlined />} onClick={() => handleConnect(p.name)}>配置 Token</Button>
            </div>
          </Card>
        ))}
      </div>

      <Modal
        title={`配置 ${selectedPlatform}`}
        open={modalOpen}
        onCancel={() => { setModalOpen(false); form.resetFields(); }}
        onOk={() => form.submit()}
        okText="保存"
      >
        <Form form={form} layout="vertical" onFinish={handleSave}>
          <Form.Item name="accessToken" label="Personal Access Token" rules={[{ required: true, message: '请输入 Token' }]}>
            <Input.Password placeholder="粘贴你的 Token" />
          </Form.Item>
          <Form.Item name="username" label="用户名（可选）">
            <Input placeholder="用于验证 Token 有效性" />
          </Form.Item>
          <div style={{ background: 'rgba(34, 197, 94, 0.06)', padding: 12, borderRadius: 6, fontSize: 13, color: '#6b7a99' }}>
            {selectedPlatform === 'GitHub' && '前往 GitHub → Settings → Developer settings → Personal access tokens 生成 Token，需要 repo 权限。'}
            {selectedPlatform === 'GitLab' && '前往 GitLab → User Settings → Access Tokens 生成 Token，需要 api 权限。'}
            {selectedPlatform === 'Gitee' && '前往 Gitee → 设置 → 私人令牌 生成 Token，需要 projects 权限。'}
          </div>
        </Form>
      </Modal>
    </>
  );
}

// ==================== 偏好设置 ====================

function PreferenceSettings() {
  const [defaultCmd, setDefaultCmd] = useState(localStorage.getItem('devhub_default_open_cmd') || 'code {path}');

  const handleSave = () => {
    localStorage.setItem('devhub_default_open_cmd', defaultCmd);
    message.success('偏好已保存');
  };

  return (
    <Card>
      <Form layout="vertical">
        <Form.Item label="默认打开命令">
          <Input
            value={defaultCmd}
            onChange={e => setDefaultCmd(e.target.value)}
            placeholder="code {path}"
          />
          <div style={{ color: '#6b7a99', fontSize: 12, marginTop: 4 }}>
            {'{path}'} 会被替换为项目本地路径。常用: code {'{path}'}、webstorm {'{path}'}
          </div>
        </Form.Item>
        <Form.Item>
          <Button type="primary" icon={<SaveOutlined />} onClick={handleSave}>保存</Button>
        </Form.Item>
      </Form>
    </Card>
  );
}

// ==================== 数据管理 ====================

function DataSettings() {
  const handleExport = async () => {
    try {
      // 简单实现：导出 localStorage 中的数据
      const data = {
        token: localStorage.getItem('devhub_token'),
        preferences: {
          defaultOpenCmd: localStorage.getItem('devhub_default_open_cmd'),
        },
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
    <Card>
      <Space direction="vertical" style={{ width: '100%' }} size="large">
        <div>
          <Title level={5}>数据导出</Title>
          <Text type="secondary">导出本地偏好设置。项目数据存储在服务端数据库中。</Text>
          <div style={{ marginTop: 12 }}>
            <Button onClick={handleExport}>导出设置</Button>
          </div>
        </div>
      </Space>
    </Card>
  );
}
