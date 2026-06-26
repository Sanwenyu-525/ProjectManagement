import { useState, useCallback } from 'react';
import { useAgentUIStore } from '../../../stores/agentUIStore';
import { useThemeStore } from '../../../stores/themeStore';
import AgentPlanPanel from './AgentPlanPanel';
import AgentGitTab from './AgentGitTab';
import AgentMemoryPanel from './AgentMemoryPanel';
import AgentContextPanel from './AgentContextPanel';
import AgentPromptPanel from './AgentPromptPanel';
import AgentGraphPanel from './AgentGraphPanel';
import AgentKnowledgePanel from './AgentKnowledgePanel';
import ResizeHandle from '../../../shared/ResizeHandle';
import { useWheelScroll } from '../../../hooks/useWheelScroll';

type RightTab = 'plan' | 'git' | 'context' | 'memory' | 'prompts' | 'graph' | 'knowledge';

const TABS: { key: RightTab; label: string; icon: string }[] = [
  { key: 'plan', label: '计划', icon: 'description' },
  { key: 'git', label: 'Git', icon: 'account_tree' },
  { key: 'context', label: '上下文', icon: 'folder_open' },
  { key: 'memory', label: '记忆', icon: 'neurology' },
  { key: 'prompts', label: '提示词', icon: 'record_voice_over' },
  { key: 'graph', label: '图谱', icon: 'hub' },
  { key: 'knowledge', label: '知识库', icon: 'menu_book' },
];

const COLLAPSED_WIDTH = 48;

interface AgentRightPanelProps {
  sessionId: string | null;
  cwd: string;
}

export default function AgentRightPanel({ sessionId, cwd }: AgentRightPanelProps) {
  const panelWidth = useAgentUIStore(s => s.panelWidth);
  const setPanelWidth = useAgentUIStore(s => s.setPanelWidth);
  const panelCollapsed = useAgentUIStore(s => s.panelCollapsed);
  const togglePanelCollapsed = useAgentUIStore(s => s.togglePanelCollapsed);
  const [activeTab, setActiveTab] = useState<RightTab>('plan');
  const [hoveredTab, setHoveredTab] = useState<RightTab | null>(null);
  const wheelScroll = useWheelScroll<HTMLDivElement>();
  const density = useThemeStore(s => s.density);
  const isCompact = density === 'compact' || density === 'dense';

  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    const startX = e.clientX;
    const startWidth = panelWidth;

    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    const onMouseMove = (ev: MouseEvent) => {
      const delta = startX - ev.clientX;
      setPanelWidth(startWidth + delta);
    };
    const onMouseUp = () => {
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }, [panelWidth, setPanelWidth]);

  const handleIconClick = useCallback((tabKey: RightTab) => {
    setActiveTab(tabKey);
    if (panelCollapsed) {
      togglePanelCollapsed();
    }
  }, [panelCollapsed, togglePanelCollapsed]);

  // ── Collapsed: icon strip ──
  if (panelCollapsed) {
    return (
      <div style={styles.collapsedPanel} role="complementary" aria-label="辅助面板（已折叠）">
        {/* Expand button — same height as expanded tabBar */}
        <button
          onClick={togglePanelCollapsed}
          title="展开面板 (⌘\\)"
          style={styles.collapseBtn}
          onMouseEnter={e => { e.currentTarget.style.color = 'var(--md-on-surface)'; }}
          onMouseLeave={e => { e.currentTarget.style.color = 'var(--md-on-surface-variant)'; }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 16 }}>keyboard_tab_rtl</span>
        </button>
        <div style={styles.collapsedDivider} />
        {TABS.map(tab => {
          const isHovered = hoveredTab === tab.key;
          return (
            <button
              key={tab.key}
              title={tab.label}
              onClick={() => handleIconClick(tab.key)}
              onMouseEnter={() => setHoveredTab(tab.key)}
              onMouseLeave={() => setHoveredTab(null)}
              style={{
                ...styles.iconBtn,
                color: isHovered ? 'var(--md-primary)' : 'var(--md-on-surface-variant)',
                background: isHovered ? 'var(--md-surface-container-low)' : 'transparent',
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>{tab.icon}</span>
            </button>
          );
        })}
      </div>
    );
  }

  // ── Expanded: full panel ──
  return (
    <div style={{ ...styles.panel, width: panelWidth }} role="complementary" aria-label="辅助面板">
      {/* Resize handle */}
      <ResizeHandle
        orientation="horizontal"
        onResizeStart={handleResizeStart}
      />

      {/* Tab bar */}
      <div style={{
          ...styles.tabBar,
          height: isCompact ? (density === 'dense' ? 32 : 38) : 52,
        }} role="tablist">
        <div style={styles.tabScroll} ref={wheelScroll.ref} onWheel={wheelScroll.onWheel}>
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

        {/* Collapse button — pinned right */}
        <button
          onClick={togglePanelCollapsed}
          title="收起面板 (⌘\\)"
          style={styles.collapseBtn}
          onMouseEnter={e => { e.currentTarget.style.color = 'var(--md-on-surface)'; }}
          onMouseLeave={e => { e.currentTarget.style.color = 'var(--md-on-surface-variant)'; }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 16 }}>keyboard_tab_rtl</span>
        </button>
      </div>

      {/* Content */}
      <div style={styles.content}>
        {activeTab === 'plan' && <AgentPlanPanel />}
        {activeTab === 'git' && <AgentGitTab repoPath={cwd} />}
        {activeTab === 'context' && <AgentContextPanel sessionId={sessionId} cwd={cwd} />}
        {activeTab === 'memory' && <AgentMemoryPanel sessionId={sessionId} />}
        {activeTab === 'prompts' && <AgentPromptPanel />}
        {activeTab === 'graph' && <AgentGraphPanel />}
        {activeTab === 'knowledge' && <AgentKnowledgePanel />}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  collapsedPanel: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    width: COLLAPSED_WIDTH,
    flexShrink: 0,
    background: 'var(--md-surface-container-lowest)',
    borderLeft: '1px solid var(--border)',
    paddingTop: 0,
    paddingBottom: 8,
    gap: 2,
  },
  collapsedDivider: {
    width: 24,
    height: 1,
    background: 'var(--border)',
    flexShrink: 0,
    margin: '2px 0 4px',
  },
  iconBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 36,
    height: 36,
    borderRadius: 8,
    border: 'none',
    cursor: 'pointer',
    transition: 'all 0.15s',
    flexShrink: 0,
  },
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
    padding: '0 4px 0 0',
    borderBottom: '1px solid var(--border)',
    flexShrink: 0,
    background: 'var(--md-surface-container-lowest)',
    alignItems: 'stretch',
    minWidth: 0,
  },
  tabScroll: {
    display: 'flex',
    flex: 1,
    minWidth: 0,
    overflow: 'auto',
    alignItems: 'stretch',
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
  collapseBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 28,
    alignSelf: 'stretch',
    borderRadius: 6,
    border: 'none',
    background: 'transparent',
    color: 'var(--md-on-surface-variant)',
    cursor: 'pointer',
    transition: 'color 0.15s',
    flexShrink: 0,
  },
  content: {
    display: 'flex',
    flexDirection: 'column',
    flex: 1,
    minHeight: 0,
    overflow: 'hidden',
  },
};
