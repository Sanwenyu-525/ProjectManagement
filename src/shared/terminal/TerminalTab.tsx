import { useState, useRef } from 'react';
import { Terminal } from '../terminalTypes';
import { CloseOutlined } from '@ant-design/icons';

interface TerminalTabProps {
  terminal: Terminal;
  isActive: boolean;
  onSelect: (id: string) => void;
  onClose: (id: string) => void;
  onRename: (id: string, label: string) => void;
  onContextMenu?: (e: React.MouseEvent, terminalId: string) => void;
}

export default function TerminalTab({ terminal, isActive, onSelect, onClose, onRename, onContextMenu }: TerminalTabProps) {
  const [editing, setEditing] = useState(false);
  const [editLabel, setEditLabel] = useState('');
  const [hovered, setHovered] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditing(true);
    setEditLabel(terminal.label);
    setTimeout(() => inputRef.current?.select(), 0);
  };

  const commitEdit = () => {
    if (editLabel.trim()) {
      onRename(terminal.id, editLabel.trim());
    }
    setEditing(false);
  };

  const statusColor = terminal.status === 'running' ? '#22c55e'
    : terminal.status === 'exited' ? '#6b7a99'
    : '#ef4444';

  return (
    <div
      onClick={() => onSelect(terminal.id)}
      onDoubleClick={handleDoubleClick}
      onContextMenu={(e) => onContextMenu?.(e, terminal.id)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '5px 12px 5px 24px',
        cursor: 'pointer',
        fontSize: 12,
        color: isActive ? '#ffffff' : '#b0b8c8',
        background: isActive ? '#37373d' : 'transparent',
        borderRadius: 4,
        margin: '1px 6px',
        transition: 'all 0.1s',
        position: 'relative',
      }}
      onMouseEnter={e => {
        setHovered(true);
        if (!isActive) e.currentTarget.style.background = '#2a2d2e';
      }}
      onMouseLeave={e => {
        setHovered(false);
        if (!isActive) e.currentTarget.style.background = 'transparent';
      }}
    >
      <span style={{
        width: 6,
        height: 6,
        borderRadius: '50%',
        background: statusColor,
        flexShrink: 0,
      }} />

      {editing ? (
        <input
          ref={inputRef}
          autoFocus
          value={editLabel}
          onChange={e => setEditLabel(e.target.value)}
          onBlur={commitEdit}
          onKeyDown={e => {
            if (e.key === 'Enter') commitEdit();
            if (e.key === 'Escape') setEditing(false);
          }}
          onClick={e => e.stopPropagation()}
          style={{
            background: 'transparent',
            border: '1px solid #007acc',
            color: '#fff',
            padding: '1px 4px',
            fontSize: 12,
            flex: 1,
            minWidth: 0,
            outline: 'none',
            borderRadius: 2,
          }}
        />
      ) : (
        <span style={{
          flex: 1,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>
          {terminal.label}
        </span>
      )}

      <CloseOutlined
        onClick={e => {
          e.stopPropagation();
          onClose(terminal.id);
        }}
        onMouseEnter={e => {
          e.currentTarget.style.color = '#e8e8e8';
          e.currentTarget.style.background = 'rgba(255,255,255,0.1)';
        }}
        onMouseLeave={e => {
          e.currentTarget.style.color = '#555';
          e.currentTarget.style.background = 'transparent';
        }}
        style={{
          fontSize: 9,
          color: '#555',
          cursor: 'pointer',
          opacity: isActive || hovered ? 1 : 0,
          transition: 'opacity 0.15s, color 0.1s, background 0.1s',
          flexShrink: 0,
          borderRadius: 3,
          padding: '2px',
        }}
        className="tab-close-btn"
      />
    </div>
  );
}
