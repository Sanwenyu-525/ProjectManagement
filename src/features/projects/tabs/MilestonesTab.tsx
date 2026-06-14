import { useState, useEffect } from 'react';
import { Select, Button, Space, Table, Tag, Modal, Form, Input, Empty, message } from 'antd';
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import { milestonesApi } from '../../../api';
import type { Milestone, CreateMilestoneInput } from '../../../types';

const STATUS_MAP: Record<string, { color: string; label: string }> = {
  Pending: { color: 'default', label: '待开始' },
  InProgress: { color: 'processing', label: '进行中' },
  Completed: { color: 'success', label: '已完成' },
  Overdue: { color: 'error', label: '已逾期' },
};

export default function MilestonesTab({ projectId }: { projectId: string }) {
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [form] = Form.useForm();

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { loadMilestones(); }, []);

  async function loadMilestones() {
    try {
      const data = await milestonesApi.list(projectId);
      setMilestones(data);
    } finally {
      setLoading(false);
    }
  }

  const handleCreate = async (values: CreateMilestoneInput) => {
    await milestonesApi.create(projectId, values);
    message.success('里程碑创建成功');
    setModalOpen(false);
    form.resetFields();
    loadMilestones();
  };

  const handleDelete = async (id: string) => {
    Modal.confirm({
      title: '确认删除',
      content: '删除里程碑不会删除关联的任务。',
      okType: 'danger',
      onOk: async () => {
        await milestonesApi.delete(id);
        message.success('已删除');
        loadMilestones();
      },
    });
  };

  return (
    <>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'flex-end' }}>
        <Button icon={<PlusOutlined />} type="primary" onClick={() => setModalOpen(true)}>新建里程碑</Button>
      </div>
      {milestones.length === 0 && !loading ? (
        <Empty description="暂无里程碑" />
      ) : (
        <Table
          dataSource={milestones} rowKey="id" loading={loading} pagination={false}
          columns={[
            { title: '名称', dataIndex: 'name' },
            { title: '描述', dataIndex: 'description', ellipsis: true, render: (v: string) => v || '-' },
            { title: '状态', dataIndex: 'status', render: (v: string) => {
              const s = STATUS_MAP[v] || { color: 'default', label: v };
              return <Tag color={s.color}>{s.label}</Tag>;
            }},
            { title: '截止日期', dataIndex: 'dueDate', render: (v: string) => v ? new Date(v).toLocaleDateString('zh-CN') : '-' },
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            { title: '任务数', render: (_: unknown, r: any) => r._count?.tasks || 0 },
            { title: '操作', render: (_: unknown, record: Milestone) => (
              <Space>
                <Select value={record.status} size="small" style={{ width: 100 }}
                  onChange={async (status) => { await milestonesApi.update(record.id, { status }); loadMilestones(); }}
                  options={Object.entries(STATUS_MAP).map(([k, v]) => ({ value: k, label: v.label }))} />
                <Button size="small" icon={<DeleteOutlined />} danger onClick={() => handleDelete(record.id)} />
              </Space>
            )},
          ]}
        />
      )}

      <Modal title="新建里程碑" open={modalOpen} onCancel={() => { setModalOpen(false); form.resetFields(); }} onOk={() => form.submit()} okText="创建">
        <Form form={form} layout="vertical" onFinish={handleCreate}>
          <Form.Item name="name" label="名称" rules={[{ required: true }]}>
            <Input placeholder="v1.0 发布" />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.Item name="dueDate" label="截止日期">
            <Input type="date" />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}
