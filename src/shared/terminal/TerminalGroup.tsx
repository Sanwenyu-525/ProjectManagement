import { useState } from 'react';
import { Terminal } from '../terminalTypes';
import { TerminalGroup as TerminalGroupType } from '../../stores/terminalStore';
import TerminalTab from './TerminalTab';
import { RightOutlined, DownOutlined, CloseOutlined, PlusOutlined } from '@ant-design/icons';

interface TerminalGroupProps {
  group: TerminalGroupType;
  terminals: Terminal[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onClose: (id: string) => void;
  onRename: (id: string, label: string) => void;
  onToggleCollapse: (id: string) => void;
  onDeleteGroup?: (id: string) => void;
  onCreateTerminal?: (groupId?: string) => void;
  onContextMenu?: (e: React.MouseEvent, terminalId: string) => void;
  onGroupContextMenu?: (e: React.MouseEvent, groupId: string) => void;
}

export default function TerminalGroup({
  group,
  terminals,
  activeId,
  onSelect,
  onClose,
  onRename,
  onToggleCollapse,
  onDeleteGroup,
  onCreateTerminal,
  onContextMenu,
  onGroupContextMenu,
}: TerminalGroupProps) {
  const count = terminals.length;
  const hasActive = terminals.some(t => t.id === activeId);
  const [hovered, setHovered] = useState(false);

  return (
    <div>
      {/* Group header */}
      <div
        onClick={() => onToggleCollapse(group.id)}
        onContextMenu={(e) => onGroupContextMenu?.(e, group.id)}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '6px 12px',
          cursor: 'pointer',
          fontSize: 11,
          fontWeight: 600,
          color: hasActive ? '#e0e6f0' : '#7a8399',
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
          userSelect: 'none',
        }}
      >
        {group.isCollapsed
          ? <RightOutlined style={{ fontSize: 8 }} />
          : <DownOutlined style={{ fontSize: 8 }} />
        }
        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 4 }}>
          <span>{group.label}</span>
          <span style={{
            fontSize: 11,
            color: '#7a8399',
            fontWeight: 400,
          }}>
            {count}
          </span>
        </span>
        <PlusOutlined
          onClick={(e) => {
            e.stopPropagation();
            onCreateTerminal?.(group.id === 'global' ? undefined : group.id);
          }}
          style={{
            fontSize: 9,
            color: hovered ? '#888' : 'transparent',
            cursor: 'pointer',
            padding: '0 2px',
            transition: 'color 0.15s',
          }}
        />
        {group.id !== 'global' && (
          <CloseOutlined
            onClick={(e) => {
              e.stopPropagation();
              onDeleteGroup?.(group.id);
            }}
            style={{
              fontSize: 9,
              color: hovered ? '#888' : 'transparent',
              cursor: 'pointer',
              padding: '0 2px',
              transition: 'color 0.15s',
            }}
          />
        )}
      </div>

      {/* Terminal tabs */}
      {!group.isCollapsed && terminals.map(t => (
        <TerminalTab
          key={t.id}
          terminal={t}
          isActive={t.id === activeId}
          onSelect={onSelect}
          onClose={onClose}
          onRename={onRename}
          onContextMenu={onContextMenu}
        />
      ))}
    </div>
  );
}
