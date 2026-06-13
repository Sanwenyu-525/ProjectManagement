import { useState, useMemo, useCallback, useRef } from 'react';
import { Terminal, PanePosition } from '../terminalTypes';
import { TerminalGroup as TerminalGroupType, useTerminalStore } from '../../stores/terminalStore';
import TerminalGroup from './TerminalGroup';
import { PlusOutlined, PartitionOutlined } from '@ant-design/icons';

interface TerminalTabBarProps {
  pane: PanePosition;
  activeId: string | null;
  onSelect: (id: string) => void;
  onClose: (id: string) => void;
  onRename: (id: string, label: string) => void;
  onCreateTerminal: (groupId?: string) => void;
  terminalCount: number;
  maxTerminals: number;
}

export default function TerminalTabBar({
  pane,
  activeId,
  onSelect,
  onClose,
  onRename,
  onCreateTerminal,
  terminalCount,
  maxTerminals,
}: TerminalTabBarProps) {
  const groups = useTerminalStore(s => s.groups);
  const terminals = useTerminalStore(s => s.terminals);
  const toggleGroupCollapse = useTerminalStore(s => s.toggleGroupCollapse);
  const splitPaneOpen = useTerminalStore(s => s.splitPaneOpen);
  const setSplitPaneOpen = useTerminalStore(s => s.setSplitPaneOpen);
  const splitVerticalOpen = useTerminalStore(s => s.splitVerticalOpen);
  const setSplitVerticalOpen = useTerminalStore(s => s.setSplitVerticalOpen);
  const tabBarWidth = useTerminalStore(s => s.tabBarWidth);
  const setTabBarWidth = useTerminalStore(s => s.setTabBarWidth);
  const removeGroup = useTerminalStore(s => s.removeGroup);

  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef({ dragging: false, startX: 0, startWidth: 0 });

  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragRef.current = { dragging: true, startX: e.clientX, startWidth: tabBarWidth };
    setIsDragging(true);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    const handleMove = (ev: MouseEvent) => {
      if (!dragRef.current.dragging) return;
      const delta = ev.clientX - dragRef.current.startX;
      setTabBarWidth(dragRef.current.startWidth + delta);
    };

    const handleUp = () => {
      dragRef.current.dragging = false;
      setIsDragging(false);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      document.removeEventListener('mousemove', handleMove);
      document.removeEventListener('mouseup', handleUp);
    };

    document.addEventListener('mousemove', handleMove);
    document.addEventListener('mouseup', handleUp);
  }, [tabBarWidth, setTabBarWidth]);

  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    terminalId?: string;
    groupId?: string;
  } | null>(null);

  // Filter terminals for this pane
  const paneTerminals = useMemo(
    () => terminals.filter(t => t.pane === pane),
    [terminals, pane]
  );

  // Build grouped terminal list
  const groupedTerminals = useMemo(() => {
    // Ensure "global" group always exists
    const globalGroup: TerminalGroupType = {
      id: 'global',
      label: '全局',
      isProjectGroup: true,
      isCollapsed: false,
    };

    // Collect all relevant groups
    const allGroups: TerminalGroupType[] = [globalGroup];

    // Add project groups and custom groups that have terminals in this pane
    const groupIdsWithTerminals = new Set(paneTerminals.map(t => t.groupId).filter(Boolean));
    for (const g of groups) {
      if (groupIdsWithTerminals.has(g.id)) {
        allGroups.push(g);
      }
    }

    // Build map: groupId -> terminals
    const groupMap = new Map<string, Terminal[]>();
    groupMap.set('global', []);

    for (const g of allGroups) {
      if (g.id !== 'global') groupMap.set(g.id, []);
    }

    for (const t of paneTerminals) {
      const gid = t.groupId || 'global';
      if (!groupMap.has(gid)) {
        groupMap.set(gid, []);
      }
      groupMap.get(gid)!.push(t);
    }

    // Filter out empty groups (except global)
    return allGroups
      .filter(g => g.id === 'global' || (groupMap.get(g.id)?.length ?? 0) > 0)
      .map(g => ({
        group: g,
        terminals: groupMap.get(g.id) || [],
      }));
  }, [groups, paneTerminals]);

  const handleContextMenu = useCallback((e: React.MouseEvent, terminalId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY, terminalId });
  }, []);

  const handleGroupContextMenu = useCallback((e: React.MouseEvent, groupId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY, groupId });
  }, []);

  // Resolve current group from active terminal
  const activeTerminal = paneTerminals.find(t => t.id === activeId);
  const currentGroupId = activeTerminal?.groupId || undefined;

  const closeContextMenu = useCallback(() => setContextMenu(null), []);

  return (
    <div
      style={{
        width: tabBarWidth,
        minWidth: 140,
        background: '#252526',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        position: 'relative',
        flexShrink: 0,
      }}
      onClick={closeContextMenu}
    >
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '8px 12px',
        borderBottom: '1px solid #3c3c3c',
        flexShrink: 0,
      }}>
        <span style={{ fontSize: 11, color: '#7a8399', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          终端
        </span>
        <div style={{ display: 'flex', gap: 4 }}>
          <button
            onClick={() => onCreateTerminal(currentGroupId)}
            disabled={terminalCount >= maxTerminals}
            title="新建终端"
            style={{
              background: 'none',
              border: 'none',
              color: terminalCount >= maxTerminals ? '#333' : '#888',
              cursor: terminalCount >= maxTerminals ? 'not-allowed' : 'pointer',
              padding: '3px 6px',
              borderRadius: 3,
              display: 'flex',
              alignItems: 'center',
            }}
            onMouseEnter={e => {
              if (terminalCount < maxTerminals) e.currentTarget.style.background = '#3c3c3c';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = 'none';
            }}
          >
            <PlusOutlined style={{ fontSize: 11 }} />
          </button>
          {pane === 'right' && (
            <button
              onClick={() => setSplitVerticalOpen(!splitVerticalOpen)}
              title={splitVerticalOpen ? '关闭上下分屏' : '上下分屏'}
              style={{
                background: splitVerticalOpen ? 'rgba(59, 130, 246, 0.2)' : 'none',
                border: splitVerticalOpen ? '1px solid rgba(59, 130, 246, 0.3)' : 'none',
                color: splitVerticalOpen ? '#60a5fa' : '#888',
                cursor: 'pointer',
                padding: '3px 6px',
                borderRadius: 3,
                display: 'flex',
                alignItems: 'center',
              }}
              onMouseEnter={e => {
                if (!splitVerticalOpen) e.currentTarget.style.background = '#3c3c3c';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = splitVerticalOpen ? 'rgba(59, 130, 246, 0.2)' : 'none';
              }}
            >
              <svg width="11" height="11" viewBox="0 0 11 11" fill="currentColor">
                <rect x="0" y="0" width="11" height="5" rx="1" />
                <rect x="0" y="6" width="11" height="5" rx="1" />
              </svg>
            </button>
          )}
          <button
            onClick={() => setSplitPaneOpen(!splitPaneOpen)}
            title={splitPaneOpen ? '关闭分屏' : '左右分屏'}
            style={{
              background: splitPaneOpen ? 'rgba(59, 130, 246, 0.2)' : 'none',
              border: splitPaneOpen ? '1px solid rgba(59, 130, 246, 0.3)' : 'none',
              color: splitPaneOpen ? '#60a5fa' : '#888',
              cursor: 'pointer',
              padding: '3px 6px',
              borderRadius: 3,
              display: 'flex',
              alignItems: 'center',
            }}
            onMouseEnter={e => {
              if (!splitPaneOpen) e.currentTarget.style.background = '#3c3c3c';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = splitPaneOpen ? 'rgba(59, 130, 246, 0.2)' : 'none';
            }}
          >
            <PartitionOutlined style={{ fontSize: 11 }} />
          </button>
        </div>
      </div>

      {/* Groups list */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        overflowX: 'hidden',
        padding: '4px 0',
      }}>
        {groupedTerminals.map(({ group, terminals: groupTerminals }) => (
          <TerminalGroup
            key={group.id}
            group={group}
            terminals={groupTerminals}
            activeId={activeId}
            onSelect={onSelect}
            onClose={onClose}
            onRename={onRename}
            onToggleCollapse={toggleGroupCollapse}
            onDeleteGroup={removeGroup}
            onCreateTerminal={onCreateTerminal}
            onContextMenu={handleContextMenu}
            onGroupContextMenu={handleGroupContextMenu}
          />
        ))}

        {paneTerminals.length === 0 && (
          <div style={{
            padding: '20px 12px',
            textAlign: 'center',
            color: '#555',
            fontSize: 12,
          }}>
            无终端
          </div>
        )}
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          terminalId={contextMenu.terminalId}
          groupId={contextMenu.groupId}
          pane={pane}
          onClose={closeContextMenu}
          onSelect={onSelect}
          onCloseTerminal={onClose}
        />
      )}

      {/* Right-edge drag handle */}
      <div
        onMouseDown={handleResizeStart}
        onMouseEnter={e => {
          const indicator = e.currentTarget.querySelector('[data-indicator]') as HTMLElement;
          if (indicator) indicator.style.background = 'rgba(255,255,255,0.35)';
        }}
        onMouseLeave={e => {
          if (isDragging) return;
          const indicator = e.currentTarget.querySelector('[data-indicator]') as HTMLElement;
          if (indicator) indicator.style.background = 'rgba(255,255,255,0)';
        }}
        style={{
          position: 'absolute',
          top: 0,
          right: 0,
          width: 5,
          height: '100%',
          cursor: 'col-resize',
          zIndex: 12,
        }}
      >
        <div
          data-indicator
          style={{
            position: 'absolute',
            top: '50%',
            right: 1,
            width: 3,
            height: 24,
            borderRadius: 2,
            transform: 'translateY(-50%)',
            background: isDragging ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0)',
            transition: isDragging ? 'none' : 'background 0.15s',
          }}
        />
      </div>
    </div>
  );
}

