import { useState, useCallback, useRef, useEffect } from 'react';
import { listen } from '@tauri-apps/api/event';
import { message } from 'antd';
import { open } from '@tauri-apps/plugin-dialog';
import { useTerminalStore } from '../../../stores/terminalStore';
import { useLogStore } from '../../../stores/logStore';
import { terminalApi } from '../../../api';
import { DEFAULT_SHELL, SHELL_MAP } from '../../../lib/constants';
import TerminalInstance from '../../../shared/TerminalInstance';
import ResizeHandle from '../../../shared/ResizeHandle';
import { useWheelScroll } from '../../../hooks/useWheelScroll';
import type { TerminalExitEvent } from '../../../shared/terminalTypes';

type BottomTab = 'terminal' | 'logs';

const TAB_DEFS: { key: BottomTab; label: string; icon: string }[] = [
  { key: 'terminal', label: 'Terminal', icon: 'terminal' },
  { key: 'logs', label: 'Logs', icon: 'article' },
];

interface TerminalTab {
  id: string;
  label: string;
  status: 'running' | 'exited' | 'error';
}

interface BottomPanelProps {
  defaultHeight?: number;
  onHeightChange?: (height: number) => void;
  cwd?: string;
  visible?: boolean;
  onToggleTerminal?: () => void;
}

