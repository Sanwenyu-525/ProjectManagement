import { useState, useRef, useEffect, useCallback, useLayoutEffect } from 'react';
import { PlusOutlined, CloseOutlined, PartitionOutlined, SortAscendingOutlined, PushpinOutlined, PushpinFilled } from '@ant-design/icons';
import { Dropdown, Modal } from 'antd';
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { SortableContext, horizontalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { PaneTab } from './types';
import { isEnterCommit } from '@/lib/keyboard';

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
  onReorder?: (fromIndex: number, toIndex: number) => void;
  onRename?: (tabId: string, newLabel: string) => void;
  onTogglePin?: (tabId: string) => void;
  onCloseOthers?: (tabId: string) => void;
  onCloseRight?: (tabId: string) => void;
  onMoveToPane?: (tabId: string, targetLeafId: string) => void;
  otherPanes?: { id: string; label: string }[];
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
  if (status === 'exited') return 'var(--ws-text-muted, #6b7280)';
  if (status === 'error') return '#ef4444';
  return 'var(--ws-text-muted, #6b7280)';
}

interface SortableTabProps {
  tab: PaneTab;
  isActive: boolean;
  isHovered: boolean;
  isNew: boolean;
  editingTabId: string | null;
  editValue: string;
  inputRef: React.RefObject<HTMLInputElement>;
  onEditValueChange: (v: string) => void;
  onCommitEdit: () => void;
  onCancelEdit: () => void;
  onSelect: (tabId: string) => void;
  onDoubleClick: (tabId: string, label: string) => void;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  onClose: (tabId: string) => void;
  onTogglePin?: (tabId: string) => void;
  onContextMenu?: (e: React.MouseEvent, tabId: string) => void;
}

