import { useState, useRef } from 'react';
import { Terminal } from '../terminalTypes';
import { CloseOutlined } from '@ant-design/icons';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { isEnterCommit } from '@/lib/keyboard';

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
  const composingRef = useRef(false);
  const { attributes, listeners, setNodeRef, transform, isDragging } = useSortable({ id: terminal.id });

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

  const statusColor = terminal.status === 'running' ? 'var(--color-status-done)'
    : terminal.status === 'exited' ? 'var(--ws-text-secondary, #6b7a99)'
    : 'var(--color-status-cancel)';

  return (
    <div
      ref={setNodeRef}
      onClick={() => onSelect(terminal.id)}
      onDoubleClick={handleDoubleClick}
      onContextMenu={(e) => onContextMenu?.(e, terminal.id)}
      {...attributes}
      {...listeners}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '5px 12px 5px 24px',
        cursor: 'grab',
        fontSize: 12,
        color: isActive ? 'var(--ws-text, #1a1f36)' : 'var(--ws-text-secondary, #6b7a99)',
        background: isActive ? 'var(--ws-hover, rgba(0,0,0,0.06))' : hovered ? 'var(--ws-active-bg, rgba(99,102,241,0.10))' : 'transparent',
        borderRadius: 4,
        margin: '1px 6px',
        transition: 'all 0.1s',
        position: 'relative',
        opacity: isDragging ? 0.4 : 1,
        transform: CSS.Translate.toString(transform),
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
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
          onCompositionStart={() => { composingRef.current = true; }}
          onCompositionEnd={() => { composingRef.current = false; }}
          onBlur={() => { if (!composingRef.current) commitEdit(); }}
          onKeyDown={e => {
            if (isEnterCommit(e)) commitEdit();
            if (e.key === 'Escape') setEditing(false);
          }}
          onClick={e => e.stopPropagation()}
          style={{
            background: 'transparent',
            border: '1px solid var(--ws-active-border, #6366f1)',
            color: 'var(--ws-text, #1a1f36)',
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
        style={{
          fontSize: 9,
          color: 'var(--ws-text-secondary, #6b7a99)',
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
