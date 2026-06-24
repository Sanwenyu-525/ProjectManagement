import { useState } from 'react';
import { Button, Space, Table, Tag, Modal, Form, Input, Select, message } from 'antd';
import { SyncOutlined, PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import { reposApi } from '../../../api';
import type { RemoteRepo, AddRepoInput } from '../../../types';

export default function ReposTab({ projectId, repos, onRefresh }: { projectId: string; repos: RemoteRepo[]; onRefresh: () => void }) {
  const [modalOpen, setModalOpen] = useState(false);
  const [form] = Form.useForm();
  const [syncing, setSyncing] = useState<string | null>(null);

  const handleAdd = async (values: AddRepoInput) => {
    try {
      await reposApi.add(projectId, values);
      message.success('仓库关联成功');
      setModalOpen(false);
      form.resetFields();
      onRefresh();
    } catch (err: unknown) {
      message.error(String(err) || '关联失败');
    }
  };

  const handleSync = async (repoId: string) => {
    setSyncing(repoId);
    try {
      await reposApi.sync(repoId);
      message.success('同步完成');
      onRefresh();
    } catch (err: unknown) {
      message.error(String(err) || '同步失败');
    } finally {
      setSyncing(null);
    }
  };

  const handleRemove = async (repoId: string) => {
    Modal.confirm({
      title: '确认移除',
      content: '移除仓库关联不会删除远程仓库，仅解除本项目的关联。',
      onOk: async () => {
        await reposApi.remove(repoId);
        message.success('已移除');
        onRefresh();
      },
    });
  };

  const columns = [
    { title: '平台', dataIndex: 'platform', render: (v: string) => <Tag>{v}</Tag> },
    { title: '仓库', dataIndex: 'repoFullName' },
    { title: '分支', dataIndex: 'defaultBranch', render: (v: string) => v || '-' },
    { title: '状态', dataIndex: 'repoStatus', render: (v: string) => <Tag color={v === 'Synced' ? 'green' : v === 'Error' ? 'red' : 'orange'}>{v}</Tag> },
    { title: '最后同步', dataIndex: 'lastSyncAt', render: (v: string) => v ? new Date(v).toLocaleString('zh-CN') : '从未' },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    { title: '任务数', render: (_: unknown, r: any) => r._count?.tasks || 0 },
    {
      title: '操作', render: (_: unknown, record: RemoteRepo) => (
        <Space>
          <Button size="small" icon={<SyncOutlined />} loading={syncing === record.id} onClick={() => handleSync(record.id)}>同步</Button>
          <Button size="small" icon={<DeleteOutlined />} danger onClick={() => handleRemove(record.id)} />
        </Space>
      ),
    },
  ];

  return (
    <>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'flex-end' }}>
        <Button icon={<PlusOutlined />} type="primary" onClick={() => setModalOpen(true)}>关联远程仓库</Button>
      </div>
      <Table columns={columns} dataSource={repos} rowKey="id" pagination={false} />

      <Modal title="关联远程仓库" open={modalOpen} onCancel={() => { setModalOpen(false); form.resetFields(); }} onOk={() => form.submit()} okText="关联">
        <Form form={form} layout="vertical" onFinish={handleAdd}>
          <Form.Item name="platform" label="平台" rules={[{ required: true }]}>
            <Select options={['GitHub', 'GitLab', 'Gitee', 'Bitbucket'].map(p => ({ value: p, label: p }))} />
          </Form.Item>
          <Form.Item name="repoFullName" label="仓库全名" rules={[{ required: true, message: '如 user/repo' }]}>
            <Input placeholder="user/repo" />
          </Form.Item>
          <Form.Item name="repoUrl" label="仓库地址" rules={[{ required: true, type: 'url' }]}>
            <Input placeholder="https://github.com/user/repo" />
          </Form.Item>
          <Form.Item name="defaultBranch" label="默认分支">
            <Input placeholder="main" />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}
