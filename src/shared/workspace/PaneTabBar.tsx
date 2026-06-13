import { useState } from 'react';
import { PlusOutlined, CloseOutlined } from '@ant-design/icons';
import type { PaneTab } from './types';

interface Props {
  tabs: PaneTab[];
  activeTabId: string | null;
  onSelect: (tabId: string) => void;
  onClose: (tabId: string) => void;
  onAdd?: () => void;
}

function statusColor(status?: string) {
  if (status === 'running') return '#22c55e';
  if (status === 'exited') return '#6b7280';
  if (status === 'error') return '#ef4444';
  return '#6b7280';
}

export default function PaneTabBar({ tabs, activeTabId, onSelect, onClose, onAdd }: Props) {
  const [hoveredTab, setHoveredTab] = useState<string | null>(null);

  if (tabs.length === 0) {
    return (
      <div style={styles.emptyBar}>
        <span style={styles.emptyText}>无标签页</span>
        {onAdd && (
          <button onClick={onAdd} style={styles.addBtnSmall} title="新建">
            <PlusOutlined style={{ fontSize: 10 }} />
          </button>
        )}
      </div>
    );
  }

  return (
    <div style={styles.bar}>
      <div style={styles.tabsRow}>
        {tabs.map(tab => {
          const isActive = tab.id === activeTabId;
          const isHovered = tab.id === hoveredTab;
          return (
            <div
              key={tab.id}
              style={{
                ...styles.tab,
                ...(isActive ? styles.tabActive : {}),
                color: isActive ? '#e2e8f0' : '#94a3b8',
              }}
              onClick={() => onSelect(tab.id)}
              onMouseEnter={() => setHoveredTab(tab.id)}
              onMouseLeave={() => setHoveredTab(null)}
            >
              <span style={{
                ...styles.dot,
                background: tab.contentType === 'browser' ? '#60a5fa'
                  : tab.contentType === 'agent' ? '#a5b4fc'
                  : statusColor(tab.status),
                boxShadow: tab.status === 'running'
                  ? '0 0 4px rgba(34, 197, 94, 0.4)'
                  : 'none',
              }} />
              <span style={styles.label}>{tab.label}</span>
              {(isHovered || isActive) && tabs.length > 1 && (
                <button
                  onClick={(e) => { e.stopPropagation(); onClose(tab.id); }}
                  style={styles.closeBtn}
                  title="关闭"
                >
                  <CloseOutlined style={{ fontSize: 8 }} />
                </button>
              )}
            </div>
          );
        })}
      </div>
      {onAdd && (
        <button onClick={onAdd} style={styles.addBtn} title="新建标签页">
          <PlusOutlined style={{ fontSize: 10 }} />
        </button>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  bar: {
    display: 'flex',
    alignItems: 'center',
    height: 32,
    background: 'rgba(255, 255, 255, 0.03)',
    borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
    overflow: 'hidden',
    flexShrink: 0,
    gap: 1,
  },
  emptyBar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: 32,
    background: 'rgba(255, 255, 255, 0.03)',
    borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
    flexShrink: 0,
    gap: 8,
  },
  emptyText: {
    fontSize: 11,
    color: '#94a3b8',
  },
  tabsRow: {
    display: 'flex',
    flex: 1,
    overflow: 'auto',
    height: '100%',
    alignItems: 'center',
    gap: 1,
    padding: '0 2px',
  },
  tab: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '0 10px',
    height: 24,
    borderRadius: 4,
    cursor: 'pointer',
    fontSize: 11,
    fontFamily: "'Fira Code', monospace",
    whiteSpace: 'nowrap',
    transition: 'background 0.1s',
    flexShrink: 0,
    background: 'transparent',
  },
  tabActive: {
    background: 'rgba(255, 255, 255, 0.08)',
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: '50%',
    flexShrink: 0,
  },
  label: {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    maxWidth: 120,
  },
  closeBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 14,
    height: 14,
    borderRadius: 3,
    border: 'none',
    background: 'transparent',
    color: '#64748b',
    cursor: 'pointer',
    flexShrink: 0,
    padding: 0,
    lineHeight: 1,
  },
  addBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 24,
    height: 24,
    borderRadius: 4,
    border: 'none',
    background: 'transparent',
    color: '#64748b',
    cursor: 'pointer',
    flexShrink: 0,
    marginRight: 4,
    padding: 0,
  },
  addBtnSmall: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 18,
    height: 18,
    borderRadius: 3,
    border: 'none',
    background: 'transparent',
    color: '#94a3b8',
    cursor: 'pointer',
    padding: 0,
  },
};
