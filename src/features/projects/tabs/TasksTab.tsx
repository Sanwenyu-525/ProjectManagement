import { useState, useEffect } from 'react';
import { Select, Button, Space, Table, Tag, Modal, Form, Input, Spin, message } from 'antd';
import { PlusOutlined, AppstoreOutlined, TableOutlined } from '@ant-design/icons';
import { tasksApi } from '../../../api';
import type { Task, RemoteRepo, CreateTaskInput } from '../../../types';
import KanbanBoard from '../../../shared/KanbanBoard';

export default function TasksTab({ projectId, repos }: { projectId: string; repos: RemoteRepo[] }) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [scopeFilter, setScopeFilter] = useState<string | undefined>();
  const [modalOpen, setModalOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'table' | 'kanban'>('kanban');
  const [form] = Form.useForm();

  /* eslint-disable react-hooks/exhaustive-deps */
  useEffect(() => { loadTasks(); }, [scopeFilter]);
  /* eslint-enable react-hooks/exhaustive-deps */

  async function loadTasks() {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (scopeFilter !== undefined) params.repoScope = scopeFilter;
      const data = await tasksApi.list(projectId, params);
      setTasks(data);
    } finally {
      setLoading(false);
    }
  }

  const handleCreate = async (values: CreateTaskInput) => {
    await tasksApi.create(projectId, { ...values, repoScope: values.repoScope || undefined });
    message.success('任务创建成功');
    setModalOpen(false);
    form.resetFields();
    loadTasks();
  };

  const handleStatusChange = async (taskId: string, status: string) => {
    await tasksApi.updateStatus(taskId, status);
    loadTasks();
  };

  const columns = [
    { title: '标题', dataIndex: 'title', ellipsis: true },
    { title: '状态', dataIndex: 'status', render: (v: string, record: Task) => (
      <Select value={v} size="small" style={{ width: 110 }} onChange={(s) => handleStatusChange(record.id, s)}
        options={['Todo', 'InProgress', 'Done', 'Cancelled'].map(s => ({ value: s, label: s }))} />
    )},
    { title: '优先级', dataIndex: 'priority', render: (v: string) => <Tag>{v}</Tag> },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    { title: '仓库范围', render: (_: unknown, r: any) => r.scopedRepo ? <Tag>{r.scopedRepo.platform}: {r.scopedRepo.repoFullName}</Tag> : <Tag color="blue">全部</Tag> },
    { title: '截止日期', dataIndex: 'dueDate', render: (v: string) => v ? new Date(v).toLocaleDateString('zh-CN') : '-' },
  ];

  return (
    <>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Space>
          <Select placeholder="按仓库筛选" allowClear value={scopeFilter} onChange={setScopeFilter} style={{ width: 200 }}
            options={[
              { value: 'null', label: '所有仓库共享' },
              ...repos.map(r => ({ value: r.id, label: `${r.platform}: ${r.repoFullName}` })),
            ]}
          />
          <Button.Group>
            <Button icon={<AppstoreOutlined />} type={viewMode === 'kanban' ? 'primary' : 'default'} onClick={() => setViewMode('kanban')}>看板</Button>
            <Button icon={<TableOutlined />} type={viewMode === 'table' ? 'primary' : 'default'} onClick={() => setViewMode('table')}>列表</Button>
          </Button.Group>
        </Space>
        <Button icon={<PlusOutlined />} type="primary" onClick={() => setModalOpen(true)}>新建任务</Button>
      </div>

      {loading ? (
        <Spin />
      ) : viewMode === 'kanban' ? (
        <KanbanBoard tasks={tasks} onTaskUpdated={loadTasks} />
      ) : (
        <Table columns={columns} dataSource={tasks} rowKey="id" pagination={false} />
      )}

      <Modal title="新建任务" open={modalOpen} onCancel={() => { setModalOpen(false); form.resetFields(); }} onOk={() => form.submit()} okText="创建">
        <Form form={form} layout="vertical" onFinish={handleCreate}>
          <Form.Item name="title" label="标题" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.Item name="priority" label="优先级" initialValue="Medium">
            <Select options={['Low', 'Medium', 'High', 'Critical'].map(p => ({ value: p, label: p }))} />
          </Form.Item>
          <Form.Item name="repoScope" label="仓库范围">
            <Select allowClear placeholder="全部仓库共享"
              options={[
                { value: null, label: '全部仓库共享' },
                ...repos.map(r => ({ value: r.id, label: `${r.platform}: ${r.repoFullName}` })),
              ]}
            />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}
