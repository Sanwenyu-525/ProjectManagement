/* src/shared/components/SearchBox.tsx */

import { useState } from 'react';
import { SearchOutlined } from '@ant-design/icons';

interface SearchBoxProps {
  onClick?: () => void;
}

export default function SearchBox({ onClick }: SearchBoxProps) {
  const [focused, setFocused] = useState(false);

  return (
    <div
      tabIndex={0}
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        background: 'rgba(255, 255, 255, 0.08)',
        backdropFilter: 'blur(40px) saturate(1.3)',
        WebkitBackdropFilter: 'blur(40px) saturate(1.3)',
        border: `1px solid ${focused ? 'rgba(34, 197, 94, 0.5)' : 'rgba(255, 255, 255, 0.15)'}`,
        borderRadius: 8,
        padding: '10px 20px',
        minWidth: 0,
        maxWidth: 400,
        boxShadow: focused
          ? 'inset 0 1px 0 rgba(255, 255, 255, 0.4), 0 0 20px rgba(34, 197, 94, 0.1)'
          : 'inset 0 1px 0 rgba(255, 255, 255, 0.4), 0 4px 12px rgba(0, 0, 0, 0.08)',
        transition: 'all 0.3s ease',
        cursor: 'pointer',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = 'rgba(34, 197, 94, 0.3)';
        e.currentTarget.style.boxShadow = 'inset 0 1px 0 rgba(255, 255, 255, 0.4), 0 4px 12px rgba(0, 0, 0, 0.12)';
      }}
      onMouseLeave={(e) => {
        if (!focused) {
          e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.15)';
          e.currentTarget.style.boxShadow = 'inset 0 1px 0 rgba(255, 255, 255, 0.4), 0 4px 12px rgba(0, 0, 0, 0.08)';
        }
      }}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
    >
      <SearchOutlined
        style={{
          color: focused ? '#22c55e' : '#9eadc0',
          fontSize: 16,
          transition: 'color 0.3s ease',
        }}
      />
      <span style={{
        color: '#9eadc0',
        fontSize: 14,
        flex: 1,
      }}>
        搜索项目、任务、文档...
      </span>
      <kbd style={{
        fontSize: 11,
        color: '#9eadc0',
        background: 'rgba(255, 255, 255, 0.1)',
        padding: '2px 6px',
        borderRadius: 4,
        border: '1px solid rgba(255, 255, 255, 0.15)',
        fontFamily: "'Fira Code', monospace",
      }}>
        ⌘K
      </kbd>
    </div>
  );
}
