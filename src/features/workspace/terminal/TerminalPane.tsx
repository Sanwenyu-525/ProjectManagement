import { useState, useRef, useEffect, useCallback } from 'react';
import { PlusOutlined } from '@ant-design/icons';
import { terminalApi } from '../../../api';
import { useTerminalStore } from '../../../stores/terminalStore';
import { usePreviewStore } from '../../../stores/previewStore';
import TerminalInstance from '../../../shared/TerminalInstance';
import { DEFAULT_SHELL, SHELL_MAP } from '../../../lib/constants';
import { listen } from '@tauri-apps/api/event';
import type { TerminalExitEvent } from '../../../shared/terminalTypes';

interface TerminalTab {
  id: string;
  label: string;
  status: 'running' | 'exited' | 'error';
}

export default function TerminalPane() {
  const theme = useTerminalStore(s => s.theme);
  const defaultCwd = useTerminalStore(s => s.defaultCwd);
  const previews = usePreviewStore(s => s.previews);
  const [tabs, setTabs] = useState<TerminalTab[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const createdRef = useRef(false);

  // Create default terminal on mount
  useEffect(() => {
    if (createdRef.current) return;
    createdRef.current = true;

    const shellPref = localStorage.getItem('devhub_terminal_shell') || DEFAULT_SHELL;
    const cfg = SHELL_MAP[shellPref] || SHELL_MAP[DEFAULT_SHELL];
    const id = `term-${Date.now()}`;
    const label = 'Terminal 1';

    terminalApi.startShell(id, cfg.shell, defaultCwd, cfg.args).catch(() => {});
    useTerminalStore.getState().addTerminal({
      id,
      label,
      createdAt: new Date(),
      shell: cfg.shell,
      cwd: defaultCwd,
      status: 'running',
      projectId: null,
      groupId: null,
      pane: 'left',
    });
    setTabs([{ id, label, status: 'running' }]);
    setActiveId(id);
  }, [defaultCwd]);

  // Listen for terminal exit events
  useEffect(() => {
    const unlisten = listen<TerminalExitEvent>('terminal-exit', (event) => {
      const { terminalId, code } = event.payload;
      setTabs(prev => prev.map(t =>
        t.id === terminalId ? { ...t, status: code === 0 ? 'exited' : 'error' } : t
      ));
    });
    return () => { unlisten.then(fn => fn()); };
  }, []);

  const handleInput = useCallback((terminalId: string, data: string) => {
    terminalApi.input(terminalId, data).catch(console.error);
  }, []);

  const handleExit = useCallback((terminalId: string, code: number | null) => {
    setTabs(prev => prev.map(t =>
      t.id === terminalId ? { ...t, status: code === 0 ? 'exited' : 'error' } : t
    ));
  }, []);

  const handleAddTerminal = useCallback(async () => {
    if (tabs.length >= 6) return;
    const shellPref = localStorage.getItem('devhub_terminal_shell') || DEFAULT_SHELL;
    const cfg = SHELL_MAP[shellPref] || SHELL_MAP[DEFAULT_SHELL];
    const id = `term-${Date.now()}`;
    const label = `Terminal ${tabs.length + 1}`;

    try {
      await terminalApi.startShell(id, cfg.shell, defaultCwd, cfg.args);
      useTerminalStore.getState().addTerminal({
        id,
        label,
        createdAt: new Date(),
        shell: cfg.shell,
        cwd: defaultCwd,
        status: 'running',
        projectId: null,
        groupId: null,
        pane: 'left',
      });
      setTabs(prev => [...prev, { id, label, status: 'running' }]);
      setActiveId(id);
    } catch (e) {
      console.error('Failed to create terminal:', e);
    }
  }, [tabs.length, defaultCwd]);

  const activeTerminal = useTerminalStore(s => s.terminals.find(t => t.id === activeId));
  const detectedUrl = previews.find(p => tabs.some(t => t.id === p.terminalId));

  return (
    <div style={styles.container}>
      {/* Terminal Tabs + Status */}
      <div style={styles.header}>
        <div style={styles.tabsRow}>
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveId(tab.id)}
              style={{
                ...styles.tab,
                ...(tab.id === activeId ? styles.tabActive : {}),
              }}
            >
              {tab.label}
            </button>
          ))}
          <button onClick={handleAddTerminal} style={styles.addBtn} title="New terminal">
            <PlusOutlined style={{ fontSize: 12 }} />
          </button>
        </div>
        {activeTerminal?.status === 'running' && (
          <div style={styles.status}>
            <span style={styles.statusDot}>
              <span style={styles.statusDotPing} />
              <span style={styles.statusDotCore} />
            </span>
            <span style={styles.statusText}>
              {detectedUrl
                ? `Dev Server: Running (${new URL(detectedUrl.url).host})`
                : `${activeTerminal.label}: Running`}
            </span>
          </div>
        )}
      </div>

      {/* Terminal Content */}
      <div style={styles.content}>
        {activeTerminal ? (
          <TerminalInstance
            terminal={activeTerminal}
            theme={theme}
            isActive={true}
            onInput={handleInput}
            onExit={handleExit}
          />
        ) : (
          <div style={styles.empty}>
            <span style={{ color: 'rgba(148, 163, 184, 0.5)', fontSize: 12 }}>
              Starting terminal...
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: 256,
    flexShrink: 0,
    background: '#ffffff',
    borderRadius: 12,
    border: '1px solid rgba(187, 202, 198, 0.50)',
    boxShadow: '0 2px 8px rgba(11, 28, 48, 0.04)',
    overflow: 'hidden',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottom: '1px solid rgba(187, 202, 198, 0.50)',
    background: 'var(--md-surface-container-lowest)',
    padding: '4px 8px',
    flexShrink: 0,
  },
  tabsRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
  },
  tab: {
    padding: '4px 12px',
    fontSize: 13,
    fontFamily: 'var(--font-sans)',
    borderRadius: 6,
    border: 'none',
    background: 'transparent',
    color: 'var(--md-on-surface-variant)',
    cursor: 'pointer',
    transition: 'all 0.15s',
  },
  tabActive: {
    background: 'var(--md-surface-container-high)',
    color: 'var(--md-on-surface)',
  },
  addBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 24,
    height: 24,
    borderRadius: 6,
    border: 'none',
    background: 'transparent',
    color: 'var(--md-outline-variant)',
    cursor: 'pointer',
    transition: 'all 0.15s',
  },
  status: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '0 8px',
    flexShrink: 0,
  },
  statusDot: {
    display: 'flex',
    height: 8,
    width: 8,
    position: 'relative' as const,
  },
  statusDotPing: {
    position: 'absolute' as const,
    display: 'inline-flex',
    height: '100%',
    width: '100%',
    borderRadius: '50%',
    background: '#16bb83',
    opacity: 0.75,
    animation: 'ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite',
  },
  statusDotCore: {
    position: 'relative' as const,
    display: 'inline-flex',
    borderRadius: '50%',
    height: 8,
    width: 8,
    background: '#16bb83',
  },
  statusText: {
    fontFamily: 'var(--font-mono)',
    fontSize: 10,
    color: 'rgba(108, 122, 119, 0.6)',
  },
  content: {
    flex: 1,
    overflow: 'hidden',
    background: '#0F172A',
  },
  empty: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    height: '100%',
  },
};
