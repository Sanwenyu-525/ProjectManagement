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

  return (
    <div>
      {/* Group header */}
      <div
        onClick={() => onToggleCollapse(group.id)}
        onContextMenu={(e) => onGroupContextMenu?.(e, group.id)}
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
        <span
          onClick={(e) => {
            e.stopPropagation();
            onCreateTerminal?.(group.id === 'global' ? undefined : group.id);
          }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.15)'; e.currentTarget.style.color = '#e0e6f0'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#7a8399'; }}
          style={{
            fontSize: 12,
            color: '#7a8399',
            cursor: 'pointer',
            padding: '2px 4px',
            borderRadius: 3,
            display: 'flex',
            alignItems: 'center',
            transition: 'all 0.15s',
          }}
        >
          <PlusOutlined />
        </span>
        {group.id !== 'global' && (
          <span
            onClick={(e) => {
              e.stopPropagation();
              onDeleteGroup?.(group.id);
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.2)'; e.currentTarget.style.color = '#ef4444'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#7a8399'; }}
            style={{
              fontSize: 12,
              color: '#7a8399',
              cursor: 'pointer',
              padding: '2px 4px',
              borderRadius: 3,
              display: 'flex',
              alignItems: 'center',
              transition: 'all 0.15s',
            }}
          >
            <CloseOutlined />
          </span>
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