export default function BottomPanel({ defaultHeight = 280, onHeightChange, cwd, visible = true, onToggleTerminal }: BottomPanelProps) {
  const theme = useTerminalStore(s => s.theme);
  const storeCwd = useTerminalStore(s => s.defaultCwd);
  const effectiveCwd = cwd || storeCwd;

  const [activeTab, setActiveTab] = useState<BottomTab>('terminal');
  const [height, setHeight] = useState(defaultHeight);
  const [tabs, setTabs] = useState<TerminalTab[]>([]);
  const [activeTerminalId, setActiveTerminalId] = useState<string | null>(null);
  const logEntries = useLogStore(s => s.entries);
  const clearLogs = useLogStore(s => s.clearAll);
  const createdRef = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const wheelScroll = useWheelScroll<HTMLDivElement>();

  // Create default terminal on mount
  useEffect(() => {
    if (createdRef.current) return;
    createdRef.current = true;

    const shellPref = localStorage.getItem('devhub_terminal_shell') || DEFAULT_SHELL;
    const cfg = SHELL_MAP[shellPref] || SHELL_MAP[DEFAULT_SHELL];
    const id = `term-${Date.now()}`;
    const label = 'Terminal 1';

    terminalApi.startShell(id, cfg.shell, effectiveCwd, cfg.args).catch((e) => {
      console.error('Failed to start terminal:', e);
      message.error('终端启动失败，请检查 shell 配置');
    });
    useTerminalStore.getState().addTerminal({
      id, label, createdAt: new Date(),
      shell: cfg.shell, cwd: effectiveCwd, status: 'running',
      projectId: null, groupId: null, pane: 'left',
    });
    setTabs([{ id, label, status: 'running' }]);
    setActiveTerminalId(id);
  }, [effectiveCwd]);

  // Listen for terminal exit
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
    if (tabs.length >= 6) {
      message.warning('最多同时打开 6 个终端');
      return;
    }
    const shellPref = localStorage.getItem('devhub_terminal_shell') || DEFAULT_SHELL;
    const cfg = SHELL_MAP[shellPref] || SHELL_MAP[DEFAULT_SHELL];
    const id = `term-${Date.now()}`;
    const label = `Terminal ${tabs.length + 1}`;

    try {
      await terminalApi.startShell(id, cfg.shell, effectiveCwd, cfg.args);
      useTerminalStore.getState().addTerminal({
        id, label, createdAt: new Date(),
        shell: cfg.shell, cwd: effectiveCwd, status: 'running',
        projectId: null, groupId: null, pane: 'left',
      });
      setTabs(prev => [...prev, { id, label, status: 'running' }]);
      setActiveTerminalId(id);
      setActiveTab('terminal');
    } catch (e) {
      console.error('Failed to create terminal:', e);
    }
  }, [tabs.length, effectiveCwd]);

  const handleCloseTerminal = useCallback((id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    terminalApi.stop(id).catch(() => {});
    useTerminalStore.getState().removeTerminal(id);
    setTabs(prev => {
      const next = prev.filter(t => t.id !== id);
      if (activeTerminalId === id) {
        setActiveTerminalId(next.length > 0 ? next[next.length - 1].id : null);
      }
      return next;
    });
  }, [activeTerminalId]);

  const handleBrowse = useCallback(async () => {
    if (tabs.length >= 6) return;
    const selected = await open({ directory: true, title: '选择目录', defaultPath: effectiveCwd || undefined });
    if (typeof selected !== 'string' || !selected) return;

    const shellPref = localStorage.getItem('devhub_terminal_shell') || DEFAULT_SHELL;
    const cfg = SHELL_MAP[shellPref] || SHELL_MAP[DEFAULT_SHELL];
    const id = `term-${Date.now()}`;
    const label = selected.replace(/\\/g, '/').split('/').filter(Boolean).pop() || 'Terminal';

    try {
      await terminalApi.startShell(id, cfg.shell, selected, cfg.args);
      useTerminalStore.getState().addTerminal({
        id, label, createdAt: new Date(),
        shell: cfg.shell, cwd: selected, status: 'running',
        projectId: null, groupId: null, pane: 'left',
      });
      setTabs(prev => [...prev, { id, label, status: 'running' }]);
      setActiveTerminalId(id);
      setActiveTab('terminal');
    } catch (e) {
      console.error('Failed to create terminal:', e);
    }
  }, [tabs.length, effectiveCwd]);

  const activeTerminal = useTerminalStore(s => s.terminals.find(t => t.id === activeTerminalId));

  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    const startY = e.clientY;
    const startHeight = height;

    const onMouseMove = (ev: MouseEvent) => {
      const delta = startY - ev.clientY;
      const newHeight = Math.min(600, Math.max(120, startHeight + delta));
      setHeight(newHeight);
      onHeightChange?.(newHeight);
    };
    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }, [height, onHeightChange]);

  return (
    <div ref={containerRef} style={{ ...styles.container, height }}>
      {/* Resize handle */}
      <ResizeHandle
        orientation="vertical"
        onResizeStart={handleResizeStart}
      />

      {/* Tab bar */}
      <div style={styles.tabBar}>
        <div style={styles.tabsLeft}>
          {TAB_DEFS.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              style={{
                ...styles.tab,
                ...(activeTab === tab.key ? styles.tabActive : {}),
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 14 }}>{tab.icon}</span>
              {tab.label}
            </button>
          ))}
          <button onClick={handleAddTerminal} style={styles.addBtn} title="New terminal"
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--term-surface)'; e.currentTarget.style.color = 'var(--term-text)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--term-text-dim)'; }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 14 }}>add</span>
          </button>
          {activeTab === 'terminal' && (
            <button onClick={handleBrowse} style={styles.addBtn} title="打开目录"
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--term-surface)'; e.currentTarget.style.color = 'var(--term-text)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--term-text-dim)'; }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 14 }}>folder_open</span>
            </button>
          )}
        </div>

        {/* Terminal tabs when in terminal mode */}
        {activeTab === 'terminal' && tabs.length > 1 && (
          <div style={styles.terminalTabs} ref={wheelScroll.ref} onWheel={wheelScroll.onWheel}>
            {tabs.map(tab => (
              <div
                key={tab.id}
                onClick={() => setActiveTerminalId(tab.id)}
                onMouseEnter={e => { if (tab.id !== activeTerminalId) e.currentTarget.style.background = 'rgba(128,128,128,0.12)'; }}
                onMouseLeave={e => { if (tab.id !== activeTerminalId) e.currentTarget.style.background = 'transparent'; }}
                style={{
                  ...styles.terminalTab,
                  ...(tab.id === activeTerminalId ? styles.terminalTabActive : {}),
                }}
              >
                {tab.label}
                {tab.status === 'running' && <span style={styles.miniDot} />}
                <button
                  onClick={(e) => handleCloseTerminal(tab.id, e)}
                  style={styles.closeBtn}
                  title="Close terminal"
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.15)'; e.currentTarget.style.color = '#ef4444'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--term-text-dim)'; }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 12 }}>close</span>
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Status + collapse toggle */}
        {activeTab === 'terminal' && activeTerminal && (
          <div style={styles.statusArea}>
            <span style={{
              ...styles.statusDotCore,
              background: activeTerminal.status === 'running' ? 'var(--term-accent)' : activeTerminal.status === 'error' ? '#ef4444' : 'var(--term-text-dim)',
            }} />
            <span style={styles.statusText}>
              {activeTerminal.status === 'running' ? 'Running' : activeTerminal.status === 'error' ? 'Error' : 'Exited'}
            </span>
            {onToggleTerminal && (
              <button onClick={onToggleTerminal} style={styles.addBtn} title="收起终端">
                <span className="material-symbols-outlined" style={{ fontSize: 14 }}>keyboard_arrow_down</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Content */}
      <div style={styles.content}>
        {activeTab === 'terminal' && activeTerminal && (
          <TerminalInstance
            terminal={activeTerminal}
            theme={theme}
            isActive={true}
            visible={visible}
            onInput={handleInput}
            onExit={handleExit}
          />
        )}
        {activeTab === 'terminal' && !activeTerminal && (
          <div style={styles.empty}>Starting terminal...</div>
        )}

        {activeTab === 'logs' && (
          <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
            {/* Logs toolbar */}
            <div style={styles.logsToolbar}>
              <span style={styles.logsCount}>{logEntries.length} 条日志</span>
              <button onClick={clearLogs} style={styles.addBtn} title="清空日志">
                <span className="material-symbols-outlined" style={{ fontSize: 14 }}>delete_sweep</span>
              </button>
            </div>
            {/* Logs content */}
            {logEntries.length > 0 ? (
              <div style={styles.logsContent}>
                {logEntries.map((entry, i) => (
                  <div key={i} style={styles.logEntry}>
                    <span style={styles.logTime}>
                      {new Date(entry.timestamp).toLocaleTimeString('zh-CN', { hour12: false })}
                    </span>
                    <span style={styles.logLabel}>{entry.terminalLabel}</span>
                    <span style={entry.stream === 'stderr' ? styles.logTextErr : styles.logText}>
                      {entry.data}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div style={styles.empty}>
                <span className="material-symbols-outlined" style={{ fontSize: 28, color: 'var(--md-outline-variant)', marginBottom: 8 }}>
                  article
                </span>
                <span style={{ fontSize: 12, color: 'var(--md-on-surface-variant)' }}>
                  终端输出将显示在这里
                </span>
              </div>
            )}
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
    flexShrink: 0,
    borderRadius: 12,
    border: '1px solid var(--border)',
    background: 'var(--term-bg)',
    overflow: 'hidden',
    position: 'relative',
  },
  tabBar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottom: '1px solid var(--border)',
    background: 'var(--term-bg)',
    padding: '0 8px',
    flexShrink: 0,
    minHeight: 32,
  },
  tabsLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: 2,
  },
  tab: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    padding: '6px 10px',
    fontSize: 12,
    fontFamily: 'var(--font-sans)',
    borderRadius: 6,
    border: 'none',
    background: 'transparent',
    color: 'var(--term-text-muted)',
    cursor: 'pointer',
    transition: 'all 0.15s',
  },
  tabActive: {
    background: 'var(--term-surface)',
    color: 'var(--term-text)',
  },
  addBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 28,
    height: 28,
    borderRadius: 6,
    border: 'none',
    background: 'transparent',
    color: 'var(--term-text-dim)',
    cursor: 'pointer',
  },
  terminalTabs: {
    display: 'flex',
    gap: 4,
    flex: 1,
    minWidth: 0,
    overflowX: 'auto',
  },
  terminalTab: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    padding: '3px 8px',
    fontSize: 11,
    fontFamily: 'var(--font-mono)',
    borderRadius: 4,
    border: 'none',
    background: 'transparent',
    color: 'var(--term-text-muted)',
    cursor: 'pointer',
  },
  terminalTabActive: {
    background: 'var(--term-surface)',
    color: 'var(--term-text)',
  },
  closeBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 16,
    height: 16,
    borderRadius: 4,
    border: 'none',
    background: 'transparent',
    color: 'var(--term-text-dim)',
    cursor: 'pointer',
    padding: 0,
    marginLeft: 2,
  },
  miniDot: {
    display: 'inline-block',
    width: 5,
    height: 5,
    borderRadius: '50%',
    background: 'var(--term-accent)',
  },
  statusArea: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  },
  statusDotCore: {
    display: 'inline-block',
    width: 6,
    height: 6,
    borderRadius: '50%',
    background: 'var(--term-accent)',
  },
  statusText: {
    fontFamily: 'var(--font-mono)',
    fontSize: 10,
    color: 'var(--term-text-dim)',
  },
  content: {
    flex: 1,
    overflow: 'auto',
  },
  empty: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    height: '100%',
    color: 'var(--term-text-dim)',
  },
  logsToolbar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '4px 8px',
    borderBottom: '1px solid var(--border)',
    flexShrink: 0,
  },
  logsCount: {
    fontSize: 11,
    fontFamily: 'var(--font-mono)',
    color: 'var(--term-text-dim)',
  },
  logsContent: {
    flex: 1,
    overflow: 'auto',
    padding: '4px 0',
  },
  logEntry: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 8,
    padding: '1px 8px',
    fontSize: 11,
    fontFamily: 'var(--font-mono)',
    lineHeight: 1.5,
  },
  logTime: {
    color: 'var(--term-text-dim)',
    flexShrink: 0,
    fontSize: 10,
  },
  logLabel: {
    color: 'var(--term-accent)',
    flexShrink: 0,
    fontSize: 10,
    minWidth: 60,
  },
  logText: {
    color: 'var(--term-text)',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-all',
  },
  logTextErr: {
    color: '#ef4444',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-all',
  },
};
