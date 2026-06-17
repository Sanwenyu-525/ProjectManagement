import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ThunderboltOutlined, CloseOutlined, CheckCircleFilled, PlusOutlined, CodeOutlined, ApartmentOutlined, ApiOutlined, DesktopOutlined, CloudOutlined } from '@ant-design/icons';
import { templatesApi } from '../../api';
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

const STEPS = [
  { label: '模板', active: true },
  { label: '工作区', active: false },
  { label: '智能体', active: false },
];

export default function NewProjectWizard() {
  const navigate = useNavigate();
  const [selected, setSelected] = useState<string>('react');
  const [templates, setTemplates] = useState<TemplateVM[]>(DEFAULT_TEMPLATES);

  useEffect(() => {
    templatesApi.list('project').then(list => {
      if (list.length > 0) setTemplates(list.map(templateToVM));
    }).catch(() => {});
  }, []);

  const handleClose = () => navigate('/projects');

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
            <p>选择一个模板来快速启动新项目。后续步骤中可以配置工作区、智能体和构建流水线。</p>
          </div>

          {/* Steps */}
          <div className="wizard-steps">
            {STEPS.map((step, i) => (
              <div key={step.label} style={{ display: 'contents' }}>
                {i > 0 && <div className="wizard-step-divider" />}
                <div className={`wizard-step ${step.active ? '' : 'wizard-step--inactive'}`}>
                  <div className={`wizard-step-circle ${step.active ? 'wizard-step-circle--active' : 'wizard-step-circle--inactive'}`}>
                    {i + 1}
                  </div>
                  <span className={`wizard-step-label ${step.active ? 'wizard-step-label--active' : 'wizard-step-label--inactive'}`}>
                    {step.label}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Grid */}
          <div className="wizard-grid">
            {templates.map((t) => (
              <div
                key={t.id}
                className={`wizard-card ${selected === t.id ? 'wizard-card--selected' : ''}`}
                onClick={() => setSelected(t.id)}
                role="button"
                tabIndex={0}
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
            >
              <div className="wizard-blank-icon">
                <PlusOutlined />
              </div>
              <h3 className="wizard-card-title">空白画布</h3>
              <p className="wizard-card-desc">完全从零开始</p>
            </div>
          </div>

          {/* Footer */}
          <div className="wizard-footer">
            <button className="wizard-footer-cancel" onClick={handleClose}>
              <CloseOutlined style={{ fontSize: 14 }} />
              取消
            </button>
            <button className="wizard-footer-next" onClick={() => {/* next step */}}>
              配置工作区
              <span style={{ fontSize: 14 }}>→</span>
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
