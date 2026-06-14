import { useState, useRef, useEffect } from 'react';
import { PlusOutlined, CloseOutlined, PartitionOutlined, SortAscendingOutlined, PushpinOutlined, PushpinFilled } from '@ant-design/icons';
import { Dropdown, Modal } from 'antd';
import type { PaneTab } from './types';

type SplitDirection = 'left' | 'right' | 'up' | 'down';

interface Props {
  tabs: PaneTab[];
  activeTabId: string | null;
  onSelect: (tabId: string) => void;
  onClose: (tabId: string) => void;
  onAdd?: () => void;
  onSplit?: (direction: SplitDirection) => void;
  onClosePane?: () => void;
  onSort?: (mode: 'name-asc' | 'name-desc' | 'type' | 'status') => void;
  onRename?: (tabId: string, newLabel: string) => void;
  onTogglePin?: (tabId: string) => void;
}

function ArrowIcon({ direction, size = 10 }: { direction: SplitDirection; size?: number }) {
  const rotation = { up: 0, right: 90, down: 180, left: 270 }[direction];
  return (
    <svg width={size} height={size} viewBox="0 0 10 10" style={{ transform: `rotate(${rotation}deg)`, flexShrink: 0 }}>
      <path d="M5 1 L9 7 L1 7 Z" fill="currentColor" />
    </svg>
  );
}

function statusColor(status?: string) {
  if (status === 'running') return '#22c55e';
  if (status === 'exited') return '#6b7280';
  if (status === 'error') return '#ef4444';
  return '#6b7280';
}

