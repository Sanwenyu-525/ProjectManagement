import { useState, useEffect } from 'react';
import { Card, Row, Col, Button, Tag, Space, Modal, Form, Input, Select, Empty, message, Tooltip } from 'antd';
import {
  PlusOutlined,
  CopyOutlined,
  EditOutlined,
  DeleteOutlined,
  RocketOutlined,
  CodeOutlined,
  DatabaseOutlined,
  CloudOutlined,
  MobileOutlined,
  DesktopOutlined,
} from '@ant-design/icons';

interface ProjectTemplate {
  id: string;
  name: string;
  description: string;
  category: 'web' | 'mobile' | 'backend' | 'database' | 'devops' | 'other';
  techStack: string[];
  defaultCommands: {
    dev?: string;
    build?: string;
    test?: string;
  };
  isBuiltin: boolean;
  usageCount: number;
}

const CATEGORY_CONFIG = {
  web: { icon: <CodeOutlined />, color: '#3b82f6', label: 'Web 应用' },
  mobile: { icon: <MobileOutlined />, color: '#8b5cf6', label: '移动应用' },
  backend: { icon: <CloudOutlined />, color: '#22c55e', label: '后端服务' },
  database: { icon: <DatabaseOutlined />, color: '#f59e0b', label: '数据库' },
  devops: { icon: <RocketOutlined />, color: '#06b6d4', label: 'DevOps' },
  other: { icon: <DesktopOutlined />, color: '#6b7280', label: '其他' },
};

const BUILTIN_TEMPLATES: ProjectTemplate[] = [
  {
    id: 'react',
    name: 'React 应用',
    description: '使用 Create React App 或 Vite 创建的 React 应用',
    category: 'web',
    techStack: ['React', 'TypeScript', 'Vite'],
    defaultCommands: {
      dev: 'npm run dev',
      build: 'npm run build',
      test: 'npm test',
    },
    isBuiltin: true,
    usageCount: 156,
  },
  {
    id: 'vue',
    name: 'Vue 应用',
    description: '使用 Vue CLI 或 Vite 创建的 Vue 应用',
    category: 'web',
    techStack: ['Vue', 'TypeScript', 'Vite'],
    defaultCommands: {
      dev: 'npm run dev',
      build: 'npm run build',
      test: 'npm test',
    },
    isBuiltin: true,
    usageCount: 89,
  },
  {
    id: 'nextjs',
    name: 'Next.js 应用',
    description: '使用 Next.js 创建的全栈 React 应用',
    category: 'web',
    techStack: ['Next.js', 'React', 'TypeScript'],
    defaultCommands: {
      dev: 'npm run dev',
      build: 'npm run build',
      test: 'npm test',
    },
    isBuiltin: true,
    usageCount: 67,
  },
  {
    id: 'nodejs',
    name: 'Node.js 后端',
    description: 'Express/Fastify/NestJS 后端服务',
    category: 'backend',
    techStack: ['Node.js', 'Express', 'TypeScript'],
    defaultCommands: {
      dev: 'npm run dev',
      build: 'npm run build',
      test: 'npm test',
    },
    isBuiltin: true,
    usageCount: 112,
  },
  {
    id: 'python',
    name: 'Python 后端',
    description: 'Django/Flask/FastAPI 后端服务',
    category: 'backend',
    techStack: ['Python', 'Django', 'PostgreSQL'],
    defaultCommands: {
      dev: 'python manage.py runserver',
      build: 'python manage.py collectstatic',
      test: 'python manage.py test',
    },
    isBuiltin: true,
    usageCount: 78,
  },
  {
    id: 'react-native',
    name: 'React Native',
    description: '跨平台移动应用',
    category: 'mobile',
    techStack: ['React Native', 'TypeScript'],
    defaultCommands: {
      dev: 'npm run android',
      build: 'npm run build',
      test: 'npm test',
    },
    isBuiltin: true,
    usageCount: 45,
  },
  {
    id: 'flutter',
    name: 'Flutter',
    description: '跨平台移动应用',
    category: 'mobile',
    techStack: ['Flutter', 'Dart'],
    defaultCommands: {
      dev: 'flutter run',
      build: 'flutter build apk',
      test: 'flutter test',
    },
    isBuiltin: true,
    usageCount: 34,
  },
  {
    id: 'docker',
    name: 'Docker 项目',
    description: '容器化应用',
    category: 'devops',
    techStack: ['Docker', 'Docker Compose'],
    defaultCommands: {
      dev: 'docker-compose up',
      build: 'docker-compose build',
    },
    isBuiltin: true,
    usageCount: 89,
  },
];

