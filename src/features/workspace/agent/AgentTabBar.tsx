import { useState, useCallback } from 'react';
import { open } from '@tauri-apps/plugin-dialog';
import { useAgentTabStore } from '../../../stores/agentTabStore';
import { useAgentStore } from '../../../stores/agentStore';
import { useTerminalStore } from '../../../stores/terminalStore';
import { folderName } from '../components/terminalFactory';
import StatusDot from '../components/StatusDot';
import { useWheelScroll } from '../../../hooks/useWheelScroll';

interface AgentTabBarProps {
  onCloseTab?: (tabId: string) => void;
}

export default function AgentTabBar({ onCloseTab }: AgentTabBarProps) {
  const tabs = useAgentTabStore(s => s.tabs);
  const activeTabId = useAgentTabStore(s => s.activeTabId);
  const switchTab = useAgentTabStore(s => s.switchTab);
  const addTab = useAgentTabStore(s => s.addTab);
  const streamingSessionId = useAgentStore(s => s.streamingSessionId);
  const endedSessionIds = useAgentStore(s => s.endedSessionIds);
  const errorSessionIds = useAgentStore(s => s.errorSessionIds);
  const defaultCwd = useTerminalStore(s => s.defaultCwd);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const wheelScroll = useWheelScroll<HTMLDivElement>();

  // New conversation default path
  const newCwd = localStorage.getItem('agent_lastCwd') || defaultCwd;
  const newCwdName = newCwd ? folderName(newCwd) : '未设置';

  const effectiveCwd = useCallback((tabCwd?: string | null) => tabCwd || newCwd || '', [newCwd]);

  const handleBrowse = useCallback(async () => {
    const selected = await open({ directory: true, title: '选择新对话目录' });
    if (selected && typeof selected === 'string') {
      localStorage.setItem('agent_lastCwd', selected);
      const newId = useAgentTabStore.getState().addTab();
      useAgentTabStore.getState().setCwd(newId, selected);
    }
  }, []);

  return (
    <div style={styles.tabBar}>
      {/* Row 1: Tabs */}
      <div style={styles.tabsRow} ref={wheelScroll.ref} onWheel={wheelScroll.onWheel}>
        {tabs.map(tab => {
          const isActive = tab.id === activeTabId;
          const isStreaming = tab.sessionId != null && streamingSessionId === tab.sessionId;
          const tabStatus: 'running' | 'idle' | 'ended' | 'error' | 'none' =
            tab.sessionId == null ? 'none'
            : isStreaming ? 'running'
            : tab.sessionId in errorSessionIds ? 'error'
            : tab.sessionId in endedSessionIds ? 'ended'
            : 'idle';
          const tabCwd = effectiveCwd(tab.cwd);
          return (
            <div
              key={tab.id}
              onClick={() => switchTab(tab.id)}
              onMouseEnter={() => setHoveredId(tab.id)}
              onMouseLeave={() => setHoveredId(null)}
              title={`${tab.label}\n${tabCwd || '未设置路径'}`}
              style={{
                ...styles.tab,
                ...(isActive ? styles.tabActive : {}),
                opacity: isActive ? 1 : 0.7,
                background: isActive
                  ? 'var(--md-surface-container)'
                  : hoveredId === tab.id
                    ? 'var(--md-surface-container-low)'
                    : 'transparent',
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={isActive ? 'var(--md-primary)' : 'var(--md-tertiary-container)'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                <polyline points="4 17 10 11 4 5" />
                <line x1="12" y1="19" x2="20" y2="19" />
              </svg>
              <StatusDot status={tabStatus} />
              <span style={styles.tabLabel}>{tab.label}</span>
              {isActive && (
                <span style={styles.tabCwd} title={tabCwd}>
                  · {folderName(tabCwd)}
                </span>
              )}
              <span
                  className="material-symbols-outlined"
                  role="button"
                  aria-label="关闭标签"
                  style={{
                    ...styles.closeIcon,
                    opacity: isActive || hoveredId === tab.id ? 1 : 0,
                    pointerEvents: isActive || hoveredId === tab.id ? 'auto' : 'none',
                  }}
                  tabIndex={isActive || hoveredId === tab.id ? 0 : -1}
                  onClick={e => { e.stopPropagation(); onCloseTab?.(tab.id); }}
                >close</span>
            </div>
          );
        })}
      </div>

      {/* Right side buttons */}
      <div style={styles.rightActions}>
        <div
          role="button"
          aria-label={`选择新对话目录: ${newCwdName}`}
          tabIndex={0}
          onClick={handleBrowse}
          onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleBrowse(); } }}
          style={styles.folderBtn}
          title={`新对话目录：${newCwd}`}
          onMouseEnter={e => { e.currentTarget.style.background = 'var(--md-surface-container-high)'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 18, color: 'var(--md-on-surface-variant)' }}>
            folder
          </span>
        </div>
        <div
          role="button"
          aria-label="新建对话"
          tabIndex={0}
          onClick={addTab}
          onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); addTab(); } }}
          style={styles.addTabBtn}
          title="新对话"
          onMouseEnter={e => { e.currentTarget.style.background = 'var(--md-surface-container-high)'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 18, color: 'var(--md-on-surface-variant)' }}>
            add
          </span>
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  tabBar: {
    display: 'flex',
    flexDirection: 'column',
    borderBottom: '1px solid var(--border)',
    background: 'var(--md-surface-container-lowest)',
    flexShrink: 0,
    minWidth: 0,
    position: 'relative',
    overflow: 'hidden',
  },
  tabsRow: {
    display: 'flex',
    alignItems: 'stretch',
    overflowX: 'auto',
    flex: 1,
    minWidth: 0,
    gap: 0,
    minHeight: 36,
    paddingRight: 100,
  },
  rightActions: {
    position: 'absolute',
    right: 0,
    top: 0,
    display: 'flex',
    alignItems: 'center',
    gap: 2,
    height: 36,
    paddingRight: 4,
    paddingLeft: 12,
    background: 'linear-gradient(to left, var(--md-surface-container-lowest) 70%, transparent)',
    zIndex: 3,
  },
  tab: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '8px 12px',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    transition: 'all 0.15s',
    borderBottom: '2px solid transparent',
    flexShrink: 0,
    maxWidth: 280,
  },
  tabActive: {
    background: 'var(--md-surface-container)',
    borderBottom: '2px solid var(--md-primary)',
    opacity: 1,
  },
  tabLabel: {
    fontSize: 'var(--text-sm)',
    fontFamily: 'var(--font-sans)',
    color: 'var(--md-on-surface)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  tabCwd: {
    fontSize: 'var(--text-xs)',
    fontFamily: 'var(--font-mono, monospace)',
    color: 'var(--md-on-surface-variant)',
    flexShrink: 0,
    maxWidth: 120,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  closeIcon: {
    fontSize: 14,
    color: 'var(--md-outline-variant)',
    cursor: 'pointer',
    marginLeft: 2,
    padding: 6,
    borderRadius: 'var(--radius-xs)',
    transition: 'opacity 0.15s, background 0.15s',
    flexShrink: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 28,
    minHeight: 28,
  },
  addTabBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 36,
    height: 36,
    margin: '0 4px',
    borderRadius: 'var(--radius-sm)',
    cursor: 'pointer',
    flexShrink: 0,
    transition: 'background 0.15s',
  },
  folderBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 32,
    height: 32,
    borderRadius: 'var(--radius-sm)',
    cursor: 'pointer',
    flexShrink: 0,
    transition: 'background 0.15s',
  },
};
