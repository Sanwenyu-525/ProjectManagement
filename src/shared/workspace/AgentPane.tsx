import { useEffect, useRef, useState, useCallback } from 'react';
import { terminalApi } from '../../api';
import { useTerminalStore } from '../../stores/terminalStore';
import { useWorkspaceStore } from '../../stores/workspaceStore';
import { getRuntime } from './agent-runtimes';
import { useXtermTerminal } from './useXtermTerminal';
import { generateWorkspaceContext, formatContextForAgent } from '../../lib/aiContext';
import { RobotOutlined, StopOutlined, ReloadOutlined } from '@ant-design/icons';

interface Props {
  agentId: string;
  runtimeId: string;
}

export default function AgentPane({ agentId, runtimeId }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<'starting' | 'running' | 'exited'>('starting');
  const [restartKey, setRestartKey] = useState(0);
  const runtime = getRuntime(runtimeId);
  const theme = useTerminalStore(s => s.theme);

  const spawnAgent = useCallback(async () => {
    if (!runtime) return;

    const defaultCwd = useTerminalStore.getState().defaultCwd;

    // On Windows, ensure launcher is ready before spawning.
    // setupAgentLauncher() internally checks if file exists and creates if needed.
    if (navigator.userAgent.toLowerCase().includes('win')) {
      try {
        const path = await terminalApi.setupAgentLauncher();
        localStorage.setItem('devhub_claude_launcher', path);
      } catch { /* ignore — will use fallback */ }
    }

    // Re-resolve runtime after launcher is guaranteed to be set
    const resolvedRuntime = getRuntime(runtimeId) || runtime;

    try {
      useTerminalStore.getState().addTerminal({
        id: agentId,
        label: resolvedRuntime.name,
        createdAt: new Date(),
        shell: resolvedRuntime.command,
        cwd: defaultCwd,
        status: 'running',
        projectId: null,
        groupId: null,
        pane: 'left',
      });

      await terminalApi.startAgent(agentId, resolvedRuntime.command, resolvedRuntime.args, defaultCwd);
      setStatus('running');
    } catch (e) {
      console.error('Failed to start agent:', e);
      useTerminalStore.getState().removeTerminal(agentId);
      setStatus('exited');
    }
  }, [agentId, runtime, runtimeId]);

  const { refit } = useXtermTerminal(containerRef, {
    terminalId: agentId,
    theme,
    onData: (data) => terminalApi.input(agentId, data).catch(() => {}),
  });

  // Spawn on mount and on restartKey change
  useEffect(() => {
    spawnAgent();
  }, [spawnAgent, restartKey]);

  // Re-fit on status change
  useEffect(() => {
    if (status === 'running') {
      const timer = setTimeout(refit, 100);
      return () => clearTimeout(timer);
    }
  }, [status, refit]);

  // Inject workspace context when agent starts running
  useEffect(() => {
    if (status !== 'running') return;
    const timeout = setTimeout(async () => {
      try {
        const tabs = useWorkspaceStore.getState().tabs;
        const openTabs = Object.values(tabs).map(t => ({
          id: t.id, label: t.label, type: t.contentType,
        }));
        const ctx = await generateWorkspaceContext(openTabs);
        const prompt = formatContextForAgent(ctx);
        // Send context as a paste to the agent terminal
        await terminalApi.input(agentId, `\n${prompt}\n`);
      } catch { /* context injection is best-effort */ }
    }, 2000); // 2s delay to let agent initialize
    return () => clearTimeout(timeout);
  }, [status, agentId]);

  const handleStop = useCallback(async () => {
    await terminalApi.stop(agentId).catch(() => {});
    useTerminalStore.getState().removeTerminal(agentId);
    setStatus('exited');
  }, [agentId]);

  const handleRestart = useCallback(async () => {
    setStatus('starting');
    await terminalApi.stop(agentId).catch(() => {});
    useTerminalStore.getState().removeTerminal(agentId);
    setRestartKey(k => k + 1);
  }, [agentId]);

  if (!runtime) {
    return (
      <div style={styles.fallback}>
        <span style={{ color: '#ef4444' }}>未知 Agent 运行时: {runtimeId}</span>
      </div>
    );
  }

  return (
    <div
      style={styles.container}
      onDragOver={e => {
        if (e.dataTransfer.types.includes('text/plain')) {
          e.preventDefault();
          e.dataTransfer.dropEffect = 'copy';
        }
      }}
      onDrop={e => {
        e.preventDefault();
        const filePath = e.dataTransfer.getData('text/plain');
        if (filePath) {
          const quoted = filePath.includes(' ') ? `"${filePath}"` : filePath;
          terminalApi.input(agentId, quoted).catch(() => {});
        }
      }}
    >
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
    background: 'var(--ws-content-bg)',
  },
  statusBar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 28,
    padding: '0 10px',
    background: 'rgba(255, 255, 255, 0.03)',
    borderBottom: '1px solid var(--ws-border-subtle)',
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
    color: 'var(--ws-text)',
    fontFamily: "'Fira Sans', sans-serif",
  },
  statusDot: {
    width: 5,
    height: 5,
    borderRadius: '50%',
  },
  statusText: {
    fontSize: 10,
    color: 'var(--ws-text-muted)',
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
    color: 'var(--ws-text-muted)',
    cursor: 'pointer',
    padding: 0,
  },
  fallback: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    height: '100%',
    background: 'var(--ws-content-bg)',
    fontSize: 13,
  },
};