export default function ProjectTemplates() {
  const [templates, setTemplates] = useState<ProjectTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<ProjectTemplate | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [form] = Form.useForm();

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    // 加载内置模板和用户自定义模板
    const customTemplates = localStorage.getItem('devhub_custom_templates');
    const custom = customTemplates ? JSON.parse(customTemplates) : [];
    setTemplates([...BUILTIN_TEMPLATES, ...custom]);
    setLoading(false);
  };

  const handleCreateTemplate = async (values: any) => {
    try {
      const newTemplate: ProjectTemplate = {
        id: Date.now().toString(),
        ...values,
        isBuiltin: false,
        usageCount: 0,
      };

      const updatedTemplates = [...templates, newTemplate];
      setTemplates(updatedTemplates);

      // 保存到本地存储
      const customTemplates = updatedTemplates.filter(t => !t.isBuiltin);
      localStorage.setItem('devhub_custom_templates', JSON.stringify(customTemplates));

      message.success('模板已创建');
      setModalOpen(false);
      form.resetFields();
    } catch (error) {
      message.error('创建失败');
    }
  };

  const handleDeleteTemplate = async (templateId: string) => {
    const template = templates.find(t => t.id === templateId);
    if (template?.isBuiltin) {
      message.warning('不能删除内置模板');
      return;
    }

    Modal.confirm({
      title: '确认删除',
      content: '确定要删除这个模板吗？',
      okType: 'danger',
      onOk: () => {
        const updatedTemplates = templates.filter(t => t.id !== templateId);
        setTemplates(updatedTemplates);

        const customTemplates = updatedTemplates.filter(t => !t.isBuiltin);
        localStorage.setItem('devhub_custom_templates', JSON.stringify(customTemplates));

        message.success('模板已删除');
      },
    });
  };

  const handleUseTemplate = (template: ProjectTemplate) => {
    // 增加使用次数
    const updatedTemplates = templates.map(t =>
      t.id === template.id ? { ...t, usageCount: t.usageCount + 1 } : t
    );
    setTemplates(updatedTemplates);

    // 跳转到创建项目页面，并预填模板信息
    message.success(`使用模板 "${template.name}" 创建项目`);
    // TODO: 跳转到创建项目页面
  };

  const filteredTemplates = selectedCategory === 'all'
    ? templates
    : templates.filter(t => t.category === selectedCategory);

  const categories = Object.entries(CATEGORY_CONFIG).map(([key, config]) => ({
    value: key,
    label: config.label,
    icon: config.icon,
  }));

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ margin: 0 }}>项目模板</h3>
        <Space>
          <Select
            value={selectedCategory}
            onChange={setSelectedCategory}
            style={{ width: 150 }}
            options={[{ value: 'all', label: '全部分类' }, ...categories]}
          />
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalOpen(true)}>
            创建模板
          </Button>
        </Space>
      </div>

      <Row gutter={[16, 16]}>
        {filteredTemplates.map(template => {
          const categoryConfig = CATEGORY_CONFIG[template.category];
          return (
            <Col key={template.id} xs={24} sm={12} md={8} lg={6}>
              <Card
                hoverable
                style={{ height: 200 }}
                actions={[
                  <Tooltip title="使用模板" key="use">
                    <Button type="link" icon={<RocketOutlined />} onClick={() => handleUseTemplate(template)}>
                      使用
                    </Button>
                  </Tooltip>,
                  !template.isBuiltin && (
                    <Tooltip title="删除" key="delete">
                      <Button type="link" danger icon={<DeleteOutlined />} onClick={() => handleDeleteTemplate(template.id)} />
                    </Tooltip>
                  ),
                ].filter(Boolean)}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                  <div style={{
                    width: 40,
                    height: 40,
                    borderRadius: 8,
                    background: `${categoryConfig.color}15`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: categoryConfig.color,
                  }}>
                    {categoryConfig.icon}
                  </div>
                  <div>
                    <div style={{ fontWeight: 600 }}>{template.name}</div>
                    <Tag color={categoryConfig.color} style={{ fontSize: 11, margin: 0 }}>
                      {categoryConfig.label}
                    </Tag>
                  </div>
                </div>

                <div style={{ color: '#6b7a99', fontSize: 12, marginBottom: 12, lineHeight: 1.5 }}>
                  {template.description}
                </div>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 8 }}>
                  {template.techStack.slice(0, 3).map(tech => (
                    <Tag key={tech} style={{ fontSize: 11, margin: 0 }}>{tech}</Tag>
                  ))}
                  {template.techStack.length > 3 && (
                    <Tag style={{ fontSize: 11, margin: 0 }}>+{template.techStack.length - 3}</Tag>
                  )}
                </div>

                <div style={{ fontSize: 11, color: '#9eadc0' }}>
                  使用次数: {template.usageCount}
                </div>
              </Card>
            </Col>
          );
        })}
      </Row>

      {filteredTemplates.length === 0 && (
        <Empty description="暂无模板" />
      )}

      {/* Create Template Modal */}
      <Modal
        title="创建模板"
        open={modalOpen}
        onCancel={() => {
          setModalOpen(false);
          setEditingTemplate(null);
          form.resetFields();
        }}
        onOk={() => form.submit()}
        width={520}
      >
        <Form form={form} layout="vertical" onFinish={handleCreateTemplate}>
          <Form.Item name="name" label="模板名称" rules={[{ required: true, message: '请输入模板名称' }]}>
            <Input placeholder="如：React + TypeScript" />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input.TextArea rows={2} placeholder="简要描述模板用途..." />
          </Form.Item>
          <Form.Item name="category" label="分类" rules={[{ required: true, message: '请选择分类' }]}>
            <Select placeholder="选择分类">
              {categories.map(cat => (
                <Select.Option key={cat.value} value={cat.value}>
                  <Space>
                    {cat.icon}
                    {cat.label}
                  </Space>
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="techStack" label="技术栈" rules={[{ required: true, message: '请输入技术栈' }]}>
            <Select
              mode="tags"
              placeholder="输入技术栈，按回车添加"
            />
          </Form.Item>
          <Form.Item name="devCommand" label="开发命令">
            <Input placeholder="如：npm run dev" />
          </Form.Item>
          <Form.Item name="buildCommand" label="构建命令">
            <Input placeholder="如：npm run build" />
          </Form.Item>
          <Form.Item name="testCommand" label="测试命令">
            <Input placeholder="如：npm test" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