export default function PaneTabBar({ tabs, activeTabId, onSelect, onClose, onAdd, onSplit, onClosePane, onSort, onRename, onTogglePin }: Props) {
  const [hoveredTab, setHoveredTab] = useState<string | null>(null);
  const [editingTabId, setEditingTabId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const clickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tabsRowRef = useRef<HTMLDivElement>(null);

  const startEdit = (tabId: string, label: string) => {
    if (!onRename) return;
    setEditingTabId(tabId);
    setEditValue(label);
    setTimeout(() => inputRef.current?.select(), 0);
  };

  const commitEdit = () => {
    if (editingTabId && editValue.trim()) {
      onRename?.(editingTabId, editValue.trim());
    }
    setEditingTabId(null);
  };

  // ── New tab highlight animation ──
  const prevTabIdsRef = useRef<Set<string>>(new Set());
  const [newTabIds, setNewTabIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    const prev = prevTabIdsRef.current;
    const curr = new Set(tabs.map(t => t.id));
    const added = new Set([...curr].filter(id => !prev.has(id)));
    prevTabIdsRef.current = curr;
    if (added.size > 0) {
      setNewTabIds(prev => new Set([...prev, ...added]));
      const timer = setTimeout(() => setNewTabIds(prev => {
        const next = new Set(prev);
        added.forEach(id => next.delete(id));
        return next;
      }), 1200);
      return () => clearTimeout(timer);
    }
  }, [tabs]);

  // Inject keyframe animation once
  const animStyleInjected = useRef(false);
  useEffect(() => {
    if (!animStyleInjected.current) {
      animStyleInjected.current = true;
      const style = document.createElement('style');
      style.textContent = `@keyframes paneTabFlash{0%,100%{background:rgba(99,102,241,0.3)}33%{background:rgba(99,102,241,0.05)}66%{background:rgba(99,102,241,0.3)}}`;
      document.head.appendChild(style);
    }
  }, []);

  // ── Close confirmation ──
  const [closingTab, setClosingTab] = useState<{ id: string; label: string } | null>(null);

  const handleCloseConfirm = () => {
    if (closingTab) {
      onClose(closingTab.id);
      setClosingTab(null);
    }
  };

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
    <>
    <div style={styles.bar}>
      <div
        ref={tabsRowRef}
        style={styles.tabsRow}
        onWheel={(e) => {
          if (!tabsRowRef.current) return;
          e.preventDefault();
          tabsRowRef.current.scrollLeft += e.deltaY;
        }}
      >
        {tabs.map(tab => {
          const isActive = tab.id === activeTabId;
          const isHovered = tab.id === hoveredTab;
          const isNew = newTabIds.has(tab.id);
          return (
            <div
              key={tab.id}
              style={{
                ...styles.tab,
                ...(isActive ? styles.tabActive : {}),
                ...(!isActive && isHovered ? { background: 'var(--ws-hover)' } : {}),
                color: isActive ? 'var(--ws-text)' : 'var(--ws-text-secondary)',
                ...(isNew ? { animation: 'paneTabFlash 1.2s ease' } : {}),
              }}
              onClick={editingTabId === tab.id ? undefined : () => {
                if (clickTimerRef.current) clearTimeout(clickTimerRef.current);
                clickTimerRef.current = setTimeout(() => onSelect(tab.id), 250);
              }}
              onDoubleClick={(e) => {
                e.stopPropagation();
                if (clickTimerRef.current) { clearTimeout(clickTimerRef.current); clickTimerRef.current = null; }
                startEdit(tab.id, tab.label);
              }}
              onMouseEnter={() => setHoveredTab(tab.id)}
              onMouseLeave={() => setHoveredTab(null)}
            >
              <span style={{
                ...styles.dot,
                background: tab.contentType === 'browser' ? '#60a5fa'
                  : tab.contentType === 'agent' ? '#a5b4fc'
                  : tab.contentType === 'plugin' ? '#f59e0b'
                  : tab.contentType === 'file' ? '#fbbf24'
                  : statusColor(tab.status),
                boxShadow: tab.status === 'running'
                  ? '0 0 4px rgba(34, 197, 94, 0.4)'
                  : 'none',
              }} />
              {editingTabId === tab.id ? (
                <input
                  ref={inputRef}
                  autoFocus
                  value={editValue}
                  onChange={e => setEditValue(e.target.value)}
                  onBlur={commitEdit}
                  onKeyDown={e => {
                    if (e.key === 'Enter') commitEdit();
                    if (e.key === 'Escape') setEditingTabId(null);
                  }}
                  onClick={e => e.stopPropagation()}
                  style={styles.editInput}
                />
              ) : (
                <span style={styles.label}>{tab.label}</span>
              )}
              {tab.contentType === 'terminal' && onTogglePin && (tab.namePinned || isHovered || isActive) && (
                <button
                  onClick={(e) => { e.stopPropagation(); onTogglePin(tab.id); }}
                  style={styles.pinBtn}
                  title={tab.namePinned ? '取消固定名称' : '固定名称'}
                >
                  {tab.namePinned
                    ? <PushpinFilled style={{ fontSize: 9, color: '#6366f1' }} />
                    : <PushpinOutlined style={{ fontSize: 9 }} />}
                </button>
              )}
              {(isHovered || isActive) && (
                <button
                  onClick={(e) => { e.stopPropagation(); setClosingTab({ id: tab.id, label: tab.label }); }}
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
      {tabs.length > 1 && onSort && (
        <Dropdown
          menu={{
            items: [
              { key: 'name-asc', label: '名称 A→Z' },
              { key: 'name-desc', label: '名称 Z→A' },
              { type: 'divider' as const },
              { key: 'type', label: '按类型分组' },
              { key: 'status', label: '运行中优先' },
            ],
            onClick: ({ key }) => onSort(key as 'name-asc' | 'name-desc' | 'type' | 'status'),
          }}
          trigger={['click']}
        >
          <button style={styles.addBtn} title="排序标签页">
            <SortAscendingOutlined style={{ fontSize: 10 }} />
          </button>
        </Dropdown>
      )}
      {tabs.length > 0 && onSplit && (
        <Dropdown
          menu={{
            items: [
              { key: 'left',  label: '向左分屏',  icon: <ArrowIcon direction="left" /> },
              { key: 'right', label: '向右分屏',  icon: <ArrowIcon direction="right" /> },
              { key: 'up',    label: '向上分屏',  icon: <ArrowIcon direction="up" /> },
              { key: 'down',  label: '向下分屏',  icon: <ArrowIcon direction="down" /> },
            ],
            onClick: ({ key }) => onSplit(key as SplitDirection),
          }}
          trigger={['click']}
        >
          <button style={styles.addBtn} title="分屏">
            <PartitionOutlined style={{ fontSize: 10 }} />
          </button>
        </Dropdown>
      )}
      {onClosePane && (
        <button onClick={onClosePane} style={styles.addBtn} title="关闭面板">
          <CloseOutlined style={{ fontSize: 9, color: '#ef4444' }} />
        </button>
      )}
    </div>
    <Modal
      open={!!closingTab}
      title="关闭标签页"
      onOk={handleCloseConfirm}
      onCancel={() => setClosingTab(null)}
      okText="关闭"
      cancelText="取消"
      okButtonProps={{ danger: true }}
      centered
      destroyOnClose
    >
      <p>确定关闭「{closingTab?.label}」？</p>
    </Modal>
    </>
  );
}

const styles: Record<string, React.CSSProperties> = {
  bar: {
    display: 'flex',
    alignItems: 'center',
    height: 34,
    background: 'var(--ws-tabbar-bg)',
    backdropFilter: 'var(--ws-glass-blur)',
    WebkitBackdropFilter: 'var(--ws-glass-blur)',
    borderBottom: '1px solid var(--ws-border)',
    overflow: 'hidden',
    flexShrink: 0,
    gap: 1,
  },
  emptyBar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: 34,
    background: 'var(--ws-tabbar-bg)',
    backdropFilter: 'var(--ws-glass-blur)',
    WebkitBackdropFilter: 'var(--ws-glass-blur)',
    borderBottom: '1px solid var(--ws-border)',
    flexShrink: 0,
    gap: 8,
  },
  emptyText: {
    fontSize: 11,
    color: 'var(--ws-text-secondary)',
  },
  tabsRow: {
    display: 'flex',
    flex: 1,
    overflowX: 'auto',
    overflowY: 'hidden',
    height: '100%',
    alignItems: 'stretch',
    gap: 0,
    padding: '0 4px',
  },
  tab: {
    display: 'flex',
    alignItems: 'center',
    gap: 7,
    padding: '0 12px',
    height: '100%',
    cursor: 'pointer',
    fontSize: 11,
    fontFamily: "'Fira Code', monospace",
    whiteSpace: 'nowrap',
    transition: 'background 0.12s, border-color 0.12s',
    flexShrink: 0,
    background: 'transparent',
    borderBottom: '2px solid transparent',
  },
  tabActive: {
    background: 'var(--ws-hover)',
    borderBottom: '2px solid var(--ws-active-border)',
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: '50%',
    flexShrink: 0,
  },
  label: {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    maxWidth: 130,
    lineHeight: '34px',
  },
  closeBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 16,
    height: 16,
    borderRadius: 4,
    border: 'none',
    background: 'transparent',
    color: 'var(--ws-text-secondary)',
    cursor: 'pointer',
    flexShrink: 0,
    padding: 0,
    lineHeight: 1,
    transition: 'color 0.12s',
  },
  pinBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 14,
    height: 14,
    borderRadius: 3,
    border: 'none',
    background: 'transparent',
    color: 'var(--ws-text-secondary)',
    cursor: 'pointer',
    flexShrink: 0,
    padding: 0,
    lineHeight: 1,
    transition: 'color 0.12s',
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
    color: 'var(--ws-text-secondary)',
    cursor: 'pointer',
    flexShrink: 0,
    marginRight: 4,
    padding: 0,
    transition: 'color 0.12s',
  },
  addBtnSmall: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 20,
    height: 20,
    borderRadius: 4,
    border: 'none',
    background: 'transparent',
    color: 'var(--ws-text-secondary)',
    cursor: 'pointer',
    padding: 0,
  },
  editInput: {
    background: 'transparent',
    border: '1px solid #6366f1',
    color: 'var(--ws-text)',
    padding: '0 4px',
    fontSize: 11,
    fontFamily: "'Fira Code', monospace",
    flex: 1,
    minWidth: 0,
    outline: 'none',
    borderRadius: 3,
    lineHeight: '20px',
  },
};
