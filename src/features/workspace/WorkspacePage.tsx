import { useState, useEffect, useCallback, useRef, useMemo, Suspense, lazy } from 'react';
import { listen } from '@tauri-apps/api/event';
import { useQuery } from '@tanstack/react-query';
import { useTerminalStore } from '../../stores/terminalStore';
import { usePreviewStore } from '../../stores/previewStore';
import { useAgentStore } from '../../stores/agentStore';
import { useAgentTabStore } from '../../stores/agentTabStore';
import { useAgentPlanStore } from '../../stores/agentPlanStore';
import { useWorkspaceStore } from '../../stores/workspaceStore';
import { terminalApi, sessionsApi, gitApi, workspacesApi } from '../../api';
import { queryKeys } from '../../api/queryKeys';
import { TerminalExitEvent, TerminalOutputEvent } from '../../shared/terminalTypes';
import AgentTabBar from './agent/AgentTabBar';
import AgentTerminalMode from './agent/AgentTerminalMode';
import type { AgentTerminalModeHandle } from './agent/AgentTerminalMode';
import AgentToolbar from './agent/AgentToolbar';
import { DEFAULT_SHELL, SHELL_MAP } from '../../lib/constants';
import { folderName } from './components/terminalFactory';

// Lazy-load heavy components — only needed when editor/terminal/right-panel are open
const CodeEditorPane = lazy(() => import('./editor/CodeEditorPane'));
const BottomPanel = lazy(() => import('./terminal/BottomPanel'));
const AgentRightPanel = lazy(() => import('./agent/AgentRightPanel'));

let staleSessionsCleanedUp = false; // Run cleanupStale only once per app session

// Regex patterns for detecting dev server URLs in terminal output
const URL_PATTERNS = [
  /Local:\s+(https?:\/\/[^\s]+)/,
  /- Local:\s+(https?:\/\/[^\s]+)/,
  /Network:\s+(https?:\/\/[^\s]+)/,
  /(https?:\/\/localhost:\d+[^\s]*)/,
];