function SortableTab({ tab, isActive, isHovered, isNew, editingTabId, editValue, inputRef, onEditValueChange, onCommitEdit, onCancelEdit, onSelect, onDoubleClick, onMouseEnter, onMouseLeave, onClose, onTogglePin, onContextMenu }: SortableTabProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: tab.id });
  const composingRef = useRef(false);
  const style: React.CSSProperties = {
    ...styles.tab,
    ...(isActive ? styles.tabActive : {}),
    ...(!isActive && isHovered ? { background: 'var(--ws-hover)' } : {}),
    color: isActive ? 'var(--ws-text)' : 'var(--ws-text-secondary)',
    // Flash only on inactive new tabs — active tab keeps its normal background
    ...(!isActive && isNew ? { animation: 'paneTabFlash 1.2s ease' } : {}),
    ...(isDragging ? { opacity: 0.4 } : {}),
    transform: CSS.Translate.toString(transform),
    // Merge dnd-kit transition with tab's own transition instead of replacing it
    transition: transition
      ? `${transition}, background 0.12s, border-color 0.12s`
      : 'background 0.12s, border-color 0.12s',
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={editingTabId === tab.id ? undefined : () => onSelect(tab.id)}
      onDoubleClick={(e) => { e.stopPropagation(); onDoubleClick(tab.id, tab.label); }}
      onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); onContextMenu?.(e, tab.id); }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
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
          onChange={e => onEditValueChange(e.target.value)}
          onCompositionStart={() => { composingRef.current = true; }}
          onCompositionEnd={() => { composingRef.current = false; }}
          onBlur={() => { if (!composingRef.current) onCommitEdit(); }}
          onKeyDown={e => {
            if (isEnterCommit(e)) onCommitEdit();
            if (e.key === 'Escape') onCancelEdit();
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
            ? <PushpinFilled style={{ fontSize: 9, color: 'var(--ws-active-border, #6366f1)' }} />
            : <PushpinOutlined style={{ fontSize: 9 }} />}
        </button>
      )}
      {(isHovered || isActive) && (
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
}

export default function PaneTabBar({ tabs, activeTabId, onSelect, onClose, onAdd, onSplit, onClosePane, onSort, onReorder, onRename, onTogglePin, onCloseOthers, onCloseRight, onMoveToPane, otherPanes }: Props) {
  const [hoveredTab, setHoveredTab] = useState<string | null>(null);
  const [editingTabId, setEditingTabId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const clickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tabsRowRef = useRef<HTMLDivElement>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; tabId: string } | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

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

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id || !onReorder) return;
    const fromIndex = tabs.findIndex(t => t.id === active.id);
    const toIndex = tabs.findIndex(t => t.id === over.id);
    if (fromIndex !== -1 && toIndex !== -1) {
      onReorder(fromIndex, toIndex);
    }
  };

  const handleContextMenu = useCallback((e: React.MouseEvent, tabId: string) => {
    setContextMenu({ x: e.clientX, y: e.clientY, tabId });
  }, []);

  const closeContextMenu = useCallback(() => setContextMenu(null), []);

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
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <div
          ref={tabsRowRef}
          style={styles.tabsRow}
          onWheel={(e) => {
            if (!tabsRowRef.current) return;
            e.preventDefault();
            tabsRowRef.current.scrollLeft += e.deltaY;
          }}
        >
          <SortableContext items={tabs.map(t => t.id)} strategy={horizontalListSortingStrategy}>
            {tabs.map(tab => (
              <SortableTab
                key={tab.id}
                tab={tab}
                isActive={tab.id === activeTabId}
                isHovered={tab.id === hoveredTab}
                isNew={newTabIds.has(tab.id)}
                editingTabId={editingTabId}
                editValue={editValue}
                inputRef={inputRef}
                onEditValueChange={setEditValue}
                onCommitEdit={commitEdit}
                onCancelEdit={() => setEditingTabId(null)}
                onSelect={(tabId) => {
                  if (clickTimerRef.current) clearTimeout(clickTimerRef.current);
                  clickTimerRef.current = setTimeout(() => onSelect(tabId), 250);
                }}
                onDoubleClick={(tabId, label) => {
                  if (clickTimerRef.current) { clearTimeout(clickTimerRef.current); clickTimerRef.current = null; }
                  startEdit(tabId, label);
                }}
                onMouseEnter={() => setHoveredTab(tab.id)}
                onMouseLeave={() => setHoveredTab(null)}
                onClose={(tabId) => setClosingTab({ id: tabId, label: tab.label })}
                onTogglePin={onTogglePin}
                onContextMenu={handleContextMenu}
              />
            ))}
          </SortableContext>
        </div>
      </DndContext>
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
    {contextMenu && (
      <ContextMenu
        x={contextMenu.x}
        y={contextMenu.y}
        tabId={contextMenu.tabId}
        tabs={tabs}
        onClose={closeContextMenu}
        onCloseTab={onClose}
        onCloseOthers={onCloseOthers}
        onCloseRight={onCloseRight}
        onMoveToPane={onMoveToPane}
        otherPanes={otherPanes}
        onAdd={onAdd}
      />
    )}
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

