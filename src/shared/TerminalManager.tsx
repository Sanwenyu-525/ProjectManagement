import { useState, useCallback, useEffect } from 'react';
import { terminalApi } from '../api';
import TerminalInstance from './TerminalInstance';
import { Terminal, TerminalTheme } from './terminalTypes';
import { PlusOutlined, CloseOutlined } from '@ant-design/icons';

interface TerminalManagerProps {
  visible: boolean;
}

export default function TerminalManager({ visible }: TerminalManagerProps) {
  const [terminals, setTerminals] = useState<Terminal[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [theme, setTheme] = useState<TerminalTheme>('dark');

  // Load saved theme on mount
  useEffect(() => {
    const savedTheme = localStorage.getItem('terminal-theme');
    if (savedTheme && ['dark', 'modern', 'matrix', 'light'].includes(savedTheme)) {
      setTheme(savedTheme as TerminalTheme);
    }
  }, []);

  // Persist terminal state to localStorage
  useEffect(() => {
    if (terminals.length > 0) {
      localStorage.setItem('terminal-state', JSON.stringify({ terminals, activeId }));
    } else {
      localStorage.removeItem('terminal-state');
    }
  }, [terminals, activeId]);

  const createTerminal = useCallback(async (label?: string) => {
    if (terminals.length >= 10) {
      console.warn('Max terminals reached');
      return;
    }

    const id = `global-${Math.random().toString(36).slice(2, 10)}`;
    const isWin = navigator.platform.includes('Win');
    const shell = isWin ? 'powershell.exe' : 'bash';
    const cwd = isWin
      ? (import.meta.env.USERPROFILE || 'C:\\')
      : (import.meta.env.HOME || '/');

    const newTerminal: Terminal = {
      id,
      label: label || `终端 ${terminals.length + 1}`,
      createdAt: new Date(),
      shell,
      cwd,
      status: 'running',
    };

    await terminalApi.startShell(id, shell, cwd);
    setTerminals(prev => [...prev, newTerminal]);
    setActiveId(id);
  }, [terminals.length]);

  const closeTerminal = useCallback(async (id: string) => {
    try {
      await terminalApi.stop(id);
    } catch {
      // Terminal may have already exited
    }

    setTerminals(prev => {
      const remaining = prev.filter(t => t.id !== id);
      if (activeId === id) {
        const newActiveId = remaining.length > 0
          ? remaining[remaining.length - 1].id
          : null;
        setActiveId(newActiveId);
      }
      return remaining;
    });
  }, [activeId]);

  const switchTerminal = useCallback((id: string) => {
    setActiveId(id);
  }, []);

  const renameTerminal = useCallback((id: string, label: string) => {
    setTerminals(prev => prev.map(t =>
      t.id === id ? { ...t, label } : t
    ));
  }, []);

  const setTerminalTheme = useCallback((newTheme: TerminalTheme) => {
    setTheme(newTheme);
    localStorage.setItem('terminal-theme', newTheme);
  }, []);

  // These are exposed via the component's actions for parent consumption
  // (e.g., through context or imperative handle). Silencing unused warnings
  // until they are wired into the render tree.
  void renameTerminal;
  void setTerminalTheme;

  const handleTerminalInput = useCallback((terminalId: string, data: string) => {
    terminalApi.input(terminalId, data).catch(console.error);
  }, []);

  if (!visible) return null;

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      background: '#1e1e1e',
      borderRadius: '12px 12px 0 0',
      overflow: 'hidden',
    }}>
      {/* Tab bar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        height: 36,
        padding: '0 8px',
        background: '#252526',
        borderBottom: '1px solid #3c3c3c',
        gap: 4,
        overflowX: 'auto',
      }}>
        {terminals.map(t => (
          <div
            key={t.id}
            onClick={() => switchTerminal(t.id)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 12px',
              background: activeId === t.id ? '#37373d' : 'transparent',
              borderRadius: 4,
              cursor: 'pointer',
              fontSize: 12,
              color: activeId === t.id ? '#ffffff' : '#999',
              transition: 'all 0.1s',
              whiteSpace: 'nowrap',
            }}
            onMouseEnter={e => {
              if (activeId !== t.id) {
                e.currentTarget.style.background = '#2a2d2e';
              }
            }}
            onMouseLeave={e => {
              if (activeId !== t.id) {
                e.currentTarget.style.background = 'transparent';
              }
            }}
          >
            <span>{t.label}</span>
            <CloseOutlined
              onClick={(e) => {
                e.stopPropagation();
                closeTerminal(t.id);
              }}
              style={{
                fontSize: 10,
                color: '#666',
                cursor: 'pointer',
              }}
            />
          </div>
        ))}

        <button
          onClick={() => createTerminal()}
          disabled={terminals.length >= 10}
          style={{
            background: 'none',
            border: 'none',
            color: terminals.length >= 10 ? '#333' : '#999',
            cursor: terminals.length >= 10 ? 'not-allowed' : 'pointer',
            padding: '6px 8px',
            borderRadius: 4,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.1s',
          }}
          onMouseEnter={e => {
            if (terminals.length < 10) {
              e.currentTarget.style.background = '#3c3c3c';
              e.currentTarget.style.color = '#fff';
            }
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = 'none';
            e.currentTarget.style.color = terminals.length >= 10 ? '#333' : '#999';
          }}
          title="新建终端"
        >
          <PlusOutlined style={{ fontSize: 12 }} />
        </button>
      </div>

      {/* Terminal viewport */}
      <div style={{
        flex: 1,
        padding: '8px 4px',
        overflow: 'hidden',
        position: 'relative',
      }}>
        {terminals.map(t => (
          <TerminalInstance
            key={t.id}
            terminal={t}
            theme={theme}
            isActive={activeId === t.id}
            onInput={handleTerminalInput}
          />
        ))}

        {terminals.length === 0 && (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            color: '#666',
          }}>
            <div style={{ marginBottom: 12 }}>无活动终端</div>
            <button
              onClick={() => createTerminal()}
              style={{
                background: '#007acc',
                color: '#fff',
                border: 'none',
                padding: '8px 16px',
                borderRadius: 4,
                cursor: 'pointer',
              }}
            >
              新建终端
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
