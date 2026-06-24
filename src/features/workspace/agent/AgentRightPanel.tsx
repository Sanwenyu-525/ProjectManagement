import { useState, useCallback } from 'react';
import { useAgentWorkspaceStore } from '../../../stores/agentWorkspaceStore';
import AgentPlanPanel from './AgentPlanPanel';
import AgentGitTab from './AgentGitTab';
import AgentMemoryPanel from './AgentMemoryPanel';
import AgentContextPanel from './AgentContextPanel';
import AgentPromptPanel from './AgentPromptPanel';
import ResizeHandle from '../../../shared/ResizeHandle';

type RightTab = 'plan' | 'git' | 'memory' | 'context' | 'prompts';

const TABS: { key: RightTab; label: string; icon: string }[] = [
  { key: 'plan', label: '计划', icon: 'description' },
  { key: 'git', label: 'Git', icon: 'account_tree' },
  { key: 'context', label: '上下文', icon: 'folder_open' },
  { key: 'memory', label: '记忆', icon: 'neurology' },
  { key: 'prompts', label: '提示词', icon: 'record_voice_over' },
];

interface AgentRightPanelProps {
  sessionId: string | null;
  cwd: string;
}

export default function AgentRightPanel({ sessionId, cwd }: AgentRightPanelProps) {
  const panelWidth = useAgentWorkspaceStore(s => s.panelWidth);
  const setPanelWidth = useAgentWorkspaceStore(s => s.setPanelWidth);
  const [activeTab, setActiveTab] = useState<RightTab>('plan');
  const [hoveredTab, setHoveredTab] = useState<RightTab | null>(null);

  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    const startX = e.clientX;
    const startWidth = panelWidth;

    const onMouseMove = (ev: MouseEvent) => {
      const delta = startX - ev.clientX;
      setPanelWidth(startWidth + delta);
    };
    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }, [panelWidth, setPanelWidth]);

  return (
    <div style={{ ...styles.panel, width: panelWidth }} role="complementary" aria-label="辅助面板">
      {/* Resize handle */}
      <ResizeHandle
        orientation="horizontal"
        onResizeStart={handleResizeStart}
      />

      {/* Tab bar */}
      <div style={styles.tabBar} role="tablist">
        {TABS.map(tab => {
          const isActive = activeTab === tab.key;
          const isHovered = hoveredTab === tab.key;
          return (
            <button
              key={tab.key}
              role="tab"
              aria-selected={isActive}
              title={tab.label}
              onClick={() => setActiveTab(tab.key)}
              onMouseEnter={() => setHoveredTab(tab.key)}
              onMouseLeave={() => setHoveredTab(null)}
              style={{
                ...styles.tab,
                color: isActive
                  ? 'var(--md-primary)'
                  : isHovered
                    ? 'var(--md-on-surface)'
                    : 'var(--md-on-surface-variant)',
                background: isActive
                  ? 'var(--md-surface-container)'
                  : isHovered
                    ? 'var(--md-surface-container-low)'
                    : 'transparent',
                fontWeight: isActive ? 600 : 500,
                borderBottom: isActive ? '2px solid var(--md-primary)' : '2px solid transparent',
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 15 }}>{tab.icon}</span>
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Content */}
      <div style={styles.content}>
        {activeTab === 'plan' && <AgentPlanPanel />}
        {activeTab === 'git' && <AgentGitTab repoPath={cwd} />}
        {activeTab === 'context' && <AgentContextPanel sessionId={sessionId} cwd={cwd} />}
        {activeTab === 'memory' && <AgentMemoryPanel sessionId={sessionId} />}
        {activeTab === 'prompts' && <AgentPromptPanel />}
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
    borderLeft: '1px solid var(--border)',
    overflow: 'hidden',
    position: 'relative',
  },
  tabBar: {
    display: 'flex',
    gap: 0,
    padding: '0 4px',
    borderBottom: '1px solid var(--border)',
    flexShrink: 0,
    background: 'var(--md-surface-container-lowest)',
  },
  tab: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    padding: '8px 10px',
    fontSize: 'var(--text-xs)',
    fontFamily: 'var(--font-sans)',
    background: 'transparent',
    border: 'none',
    borderBottom: '2px solid transparent',
    cursor: 'pointer',
    transition: 'color 0.15s, background 0.15s, border-color 0.15s',
    whiteSpace: 'nowrap',
  },
  content: {
    display: 'flex',
    flexDirection: 'column',
    flex: 1,
    minHeight: 0,
    overflow: 'hidden',
  },
};
