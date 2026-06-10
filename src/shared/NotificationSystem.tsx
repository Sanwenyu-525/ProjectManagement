import { useState, useEffect } from 'react';
import { Card, List, Badge, Button, Tag, Space, Empty, Spin, Typography, Tooltip, Switch, Select } from 'antd';
import {
  BellOutlined,
  CheckOutlined,
  DeleteOutlined,
  ClockCircleOutlined,
  ExclamationCircleOutlined,
  FileTextOutlined,
  UserOutlined,
  SettingOutlined,
} from '@ant-design/icons';

const { Text } = Typography;

interface Notification {
  id: string;
  type: 'task_assigned' | 'task_completed' | 'deadline_approaching' | 'status_changed' | 'member_joined' | 'comment_added';
  title: string;
  message: string;
  projectId?: string;
  projectName?: string;
  taskId?: string;
  taskTitle?: string;
  createdAt: string;
  read: boolean;
}

const NOTIFICATION_CONFIG = {
  task_assigned: { icon: <FileTextOutlined />, color: '#3b82f6', label: '任务分配' },
  task_completed: { icon: <CheckOutlined />, color: '#22c55e', label: '任务完成' },
  deadline_approaching: { icon: <ClockCircleOutlined />, color: '#f59e0b', label: '截止日期临近' },
  status_changed: { icon: <ExclamationCircleOutlined />, color: '#8b5cf6', label: '状态变更' },
  member_joined: { icon: <UserOutlined />, color: '#06b6d4', label: '成员加入' },
  comment_added: { icon: <FileTextOutlined />, color: '#ec4899', label: '新评论' },
};

export default function NotificationSystem() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [settings, setSettings] = useState({
    taskAssigned: true,
    taskCompleted: true,
    deadlineApproaching: true,
    statusChanged: true,
    memberJoined: true,
    commentAdded: true,
  });

  useEffect(() => {
    loadNotifications();
  }, []);

  const loadNotifications = async () => {
    // 模拟加载通知数据
    const mockNotifications: Notification[] = [
      {
        id: '1',
        type: 'task_assigned',
        title: '新任务分配',
        message: '你有一个新的任务需要处理',
        projectId: '1',
        projectName: 'DevHub 前端',
        taskId: '101',
        taskTitle: '实现用户登录功能',
        createdAt: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
        read: false,
      },
      {
        id: '2',
        type: 'deadline_approaching',
        title: '截止日期临近',
        message: '任务将在 2 天后到期',
        projectId: '1',
        projectName: 'DevHub 前端',
        taskId: '102',
        taskTitle: '完成 UI 设计',
        createdAt: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
        read: false,
      },
      {
        id: '3',
        type: 'status_changed',
        title: '任务状态变更',
        message: '任务状态已更新为"进行中"',
        projectId: '2',
        projectName: 'DevHub 后端',
        taskId: '103',
        taskTitle: '优化 API 性能',
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
        read: true,
      },
      {
        id: '4',
        type: 'member_joined',
        title: '新成员加入',
        message: '王五已加入项目团队',
        projectId: '1',
        projectName: 'DevHub 前端',
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
        read: true,
      },
      {
        id: '5',
        type: 'comment_added',
        title: '新评论',
        message: '李四在任务中添加了评论',
        projectId: '1',
        projectName: 'DevHub 前端',
        taskId: '101',
        taskTitle: '实现用户登录功能',
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2).toISOString(),
        read: true,
      },
    ];
    setNotifications(mockNotifications);
    setLoading(false);
  };

  const markAsRead = (id: string) => {
    setNotifications(notifications.map(n =>
      n.id === id ? { ...n, read: true } : n
    ));
  };

  const markAllAsRead = () => {
    setNotifications(notifications.map(n => ({ ...n, read: true })));
  };

  const deleteNotification = (id: string) => {
    setNotifications(notifications.filter(n => n.id !== id));
  };

  const filteredNotifications = notifications.filter(n => {
    if (filter === 'unread') return !n.read;
    return true;
  });

  const unreadCount = notifications.filter(n => !n.read).length;

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return '刚刚';
    if (diffMins < 60) return `${diffMins} 分钟前`;
    if (diffHours < 24) return `${diffHours} 小时前`;
    if (diffDays < 7) return `${diffDays} 天前`;
    return date.toLocaleDateString('zh-CN');
  };

  if (loading) {
    return (
      <Card style={{ width: 400 }}>
        <div style={{ textAlign: 'center', padding: 40 }}>
          <Spin tip="加载通知..." />
        </div>
      </Card>
    );
  }

  return (
    <Card
      style={{ width: 400, borderRadius: 12 }}
      title={
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Space>
            <BellOutlined />
            <span>通知</span>
            {unreadCount > 0 && <Badge count={unreadCount} />}
          </Space>
          <Space>
            <Button size="small" onClick={markAllAsRead} disabled={unreadCount === 0}>
              全部已读
            </Button>
          </Space>
        </div>
      }
      extra={
        <Select
          value={filter}
          onChange={setFilter}
          size="small"
          style={{ width: 100 }}
          options={[
            { value: 'all', label: '全部' },
            { value: 'unread', label: '未读' },
          ]}
        />
      }
      bodyStyle={{ padding: 0, maxHeight: 500, overflow: 'auto' }}
    >
      {filteredNotifications.length === 0 ? (
        <Empty description="暂无通知" style={{ padding: 40 }} />
      ) : (
        <List
          dataSource={filteredNotifications}
          renderItem={(item) => {
            const config = NOTIFICATION_CONFIG[item.type];
            return (
              <List.Item
                style={{
                  padding: '12px 16px',
                  background: item.read ? 'transparent' : 'rgba(59, 130, 246, 0.02)',
                  cursor: 'pointer',
                }}
                onClick={() => markAsRead(item.id)}
                actions={[
                  <Tooltip title="删除" key="delete">
                    <Button
                      type="text"
                      size="small"
                      icon={<DeleteOutlined />}
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteNotification(item.id);
                      }}
                    />
                  </Tooltip>,
                ]}
              >
                <List.Item.Meta
                  avatar={
                    <div style={{
                      width: 36,
                      height: 36,
                      borderRadius: '50%',
                      background: `${config.color}15`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: config.color,
                    }}>
                      {config.icon}
                    </div>
                  }
                  title={
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontWeight: item.read ? 400 : 600 }}>{item.title}</span>
                      {!item.read && <Badge status="processing" />}
                    </div>
                  }
                  description={
                    <div>
                      <Text type="secondary" style={{ fontSize: 12 }}>{item.message}</Text>
                      {item.projectName && (
                        <div style={{ marginTop: 4 }}>
                          <Tag color="blue" style={{ fontSize: 11 }}>{item.projectName}</Tag>
                          {item.taskTitle && <Tag style={{ fontSize: 11 }}>{item.taskTitle}</Tag>}
                        </div>
                      )}
                      <div style={{ marginTop: 4, fontSize: 11, color: '#9eadc0' }}>
                        <ClockCircleOutlined style={{ marginRight: 4 }} />
                        {formatTime(item.createdAt)}
                      </div>
                    </div>
                  }
                />
              </List.Item>
            );
          }}
        />
      )}
    </Card>
  );
}
