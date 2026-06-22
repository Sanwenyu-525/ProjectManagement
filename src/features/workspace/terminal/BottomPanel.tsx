import { useState, useCallback, useRef, useEffect } from 'react';
import { listen } from '@tauri-apps/api/event';
import { message } from 'antd';
import { useTerminalStore } from '../../../stores/terminalStore';
import { usePreviewStore } from '../../../stores/previewStore';
import { terminalApi } from '../../../api';
import { DEFAULT_SHELL, SHELL_MAP } from '../../../lib/constants';
import TerminalInstance from '../../../shared/TerminalInstance';
import type { TerminalExitEvent } from '../../../shared/terminalTypes';

type BottomTab = 'terminal' | 'preview' | 'logs';

const TAB_DEFS: { key: BottomTab; label: string; icon: string }[] = [
  { key: 'terminal', label: 'Terminal', icon: 'terminal' },
  { key: 'preview', label: 'Preview', icon: 'language' },
  { key: 'logs', label: 'Logs', 'icon': 'article' },
];

interface TerminalTab {
  id: string;
  label: string;
  status: 'running' | 'exited' | 'error';
}

interface BottomPanelProps {
  defaultHeight?: number;
  onHeightChange?: (height: number) => void;
}

export default function BottomPanel({ defaultHeight = 280, onHeightChange }: BottomPanelProps) {
  const theme = useTerminalStore(s => s.theme);
  const defaultCwd = useTerminalStore(s => s.defaultCwd);
  const previews = usePreviewStore(s => s.previews);

  const [activeTab, setActiveTab] = useState<BottomTab>('terminal');
  const [height, setHeight] = useState(defaultHeight);
  const [tabs, setTabs] = useState<TerminalTab[]>([]);
  const [activeTerminalId, setActiveTerminalId] = useState<string | null>(null);
  const createdRef = useRef(false);
  const resizingRef = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Create default terminal on mount
  useEffect(() => {
    if (createdRef.current) return;
    createdRef.current = true;

    const shellPref = localStorage.getItem('devhub_terminal_shell') || DEFAULT_SHELL;
    const cfg = SHELL_MAP[shellPref] || SHELL_MAP[DEFAULT_SHELL];
    const id = `term-${Date.now()}`;
    const label = 'Terminal 1';

    terminalApi.startShell(id, cfg.shell, defaultCwd, cfg.args).catch((e) => {
      console.error('Failed to start terminal:', e);
      message.error('终端启动失败，请检查 shell 配置');
    });
    useTerminalStore.getState().addTerminal({
      id, label, createdAt: new Date(),
      shell: cfg.shell, cwd: defaultCwd, status: 'running',
      projectId: null, groupId: null, pane: 'left',
    });
    setTabs([{ id, label, status: 'running' }]);
    setActiveTerminalId(id);
  }, [defaultCwd]);

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
    if (tabs.length >= 6) return;
    const shellPref = localStorage.getItem('devhub_terminal_shell') || DEFAULT_SHELL;
    const cfg = SHELL_MAP[shellPref] || SHELL_MAP[DEFAULT_SHELL];
    const id = `term-${Date.now()}`;
    const label = `Terminal ${tabs.length + 1}`;

    try {
      await terminalApi.startShell(id, cfg.shell, defaultCwd, cfg.args);
      useTerminalStore.getState().addTerminal({
        id, label, createdAt: new Date(),
        shell: cfg.shell, cwd: defaultCwd, status: 'running',
        projectId: null, groupId: null, pane: 'left',
      });
      setTabs(prev => [...prev, { id, label, status: 'running' }]);
      setActiveTerminalId(id);
    } catch (e) {
      console.error('Failed to create terminal:', e);
    }
  }, [tabs.length, defaultCwd]);

  const activeTerminal = useTerminalStore(s => s.terminals.find(t => t.id === activeTerminalId));
  const detectedPreview = previews.length > 0 ? previews[previews.length - 1] : null;

  // Resize handle
  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    resizingRef.current = true;
    const startY = e.clientY;
    const startHeight = height;

    const onMouseMove = (ev: MouseEvent) => {
      if (!resizingRef.current) return;
      const delta = startY - ev.clientY;
      const newHeight = Math.min(600, Math.max(120, startHeight + delta));
      setHeight(newHeight);
      onHeightChange?.(newHeight);
    };
    const onMouseUp = () => {
      resizingRef.current = false;
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    document.body.style.cursor = 'row-resize';
    document.body.style.userSelect = 'none';
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }, [height, onHeightChange]);

  return (
    <div ref={containerRef} style={{ ...styles.container, height }}>
      {/* Resize handle */}
      <div
        style={styles.resizeHandle}
        onMouseDown={handleResizeStart}
        onMouseEnter={e => { e.currentTarget.style.background = 'var(--md-primary-container)'; }}
        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
      >
        <div style={{ display: 'flex', gap: 3, opacity: 0.4 }}>
          {[0, 1, 2].map(i => (
            <div key={i} style={{ width: 2, height: 2, borderRadius: '50%', background: 'var(--md-on-surface-variant)' }} />
          ))}
        </div>
      </div>

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
          <button onClick={handleAddTerminal} style={styles.addBtn} title="New terminal">
            <span className="material-symbols-outlined" style={{ fontSize: 14 }}>add</span>
          </button>
        </div>

        {/* Terminal tabs when in terminal mode */}
        {activeTab === 'terminal' && tabs.length > 1 && (
          <div style={styles.terminalTabs}>
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTerminalId(tab.id)}
                style={{
                  ...styles.terminalTab,
                  ...(tab.id === activeTerminalId ? styles.terminalTabActive : {}),
                }}
              >
                {tab.label}
                {tab.status === 'running' && <span style={styles.miniDot} />}
              </button>
            ))}
          </div>
        )}

        {/* Status */}
        {activeTab === 'terminal' && activeTerminal?.status === 'running' && (
          <div style={styles.statusArea}>
            <span style={styles.statusDotCore} />
            <span style={styles.statusText}>Running</span>
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
            onInput={handleInput}
            onExit={handleExit}
          />
        )}
        {activeTab === 'terminal' && !activeTerminal && (
          <div style={styles.empty}>Starting terminal...</div>
        )}

        {activeTab === 'preview' && detectedPreview && (
          <iframe
            src={detectedPreview.url}
            style={styles.iframe}
            title="Preview"
            sandbox="allow-scripts allow-forms allow-popups"
          />
        )}
        {activeTab === 'preview' && !detectedPreview && (
          <div style={styles.empty}>
            <span className="material-symbols-outlined" style={{ fontSize: 28, color: 'var(--md-outline-variant)', marginBottom: 8 }}>
              language
            </span>
            <span style={{ fontSize: 12, color: 'var(--md-on-surface-variant)' }}>
              No preview URL detected. Start a dev server to see preview.
            </span>
          </div>
        )}

        {activeTab === 'logs' && (
          <div style={styles.empty}>
            <span className="material-symbols-outlined" style={{ fontSize: 28, color: 'var(--md-outline-variant)', marginBottom: 8 }}>
              article
            </span>
            <span style={{ fontSize: 12, color: 'var(--md-on-surface-variant)' }}>
              Build logs will appear here.
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
    flexShrink: 0,
    borderRadius: 12,
    border: '1px solid var(--md-outline-variant)',
    background: 'var(--term-bg)',
    overflow: 'hidden',
    position: 'relative',
  },
  resizeHandle: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 8,
    cursor: 'row-resize',
    zIndex: 10,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'transparent',
    transition: 'background 0.15s',
  },
  tabBar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottom: '1px solid var(--term-border)',
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
    overflow: 'hidden',
  },
  iframe: {
    width: '100%',
    height: '100%',
    border: 'none',
    background: '#ffffff',
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
};
