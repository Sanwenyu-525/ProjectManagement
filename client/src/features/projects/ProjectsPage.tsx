import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Button, Input, Select, Row, Col, Tag, Space, Modal, Form, message, Empty, Spin, Dropdown } from 'antd';
import { PlusOutlined, SearchOutlined, FolderOpenOutlined, MoreOutlined } from '@ant-design/icons';
import { projectsApi } from '../../api';
import ProjectIcon from '../../shared/ProjectIcon';

const STATUS_OPTIONS = ['Idea', 'Planning', 'Development', 'Testing', 'Deployed', 'Maintained', 'Archived'];
const STATUS_COLORS: Record<string, string> = {
  Idea: 'default', Planning: 'blue', Development: 'orange',
  Testing: 'purple', Deployed: 'green', Maintained: 'cyan', Archived: 'default',
};
const PRIORITY_OPTIONS = ['Low', 'Medium', 'High', 'Critical'];
const SOURCE_OPTIONS = [
  { value: 'Local', label: '本地项目' },
  { value: 'Remote', label: '远程项目' },
  { value: 'Hybrid', label: '混合项目' },
];

export default function ProjectsPage() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string | undefined>();
  const [modalOpen, setModalOpen] = useState(false);
  const [form] = Form.useForm();

  const loadProjects = useCallback(async () => {
    try {
      const params: Record<string, string> = {};
      if (search) params.search = search;
      if (statusFilter) params.status = statusFilter;
      const res = await projectsApi.list(params);
      setProjects(res.data.data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter]);

  useEffect(() => { loadProjects(); }, [loadProjects]);

  const handleCreate = async (values: any) => {
    try {
      await projectsApi.create({
        ...values,
        techStack: values.techStack ? values.techStack.split(',').map((s: string) => s.trim()).filter(Boolean) : [],
      });
      message.success('项目创建成功');
      setModalOpen(false);
      form.resetFields();
      loadProjects();
    } catch (err: any) {
      message.error(err.response?.data?.error?.message || '创建失败');
    }
  };

  const handleDelete = async (id: string) => {
    Modal.confirm({
      title: '确认删除',
      content: '删除后不可恢复，确认要删除该项目吗？',
      okType: 'danger',
      onOk: async () => {
        await projectsApi.delete(id);
        message.success('已删除');
        loadProjects();
      },
    });
  };

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2 style={{ margin: 0 }}>项目管理</h2>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalOpen(true)}>
          新建项目
        </Button>
      </div>

      <Space style={{ marginBottom: 16 }} wrap>
        <Input
          placeholder="搜索项目..."
          prefix={<SearchOutlined />}
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ width: 240 }}
          allowClear
        />
        <Select
          placeholder="按状态筛选"
          value={statusFilter}
          onChange={setStatusFilter}
          allowClear
          style={{ width: 160 }}
          options={STATUS_OPTIONS.map(s => ({ value: s, label: s }))}
        />
      </Space>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 80 }}><Spin size="large" /></div>
      ) : projects.length === 0 ? (
        <Empty description="暂无项目" />
      ) : (
        <Row gutter={[16, 16]}>
          {projects.map(project => (
            <Col key={project.id} xs={24} sm={12} md={8} lg={6}>
              <Card
                hoverable
                onDoubleClick={() => projectsApi.open(project.id).then(() => message.success('正在打开项目...')).catch((e: any) => message.warning(e.response?.data?.error?.message || '打开失败'))}
                onClick={() => navigate(`/projects/${project.id}`)}
                style={{ borderRadius: 8 }}
                actions={[
                  <Dropdown
                    key="more"
                    menu={{
                      items: [
                        { key: 'open', label: '打开项目', icon: <FolderOpenOutlined /> },
                        { key: 'delete', label: '删除', danger: true, onClick: () => handleDelete(project.id) },
                      ],
                    }}
                    trigger={['click']}
                  >
                    <MoreOutlined onClick={e => e.stopPropagation()} />
                  </Dropdown>,
                ]}
              >
                <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
                  <ProjectIcon
                    name={project.name}
                    techStack={project.techStack}
                    iconType={project.iconType}
                    iconUrl={project.iconUrl}
                    iconColor={project.iconColor}
                    size={48}
                  />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {project.name}
                    </div>
                    <Tag color={STATUS_COLORS[project.status]} style={{ marginTop: 4 }}>{project.status}</Tag>
                  </div>
                </div>
                {project.description && (
                  <div style={{ color: '#999', fontSize: 13, marginBottom: 8, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {project.description}
                  </div>
                )}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {project.techStack?.slice(0, 3).map((t: string) => <Tag key={t} style={{ fontSize: 11 }}>{t}</Tag>)}
                  {project.remoteRepos?.length > 0 && (
                    <Tag color="blue">{project.remoteRepos.length} 仓库</Tag>
                  )}
                </div>
              </Card>
            </Col>
          ))}
        </Row>
      )}

      {/* 新建项目弹窗 */}
      <Modal
        title="新建项目"
        open={modalOpen}
        onCancel={() => { setModalOpen(false); form.resetFields(); }}
        onOk={() => form.submit()}
        okText="创建"
        cancelText="取消"
        width={520}
      >
        <Form form={form} layout="vertical" onFinish={handleCreate}>
          <Form.Item name="name" label="项目名称" rules={[{ required: true, message: '请输入项目名称' }]}>
            <Input placeholder="我的项目" />
          </Form.Item>
          <Form.Item name="description" label="项目描述">
            <Input.TextArea rows={2} placeholder="简要描述项目..." />
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="source" label="项目来源" initialValue="Local">
                <Select options={SOURCE_OPTIONS} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="priority" label="优先级" initialValue="Medium">
                <Select options={PRIORITY_OPTIONS.map(p => ({ value: p, label: p }))} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="localPath" label="本地路径">
            <Input placeholder="D:\Projects\my-app" />
          </Form.Item>
          <Form.Item name="openCommand" label="打开命令">
            <Input placeholder="code {path}" />
          </Form.Item>
          <Form.Item name="techStack" label="技术栈（逗号分隔）">
            <Input placeholder="React, TypeScript, Node.js" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