function ContextMenu({
  x, y, tabId, tabs, onClose, onCloseTab, onCloseOthers, onCloseRight, onMoveToPane, otherPanes, onAdd,
}: {
  x: number; y: number; tabId: string; tabs: PaneTab[];
  onClose: () => void; onCloseTab: (id: string) => void;
  onCloseOthers?: (id: string) => void; onCloseRight?: (id: string) => void;
  onMoveToPane?: (id: string, targetLeafId: string) => void;
  otherPanes?: { id: string; label: string }[];
  onAdd?: () => void;
}) {
  const tabIndex = tabs.findIndex(t => t.id === tabId);
  const tab = tabs[tabIndex];
  if (!tab) return null;

  const items: { key: string; label: string; danger?: boolean; disabled?: boolean; divider?: boolean; sub?: { id: string; label: string }[] }[] = [];

  items.push({ key: 'close', label: '关闭' });
  items.push({ key: 'close-others', label: '关闭其他', disabled: tabs.length <= 1 });
  items.push({ key: 'close-right', label: '关闭右侧', disabled: tabIndex >= tabs.length - 1 });
  items.push({ key: 'divider-1', label: '', divider: true });

  if (onMoveToPane && otherPanes && otherPanes.length > 0) {
    items.push({
      key: 'move',
      label: '移到面板',
      sub: otherPanes.map(p => ({ id: p.id, label: p.label })),
    });
  }

  if (onAdd) {
    items.push({ key: 'divider-2', label: '', divider: true });
    items.push({ key: 'new', label: '新建标签页' });
  }

  const menuRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const el = menuRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    let cx = x, cy = y;
    if (cx + rect.width > window.innerWidth - 8) cx = window.innerWidth - rect.width - 8;
    if (cy + rect.height > window.innerHeight - 8) cy = window.innerHeight - rect.height - 8;
    if (cx < 8) cx = 8;
    if (cy < 8) cy = 8;
    el.style.left = `${cx}px`;
    el.style.top = `${cy}px`;
  }, [x, y]);

  const [hoveredItem, setHoveredItem] = useState<string | null>(null);

  return (
    <div
      ref={menuRef}
      style={{
        position: 'fixed',
        left: x,
        top: y,
        background: 'var(--ws-navigator-bg, rgba(15,16,24,0.95))',
        border: '1px solid var(--ws-border, rgba(0,0,0,0.08))',
        borderRadius: 6,
        padding: '4px 0',
        minWidth: 160,
        zIndex: 1000,
        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        backdropFilter: 'var(--ws-glass-blur, blur(20px) saturate(1.8))',
      }}
      onClick={e => e.stopPropagation()}
    >
      {items.map(item => {
        if (item.divider) {
          return <div key={item.key} style={{ height: 1, background: 'var(--ws-border, rgba(0,0,0,0.08))', margin: '4px 0' }} />;
        }
        if (item.sub) {
          return (
            <div
              key={item.key}
              onMouseEnter={() => setHoveredItem(item.key)}
              onMouseLeave={() => setHoveredItem(null)}
              style={{ position: 'relative' }}
            >
              <div style={{
                padding: '6px 14px',
                fontSize: 12,
                color: 'var(--ws-text, #1a1f36)',
                cursor: 'default',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                background: hoveredItem === item.key ? 'var(--ws-hover, rgba(0,0,0,0.04))' : 'transparent',
              }}>
                <span>{item.label}</span>
                <span style={{ fontSize: 8, color: 'var(--ws-text-secondary, #6b7a99)', marginLeft: 8 }}>▶</span>
              </div>
              {hoveredItem === item.key && (
                <div style={{
                  position: 'absolute',
                  left: '100%',
                  top: 0,
                  background: 'var(--ws-navigator-bg, rgba(15,16,24,0.95))',
                  border: '1px solid var(--ws-border, rgba(0,0,0,0.08))',
                  borderRadius: 6,
                  padding: '4px 0',
                  minWidth: 120,
                  boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                  backdropFilter: 'var(--ws-glass-blur, blur(20px) saturate(1.8))',
                  zIndex: 1001,
                }}>
                  {item.sub.map(s => (
                    <div
                      key={s.id}
                      onClick={() => { onMoveToPane?.(tabId, s.id); onClose(); }}
                      style={{
                        padding: '6px 14px',
                        fontSize: 12,
                        color: 'var(--ws-text, #1a1f36)',
                        cursor: 'pointer',
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = 'var(--ws-hover, rgba(0,0,0,0.04))'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                      {s.label}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        }
        const disabled = item.disabled;
        return (
          <div
            key={item.key}
            onClick={() => {
              if (disabled) return;
              if (item.key === 'close') { onCloseTab(tabId); onClose(); }
              else if (item.key === 'close-others') { onCloseOthers?.(tabId); onClose(); }
              else if (item.key === 'close-right') { onCloseRight?.(tabId); onClose(); }
              else if (item.key === 'new') { onAdd?.(); onClose(); }
            }}
            style={{
              padding: '6px 14px',
              fontSize: 12,
              color: disabled ? 'var(--ws-text-muted, #94a3b8)' : item.danger ? '#ef4444' : 'var(--ws-text, #1a1f36)',
              cursor: disabled ? 'not-allowed' : 'pointer',
              transition: 'background 0.1s',
            }}
            onMouseEnter={e => { if (!disabled) e.currentTarget.style.background = 'var(--ws-hover, rgba(0,0,0,0.04))'; }}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          >
            {item.label}
          </div>
        );
      })}
    </div>
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
    userSelect: 'none',
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
    width: 20,
    height: 20,
    borderRadius: 5,
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
    width: 20,
    height: 20,
    borderRadius: 5,
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
    border: '1px solid var(--ws-active-border, #6366f1)',
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
