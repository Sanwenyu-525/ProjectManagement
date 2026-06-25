import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ThunderboltOutlined, CloseOutlined, CheckCircleFilled, PlusOutlined, CodeOutlined, ApartmentOutlined, ApiOutlined, DesktopOutlined, CloudOutlined } from '@ant-design/icons';
import { message, Input, Button } from 'antd';
import { templatesApi, projectsApi } from '../../api';
import type { Template } from '../../types';
import './NewProjectWizard.css';

interface TemplateVM {
  id: string;
  name: string;
  icon: React.ReactNode;
  bgIcon: React.ReactNode;
  desc: string;
  tags: string[];
  iconVariant: string;
}

const ICON_MAP: Record<string, React.ReactNode> = {
  code: <CodeOutlined />,
  cloud: <CloudOutlined />,
  apartment: <ApartmentOutlined />,
  api: <ApiOutlined />,
  desktop: <DesktopOutlined />,
};

function templateToVM(t: Template): TemplateVM {
  let extra: Record<string, string> = {};
  try { extra = JSON.parse(t.data); } catch { /* ok */ }
  let tags: string[] = [];
  try { tags = JSON.parse(t.tags); } catch { /* ok */ }
  const iconNode = ICON_MAP[t.icon || ''] || <CodeOutlined />;
  return {
    id: t.id,
    name: t.name,
    icon: iconNode,
    bgIcon: iconNode,
    desc: t.description || '',
    tags,
    iconVariant: extra.iconVariant || 'primary',
  };
}

const DEFAULT_TEMPLATES: TemplateVM[] = [
  { id: 'react', name: 'React', icon: <CodeOutlined />, bgIcon: <CodeOutlined />, desc: '标准 React SPA 项目，基于 Vite、Tailwind CSS 和 TypeScript。', tags: ['vite', 'ts'], iconVariant: 'primary' },
  { id: 'nextjs', name: 'Next.js', icon: <CloudOutlined />, bgIcon: <CloudOutlined />, desc: '全栈 React 框架，支持 App Router 和 Server Components。', tags: ['app-router', 'ssr'], iconVariant: 'default' },
  { id: 'vue', name: 'Vue 3', icon: <ApartmentOutlined />, bgIcon: <ApartmentOutlined />, desc: '渐进式 JavaScript 框架，使用 Composition API 和 Vite。', tags: ['vite', 'vue-router'], iconVariant: 'tertiary' },
  { id: 'node', name: 'Node.js API', icon: <ApiOutlined />, bgIcon: <ApiOutlined />, desc: '基于 Express 的 REST API 模板，集成 Prisma ORM。', tags: ['express', 'prisma'], iconVariant: 'tertiary-container' },
  { id: 'tauri', name: 'Tauri App', icon: <DesktopOutlined />, bgIcon: <DesktopOutlined />, desc: '跨平台桌面应用，使用 Rust 和 Web 技术。', tags: ['rust', 'react'], iconVariant: 'secondary' },
];

export default function NewProjectWizard() {
  const navigate = useNavigate();
  const [selected, setSelected] = useState<string>('react');
  const [projectName, setProjectName] = useState('');
  const [templates, setTemplates] = useState<TemplateVM[]>(DEFAULT_TEMPLATES);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    templatesApi.list('project').then(list => {
      if (list.length > 0) setTemplates(list.map(templateToVM));
    }).catch(() => {});
  }, []);

  const handleClose = () => navigate('/projects');

  const handleCreate = async () => {
    const trimmedName = projectName.trim();
    if (!trimmedName) {
      message.warning('请输入项目名称');
      return;
    }
    const selectedTemplate = templates.find(t => t.id === selected);
    setCreating(true);
    try {
      const project = await projectsApi.create({
        name: trimmedName,
        techStack: selectedTemplate?.tags,
      });
      message.success(`项目「${trimmedName}」创建成功`);
      navigate(`/projects/${project.id}`);
    } catch (err) {
      message.error(`创建失败: ${err}`);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="wizard-page">
      {/* Decorative backgrounds */}
      <div className="wizard-deco-top" />
      <div className="wizard-deco-bottom" />

      {/* Header */}
      <header className="wizard-header">
        <div className="wizard-header-left">
          <ThunderboltOutlined className="wizard-header-logo" />
          <span className="wizard-header-title">DevHub</span>
          <div className="wizard-header-divider" />
          <span className="wizard-header-subtitle">新建项目</span>
        </div>
        <div className="wizard-close-btn" onClick={handleClose} role="button" tabIndex={0}>
          <CloseOutlined />
        </div>
      </header>

      {/* Main */}
      <main className="wizard-main">
        <div className="wizard-content">
          {/* Intro */}
          <div className="wizard-intro">
            <h1>开始构建新项目</h1>
            <p>选择一个模板来快速启动新项目。</p>
          </div>

          <div className="wizard-grid">
            {templates.map((t) => (
              <div
                key={t.id}
                className={`wizard-card ${selected === t.id ? 'wizard-card--selected' : ''}`}
                onClick={() => setSelected(t.id)}
                role="button"
                tabIndex={0}
                onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelected(t.id); } }}
              >
                <div className="wizard-card-bg-icon" style={{ color: `var(--md-${t.iconVariant === 'default' ? 'on-surface' : t.iconVariant})` }}>
                  {t.bgIcon}
                </div>
                <div className="wizard-card-header">
                  <div className={`wizard-card-icon-box wizard-card-icon-box--${t.iconVariant}`}>
                    {t.icon}
                  </div>
                  {selected === t.id && <CheckCircleFilled className="wizard-card-check" />}
                </div>
                <h3 className="wizard-card-title">{t.name}</h3>
                <p className="wizard-card-desc">{t.desc}</p>
                <div className="wizard-card-tags">
                  {t.tags.map((tag) => (
                    <span key={tag} className="wizard-card-tag">{tag}</span>
                  ))}
                </div>
              </div>
            ))}

            {/* Blank Canvas */}
            <div
              className={`wizard-card wizard-card--blank ${selected === 'blank' ? 'wizard-card--selected' : ''}`}
              onClick={() => setSelected('blank')}
              role="button"
              tabIndex={0}
              onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelected('blank'); } }}
            >
              <div className="wizard-blank-icon">
                <PlusOutlined />
              </div>
              <h3 className="wizard-card-title">空白画布</h3>
              <p className="wizard-card-desc">完全从零开始</p>
            </div>
          </div>

          {/* Project name input */}
          <div style={{ marginTop: 20, maxWidth: 400 }}>
            <Input
              value={projectName}
              onChange={e => setProjectName(e.target.value)}
              placeholder="输入项目名称"
              size="large"
              onPressEnter={handleCreate}
            />
          </div>

          {/* Footer */}
          <div className="wizard-footer">
            <Button icon={<CloseOutlined />} onClick={handleClose}>
              取消
            </Button>
            <Button
              type="primary"
              loading={creating}
              onClick={handleCreate}
            >
              完成创建
              <span style={{ fontSize: 14 }}>→</span>
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}
