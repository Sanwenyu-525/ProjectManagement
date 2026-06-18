import { useState, useCallback, useRef } from 'react';
import { useAgentWorkspaceStore } from '../../../stores/agentWorkspaceStore';
import { useTerminalStore } from '../../../stores/terminalStore';
import AgentPlanPanel from './AgentPlanPanel';
import AgentGitTab from './AgentGitTab';
import AgentContextPanel from './AgentContextPanel';

type RightTab = 'plan' | 'git' | 'context';

const TABS: { key: RightTab; label: string; icon: string }[] = [
  { key: 'plan', label: 'Plan', icon: 'description' },
  { key: 'git', label: 'Git', icon: 'account_tree' },
  { key: 'context', label: 'Context', icon: 'psychology' },
];

interface AgentRightPanelProps {
  sessionId: string | null;
}

export default function AgentRightPanel({ sessionId }: AgentRightPanelProps) {
  const panelWidth = useAgentWorkspaceStore(s => s.panelWidth);
  const setPanelWidth = useAgentWorkspaceStore(s => s.setPanelWidth);
  const repoPath = useTerminalStore(s => s.defaultCwd);
  const [activeTab, setActiveTab] = useState<RightTab>('plan');
  const resizingRef = useRef(false);

  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    resizingRef.current = true;
    const startX = e.clientX;
    const startWidth = panelWidth;

    const onMouseMove = (ev: MouseEvent) => {
      if (!resizingRef.current) return;
      const delta = startX - ev.clientX;
      setPanelWidth(startWidth + delta);
    };
    const onMouseUp = () => {
      resizingRef.current = false;
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }, [panelWidth, setPanelWidth]);

  return (
    <div style={{ ...styles.panel, width: panelWidth }}>
      {/* Resize handle */}
      <div style={styles.resizeHandle} onMouseDown={handleResizeStart} />

      {/* Tab bar */}
      <div style={styles.tabBar}>
        {TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            style={{
              ...styles.tab,
              ...(activeTab === tab.key ? styles.tabActive : {}),
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 14 }}>{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={styles.content}>
        {activeTab === 'plan' && <AgentPlanPanel sessionId={sessionId} />}
        {activeTab === 'git' && <AgentGitTab repoPath={repoPath} />}
        {activeTab === 'context' && <AgentContextPanel sessionId={sessionId} />}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  panel: {
    display: 'flex',
    flexDirection: 'column',
    flexShrink: 0,
    background: 'var(--md-surface-container-lowest)',
    borderRadius: 12,
    border: '1px solid var(--md-outline-variant)',
    boxShadow: '0 2px 8px rgba(11, 28, 48, 0.04)',
    overflow: 'hidden',
    position: 'relative',
  },
  resizeHandle: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
    cursor: 'col-resize',
    zIndex: 10,
  },
  tabBar: {
    display: 'flex',
    gap: 2,
    padding: '6px 12px 0',
    borderBottom: '1px solid var(--md-outline-variant)',
    flexShrink: 0,
  },
  tab: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    padding: '6px 12px',
    fontSize: 12,
    fontWeight: 500,
    fontFamily: 'var(--font-sans)',
    color: 'var(--md-on-surface-variant)',
    background: 'transparent',
    border: 'none',
    borderRadius: '8px 8px 0 0',
    cursor: 'pointer',
    transition: 'color 0.15s, background 0.15s',
    marginBottom: -1,
  },
  tabActive: {
    color: 'var(--md-primary)',
    background: 'var(--md-surface-container-low)',
    fontWeight: 600,
  },
  content: {
    display: 'flex',
    flexDirection: 'column',
    flex: 1,
    minHeight: 0,
    overflow: 'hidden',
  },
  placeholder: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
};