// Simple context menu component
function ContextMenu({
  x, y, terminalId, groupId, pane, onClose, onSelect, onCloseTerminal,
}: {
  x: number; y: number;
  terminalId?: string; groupId?: string;
  pane: PanePosition;
  onClose: () => void;
  onSelect: (id: string) => void;
  onCloseTerminal: (id: string) => void;
}) {
  const moveTerminalToPane = useTerminalStore(s => s.moveTerminalToPane);
  const moveTerminalToGroup = useTerminalStore(s => s.moveTerminalToGroup);
  const groups = useTerminalStore(s => s.groups);
  const removeGroup = useTerminalStore(s => s.removeGroup);

  const [showGroupSubmenu, setShowGroupSubmenu] = useState(false);

  const items: { label: string; action: () => void; danger?: boolean }[] = [];

  if (terminalId) {
    // Determine target pane based on current pane
    let targetPane: PanePosition;
    let targetLabel: string;
    if (pane === 'left') {
      targetPane = 'right';
      targetLabel = '右';
    } else if (pane === 'right') {
      targetPane = 'left';
      targetLabel = '左';
    } else if (pane === 'top') {
      targetPane = 'bottom';
      targetLabel = '下';
    } else {
      targetPane = 'top';
      targetLabel = '上';
    }

    items.push(
      { label: '切换到此终端', action: () => { onSelect(terminalId); onClose(); } },
      {
        label: `移到${targetLabel}面板`,
        action: () => { moveTerminalToPane(terminalId, targetPane); onClose(); },
      },
      { label: '移到分组...', action: () => setShowGroupSubmenu(true) },
      { label: '从分组移出', action: () => { moveTerminalToGroup(terminalId, null); onClose(); } },
      { label: '关闭终端', action: () => { onCloseTerminal(terminalId); onClose(); }, danger: true },
    );
  }

  if (groupId && groupId !== 'global') {
    const group = groups.find(g => g.id === groupId);
    if (group && !group.isProjectGroup) {
      items.push({
        label: '删除分组',
        action: () => { removeGroup(groupId); onClose(); },
        danger: true,
      });
    }
  }

  return (
    <div
      style={{
        position: 'fixed',
        left: x,
        top: y,
        background: '#2d2d30',
        border: '1px solid #454545',
        borderRadius: 6,
        padding: '4px 0',
        minWidth: 160,
        zIndex: 1000,
        boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
      }}
      onClick={e => e.stopPropagation()}
    >
      {items.map((item, i) => (
        <div
          key={i}
          onClick={item.action}
          style={{
            padding: '6px 14px',
            fontSize: 12,
            color: item.danger ? '#ef4444' : '#ccc',
            cursor: 'pointer',
            transition: 'background 0.1s',
          }}
          onMouseEnter={e => e.currentTarget.style.background = '#3e3e42'}
          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
        >
          {item.label}
        </div>
      ))}

      {/* Group submenu */}
      {showGroupSubmenu && terminalId && (
        <div style={{
          position: 'absolute',
          left: '100%',
          top: 0,
          background: '#2d2d30',
          border: '1px solid #454545',
          borderRadius: 6,
          padding: '4px 0',
          minWidth: 140,
          boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
        }}>
          {groups.filter(g => !g.isProjectGroup).map(g => (
            <div
              key={g.id}
              onClick={() => {
                moveTerminalToGroup(terminalId, g.id);
                onClose();
              }}
              style={{
                padding: '6px 14px',
                fontSize: 12,
                color: '#ccc',
                cursor: 'pointer',
                transition: 'background 0.1s',
              }}
              onMouseEnter={e => e.currentTarget.style.background = '#3e3e42'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              {g.label}
            </div>
          ))}
          {groups.filter(g => !g.isProjectGroup).length === 0 && (
            <div style={{ padding: '6px 14px', fontSize: 12, color: '#555' }}>
              无自定义分组
            </div>
          )}
        </div>
      )}
    </div>
  );
}
