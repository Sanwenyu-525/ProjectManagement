import { useState, useCallback, useMemo } from 'react';
import { Input, message } from 'antd';
import { useAgentUIStore } from '../../../stores/agentUIStore';
import { useWheelScroll } from '../../../hooks/useWheelScroll';
import {
  PROMPT_TEMPLATES,
  PHASE_META,
  ACTIVE_PHASES,
  fillTemplate,
  getVariables,
} from './promptTemplates';
import type { PromptPhase, PromptTemplate } from './promptTemplates';

// ── Event dispatch helper ──

function dispatchQuickCommand(text: string) {
  window.dispatchEvent(new CustomEvent('agentQuickCommand', { detail: text }));
}

// ── Main Panel ──

export default function AgentPromptPanel() {
  const activePhase = useAgentUIStore(s => s.activePhase);
  const setActivePhase = useAgentUIStore(s => s.setActivePhase);
  const searchQuery = useAgentUIStore(s => s.searchQuery);
  const setSearchQuery = useAgentUIStore(s => s.setSearchQuery);
  const showOptimize = useAgentUIStore(s => s.showOptimize);
  const setShowOptimize = useAgentUIStore(s => s.setShowOptimize);

  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Filter templates
  const filteredTemplates = useMemo(() => {
    let list = PROMPT_TEMPLATES;
    if (activePhase !== 'all') {
      list = list.filter(t => t.phase === activePhase);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(t =>
        t.label.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q) ||
        t.tags?.some(tag => tag.toLowerCase().includes(q))
      );
    }
    return list;
  }, [activePhase, searchQuery]);

  // Group by phase
  const grouped = useMemo(() => {
    const map = new Map<PromptPhase, PromptTemplate[]>();
    for (const t of filteredTemplates) {
      const arr = map.get(t.phase) ?? [];
      arr.push(t);
      map.set(t.phase, arr);
    }
    return Array.from(map.entries()).sort(
      (a, b) => PHASE_META[a[0]].order - PHASE_META[b[0]].order
    );
  }, [filteredTemplates]);

  const handleTemplateClick = useCallback((template: PromptTemplate) => {
    const vars = getVariables(template);
    if (vars.length === 0) {
      dispatchQuickCommand(template.template);
      message.success(`已发送「${template.label}」`);
    } else {
      setExpandedId(prev => prev === template.id ? null : template.id);
    }
  }, []);

  const handleVariableSubmit = useCallback((template: PromptTemplate, values: Record<string, string>) => {
    const filled = fillTemplate(template.template, values);
    dispatchQuickCommand(filled);
    message.success(`已发送「${template.label}」`);
    setExpandedId(null);
  }, []);

  return (
    <div style={styles.container}>
      {/* Optimize area */}
      <OptimizeArea show={showOptimize} onToggle={() => setShowOptimize(!showOptimize)} />

      {/* Phase tabs */}
      <PhaseTabs active={activePhase} onChange={setActivePhase} />

      {/* Search bar */}
      <SearchBar value={searchQuery} onChange={setSearchQuery} />

      {/* Prompt list */}
      <div style={styles.scrollArea}>
        {grouped.length === 0 ? (
          <div style={styles.empty}>
            <span className="material-symbols-outlined" style={{ fontSize: 28, color: 'var(--md-outline)', opacity: 0.6 }}>
              search_off
            </span>
            <p style={styles.emptyText}>没有匹配的提示词</p>
          </div>
        ) : (
          grouped.map(([phase, templates]) => (
            <div key={phase} style={styles.section}>
              <div style={styles.sectionHeader}>
                <span className="material-symbols-outlined" style={{ fontSize: 14, color: 'var(--md-primary)' }}>
                  {PHASE_META[phase].icon}
                </span>
                <span style={styles.sectionTitle}>{PHASE_META[phase].label}</span>
                <span style={styles.sectionCount}>{templates.length}</span>
              </div>
              {templates.map(t => (
                <PromptCard
                  key={t.id}
                  template={t}
                  expanded={expandedId === t.id}
                  onClick={handleTemplateClick}
                  onSubmit={handleVariableSubmit}
                />
              ))}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ── Optimize Area ──

function OptimizeArea({ show, onToggle }: { show: boolean; onToggle: () => void }) {
  const [rawInput, setRawInput] = useState('');

  const handleOptimize = useCallback(() => {
    if (!rawInput.trim()) {
      message.warning('请输入你的需求');
      return;
    }
    const metaPrompt = `请将以下用户需求优化为一个结构化的开发提示词（使用 Markdown 格式，包含明确的目标、约束、输入输出要求）。只输出优化后的提示词，不要添加解释。

用户原始需求：
${rawInput.trim()}`;
    dispatchQuickCommand(metaPrompt);
    setRawInput('');
    message.success('优化请求已发送到 Agent');
  }, [rawInput]);

  return (
    <div style={styles.optimizeSection}>
      <button style={styles.optimizeToggle} onClick={onToggle}
        onMouseEnter={e => { e.currentTarget.style.background = 'var(--md-surface-container)'; }}
        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
      >
        <span className="material-symbols-outlined" style={{ fontSize: 14, color: 'var(--md-primary)' }}>
          auto_awesome
        </span>
        <span style={styles.optimizeLabel}>优化提示词</span>
        <span
          className="material-symbols-outlined"
          style={{
            fontSize: 14,
            color: 'var(--md-outline)',
            transform: show ? 'rotate(180deg)' : 'none',
            transition: 'transform 0.2s',
          }}
        >
          expand_more
        </span>
      </button>
      {show && (
        <div style={styles.optimizeBody}>
          <Input.TextArea
            value={rawInput}
            onChange={e => setRawInput(e.target.value)}
            placeholder="输入你的原始需求，AI 将帮你优化为结构化提示词..."
            rows={3}
            style={{ ...styles.optimizeInput, background: 'var(--color-bg-input)', color: 'var(--color-text-primary)' }}
            onPressEnter={e => {
              if (e.ctrlKey || e.metaKey) handleOptimize();
            }}
          />
          <button style={styles.optimizeBtn} onClick={handleOptimize}
            onMouseEnter={e => { e.currentTarget.style.opacity = '0.85'; }}
            onMouseLeave={e => { e.currentTarget.style.opacity = '1'; }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 14 }}>auto_awesome</span>
            优化并发送
          </button>
        </div>
      )}
    </div>
  );
}

// ── Phase Tabs ──

function PhaseTabs({ active, onChange }: { active: PromptPhase | 'all'; onChange: (p: PromptPhase | 'all') => void }) {
  const allPhases: Array<{ key: PromptPhase | 'all'; label: string; icon: string }> = [
    { key: 'all', label: '全部', icon: 'apps' },
    ...ACTIVE_PHASES.map(p => ({ key: p, label: PHASE_META[p].label, icon: PHASE_META[p].icon })),
  ];
  const wheelScroll = useWheelScroll<HTMLDivElement>();

  return (
    <div style={styles.phaseBar} ref={wheelScroll.ref} onWheel={wheelScroll.onWheel}>
      {allPhases.map(p => (
        <button
          key={p.key}
          style={{
            ...styles.phasePill,
            ...(active === p.key ? styles.phasePillActive : {}),
          }}
          onClick={() => onChange(p.key)}
          title={p.label}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 12 }}>{p.icon}</span>
          {p.label}
        </button>
      ))}
    </div>
  );
}

// ── Search Bar ──

function SearchBar({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div style={styles.searchBox}>
      <span className="material-symbols-outlined" style={{ fontSize: 16, color: 'var(--md-outline)' }}>search</span>
      <input
        style={styles.searchInput}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder="搜索提示词..."
      />
      {value && (
        <span
          className="material-symbols-outlined"
          style={{ fontSize: 14, color: 'var(--md-outline)', cursor: 'pointer', padding: 2 }}
          role="button"
          tabIndex={0}
          onClick={() => onChange('')}
          onKeyDown={e => { if (e.key === 'Enter') onChange(''); }}
        >
          close
        </span>
      )}
    </div>
  );
}

// ── Prompt Card (with inline variable expansion) ──

function PromptCard({ template, expanded, onClick, onSubmit }: {
  template: PromptTemplate;
  expanded: boolean;
  onClick: (t: PromptTemplate) => void;
  onSubmit: (t: PromptTemplate, values: Record<string, string>) => void;
}) {
  const [hovered, setHovered] = useState(false);
  const [values, setValues] = useState<Record<string, string>>({});
  const vars = useMemo(() => getVariables(template), [template]);
  const hasVars = vars.length > 0;

  const handleSubmit = useCallback(() => {
    const empty = vars.find(v => !(values[v.name]?.trim()));
    if (empty) {
      message.warning(`请填写「${empty.label}」`);
      return;
    }
    onSubmit(template, values);
    setValues({});
  }, [vars, values, template, onSubmit]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleSubmit();
    }
  }, [handleSubmit]);

  return (
    <div
      style={{
        ...styles.card,
        ...(hovered && !expanded ? styles.cardHover : {}),
        ...(expanded ? styles.cardExpanded : {}),
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => onClick(template)}
      role="button"
      tabIndex={0}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(template); } }}
    >
      {/* Header row — always visible */}
      <div style={styles.cardHeader}>
        <span className="material-symbols-outlined" style={{ fontSize: 16, color: 'var(--md-primary)', flexShrink: 0 }}>
          {template.icon}
        </span>
        <span style={styles.cardLabel}>{template.label}</span>
        {hasVars && !expanded && (
          <span style={styles.varBadge} title={`${vars.length} 个变量需要填写`}>
            <span className="material-symbols-outlined" style={{ fontSize: 10 }}>edit</span>
            {vars.length}
          </span>
        )}
        <span
          className="material-symbols-outlined"
          style={{
            fontSize: 14,
            color: expanded ? 'var(--md-error)' : 'var(--md-primary)',
            opacity: hovered || expanded ? 1 : 0,
            transition: 'opacity 0.15s',
            flexShrink: 0,
          }}
        >
          {expanded ? 'close' : hasVars ? 'edit' : 'send'}
        </span>
      </div>
      <p style={styles.cardDesc}>{template.description}</p>
      {template.tags && template.tags.length > 0 && (
        <div style={styles.cardTags}>
          {template.tags.map(tag => (
            <span key={tag} style={styles.tag}>{tag}</span>
          ))}
        </div>
      )}

      {/* Inline variable form — expanded state */}
      {expanded && (
        <div style={styles.varForm} onClick={e => e.stopPropagation()} onKeyDown={handleKeyDown}>
          {vars.map(v => (
            <div key={v.name} style={styles.varField}>
              <label style={styles.varLabel}>{v.label}</label>
              <Input.TextArea
                value={values[v.name] ?? ''}
                onChange={e => setValues(prev => ({ ...prev, [v.name]: e.target.value }))}
                placeholder={v.placeholder ?? `输入 ${v.label}...`}
                rows={2}
                style={{ ...styles.varInput, background: 'var(--color-bg-input)', color: 'var(--color-text-primary)' }}
                autoFocus
              />
            </div>
          ))}
          <div style={styles.varActions}>
            <span style={styles.varHint}>Ctrl+Enter 发送</span>
            <button style={styles.varSendBtn} onClick={handleSubmit}>
              <span className="material-symbols-outlined" style={{ fontSize: 13 }}>send</span>
              发送
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Styles ──

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    overflow: 'hidden',
  },

  // Optimize
  optimizeSection: {
    borderBottom: '1px solid var(--border)',
    flexShrink: 0,
  },
  optimizeToggle: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    width: '100%',
    padding: '8px 12px',
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    fontFamily: 'var(--font-sans)',
  },
  optimizeLabel: {
    flex: 1,
    fontSize: 12,
    fontWeight: 500,
    color: 'var(--md-on-surface)',
    textAlign: 'left',
  },
  optimizeBody: {
    padding: '0 12px 8px',
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  optimizeInput: {
    fontSize: 12,
    fontFamily: 'var(--font-sans)',
  },
  optimizeBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    height: 30,
    fontSize: 12,
    fontWeight: 500,
    color: 'var(--md-on-primary)',
    background: 'var(--md-primary)',
    border: 'none',
    borderRadius: 6,
    cursor: 'pointer',
    fontFamily: 'var(--font-sans)',
  },

  // Phase tabs
  phaseBar: {
    display: 'flex',
    gap: 4,
    padding: '6px 12px',
    overflowX: 'auto',
    flexShrink: 0,
    borderBottom: '1px solid var(--border)',
  },
  phasePill: {
    display: 'flex',
    alignItems: 'center',
    gap: 3,
    padding: '3px 8px',
    fontSize: 11,
    fontWeight: 500,
    color: 'var(--md-on-surface-variant)',
    background: 'transparent',
    border: '1px solid transparent',
    borderRadius: 'var(--radius-full)',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    fontFamily: 'var(--font-sans)',
    transition: 'all 0.15s',
  },
  phasePillActive: {
    color: 'var(--md-primary)',
    background: 'var(--md-primary-container)',
    borderColor: 'var(--md-primary)',
  },

  // Search
  searchBox: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '6px 12px',
    borderBottom: '1px solid var(--border)',
    flexShrink: 0,
  },
  searchInput: {
    flex: 1,
    border: 'none',
    outline: 'none',
    background: 'transparent',
    fontSize: 12,
    color: 'var(--md-on-surface)',
    fontFamily: 'var(--font-sans)',
  },

  // Scroll area
  scrollArea: {
    flex: 1,
    overflowY: 'auto',
    overflowX: 'hidden',
  },

  // Sections
  section: {
    padding: '6px 0',
    borderBottom: '1px solid var(--border)',
  },
  sectionHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '0 12px 4px',
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: 600,
    color: 'var(--md-on-surface-variant)',
    fontFamily: 'var(--font-label)',
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
    flex: 1,
  },
  sectionCount: {
    fontSize: 10,
    color: 'var(--md-outline)',
    background: 'var(--md-surface-container-low)',
    padding: '1px 6px',
    borderRadius: 8,
  },

  // Cards
  card: {
    padding: '6px 12px',
    cursor: 'pointer',
    transition: 'background 0.15s',
  },
  cardHover: {
    background: 'var(--md-surface-container-low)',
  },
  cardExpanded: {
    background: 'var(--md-surface-container-low)',
    cursor: 'default',
  },
  cardHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  },
  cardLabel: {
    fontSize: 12,
    fontWeight: 500,
    color: 'var(--md-on-surface)',
    flex: 1,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  varBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: 2,
    fontSize: 10,
    color: 'var(--md-tertiary)',
    background: 'var(--md-surface-container)',
    padding: '1px 5px',
    borderRadius: 3,
    flexShrink: 0,
  },
  cardDesc: {
    fontSize: 11,
    color: 'var(--md-on-surface-variant)',
    margin: '2px 0 0 22px',
    lineHeight: '16px',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    display: '-webkit-box',
    WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical',
  } as React.CSSProperties,
  cardTags: {
    display: 'flex',
    gap: 4,
    marginTop: 4,
    marginLeft: 22,
    flexWrap: 'wrap',
  },
  tag: {
    fontSize: 10,
    color: 'var(--md-outline)',
    background: 'var(--md-surface-container-low)',
    padding: '1px 5px',
    borderRadius: 3,
  },

  // Empty
  empty: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '32px 16px',
    gap: 6,
  },
  emptyText: {
    margin: 0,
    fontSize: 12,
    color: 'var(--md-on-surface-variant)',
  },

  // Inline variable form
  varForm: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    marginTop: 8,
    paddingTop: 8,
    borderTop: '1px solid var(--border)',
  },
  varField: {},
  varLabel: {
    display: 'block',
    fontSize: 11,
    fontWeight: 500,
    color: 'var(--md-on-surface)',
    marginBottom: 2,
  },
  varInput: {
    fontSize: 12,
    fontFamily: 'var(--font-sans)',
  },
  varActions: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  varHint: {
    fontSize: 10,
    color: 'var(--md-outline)',
  },
  varSendBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    height: 28,
    padding: '0 12px',
    fontSize: 12,
    fontWeight: 500,
    color: 'var(--md-on-primary)',
    background: 'var(--md-primary)',
    border: 'none',
    borderRadius: 6,
    cursor: 'pointer',
    fontFamily: 'var(--font-sans)',
  },
};
