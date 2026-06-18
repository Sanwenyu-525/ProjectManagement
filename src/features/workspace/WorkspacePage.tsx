import { useState, useEffect, useCallback, useRef } from 'react';
import { listen } from '@tauri-apps/api/event';
import { useQuery } from '@tanstack/react-query';
import { useTerminalStore } from '../../stores/terminalStore';
import { usePreviewStore } from '../../stores/previewStore';
import { useAgentStore } from '../../stores/agentStore';
import { useWorkspaceStore } from '../../stores/workspaceStore';
import { terminalApi, sessionsApi, gitApi, workspacesApi } from '../../api';
import { queryKeys } from '../../api/queryKeys';
import { TerminalExitEvent, TerminalOutputEvent } from '../../shared/terminalTypes';
import AgentChat from './agent/AgentChat';
import AgentIdleState from './agent/AgentIdleState';
import CodeEditorPane from './editor/CodeEditorPane';
import BottomPanel from './terminal/BottomPanel';
import AgentRightPanel from './agent/AgentRightPanel';
import { DEFAULT_SHELL, SHELL_MAP } from '../../lib/constants';
import { folderName } from './components/terminalFactory';
import { ClaudeProvider } from './agent/ClaudeProvider';
import type { AgentProvider } from './agent/AgentProvider';

// Regex patterns for detecting dev server URLs in terminal output
const URL_PATTERNS = [
  /Local:\s+(https?:\/\/[^\s]+)/,
  /- Local:\s+(https?:\/\/[^\s]+)/,
  /Network:\s+(https?:\/\/[^\s]+)/,
  /(https?:\/\/localhost:\d+[^\s]*)/,
];

