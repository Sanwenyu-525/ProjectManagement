import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ThunderboltOutlined, CloseOutlined, CheckCircleFilled, PlusOutlined, CodeOutlined, ApartmentOutlined, ApiOutlined, DesktopOutlined, CloudOutlined } from '@ant-design/icons';
import { message } from 'antd';
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

const STEPS = [
  { label: '模板', key: 'template' },
  { label: '工作区', key: 'workspace' },
  { label: '智能体', key: 'agent' },
] as const;

type StepKey = typeof STEPS[number]['key'];

export default function NewProjectWizard() {
  const navigate = useNavigate();
  const [selected, setSelected] = useState<string>('react');
  const [projectName, setProjectName] = useState('');
  const [templates, setTemplates] = useState<TemplateVM[]>(DEFAULT_TEMPLATES);
  const [currentStep, setCurrentStep] = useState<StepKey>('template');
  const [creating, setCreating] = useState(false);
  const currentStepIdx = STEPS.findIndex(s => s.key === currentStep);

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
            {STEPS.map((step, i) => {
              const isCurrent = step.key === currentStep;
              const isCompleted = i < currentStepIdx;
              return (
                <div key={step.key} style={{ display: 'contents' }}>
                  {i > 0 && <div className="wizard-step-divider" />}
                  <div className={`wizard-step ${isCurrent ? '' : 'wizard-step--inactive'}`}>
                    <div className={`wizard-step-circle ${isCurrent ? 'wizard-step-circle--active' : isCompleted ? 'wizard-step-circle--completed' : 'wizard-step-circle--inactive'}`}>
                      {isCompleted ? '✓' : i + 1}
                    </div>
                    <span className={`wizard-step-label ${isCurrent ? 'wizard-step-label--active' : 'wizard-step-label--inactive'}`}>
                      {step.label}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Step content */}
          {currentStep === 'template' && (
            <>
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
                <input
                  type="text"
                  value={projectName}
                  onChange={e => setProjectName(e.target.value)}
                  placeholder="输入项目名称"
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: 8,
                    border: '1px solid var(--border)',
                    background: 'var(--md-surface)',
                    color: 'var(--md-on-surface)',
                    fontSize: 14,
                    fontFamily: 'var(--font-sans)',
                    outline: 'none',
                  }}
                  onKeyDown={e => { if (e.key === 'Enter') { /* handled by footer button */ } }}
                />
              </div>
            </>
          )}

          {currentStep === 'workspace' && (
            <div style={{ padding: '32px 0', textAlign: 'center', color: 'var(--md-on-surface-variant)', fontSize: 13, fontFamily: 'var(--font-sans)' }}>
              <span className="material-symbols-outlined" style={{ fontSize: 32, display: 'block', marginBottom: 8, color: 'var(--md-outline-variant)' }}>folder_open</span>
              工作区配置将在后续版本中开放。当前将使用默认工作目录。
            </div>
          )}

          {currentStep === 'agent' && (
            <div style={{ padding: '32px 0', textAlign: 'center', color: 'var(--md-on-surface-variant)', fontSize: 13, fontFamily: 'var(--font-sans)' }}>
              <span className="material-symbols-outlined" style={{ fontSize: 32, display: 'block', marginBottom: 8, color: 'var(--md-outline-variant)' }}>smart_toy</span>
              智能体配置将在后续版本中开放。当前将使用默认 Agent 设置。
            </div>
          )}

          {/* Footer */}
          <div className="wizard-footer">
            <button className="wizard-footer-cancel" onClick={handleClose}>
              <CloseOutlined style={{ fontSize: 14 }} />
              取消
            </button>
            <button
              className="wizard-footer-next"
              disabled={creating}
              onClick={async () => {
                const nextIdx = currentStepIdx + 1;
                if (nextIdx < STEPS.length) {
                  setCurrentStep(STEPS[nextIdx].key);
                } else {
                  // Final step: create project and go to projects list
                  const trimmedName = projectName.trim();
                  if (!trimmedName) {
                    message.warning('请输入项目名称');
                    setCurrentStep('template');
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
                }
              }}
            >
              {currentStepIdx < STEPS.length - 1 ? '下一步' : '完成创建'}
              <span style={{ fontSize: 14 }}>→</span>
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
