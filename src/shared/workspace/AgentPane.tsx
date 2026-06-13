import { useEffect, useRef, useState, useCallback } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { listen } from '@tauri-apps/api/event';
import { terminalApi } from '../../api';
import { useTerminalStore } from '../../stores/terminalStore';
import { TerminalOutputEvent, TerminalExitEvent } from '../terminalTypes';
import { getThemeColors } from '../terminalThemes';
import { getRuntime } from './agent-runtimes';
import { DEFAULT_SHELL, SHELL_MAP } from '../../lib/constants';
import { RobotOutlined, StopOutlined, ReloadOutlined } from '@ant-design/icons';
import '@xterm/xterm/css/xterm.css';

interface Props {
  agentId: string;
  runtimeId: string;
}

export default function AgentPane({ agentId, runtimeId }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const [status, setStatus] = useState<'starting' | 'running' | 'exited'>('starting');
  const theme = useTerminalStore(s => s.theme);
  const runtime = getRuntime(runtimeId);

  const spawnAgent = useCallback(async () => {
    if (!runtime) return;

    const id = agentId;
    const shellPref = localStorage.getItem('devhub_terminal_shell') || DEFAULT_SHELL;
    const cfg = SHELL_MAP[shellPref] || SHELL_MAP[DEFAULT_SHELL];
    const defaultCwd = useTerminalStore.getState().defaultCwd;

    try {
      // Start a shell, then send the agent command
      await terminalApi.startShell(id, cfg.shell, defaultCwd, cfg.args);

      // Register in terminal store so exit events are tracked
      useTerminalStore.getState().addTerminal({
        id,
        label: runtime.name,
        createdAt: new Date(),
        shell: cfg.shell,
        cwd: defaultCwd,
        status: 'running',
        projectId: null,
        groupId: null,
        pane: 'left',
      });

      // Send the agent command after a short delay for shell initialization
      setTimeout(() => {
        terminalApi.input(id, `${runtime.command} ${runtime.args.join(' ')}\r`).catch(() => {});
      }, 300);

      setStatus('running');
    } catch (e) {
      console.error('Failed to start agent:', e);
      setStatus('exited');
    }
  }, [agentId, runtime]);

  // Initialize xterm.js
  useEffect(() => {
    if (!containerRef.current || !runtime) return;

    const term = new Terminal({
      cursorBlink: true,
      fontSize: 13,
      fontFamily: "'Cascadia Code', 'Fira Code', 'JetBrains Mono', Consolas, monospace",
      theme: getThemeColors(theme).colors,
      allowProposedApi: true,
      scrollback: 10000,
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(containerRef.current);
    termRef.current = term;
    fitAddonRef.current = fitAddon;

    const fitTimer = setTimeout(() => fitAddon.fit(), 350);

    // ResizeObserver
    let resizeTimer: ReturnType<typeof setTimeout> | null = null;
    const observer = new ResizeObserver(() => {
      if (fitAddonRef.current && termRef.current) {
        fitAddonRef.current.fit();
        if (resizeTimer) clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => {
          const dims = fitAddonRef.current?.proposeDimensions();
          if (dims) terminalApi.resize(agentId, dims.cols, dims.rows).catch(() => {});
        }, 100);
      }
    });
    observer.observe(containerRef.current);

    // Listen for output
    const unlistenOutput = listen<TerminalOutputEvent>('terminal-output', (event) => {
      if (event.payload.terminalId === agentId) {
        term.write(event.payload.data);
      }
    });

    // Listen for exit
    const unlistenExit = listen<TerminalExitEvent>('terminal-exit', (event) => {
      if (event.payload.terminalId === agentId) {
        setStatus('exited');
      }
    });

    // Spawn the agent process
    spawnAgent();

    return () => {
      clearTimeout(fitTimer);
      if (resizeTimer) clearTimeout(resizeTimer);
      observer.disconnect();
      unlistenOutput.then(fn => fn());
      unlistenExit.then(fn => fn());
      term.dispose();
      termRef.current = null;
      fitAddonRef.current = null;
    };
  }, [agentId, runtime, theme, spawnAgent]);

  // Re-fit on status change
  useEffect(() => {
    if (status === 'running' && fitAddonRef.current && termRef.current) {
      const timer = setTimeout(() => {
        fitAddonRef.current?.fit();
        const dims = fitAddonRef.current?.proposeDimensions();
        if (dims) terminalApi.resize(agentId, dims.cols, dims.rows).catch(() => {});
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [status, agentId]);

  const handleStop = useCallback(async () => {
    await terminalApi.stop(agentId).catch(() => {});
    useTerminalStore.getState().removeTerminal(agentId);
    setStatus('exited');
  }, [agentId]);

  const handleRestart = useCallback(() => {
    setStatus('starting');
    // Dispose old terminal
    if (termRef.current) {
      termRef.current.dispose();
      termRef.current = null;
    }
    // Re-spawn
    setTimeout(() => spawnAgent(), 100);
  }, [spawnAgent]);

  if (!runtime) {
    return (
      <div style={styles.fallback}>
        <span style={{ color: '#ef4444' }}>未知 Agent 运行时: {runtimeId}</span>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      {/* Agent status bar */}
      <div style={styles.statusBar}>
        <div style={styles.statusLeft}>
          <RobotOutlined style={{ fontSize: 12, color: runtime.color }} />
          <span style={styles.agentName}>{runtime.name}</span>
          <span style={{
            ...styles.statusDot,
            background: status === 'running' ? '#22c55e' : status === 'starting' ? '#eab308' : '#6b7280',
            boxShadow: status === 'running' ? `0 0 4px ${runtime.color}66` : 'none',
          }} />
          <span style={styles.statusText}>
            {status === 'starting' ? '启动中...' : status === 'running' ? '运行中' : '已退出'}
          </span>
        </div>
        <div style={styles.statusRight}>
          {status === 'running' && (
            <button onClick={handleStop} style={styles.actionBtn} title="停止">
              <StopOutlined style={{ fontSize: 10 }} />
            </button>
          )}
          {status === 'exited' && (
            <button onClick={handleRestart} style={styles.actionBtn} title="重启">
              <ReloadOutlined style={{ fontSize: 10 }} />
            </button>
          )}
        </div>
      </div>

      {/* Terminal viewport */}
      <div ref={containerRef} style={{ flex: 1, minHeight: 0 }} />
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    width: '100%',
    height: '100%',
    background: '#1a1b26',
  },
  statusBar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 28,
    padding: '0 10px',
    background: 'rgba(255, 255, 255, 0.03)',
    borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
    flexShrink: 0,
  },
  statusLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  },
  statusRight: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
  },
  agentName: {
    fontSize: 11,
    fontWeight: 600,
    color: '#e2e8f0',
    fontFamily: "'Fira Sans', sans-serif",
  },
  statusDot: {
    width: 5,
    height: 5,
    borderRadius: '50%',
  },
  statusText: {
    fontSize: 10,
    color: '#64748b',
    fontFamily: "'Fira Code', monospace",
  },
  actionBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 20,
    height: 20,
    borderRadius: 4,
    border: 'none',
    background: 'transparent',
    color: '#64748b',
    cursor: 'pointer',
    padding: 0,
  },
  fallback: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    height: '100%',
    background: '#1a1b26',
    fontSize: 13,
  },
};