export default function WorkspacePage() {
  const launchQueueLength = useTerminalStore(s => s.launchQueue.length);
  const activeProviderId = useAgentStore(s => s.activeProviderId);
  const setActiveProvider = useAgentStore(s => s.setActiveProvider);

  // Recent sessions for idle state
  const { data: recentSessions = [] } = useQuery({
    queryKey: queryKeys.sessions.all,
    queryFn: () => sessionsApi.list(5),
    staleTime: 30_000,
  });

  // Workspace stats (tasks, issues, docs)
  const { data: stats } = useQuery({
    queryKey: ['workspaceStats'] as const,
    queryFn: workspacesApi.stats,
    staleTime: 30_000,
  });

  const [activeSessionId, _setActiveSessionId] = useState<string | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const setActiveSessionId = useCallback((id: string | null) => {
    sessionIdRef.current = id;
    _setActiveSessionId(id);
  }, []);
  const defaultCwd = useTerminalStore(s => s.defaultCwd);
  const providerRef = useRef<AgentProvider | null>(null);

  // Git log for last commit time
  const { data: gitLog } = useQuery({
    queryKey: queryKeys.git.log(defaultCwd),
    queryFn: () => gitApi.log(defaultCwd, 1),
    staleTime: 60_000,
  });

  const lastCommitTime = (() => {
    const commits = gitLog as { date?: string }[] | null;
    if (!commits?.[0]?.date) return null;
    const diff = Date.now() - new Date(commits[0].date).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    return `${days}d ago`;
  })();

  const projectName = folderName(defaultCwd);

  // Terminal expand/collapse state
  const [terminalExpanded, setTerminalExpanded] = useState(false);

  // On mount, clean up stale sessions
  useEffect(() => {
    sessionsApi.cleanupStale(60, 30).catch(() => {});
    sessionsApi.list(5).then(sessions => {
      const staleRunning = sessions.filter(s => s.status === 'running');
      for (const s of staleRunning) {
        sessionsApi.end(s.id).catch(() => {});
      }
    }).catch(() => {});
  }, []);

  // Start agent and immediately send a message (for idle state input)
  const handleStartAndSend = useCallback(async (message: string) => {
    const workDir = defaultCwd;
    const dangerouslySkipPermissions = localStorage.getItem('agent_dangerouslySkipPermissions') === 'true';
    const permissionMode = dangerouslySkipPermissions ? 'dangerously-skip-permissions' : 'default';

    // Create session in DB
    const sessionId = await sessionsApi.start('claude', 'claude', undefined, workDir, permissionMode);

    // Directly use ClaudeProvider — no DB provider config needed
    const provider = new ClaudeProvider();
    await provider.start({ sessionId, cwd: workDir, dangerouslySkipPermissions });
    setActiveProvider('claude');
    providerRef.current = provider;
    setActiveSessionId(sessionId);

    await provider.send(message);
  }, [defaultCwd, setActiveProvider, setActiveSessionId]);

  // Process launch queue from project pages
  const processingRef = useRef(false);
  useEffect(() => {
    if (launchQueueLength === 0) return;
    if (processingRef.current) return;
    processingRef.current = true;

    const process = async () => {
      let req = useTerminalStore.getState().consumeLaunchRequest();
      while (req) {
        const state = useTerminalStore.getState();
        if (state.terminals.length >= 10) break;

        const id = `global-${Math.random().toString(36).slice(2, 10)}`;
        try {
          const shellPref = localStorage.getItem('devhub_terminal_shell') || DEFAULT_SHELL;
          const cfg = SHELL_MAP[shellPref] || SHELL_MAP[DEFAULT_SHELL];

          const newTerminal = {
            id,
            label: req.label || folderName(req.cwd || state.defaultCwd),
            createdAt: new Date(),
            shell: cfg.shell,
            cwd: req.cwd || state.defaultCwd,
            status: 'running' as const,
            projectId: req.projectId || null,
            groupId: null,
            pane: 'left' as const,
          };

          await terminalApi.startShell(id, cfg.shell, newTerminal.cwd, cfg.args);
          state.addTerminal(newTerminal);

          if (req.command) {
            await terminalApi.input(id, req.command + '\r');
          }
        } catch (e) {
          console.error('Failed to create terminal from launch queue:', e);
        }

        req = useTerminalStore.getState().consumeLaunchRequest();
      }
      processingRef.current = false;
    };

    process();
  }, [launchQueueLength]);

  // Listen for terminal events (exit + URL detection)
  const urlLastSeenRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    const unlistenExit = listen<TerminalExitEvent>('terminal-exit', (event) => {
      const { terminalId, code } = event.payload;
      if (terminalId.startsWith('claude-')) return;
      useTerminalStore.getState().updateTerminal(terminalId, { status: code === 0 ? 'exited' : 'error' });
      usePreviewStore.getState().removePreviewsByTerminal(terminalId);
    });

    const unlistenOutput = listen<TerminalOutputEvent>('terminal-output', (event) => {
      const { data, terminalId } = event.payload;
      if (!data.includes('http')) return;
      for (const pattern of URL_PATTERNS) {
        const match = data.match(pattern);
        if (match) {
          const url = match[1] || match[0];
          if (urlLastSeenRef.current.has(url)) break;
          urlLastSeenRef.current.add(url);
          usePreviewStore.getState().addPreview(url, terminalId);
          break;
        }
      }
    });

    return () => {
      unlistenExit.then(fn => fn());
      unlistenOutput.then(fn => fn());
    };
  }, []);

  const isRunning = !!activeProviderId;
  const activeTerminal = useTerminalStore(s => s.terminals[0]);

  // Editor panel state
  const editorOpen = useWorkspaceStore(s => s.editorOpen);
  const setEditorOpen = useWorkspaceStore(s => s.setEditorOpen);
  const selectedFile = useWorkspaceStore(s => s.selectedFile);

  // Open editor when a file is selected from FileExplorer
  useEffect(() => {
    if (selectedFile) {
      setEditorOpen(true);
    }
  }, [selectedFile, setEditorOpen]);

  return (
    <div style={styles.container}>
      {/* Agent area */}
      <div style={styles.agentArea}>
        {/* Project summary bar */}
        <div style={styles.summaryBar}>
          <span style={styles.projectName}>{projectName}</span>
          <div style={styles.summaryStats}>
            <span>Tasks: <strong style={{ color: 'var(--md-on-surface)' }}>{stats?.tasks ?? '—'}</strong></span>
            <span>Issues: <strong style={{ color: 'var(--md-error)' }}>{stats?.issues ?? '—'}</strong></span>
            <span>Docs: <strong style={{ color: 'var(--md-on-surface)' }}>{stats?.docs ?? '—'}</strong></span>
            {lastCommitTime && (
              <span>Last Commit: <strong style={{ color: 'var(--md-on-surface)' }}>{lastCommitTime}</strong></span>
            )}
          </div>
          <div style={styles.summaryStatus}>
            <span style={{
              width: 8, height: 8, borderRadius: '50%',
              background: isRunning ? 'var(--md-tertiary-container)' : 'var(--md-outline-variant)',
              flexShrink: 0,
            }} />
            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--md-on-surface-variant)' }}>
              {isRunning ? 'Agent Running' : 'Agent Ready'}
            </span>
          </div>
        </div>

        {/* Agent content */}
        <div style={styles.agentContent}>
          <div style={styles.agentSplit}>
            {/* Chat / Idle area */}
            <div style={{ ...styles.agentPane, flex: editorOpen ? 1 : '1 1 100%' }}>
              {isRunning ? (
                <AgentChat
                  provider={providerRef.current}
                  activeSessionId={activeSessionId}
                />
              ) : (
                <AgentIdleState
                  onStartAndSend={handleStartAndSend}
                  recentSessions={recentSessions}
                />
              )}
            </div>

            {/* Editor panel */}
            {editorOpen && (
              <div style={styles.editorPane}>
                <div style={styles.editorHeader}>
                  <span style={{ fontSize: 'var(--text-sm)', fontWeight: 500, color: 'var(--md-on-surface)', fontFamily: 'var(--font-sans)' }}>
                    Editor
                  </span>
                  <span
                    className="material-symbols-outlined"
                    onClick={() => setEditorOpen(false)}
                    style={{ fontSize: 'var(--text-lg)', cursor: 'pointer', color: 'var(--md-on-surface-variant)', padding: 2 }}
                  >close</span>
                </div>
                <CodeEditorPane onEmpty={() => setEditorOpen(false)} />
              </div>
            )}
          </div>
        </div>

        {/* Terminal bar */}
        <div
          onClick={() => setTerminalExpanded(!terminalExpanded)}
          style={styles.terminalBar}
          className="terminal-bar"
        >
          <span style={styles.terminalIcon}>$</span>
          <span style={{
            ...styles.terminalStatus,
            color: activeTerminal?.status === 'running' ? 'var(--color-status-done)' : 'var(--color-text-muted)',
          }}>
            {activeTerminal?.status === 'running' ? 'running' : 'stopped'}
          </span>
          <span style={styles.terminalExpand}>
            {terminalExpanded ? '▼' : '▲'} {terminalExpanded ? 'collapse' : 'expand'}
          </span>
        </div>

        {/* Expanded terminal */}
        {terminalExpanded && (
          <div style={styles.terminalExpanded}>
            <BottomPanel defaultHeight={240} />
          </div>
        )}
      </div>

      {/* Plan/Right panel */}
      <AgentRightPanel sessionId={activeSessionId} />
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    width: '100%',
    height: '100%',
    gap: 'var(--space-2)',
    padding: 'var(--space-2)',
    background: 'var(--md-surface-container-lowest)',
    overflow: 'hidden',
  },
  agentArea: {
    display: 'flex',
    flexDirection: 'column',
    flex: 1,
    minWidth: 0,
    background: 'var(--md-surface-container-lowest)',
    borderRadius: 'var(--radius-md)',
    border: '1px solid var(--md-outline-variant)',
    overflow: 'hidden',
  },
  summaryBar: {
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--space-4)',
    height: 52,
    padding: '0 var(--space-5)',
    borderBottom: '1px solid var(--md-outline-variant)',
    flexShrink: 0,
  },
  projectName: {
    fontSize: 'var(--text-base)',
    fontWeight: 600,
    color: 'var(--md-on-surface)',
    fontFamily: 'var(--font-sans)',
  },
  summaryStats: {
    display: 'flex',
    gap: 'var(--space-4)',
    fontSize: 'var(--text-xs)',
    color: 'var(--md-on-surface-variant)',
    fontFamily: 'var(--font-sans)',
  },
  summaryStatus: {
    marginLeft: 'auto',
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  },
  agentContent: {
    display: 'flex',
    flexDirection: 'column',
    flex: 1,
    minHeight: 0,
    overflow: 'hidden',
  },
  agentSplit: {
    display: 'flex',
    flex: 1,
    minHeight: 0,
    gap: 0,
  },
  agentPane: {
    display: 'flex',
    flexDirection: 'column',
    minWidth: 0,
  },
  editorPane: {
    display: 'flex',
    flexDirection: 'column',
    flex: '1 1 50%',
    minWidth: 0,
    borderLeft: '1px solid var(--md-outline-variant)',
  },
  editorHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '6px 12px',
    borderBottom: '1px solid var(--md-outline-variant)',
    flexShrink: 0,
    background: 'var(--md-surface-container-lowest)',
  },
  terminalBar: {
    display: 'flex',
    alignItems: 'center',
    height: 32,
    margin: '0 var(--space-2) var(--space-2)',
    padding: '0 var(--space-3)',
    background: '#0f172a',
    borderRadius: 'var(--radius-sm)',
    cursor: 'pointer',
    flexShrink: 0,
  },
  terminalIcon: {
    fontSize: 'var(--text-sm)',
    fontFamily: 'var(--font-mono)',
    color: 'var(--color-status-done)',
    marginRight: 'var(--space-2)',
  },
  terminalStatus: {
    fontSize: 'var(--text-xs)',
    fontFamily: 'var(--font-mono)',
    padding: '1px 6px',
    background: 'rgba(74, 222, 128, 0.1)',
    borderRadius: 'var(--radius-xs)',
  },
  terminalExpand: {
    marginLeft: 'auto',
    fontSize: 'var(--text-xs)',
    color: 'var(--color-text-muted)',
    fontFamily: 'var(--font-sans)',
  },
  terminalExpanded: {
    flexShrink: 0,
    margin: '0 var(--space-2) var(--space-2)',
    height: 240,
  },
};
