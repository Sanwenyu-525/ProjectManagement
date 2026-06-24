import { useState } from 'react';

// ── Models ──────────────────────────────────────────────────────

export const MODELS = [
  { id: 'opus', name: 'Claude Opus 4.8', tag: '最强', tagColor: 'var(--md-primary)' },
  { id: 'sonnet', name: 'Claude Sonnet 4.6', tag: '均衡', tagColor: 'var(--md-tertiary)' },
  { id: 'haiku', name: 'Claude Haiku 4.5', tag: '快速', tagColor: 'var(--md-outline)' },
];

export function ModelPicker({ onSelect }: { onSelect: (modelId: string) => void }) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  return (
    <div style={modelStyles.container}>
      <div style={modelStyles.title}>
        <span className="material-symbols-outlined" aria-hidden="true" style={{ fontSize: 16 }}>smart_toy</span>
        选择模型
      </div>
      <div style={modelStyles.grid}>
        {MODELS.map((m, i) => (
          <button
            key={m.id}
            onClick={() => onSelect(m.id)}
            onMouseEnter={() => setHoverIdx(i)}
            onMouseLeave={() => setHoverIdx(null)}
            style={{
              ...modelStyles.card,
              ...(hoverIdx === i ? modelStyles.cardHover : null),
            }}
          >
            <div style={modelStyles.cardTitle}>{m.name}</div>
            <span style={{ ...modelStyles.tag, background: m.tagColor }}>{m.tag}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Quick Config ────────────────────────────────────────────────

export function QuickConfig({ onSelectModel }: { onSelectModel: () => void }) {
  const [thinkingMode, setThinkingMode] = useState(() => localStorage.getItem('agent_thinkingMode') === 'true');
  const [autoCompact, setAutoCompact] = useState(() => localStorage.getItem('agent_autoCompact') !== 'false');
  const currentModelId = localStorage.getItem('agent_model') || 'sonnet';
  const currentModel = MODELS.find(m => m.id === currentModelId) ?? MODELS[1];

  const toggleThinking = () => {
    setThinkingMode(v => {
      const next = !v;
      localStorage.setItem('agent_thinkingMode', String(next));
      return next;
    });
  };

  const toggleAutoCompact = () => {
    setAutoCompact(v => {
      const next = !v;
      localStorage.setItem('agent_autoCompact', String(next));
      return next;
    });
  };

  return (
    <div style={configStyles.container}>
      <div style={configStyles.title}>
        <span className="material-symbols-outlined" aria-hidden="true" style={{ fontSize: 16 }}>tune</span>
        快速设置
      </div>

      {/* Model */}
      <div style={configStyles.row}>
        <div style={configStyles.rowLeft}>
          <span className="material-symbols-outlined" aria-hidden="true" style={configStyles.rowIcon}>smart_toy</span>
          <span style={configStyles.rowLabel}>当前模型</span>
        </div>
        <button onClick={onSelectModel} style={configStyles.modelBtn}>
          {currentModel.name}
          <span className="material-symbols-outlined" style={{ fontSize: 14 }}>chevron_right</span>
        </button>
      </div>

      {/* Thinking Mode */}
      <div style={configStyles.row}>
        <div style={configStyles.rowLeft}>
          <span className="material-symbols-outlined" aria-hidden="true" style={configStyles.rowIcon}>psychology</span>
          <span style={configStyles.rowLabel}>扩展思考</span>
        </div>
        <button
          onClick={toggleThinking}
          style={configStyles.toggle}
          role="switch"
          aria-checked={thinkingMode}
        >
          <span style={{
            ...configStyles.toggleKnob,
            transform: thinkingMode ? 'translateX(14px)' : 'translateX(0)',
            background: thinkingMode ? 'var(--md-primary)' : 'var(--md-outline)',
          }} />
        </button>
      </div>

      {/* Auto Compact */}
      <div style={configStyles.row}>
        <div style={configStyles.rowLeft}>
          <span className="material-symbols-outlined" aria-hidden="true" style={configStyles.rowIcon}>compress</span>
          <span style={configStyles.rowLabel}>自动压缩</span>
        </div>
        <button
          onClick={toggleAutoCompact}
          style={configStyles.toggle}
          role="switch"
          aria-checked={autoCompact}
        >
          <span style={{
            ...configStyles.toggleKnob,
            transform: autoCompact ? 'translateX(14px)' : 'translateX(0)',
            background: autoCompact ? 'var(--md-primary)' : 'var(--md-outline)',
          }} />
        </button>
      </div>

      {/* Pass-through hint */}
      <div style={configStyles.hint}>
        其他设置请在终端中直接输入命令
      </div>
    </div>
  );
}

// ── Slash Command Handler ───────────────────────────────────────

/** Handle interactive slash commands (/model, /config, /clear). Returns true if handled. */
export function handleSlashCommand(
  text: string,
  setShowModelPicker: (v: boolean) => void,
  setShowConfigPanel: (v: boolean) => void,
  onClear?: () => void,
): boolean {
  if (text === '/model' || text.startsWith('/model ')) {
    setShowModelPicker(true); setShowConfigPanel(false); return true;
  }
  if (text === '/config' || text.startsWith('/config ')) {
    setShowConfigPanel(true); setShowModelPicker(false); return true;
  }
  if (text === '/clear') {
    onClear?.();
    setShowModelPicker(false); setShowConfigPanel(false); return true;
  }
  return false;
}

// ── Styles ──────────────────────────────────────────────────────

const modelStyles: Record<string, React.CSSProperties> = {
  container: {
    animation: 'fadeIn 0.15s ease-out',
    background: 'var(--md-surface-container-low)',
    border: '1px solid var(--border)',
    borderRadius: 12,
    padding: 14,
    maxWidth: 320,
  },
  title: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    fontSize: 13,
    fontWeight: 600,
    color: 'var(--md-on-surface)',
    marginBottom: 10,
    fontFamily: 'var(--font-sans)',
  },
  grid: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  card: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '8px 12px',
    borderRadius: 8,
    border: '1px solid var(--border)',
    background: 'var(--md-surface-container)',
    cursor: 'pointer',
    transition: 'background 0.1s, border-color 0.1s',
    textAlign: 'left',
    fontFamily: 'var(--font-sans)',
    color: 'var(--md-on-surface)',
    width: '100%',
  },
  cardHover: {
    background: 'var(--md-primary-container)',
    borderColor: 'var(--md-primary)',
  },
  cardTitle: {
    fontSize: 13,
    fontWeight: 500,
  },
  tag: {
    fontSize: 10,
    fontWeight: 600,
    color: '#fff',
    padding: '2px 6px',
    borderRadius: 4,
    letterSpacing: '0.03em',
  },
};

const configStyles: Record<string, React.CSSProperties> = {
  container: {
    animation: 'fadeIn 0.15s ease-out',
    background: 'var(--md-surface-container-low)',
    border: '1px solid var(--border)',
    borderRadius: 12,
    padding: 14,
    width: 280,
  },
  title: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    fontSize: 13,
    fontWeight: 600,
    color: 'var(--md-on-surface)',
    marginBottom: 12,
    fontFamily: 'var(--font-sans)',
  },
  row: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '8px 0',
    borderBottom: '1px solid var(--border)',
  },
  rowLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  rowIcon: {
    fontSize: 16,
    color: 'var(--md-on-surface-variant)',
  },
  rowLabel: {
    fontSize: 13,
    color: 'var(--md-on-surface)',
    fontFamily: 'var(--font-sans)',
  },
  modelBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    fontSize: 12,
    fontFamily: 'var(--font-mono)',
    color: 'var(--md-primary)',
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    padding: '2px 4px',
    borderRadius: 4,
  },
  toggle: {
    position: 'relative',
    width: 36,
    height: 20,
    borderRadius: 10,
    background: 'var(--md-surface-container-high)',
    border: '1px solid var(--border)',
    cursor: 'pointer',
    padding: 0,
    overflow: 'hidden',
  },
  toggleKnob: {
    position: 'absolute',
    top: 1,
    left: 1,
    width: 16,
    height: 16,
    borderRadius: '50%',
    transition: 'transform 0.2s, background 0.2s',
  },
  hint: {
    marginTop: 10,
    fontSize: 11,
    color: 'var(--md-on-surface-variant)',
    opacity: 0.6,
    textAlign: 'center',
    fontFamily: 'var(--font-sans)',
  },
};
