import { useState, useEffect } from 'react';
import { Card, Table, Button, Modal, Select, Space, Tag, message, Popconfirm, Checkbox, Dropdown } from 'antd';
import {
  DeleteOutlined,
  EditOutlined,
  SyncOutlined,
  MoreOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  PauseCircleOutlined,
  PlayCircleOutlined,
} from '@ant-design/icons';

interface Task {
  id: string;
  title: string;
  status: string;
  priority: string;
  assignee?: string;
  projectId: string;
}

interface BatchOperationProps {
  tasks: Task[];
  onTasksUpdated: () => void;
}

const STATUS_OPTIONS = [
  { value: 'Todo', label: '待办', color: '#8b95a5' },
  { value: 'InProgress', label: '进行中', color: '#3b82f6' },
  { value: 'Done', label: '已完成', color: '#22c55e' },
  { value: 'Cancelled', label: '已取消', color: '#ff4d4f' },
];

const PRIORITY_OPTIONS = [
  { value: 'Low', label: '低', color: '#8b95a5' },
  { value: 'Medium', label: '中', color: '#3b82f6' },
  { value: 'High', label: '高', color: '#f59e0b' },
  { value: 'Urgent', label: '紧急', color: '#ff4d4f' },
];

export default function BatchOperations({ tasks, onTasksUpdated }: BatchOperationProps) {
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const [priorityModalOpen, setPriorityModalOpen] = useState(false);
  const [assigneeModalOpen, setAssigneeModalOpen] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState<string>('');
  const [selectedPriority, setSelectedPriority] = useState<string>('');
  const [selectedAssignee, setSelectedAssignee] = useState<string>('');

  const selectedTasks = tasks.filter(t => selectedRowKeys.includes(t.id));

  const handleBatchStatusChange = async () => {
    if (!selectedStatus) {
      message.warning('请选择状态');
      return;
    }

    try {
      // 模拟批量更新状态
      message.success(`已更新 ${selectedRowKeys.length} 个任务的状态为 "${selectedStatus}"`);
      setStatusModalOpen(false);
      setSelectedRowKeys([]);
      setSelectedStatus('');
      onTasksUpdated();
    } catch (error) {
      message.error('批量更新失败');
    }
  };

  const handleBatchPriorityChange = async () => {
    if (!selectedPriority) {
      message.warning('请选择优先级');
      return;
    }

    try {
      // 模拟批量更新优先级
      message.success(`已更新 ${selectedRowKeys.length} 个任务的优先级为 "${selectedPriority}"`);
      setPriorityModalOpen(false);
      setSelectedRowKeys([]);
      setSelectedPriority('');
      onTasksUpdated();
    } catch (error) {
      message.error('批量更新失败');
    }
  };

  const handleBatchAssigneeChange = async () => {
    try {
      // 模拟批量分配
      message.success(`已分配 ${selectedRowKeys.length} 个任务给 "${selectedAssignee || '未分配'}"`);
      setAssigneeModalOpen(false);
      setSelectedRowKeys([]);
      setSelectedAssignee('');
      onTasksUpdated();
    } catch (error) {
      message.error('批量分配失败');
    }
  };

  const handleBatchDelete = async () => {
    Modal.confirm({
      title: '确认删除',
      content: `确定要删除选中的 ${selectedRowKeys.length} 个任务吗？此操作不可恢复。`,
      okType: 'danger',
      onOk: () => {
        // 模拟批量删除
        message.success(`已删除 ${selectedRowKeys.length} 个任务`);
        setSelectedRowKeys([]);
        onTasksUpdated();
      },
    });
  };

  const columns = [
    {
      title: '任务',
      dataIndex: 'title',
      key: 'title',
      render: (text: string) => <span style={{ fontWeight: 500 }}>{text}</span>,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => {
        const config = STATUS_OPTIONS.find(s => s.value === status);
        return <Tag color={config?.color}>{config?.label || status}</Tag>;
      },
    },
    {
      title: '优先级',
      dataIndex: 'priority',
      key: 'priority',
      render: (priority: string) => {
        const config = PRIORITY_OPTIONS.find(p => p.value === priority);
        return <Tag color={config?.color}>{config?.label || priority}</Tag>;
      },
    },
    {
      title: '负责人',
      dataIndex: 'assignee',
      key: 'assignee',
      render: (assignee: string) => assignee || '-',
    },
  ];

  const menuItems = [
    {
      key: 'status',
      label: '更改状态',
      icon: <SyncOutlined />,
      onClick: () => setStatusModalOpen(true),
    },
    {
      key: 'priority',
      label: '更改优先级',
      icon: <EditOutlined />,
      onClick: () => setPriorityModalOpen(true),
    },
    {
      key: 'assignee',
      label: '分配任务',
      icon: <EditOutlined />,
      onClick: () => setAssigneeModalOpen(true),
    },
    {
      type: 'divider' as const,
    },
    {
      key: 'delete',
      label: '批量删除',
      icon: <DeleteOutlined />,
      danger: true,
      onClick: handleBatchDelete,
    },
  ];

  return (
    <div>
      {/* Batch Actions Toolbar */}
      {selectedRowKeys.length > 0 && (
        <Card
          style={{
            marginBottom: 16,
            background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.08) 0%, rgba(59, 130, 246, 0.02) 100%)',
            border: '1px solid rgba(59, 130, 246, 0.2)',
          }}
          bodyStyle={{ padding: '12px 16px' }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Space>
              <Checkbox
                checked={selectedRowKeys.length === tasks.length}
                indeterminate={selectedRowKeys.length > 0 && selectedRowKeys.length < tasks.length}
                onChange={(e) => {
                  if (e.target.checked) {
                    setSelectedRowKeys(tasks.map(t => t.id));
                  } else {
                    setSelectedRowKeys([]);
                  }
                }}
              />
              <span style={{ fontWeight: 500 }}>已选择 {selectedRowKeys.length} 个任务</span>
            </Space>
            <Space>
              <Button size="small" onClick={() => setStatusModalOpen(true)}>
                更改状态
              </Button>
              <Button size="small" onClick={() => setPriorityModalOpen(true)}>
                更改优先级
              </Button>
              <Dropdown menu={{ items: menuItems }} trigger={['click']}>
                <Button size="small" icon={<MoreOutlined />}>
                  更多操作
                </Button>
              </Dropdown>
              <Button size="small" onClick={() => setSelectedRowKeys([])}>
                取消选择
              </Button>
            </Space>
          </div>
        </Card>
      )}

      {/* Task Table with Selection */}
      <Table
        columns={columns}
        dataSource={tasks}
        rowKey="id"
        rowSelection={{
          selectedRowKeys,
          onChange: setSelectedRowKeys,
        }}
        pagination={false}
        size="small"
      />

      {/* Status Change Modal */}
      <Modal
        title="批量更改状态"
        open={statusModalOpen}
        onCancel={() => {
          setStatusModalOpen(false);
          setSelectedStatus('');
        }}
        onOk={handleBatchStatusChange}
      >
        <p>将 {selectedRowKeys.length} 个任务的状态更改为：</p>
        <Select
          value={selectedStatus}
          onChange={setSelectedStatus}
          style={{ width: '100%' }}
          placeholder="选择新状态"
        >
          {STATUS_OPTIONS.map(option => (
            <Select.Option key={option.value} value={option.value}>
              <Tag color={option.color} style={{ marginRight: 8 }}>{option.label}</Tag>
            </Select.Option>
          ))}
        </Select>
      </Modal>

      {/* Priority Change Modal */}
      <Modal
        title="批量更改优先级"
        open={priorityModalOpen}
        onCancel={() => {
          setPriorityModalOpen(false);
          setSelectedPriority('');
        }}
        onOk={handleBatchPriorityChange}
      >
        <p>将 {selectedRowKeys.length} 个任务的优先级更改为：</p>
        <Select
          value={selectedPriority}
          onChange={setSelectedPriority}
          style={{ width: '100%' }}
          placeholder="选择新优先级"
        >
          {PRIORITY_OPTIONS.map(option => (
            <Select.Option key={option.value} value={option.value}>
              <Tag color={option.color} style={{ marginRight: 8 }}>{option.label}</Tag>
            </Select.Option>
          ))}
        </Select>
      </Modal>

      {/* Assignee Change Modal */}
      <Modal
        title="批量分配任务"
        open={assigneeModalOpen}
        onCancel={() => {
          setAssigneeModalOpen(false);
          setSelectedAssignee('');
        }}
        onOk={handleBatchAssigneeChange}
      >
        <p>将 {selectedRowKeys.length} 个任务分配给：</p>
        <Select
          value={selectedAssignee}
          onChange={setSelectedAssignee}
          style={{ width: '100%' }}
          placeholder="选择负责人（留空表示取消分配）"
          allowClear
        >
          <Select.Option value="">取消分配</Select.Option>
          <Select.Option value="张三">张三</Select.Option>
          <Select.Option value="李四">李四</Select.Option>
          <Select.Option value="王五">王五</Select.Option>
        </Select>
      </Modal>
    </div>
  );
}
