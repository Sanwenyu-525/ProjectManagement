import { useState, useEffect } from 'react';
import { Card, Table, Button, Modal, Form, Input, Select, Avatar, Tag, Space, Popconfirm, message, Tooltip, Badge } from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  UserOutlined,
  MailOutlined,
  PhoneOutlined,
  CrownOutlined,
  TeamOutlined,
} from '@ant-design/icons';

interface Member {
  id: string;
  name: string;
  email: string;
  role: 'Owner' | 'Admin' | 'Member' | 'Viewer';
  avatar?: string;
  phone?: string;
  department?: string;
  joinedAt: string;
  lastActive?: string;
  tasksAssigned: number;
  tasksCompleted: number;
}

const ROLE_CONFIG = {
  Owner: { color: 'gold', icon: <CrownOutlined />, label: '所有者' },
  Admin: { color: 'blue', icon: <UserOutlined />, label: '管理员' },
  Member: { color: 'green', icon: <UserOutlined />, label: '成员' },
  Viewer: { color: 'default', icon: <UserOutlined />, label: '观察者' },
};

export default function MemberManagement({ projectId }: { projectId: string }) {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<Member | null>(null);
  const [form] = Form.useForm();

  useEffect(() => {
    loadMembers();
  }, [projectId]);

  const loadMembers = async () => {
    // 模拟加载成员数据
    const mockMembers: Member[] = [
      {
        id: '1',
        name: '张三',
        email: 'zhangsan@example.com',
        role: 'Owner',
        phone: '13800138000',
        department: '技术部',
        joinedAt: '2024-01-15',
        lastActive: '2024-01-20',
        tasksAssigned: 15,
        tasksCompleted: 12,
      },
      {
        id: '2',
        name: '李四',
        email: 'lisi@example.com',
        role: 'Admin',
        phone: '13800138001',
        department: '产品部',
        joinedAt: '2024-02-01',
        lastActive: '2024-01-19',
        tasksAssigned: 10,
        tasksCompleted: 8,
      },
      {
        id: '3',
        name: '王五',
        email: 'wangwu@example.com',
        role: 'Member',
        department: '设计部',
        joinedAt: '2024-02-15',
        tasksAssigned: 8,
        tasksCompleted: 6,
      },
    ];
    setMembers(mockMembers);
    setLoading(false);
  };

  const handleAddMember = async (values: any) => {
    try {
      const newMember: Member = {
        id: Date.now().toString(),
        ...values,
        joinedAt: new Date().toISOString(),
        tasksAssigned: 0,
        tasksCompleted: 0,
      };
      setMembers([...members, newMember]);
      message.success('成员已添加');
      setModalOpen(false);
      form.resetFields();
    } catch (error) {
      message.error('添加失败');
    }
  };

  const handleEditMember = async (values: any) => {
    if (!editingMember) return;
    try {
      const updatedMembers = members.map(m =>
        m.id === editingMember.id ? { ...m, ...values } : m
      );
      setMembers(updatedMembers);
      message.success('成员信息已更新');
      setModalOpen(false);
      setEditingMember(null);
      form.resetFields();
    } catch (error) {
      message.error('更新失败');
    }
  };

  const handleDeleteMember = async (memberId: string) => {
    try {
      setMembers(members.filter(m => m.id !== memberId));
      message.success('成员已移除');
    } catch (error) {
      message.error('删除失败');
    }
  };

  const openEditModal = (member: Member) => {
    setEditingMember(member);
    form.setFieldsValue({
      name: member.name,
      email: member.email,
      role: member.role,
      phone: member.phone,
      department: member.department,
    });
    setModalOpen(true);
  };

  const columns = [
    {
      title: '成员',
      key: 'member',
      render: (_: any, record: Member) => (
        <Space>
          <Avatar
            size={40}
            icon={<UserOutlined />}
            src={record.avatar}
            style={{ backgroundColor: ROLE_CONFIG[record.role].color === 'gold' ? '#faad14' : '#3b82f6' }}
          />
          <div>
            <div style={{ fontWeight: 600 }}>{record.name}</div>
            <div style={{ fontSize: 12, color: '#6b7a99' }}>{record.email}</div>
          </div>
        </Space>
      ),
    },
    {
      title: '角色',
      dataIndex: 'role',
      key: 'role',
      render: (role: string) => {
        const config = ROLE_CONFIG[role as keyof typeof ROLE_CONFIG];
        return (
          <Tag color={config.color} icon={config.icon}>
            {config.label}
          </Tag>
        );
      },
    },
    {
      title: '部门',
      dataIndex: 'department',
      key: 'department',
      render: (dept: string) => dept || '-',
    },
    {
      title: '任务统计',
      key: 'tasks',
      render: (_: any, record: Member) => (
        <div>
          <div>分配: {record.tasksAssigned}</div>
          <div>完成: {record.tasksCompleted}</div>
          <div style={{ fontSize: 12, color: '#22c55e' }}>
            完成率: {record.tasksAssigned > 0 ? Math.round((record.tasksCompleted / record.tasksAssigned) * 100) : 0}%
          </div>
        </div>
      ),
    },
    {
      title: '最后活跃',
      dataIndex: 'lastActive',
      key: 'lastActive',
      render: (date: string) => date ? new Date(date).toLocaleDateString('zh-CN') : '从未',
    },
    {
      title: '操作',
      key: 'actions',
      render: (_: any, record: Member) => (
        <Space>
          <Tooltip title="编辑">
            <Button
              type="text"
              icon={<EditOutlined />}
              onClick={() => openEditModal(record)}
            />
          </Tooltip>
          {record.role !== 'Owner' && (
            <Popconfirm
              title="确定要移除这个成员吗？"
              onConfirm={() => handleDeleteMember(record.id)}
              okText="移除"
              cancelText="取消"
            >
              <Tooltip title="移除">
                <Button type="text" danger icon={<DeleteOutlined />} />
              </Tooltip>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <TeamOutlined style={{ fontSize: 18, color: '#8b5cf6' }} />
          <h3 style={{ margin: 0 }}>团队成员</h3>
          <Badge count={members.length} style={{ backgroundColor: '#8b5cf6' }} />
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalOpen(true)}>
          添加成员
        </Button>
      </div>

      <Card>
        <Table
          columns={columns}
          dataSource={members}
          rowKey="id"
          loading={loading}
          pagination={false}
        />
      </Card>

      <Modal
        title={editingMember ? '编辑成员' : '添加成员'}
        open={modalOpen}
        onCancel={() => {
          setModalOpen(false);
          setEditingMember(null);
          form.resetFields();
        }}
        onOk={() => form.submit()}
        width={520}
      >
        <Form form={form} layout="vertical" onFinish={editingMember ? handleEditMember : handleAddMember}>
          <Form.Item name="name" label="姓名" rules={[{ required: true, message: '请输入姓名' }]}>
            <Input placeholder="输入成员姓名" />
          </Form.Item>
          <Form.Item name="email" label="邮箱" rules={[{ required: true, type: 'email', message: '请输入有效的邮箱' }]}>
            <Input placeholder="输入邮箱地址" />
          </Form.Item>
          <Form.Item name="role" label="角色" initialValue="Member">
            <Select>
              <Select.Option value="Owner">所有者</Select.Option>
              <Select.Option value="Admin">管理员</Select.Option>
              <Select.Option value="Member">成员</Select.Option>
              <Select.Option value="Viewer">观察者</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item name="phone" label="电话">
            <Input placeholder="输入电话号码" />
          </Form.Item>
          <Form.Item name="department" label="部门">
            <Input placeholder="输入部门名称" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
