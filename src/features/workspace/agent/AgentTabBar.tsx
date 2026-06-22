import { useState } from 'react';
import { Modal } from 'antd';
import { useAgentTabStore } from '../../../stores/agentTabStore';
import { useAgentStore } from '../../../stores/agentStore';

interface AgentTabBarProps {
  onCloseTab?: (tabId: string) => void;
}

export default function AgentTabBar({ onCloseTab }: AgentTabBarProps) {
  const tabs = useAgentTabStore(s => s.tabs);
  const activeTabId = useAgentTabStore(s => s.activeTabId);
  const switchTab = useAgentTabStore(s => s.switchTab);
  const addTab = useAgentTabStore(s => s.addTab);
  const streamingSessionId = useAgentStore(s => s.streamingSessionId);
  const setAgentMode = useAgentTabStore(s => s.setAgentMode);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [confirmTabId, setConfirmTabId] = useState<string | null>(null);

  return (
    <div style={styles.tabBar}>
      <div style={styles.tabsRow}>
        {tabs.map(tab => {
          const isActive = tab.id === activeTabId;
          const isStreaming = tab.sessionId != null && streamingSessionId === tab.sessionId;
          const showClose = true;
          return (
            <div
              key={tab.id}
              onClick={() => switchTab(tab.id)}
              onMouseEnter={() => setHoveredId(tab.id)}
              onMouseLeave={() => setHoveredId(null)}
              style={{
                ...styles.tab,
                ...(isActive ? styles.tabActive : {}),
                opacity: isActive ? 1 : 0.7,
              }}
            >
              <span className="material-symbols-outlined" style={{
                fontSize: 16,
                color: isActive ? 'var(--md-primary)' : 'var(--md-tertiary-container)',
              }}>
                {tab.agentMode === 'gui' ? 'chat' : 'terminal'}
              </span>
              {isStreaming && (
                <span style={styles.streamingDot} />
              )}
              <span style={styles.tabLabel}>{tab.label}</span>
              {showClose && (
                <span
                  className="material-symbols-outlined"
                  role="button"
                  aria-label="切换模式"
                  title="切换模式"
                  style={{
                    ...styles.closeIcon,
                    opacity: isActive || hoveredId === tab.id ? 1 : 0,
                  }}
                  onClick={e => { e.stopPropagation(); setConfirmTabId(tab.id); }}
                >swap_horiz</span>
              )}
              {showClose && (
                <span
                  className="material-symbols-outlined"
                  role="button"
                  aria-label="关闭标签"
                  style={{
                    ...styles.closeIcon,
                    opacity: isActive || hoveredId === tab.id ? 1 : 0,
                  }}
                  onClick={e => { e.stopPropagation(); onCloseTab?.(tab.id); }}
                >close</span>
              )}
            </div>
          );
        })}
      </div>
      <div
        onClick={addTab}
        style={styles.addTabBtn}
        title="新对话"
      >
        <span className="material-symbols-outlined" style={{ fontSize: 18, color: 'var(--md-on-surface-variant)' }}>
          add
        </span>
      </div>
      <Modal
        open={!!confirmTabId}
        onOk={() => {
          if (confirmTabId) {
            const tab = tabs.find(t => t.id === confirmTabId);
            if (tab) {
              setAgentMode(confirmTabId, tab.agentMode === 'xterm' ? 'gui' : 'xterm');
            }
          }
          setConfirmTabId(null);
        }}
        onCancel={() => setConfirmTabId(null)}
        title="切换模式"
        okText="切换"
        cancelText="取消"
        styles={{ body: { fontSize: 13 } }}
      >
        切换模式将结束当前会话，是否继续？
      </Modal>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  tabBar: {
    display: 'flex',
    alignItems: 'center',
    borderBottom: '1px solid var(--md-outline-variant)',
    background: 'var(--md-surface-container-lowest)',
    flexShrink: 0,
  },
  tabsRow: {
    display: 'flex',
    alignItems: 'stretch',
    overflowX: 'auto',
    flex: 1,
    gap: 0,
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
    maxWidth: 180,
  },
  tabActive: {
    background: 'var(--md-surface-container)',
    borderBottom: '2px solid var(--md-primary)',
    opacity: 1,
  },
  tabLabel: {
    fontSize: 13,
    fontFamily: 'var(--font-sans)',
    color: 'var(--md-on-surface)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  streamingDot: {
    width: 6,
    height: 6,
    borderRadius: '50%',
    background: 'var(--md-tertiary)',
    flexShrink: 0,
    animation: 'pulse 1.5s ease-in-out infinite',
  },
  closeIcon: {
    fontSize: 14,
    color: 'var(--md-outline-variant)',
    cursor: 'pointer',
    marginLeft: 2,
    padding: 3,
    borderRadius: 'var(--radius-xs)',
    transition: 'opacity 0.15s, background 0.15s',
    flexShrink: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addTabBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 32,
    height: 32,
    margin: '0 4px',
    borderRadius: 'var(--radius-sm)',
    cursor: 'pointer',
    flexShrink: 0,
    transition: 'background 0.15s',
  },
};
