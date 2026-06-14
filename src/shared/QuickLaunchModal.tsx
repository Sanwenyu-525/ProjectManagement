import { useState, useEffect } from 'react';
import { Modal, Button, Space, Tag, Empty, message, Tooltip, Popconfirm, Input, Form, Select, List } from 'antd';
import { PlusOutlined, PlayCircleOutlined, EditOutlined, DeleteOutlined, HistoryOutlined, ClockCircleOutlined, CheckCircleOutlined, CloseCircleOutlined, CopyOutlined, DownloadOutlined, UploadOutlined } from '@ant-design/icons';
import { launchProfilesStorage, launchHistoryStorage, LaunchProfile, LaunchHistoryEntry } from '../lib/launchProfiles';
import type { ProjectWithStats } from '../types';
import ProjectIcon from './ProjectIcon';

interface QuickLaunchModalProps {
  visible: boolean;
  onClose: () => void;
  projects: ProjectWithStats[];
  onLaunch: (projectIds: string[], profile?: LaunchProfile) => void;
}

export default function QuickLaunchModal({ visible, onClose, projects, onLaunch }: QuickLaunchModalProps) {
  const [profiles, setProfiles] = useState<LaunchProfile[]>([]);
  const [history, setHistory] = useState<LaunchHistoryEntry[]>([]);
  const [activeTab, setActiveTab] = useState<'profiles' | 'history'>('profiles');
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [editingProfile, setEditingProfile] = useState<LaunchProfile | null>(null);
  const [form] = Form.useForm();

  useEffect(() => {
    if (visible) {
      loadProfiles();
      loadHistory();
    }
  }, [visible]);

  const loadProfiles = () => {
    setProfiles(launchProfilesStorage.sortByLastUsed());
  };

  const loadHistory = () => {
    setHistory(launchHistoryStorage.getRecent(20));
  };

  const handleCreateProfile = async (values: { name: string; description?: string; projectIds: string[]; launchOrder?: 'selected' | 'manual' | 'smart' }) => {
    try {
      const profile = launchProfilesStorage.save({
        name: values.name,
        description: values.description,
        projectIds: values.projectIds,
        launchOrder: values.launchOrder || 'smart',
      });

      message.success(`配置 "${profile.name}" 已创建`);
      setCreateModalVisible(false);
      form.resetFields();
      loadProfiles();
    } catch {
      message.error('创建失败');
    }
  };

  const handleEditProfile = (profile: LaunchProfile) => {
    setEditingProfile(profile);
    form.setFieldsValue({
      name: profile.name,
      description: profile.description,
      projectIds: profile.projectIds,
      launchOrder: profile.launchOrder,
    });
    setCreateModalVisible(true);
  };

  const handleDeleteProfile = (profile: LaunchProfile) => {
    launchProfilesStorage.delete(profile.id);
    message.success(`配置 "${profile.name}" 已删除`);
    loadProfiles();
  };

  const handleDuplicateProfile = (profile: LaunchProfile) => {
    launchProfilesStorage.save({
      ...profile,
      name: `${profile.name} (副本)`,
    });
    message.success('配置已复制');
    loadProfiles();
  };

  const handleLaunchProfile = (profile: LaunchProfile) => {
    launchProfilesStorage.incrementUseCount(profile.id);
    onLaunch(profile.projectIds, profile);
    onClose();
  };

  const handleLaunchAll = () => {
    const allProjectIds = projects.map(p => p.id);
    onLaunch(allProjectIds);
    onClose();
  };

  const handleExportProfiles = () => {
    const data = JSON.stringify(profiles, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `devhub-launch-profiles-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    message.success('配置已导出');
  };

  const handleImportProfiles = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      try {
        const text = await file.text();
        const importedProfiles = JSON.parse(text);

        if (!Array.isArray(importedProfiles)) {
          message.error('无效的配置文件格式');
          return;
        }

        let importedCount = 0;
        for (const profile of importedProfiles) {
          if (profile.name && profile.projectIds) {
            launchProfilesStorage.save({
              name: profile.name,
              description: profile.description,
              projectIds: profile.projectIds,
              launchOrder: profile.launchOrder || 'smart',
            });
            importedCount++;
          }
        }

        message.success(`成功导入 ${importedCount} 个配置`);
        loadProfiles();
      } catch {
        message.error('导入失败：文件格式错误');
      }
    };
    input.click();
  };

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
  };

  const renderProfiles = () => {
    if (profiles.length === 0) {
      return (
        <Empty
          description="暂无快速启动配置"
          image={Empty.PRESENTED_IMAGE_SIMPLE}
        >
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateModalVisible(true)}>
            创建配置
          </Button>
        </Empty>
      );
    }

    return (
      <List
        dataSource={profiles}
        renderItem={(profile) => {
          const profileProjects = profile.projectIds
            .map(id => projects.find(p => p.id === id))
            .filter(Boolean);

          return (
            <List.Item
              actions={[
                <Tooltip title="启动" key="launch">
                  <Button
                    type="primary"
                    icon={<PlayCircleOutlined />}
                    onClick={() => handleLaunchProfile(profile)}
                  >
                    启动
                  </Button>
                </Tooltip>,
                <Tooltip title="编辑" key="edit">
                  <Button icon={<EditOutlined />} onClick={() => handleEditProfile(profile)} />
                </Tooltip>,
                <Tooltip title="复制" key="duplicate">
                  <Button icon={<CopyOutlined />} onClick={() => handleDuplicateProfile(profile)} />
                </Tooltip>,
                <Popconfirm
                  key="delete"
                  title="确定要删除这个配置吗？"
                  onConfirm={() => handleDeleteProfile(profile)}
                  okText="删除"
                  cancelText="取消"
                >
                  <Button danger icon={<DeleteOutlined />} />
                </Popconfirm>,
              ]}
            >
              <List.Item.Meta
                title={
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span>{profile.name}</span>
                    <Tag>{profile.projectIds.length} 个项目</Tag>
                    {profile.lastUsed && (
                      <Tooltip title={`上次使用：${profile.lastUsed.toLocaleString()}`}>
                        <ClockCircleOutlined style={{ color: '#8b95a5', fontSize: 12 }} />
                      </Tooltip>
                    )}
                  </div>
                }
                description={
                  <div>
                    {profile.description && (
                      <div style={{ marginBottom: 4, color: '#6b7a99' }}>{profile.description}</div>
                    )}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                      {profileProjects.filter((p): p is ProjectWithStats => !!p).slice(0, 5).map((p) => (
                        <Tag key={p.id} style={{ fontSize: 11 }}>
                          <ProjectIcon name={p.name} techStack={p.techStack} iconType={p.iconType} iconUrl={p.iconUrl} iconColor={p.iconColor} size={12} style={{ marginRight: 4 }} />
                          {p.name}
                        </Tag>
                      ))}
                      {profileProjects.length > 5 && (
                        <Tag style={{ fontSize: 11 }}>+{profileProjects.length - 5}</Tag>
                      )}
                    </div>
                  </div>
                }
              />
            </List.Item>
          );
        }}
      />
    );
  };

  const renderHistory = () => {
    if (history.length === 0) {
      return (
        <Empty
          description="暂无启动历史"
          image={Empty.PRESENTED_IMAGE_SIMPLE}
        />
      );
    }

    return (
      <List
        dataSource={history}
        renderItem={(entry) => (
          <List.Item>
            <List.Item.Meta
              title={
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {entry.successCount === entry.projects.length ? (
                    <CheckCircleOutlined style={{ color: '#52c41a' }} />
                  ) : entry.failedCount === entry.projects.length ? (
                    <CloseCircleOutlined style={{ color: '#ff4d4f' }} />
                  ) : (
                    <HistoryOutlined style={{ color: '#f59e0b' }} />
                  )}
                  <span>{entry.timestamp.toLocaleString()}</span>
                  <Tag color={entry.successCount === entry.projects.length ? 'success' : entry.failedCount === entry.projects.length ? 'error' : 'warning'}>
                    {entry.successCount}/{entry.projects.length} 成功
                  </Tag>
                  <Tag>{formatDuration(entry.totalDuration)}</Tag>
                </div>
              }
              description={
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {entry.projects.map((p) => (
                    <Tooltip key={p.projectId} title={p.error || p.projectName}>
                      <Tag
                        color={p.status === 'success' ? 'success' : 'error'}
                        style={{ fontSize: 11 }}
                      >
                        {p.projectName}
                        {p.port && ` (${p.port})`}
                      </Tag>
                    </Tooltip>
                  ))}
                </div>
              }
            />
          </List.Item>
        )}
      />
    );
  };

  return (
    <>
      <Modal
        title="快速启动"
        open={visible}
        onCancel={onClose}
        width={700}
        footer={[
          <Button key="export" icon={<DownloadOutlined />} onClick={handleExportProfiles}>
            导出配置
          </Button>,
          <Button key="import" icon={<UploadOutlined />} onClick={handleImportProfiles}>
            导入配置
          </Button>,
          <Button key="launchAll" type="primary" icon={<PlayCircleOutlined />} onClick={handleLaunchAll}>
            启动所有项目
          </Button>,
        ]}
      >
        <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
          <Space>
            <Button
              type={activeTab === 'profiles' ? 'primary' : 'default'}
              onClick={() => setActiveTab('profiles')}
            >
              快速配置
            </Button>
            <Button
              type={activeTab === 'history' ? 'primary' : 'default'}
              onClick={() => setActiveTab('history')}
            >
              启动历史
            </Button>
          </Space>
          {activeTab === 'profiles' && (
            <Button icon={<PlusOutlined />} onClick={() => setCreateModalVisible(true)}>
              新建配置
            </Button>
          )}
        </div>

        {activeTab === 'profiles' ? renderProfiles() : renderHistory()}
      </Modal>

      <Modal
        title={editingProfile ? '编辑配置' : '新建配置'}
        open={createModalVisible}
        onCancel={() => {
          setCreateModalVisible(false);
          setEditingProfile(null);
          form.resetFields();
        }}
        onOk={() => form.submit()}
        width={500}
      >
        <Form form={form} layout="vertical" onFinish={handleCreateProfile}>
          <Form.Item name="name" label="配置名称" rules={[{ required: true, message: '请输入配置名称' }]}>
            <Input placeholder="如：日常开发" />
          </Form.Item>
          <Form.Item name="description" label="描述（可选）">
            <Input.TextArea rows={2} placeholder="简要描述这个配置的用途..." />
          </Form.Item>
          <Form.Item name="projectIds" label="选择项目" rules={[{ required: true, message: '请选择项目' }]}>
            <Select
              mode="multiple"
              placeholder="选择要包含的项目"
              options={projects.map(p => ({
                value: p.id,
                label: p.name,
              }))}
            />
          </Form.Item>
          <Form.Item name="launchOrder" label="启动顺序" initialValue="smart">
            <Select
              options={[
                { value: 'smart', label: '智能排序' },
                { value: 'selected', label: '按选择顺序' },
                { value: 'manual', label: '自定义顺序' },
              ]}
            />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}
