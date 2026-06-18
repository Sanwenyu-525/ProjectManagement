import { useState } from 'react';
import { SearchOutlined } from '@ant-design/icons';

interface SearchBoxProps {
  onOpenCommandPalette?: () => void;
}

export default function SearchBox({ onOpenCommandPalette }: SearchBoxProps) {
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;

  return (
    <div style={{ position: 'relative', width: '100%', maxWidth: 500 }}>
      <div
        onClick={onOpenCommandPalette}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        tabIndex={0}
        role="button"
        aria-label="Open command palette"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          background: hovered || focused
            ? 'var(--md-surface-container-high)'
            : 'var(--md-surface-container)',
          border: `1px solid ${focused ? 'var(--md-primary)' : hovered ? 'var(--md-outline)' : 'var(--md-outline-variant)'}`,
          borderRadius: 8,
          padding: '8px 12px',
          height: 36,
          minWidth: 0,
          cursor: 'pointer',
          boxSizing: 'border-box',
          transition: 'all 0.2s ease',
          boxShadow: focused ? `0 0 0 2px rgba(0,107,95,0.14)` : 'none',
        }}
      >
        <SearchOutlined
          style={{
            color: focused ? 'var(--md-primary)' : 'var(--md-on-surface-variant)',
            fontSize: 14,
            transition: 'color 0.2s ease',
          }}
        />
        <span style={{
          flex: 1,
          fontSize: 13,
          color: 'var(--md-on-surface-variant)',
          fontFamily: 'var(--font-sans)',
          userSelect: 'none',
        }}>
          搜索命令、文件或符号 (Ctrl+K)
        </span>
        <kbd style={{
          fontSize: 10,
          color: 'var(--md-on-surface-variant)',
          background: 'var(--md-surface-container-high)',
          padding: '2px 6px',
          borderRadius: 4,
          border: '1px solid var(--md-outline-variant)',
          fontFamily: "'Fira Code', monospace",
          flexShrink: 0,
        }}>
          {isMac ? '⌘K' : 'Ctrl+K'}
        </kbd>
      </div>
    </div>
  );
}
