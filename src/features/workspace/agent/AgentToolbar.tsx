import { useState, useCallback } from 'react';
import { open } from '@tauri-apps/plugin-dialog';
import { useThemeStore } from '../../../stores/themeStore';
import { useTerminalStore } from '../../../stores/terminalStore';
import { folderName } from '../components/terminalFactory';

interface AgentToolbarProps {
  onCwdChange?: (cwd: string) => void;
}

export default function AgentToolbar({ onCwdChange }: AgentToolbarProps) {
  const isDark = useThemeStore(s => s.mode === 'dark');
  const defaultCwd = useTerminalStore(s => s.defaultCwd);
  const [cwd, setCwd] = useState(() => localStorage.getItem('agent_lastCwd') || defaultCwd);

  const handleBrowse = useCallback(async () => {
    const selected = await open({ directory: true, title: '选择工作目录' });
    if (selected && typeof selected === 'string') {
      localStorage.setItem('agent_lastCwd', selected);
      setCwd(selected);
      onCwdChange?.(selected);
    }
  }, [onCwdChange]);

  const displayName = cwd ? folderName(cwd) : '未设置';
  const isCustom = cwd !== defaultCwd;

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      padding: '4px 12px',
      borderBottom: '1px solid var(--divider)',
      background: isDark ? 'rgba(15,23,42,0.4)' : 'rgba(255,255,255,0.4)',
      flexShrink: 0,
      fontSize: 12,
      fontFamily: 'var(--font-sans)',
      minHeight: 32,
    }}>
      {/* CWD */}
      <button
        onClick={handleBrowse}
        title={cwd || '点击选择目录'}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          padding: '2px 8px',
          borderRadius: 4,
          border: 'none',
          background: isDark ? 'rgba(148,163,184,0.08)' : 'rgba(0,0,0,0.04)',
          color: isCustom ? 'var(--md-primary)' : 'var(--md-on-surface-variant)',
          cursor: 'pointer',
          fontSize: 11,
          fontFamily: 'var(--font-mono, monospace)',
          maxWidth: 260,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          transition: 'background 0.15s',
        }}
        onMouseEnter={e => { e.currentTarget.style.background = isDark ? 'rgba(148,163,184,0.15)' : 'rgba(0,0,0,0.08)'; }}
        onMouseLeave={e => { e.currentTarget.style.background = isDark ? 'rgba(148,163,184,0.08)' : 'rgba(0,0,0,0.04)'; }}
      >
        <span className="material-symbols-outlined" style={{ fontSize: 14 }}>folder</span>
        {displayName}
      </button>

      {/* Spacer */}
      <div style={{ flex: 1 }} />

    </div>
  );
}