export default function WorkspacePage() {
  const launchQueueLength = useTerminalStore(s => s.launchQueue.length);
  const tabs = useAgentTabStore(s => s.tabs);
  const activeTabId = useAgentTabStore(s => s.activeTabId);
  const addTab = useAgentTabStore(s => s.addTab);

  // Workspace stats (tasks, issues, docs)
  const { data: stats } = useQuery({
    queryKey: ['workspaceStats'] as const,
    queryFn: workspacesApi.stats,
    staleTime: 30_000,
  });

  const defaultCwd = useTerminalStore(s => s.defaultCwd);

  // Derive active tab
  const activeTab = useMemo(() => tabs.find(t => t.id === activeTabId), [tabs, activeTabId]);
  const activeTabMode = activeTab?.agentMode || 'xterm';

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

  // Agent ↔ Editor split ratio (0.2 – 0.8)
  const [splitRatio, setSplitRatio] = useState(0.5);

  // Plan mode
  const planMode = useAgentStore(s => s.planMode);
  const setPlanMode = useAgentStore(s => s.setPlanMode);
  const planSessionId = useAgentPlanStore(s => s.sessionId);
  const planCwd = useAgentPlanStore(s => s.cwd);

  // Effective cwd for the right panel: plan's cwd when in plan mode, otherwise active tab's cwd
  const effectiveCwd = useMemo(() => {
    if (planMode && planCwd) return planCwd;
    return activeTab?.cwd || localStorage.getItem('agent_lastCwd') || defaultCwd;
  }, [planMode, planCwd, activeTab?.cwd, defaultCwd]);

  // On mount, clean up stale sessions (>60 min old with no activity in 30 min) — once per app session
  useEffect(() => {
    if (!staleSessionsCleanedUp) {
      staleSessionsCleanedUp = true;
      sessionsApi.cleanupStale(60, 30).catch(() => {});
    }
  }, []);

  // Close a tab — the AgentTerminal handles its own cleanup via unmount
  const handleTabClose = useCallback((tabId: string) => {
    const tab = tabs.find(t => t.id === tabId);
    if (tab?.sessionId) {
      sessionsApi.end(tab.sessionId).catch(() => {});
    }
    useAgentTabStore.getState().closeTab(tabId);
  }, [tabs]);

  // Auto-create a tab when none is active
  useEffect(() => {
    if (!activeTabId) addTab();
  }, [activeTabId, addTab]);

  // Ref for AgentTerminal to handle directory switching
  const agentTerminalRef = useRef<AgentTerminalModeHandle>(null);
  const handleCwdChange = useCallback((newCwd: string) => {
    agentTerminalRef.current?.switchCwd(newCwd);
  }, []);

  // Divider drag handlers
  const handleDividerMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startRatio = splitRatio;
    const splitEl = (e.currentTarget as HTMLElement).parentElement;
    if (!splitEl) return;
    const splitWidth = splitEl.getBoundingClientRect().width;

    const onMouseMove = (ev: MouseEvent) => {
      const delta = ev.clientX - startX;
      const newRatio = Math.min(0.8, Math.max(0.2, startRatio + delta / splitWidth));
      setSplitRatio(newRatio);
    };
    const onMouseUp = () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  }, [splitRatio]);

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
      if (terminalId.startsWith('agent-')) return;
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

  // Reset planMode when plan execution completes
  const planModeState = useAgentPlanStore(s => s.mode);
  useEffect(() => {
    if (planModeState === 'completed' || planModeState === 'error') {
      // Keep planMode true for 3s to show completion state, then reset
      const timer = setTimeout(() => {
        setPlanMode(false);
        useAgentPlanStore.getState().reset();
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [planModeState, setPlanMode]);

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
          <div style={styles.summaryStatus} aria-live="polite" aria-atomic="true">
            <span style={{
              width: 8, height: 8, borderRadius: '50%',
              background: activeTab?.sessionId ? 'var(--md-tertiary-container)' : 'var(--md-outline-variant)',
              flexShrink: 0,
            }} />
            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--md-on-surface-variant)' }}>
              {activeTab?.sessionId ? 'Agent Running' : 'Agent Ready'}
            </span>
            <span
              className="material-symbols-outlined"
              onClick={() => setTerminalExpanded(!terminalExpanded)}
              role="button"
              aria-label={terminalExpanded ? '收起终端' : '展开终端'}
              style={{
                fontSize: 18,
                cursor: 'pointer',
                color: terminalExpanded ? 'var(--md-primary)' : 'var(--md-on-surface-variant)',
                marginLeft: 4,
                padding: 5,
                borderRadius: 'var(--radius-xs)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              title={terminalExpanded ? '收起终端' : '展开终端'}
            >terminal</span>
          </div>
        </div>

        {/* Agent content */}
        <div style={styles.agentContent}>
          <div style={styles.agentSplit}>
            {/* Chat / Idle area */}
            <div style={{
              ...styles.agentPane,
              flex: editorOpen ? `0 0 ${splitRatio * 100}%` : '1 1 100%',
            }}>
              <AgentTabBar onCloseTab={handleTabClose} />
              <AgentToolbar onCwdChange={handleCwdChange} />
              <AgentTerminalMode ref={agentTerminalRef} mode={activeTabMode} />
            </div>

            {/* Draggable divider */}
            {editorOpen && (
              <div
                className="resize-divider"
                onMouseDown={handleDividerMouseDown}
                style={{
                  width: 6,
                  flexShrink: 0,
                  cursor: 'col-resize',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  position: 'relative',
                  zIndex: 5,
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.background = 'var(--md-primary-container)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = 'transparent';
                }}
              >
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 3,
                  opacity: 0.4,
                }}>
                  {[0, 1, 2].map(i => (
                    <div key={i} style={{
                      width: 2,
                      height: 2,
                      borderRadius: '50%',
                      background: 'var(--md-on-surface-variant)',
                    }} />
                  ))}
                </div>
              </div>
            )}

            {/* Editor panel */}
            {editorOpen && (
              <div style={{ ...styles.editorPane, flex: `0 0 ${(1 - splitRatio) * 100}%` }}>
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
                <Suspense fallback={<div style={styles.loadingFallback}>Loading editor...</div>}>
                  <CodeEditorPane onEmpty={() => setEditorOpen(false)} />
                </Suspense>
              </div>
            )}
          </div>
        </div>

        {/* Expanded terminal */}
        {terminalExpanded && (
          <div style={styles.terminalExpanded}>
            <Suspense fallback={<div style={styles.loadingFallback}>Loading terminal...</div>}>
              <BottomPanel defaultHeight={240} />
            </Suspense>
          </div>
        )}
      </div>

      {/* Plan/Right panel */}
      <Suspense fallback={null}>
        <AgentRightPanel sessionId={planMode ? planSessionId : (activeTab?.sessionId ?? null)} cwd={effectiveCwd} />
      </Suspense>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    width: '100%',
    height: '100%',
    background: 'var(--md-surface-container-lowest)',
    overflow: 'hidden',
  },
  agentArea: {
    display: 'flex',
    flexDirection: 'column',
    flex: 1,
    minWidth: 0,
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
    minWidth: 0,
    overflow: 'hidden',
  },
  editorHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '6px 12px',
    borderBottom: '1px solid var(--md-outline-variant)',
    flexShrink: 0,
    background: 'var(--md-surface-container-low)',
  },
  terminalExpanded: {
    flexShrink: 0,
  },
  loadingFallback: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    fontSize: 'var(--text-sm)',
    color: 'var(--md-on-surface-variant)',
    fontFamily: 'var(--font-sans)',
  },
};
