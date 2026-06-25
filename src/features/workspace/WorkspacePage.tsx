import { useState, useEffect, useCallback, useRef, useMemo, Suspense, lazy } from 'react';
import { listen } from '@tauri-apps/api/event';
import { useQuery } from '@tanstack/react-query';
import { useThemeStore } from '../../stores/themeStore';
import { useTerminalStore } from '../../stores/terminalStore';
import { usePreviewStore } from '../../stores/previewStore';
import { useAgentStore } from '../../stores/agentStore';
import { useAgentTabStore } from '../../stores/agentTabStore';
import { useAgentPlanStore } from '../../stores/agentPlanStore';
import { useWorkspaceStore } from '../../stores/workspaceStore';
import { terminalApi, sessionsApi, gitApi, workspacesApi } from '../../api';
import { queryKeys } from '../../api/queryKeys';
import type { TerminalExitEvent, TerminalOutputEvent } from '../../shared/terminalTypes';
import AgentTabBar from './agent/AgentTabBar';
import AgentTerminal from './agent/AgentTerminal';
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

  // Defer non-critical queries to let first paint complete
  const [deferredReady, setDeferredReady] = useState(false);
  useEffect(() => {
    const id = setTimeout(() => setDeferredReady(true), 500);
    return () => clearTimeout(id);
  }, []);

  // Workspace stats (tasks, issues, docs) — deferred
  const { data: stats } = useQuery({
    queryKey: ['workspaceStats'] as const,
    queryFn: workspacesApi.stats,
    staleTime: 30_000,
    enabled: deferredReady,
  });

  const defaultCwd = useTerminalStore(s => s.defaultCwd);

  // Derive active tab
  const activeTab = useMemo(() => tabs.find(t => t.id === activeTabId), [tabs, activeTabId]);

  // Git log for last commit time — deferred
  const { data: gitLog } = useQuery({
    queryKey: queryKeys.git.log(defaultCwd),
    queryFn: () => gitApi.log(defaultCwd, 1),
    staleTime: 60_000,
    enabled: deferredReady,
  });

  const lastCommitTime = (() => {
    if (!gitLog?.commits?.[0]?.date) return null;
    const diff = Date.now() - new Date(gitLog.commits[0].date).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    return `${days}d ago`;
  })();

  // Git branches for current branch display — deferred
  const { data: branches } = useQuery({
    queryKey: queryKeys.git.branches(defaultCwd),
    queryFn: () => gitApi.branches(defaultCwd),
    enabled: deferredReady && !!defaultCwd,
    staleTime: 60_000,
  });
  const currentBranch = useMemo(() => {
    if (!Array.isArray(branches)) return '';
    return branches.find((b: { current: boolean }) => b.current)?.name ?? '';
  }, [branches]);

  // Density
  const density = useThemeStore(s => s.density);
  const isCompact = density === 'compact' || density === 'dense';

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
    }).catch(() => {});

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
    }).catch(() => {});

    return () => {
      unlistenExit.then(fn => fn?.());
      unlistenOutput.then(fn => fn?.());
    };
  }, []);

  // Editor panel state
  const editorOpen = useWorkspaceStore(s => s.editorOpen);
  const setEditorOpen = useWorkspaceStore(s => s.setEditorOpen);
  const selectedFile = useWorkspaceStore(s => s.fileToOpen);

  // Open editor when a file is requested from FileExplorer
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
      <div style={styles.mainRow}>
        {/* Agent area */}
        <div style={styles.agentArea}>
        {/* Project summary bar */}
        <div style={{
          ...styles.summaryBar,
          height: isCompact ? (density === 'dense' ? 32 : 38) : 52,
          padding: isCompact ? '0 var(--space-3)' : '0 var(--space-5)',
        }}>
          {/* Project name */}
          <span style={{
            ...styles.projectName,
            fontSize: isCompact ? 'var(--text-sm)' : 'var(--text-base)',
          }}>{projectName}</span>

          {/* Git branch — compact only */}
          {isCompact && currentBranch && (
            <>
              <div style={{ width: 1, height: 14, background: 'var(--color-divider)' }} />
              <span style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 10,
                padding: '1px 5px',
                borderRadius: 3,
                background: 'var(--color-primary-light)',
                color: 'var(--md-primary)',
              }}>
                ⎇ {currentBranch}
              </span>
            </>
          )}

          {isCompact && <div style={{ width: 1, height: 14, background: 'var(--color-divider)' }} />}

          {/* Stats */}
          <div style={{
            ...styles.summaryStats,
            gap: isCompact ? 8 : 16,
            fontSize: isCompact ? 11 : undefined,
          }}>
            <span>Tasks <span style={{ fontFamily: 'var(--font-mono)' }}>{stats?.tasks ?? '—'}</span></span>
            <span>Issues <span style={{ fontFamily: 'var(--font-mono)' }}>{stats?.issues ?? '—'}</span></span>
            <span>Docs <span style={{ fontFamily: 'var(--font-mono)' }}>{stats?.docs ?? '—'}</span></span>
          </div>

          <div style={{ flex: 1 }} />

          {/* Last active — compact only */}
          {isCompact && lastCommitTime && (
            <>
              <span style={{ fontSize: 11, color: 'var(--md-on-surface-variant)', whiteSpace: 'nowrap' as const }}>
                {lastCommitTime}
              </span>
              <div style={{ width: 1, height: 14, background: 'var(--color-divider)' }} />
            </>
          )}

          {/* Agent status */}
          <div style={{
            ...styles.summaryStatus,
            marginLeft: isCompact ? 0 : 'auto',
            gap: isCompact ? 4 : 6,
          }}>
            <div style={{
              width: isCompact ? 5 : 8,
              height: isCompact ? 5 : 8,
              borderRadius: '50%',
              background: activeTab?.sessionId
                ? 'var(--md-tertiary-container)'
                : 'var(--md-outline-variant)',
              flexShrink: 0,
            }} aria-hidden="true" />
            <span style={{
              fontSize: isCompact ? 11 : 'var(--text-xs)',
              color: 'var(--md-on-surface-variant)',
            }}>
              {activeTab?.sessionId ? 'Agent' : 'Ready'}
            </span>
          </div>
        </div>

        {/* Agent content */}
        <div style={styles.agentContent}>
          <div style={styles.agentSplit}>
            {/* Editor panel (left) */}
            {editorOpen && (
              <div style={{ ...styles.editorPane, flex: `0 0 ${splitRatio * 100}%` }}>
                <div style={styles.editorHeader}>
                  <span style={{ fontSize: 'var(--text-sm)', fontWeight: 500, color: 'var(--md-on-surface)', fontFamily: 'var(--font-sans)' }}>
                    Editor
                  </span>
                  <span
                    className="material-symbols-outlined"
                    role="button"
                    aria-label="关闭编辑器"
                    onClick={() => setEditorOpen(false)}
                    style={{ fontSize: 'var(--text-lg)', cursor: 'pointer', color: 'var(--md-on-surface-variant)', padding: 8, borderRadius: 'var(--radius-xs)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  >close</span>
                </div>
                <Suspense fallback={<div style={styles.loadingFallback} role="status"><div className="skeleton" style={{ width: '60%', height: 16 }} /></div>}>
                  <CodeEditorPane onEmpty={() => setEditorOpen(false)} />
                </Suspense>
              </div>
            )}

            {/* Draggable divider */}
            {editorOpen && (
              <div
                className="resize-divider"
                role="separator"
                aria-orientation="vertical"
                aria-label="调整编辑器宽度"
                tabIndex={0}
                onMouseDown={handleDividerMouseDown}
                onKeyDown={e => {
                  if (e.key === 'ArrowLeft') setSplitRatio(r => Math.max(0.2, r - 0.05));
                  if (e.key === 'ArrowRight') setSplitRatio(r => Math.min(0.8, r + 0.05));
                }}
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

            {/* Chat / Idle area (right) */}
            <div style={{
              ...styles.agentPane,
              flex: editorOpen ? `0 0 ${(1 - splitRatio) * 100}%` : '1 1 100%',
            }}>
              <AgentTabBar onCloseTab={handleTabClose} />
              {tabs.map(tab => (
                <div
                  key={tab.id}
                  style={{
                    flex: 1,
                    minHeight: 0,
                    overflow: 'hidden',
                    display: tab.id === activeTabId ? 'flex' : 'none',
                    flexDirection: 'column',
                  }}
                >
                  <AgentTerminal
                    tabId={tab.id}
                    style={{ flex: 1, minHeight: 0 }}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Floating terminal toggle — sits at bottom-right of agent area */}
        <div
          role="button"
          aria-label={terminalExpanded ? '收起终端' : '展开终端'}
          tabIndex={0}
          onClick={() => setTerminalExpanded(v => !v)}
          onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setTerminalExpanded(v => !v); } }}
          style={{
            position: 'absolute',
            bottom: 6,
            right: 6,
            width: 28,
            height: 28,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: 6,
            cursor: 'pointer',
            background: 'transparent',
            color: 'var(--md-on-surface-variant)',
            border: 'none',
            transition: 'color 0.15s',
            zIndex: 10,
          }}
          title={terminalExpanded ? '收起终端' : '展开终端'}
          onMouseEnter={e => { e.currentTarget.style.color = 'var(--md-primary)'; }}
          onMouseLeave={e => { e.currentTarget.style.color = 'var(--md-on-surface-variant)'; }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 16 }}>terminal</span>
        </div>

        {/* Expanded terminal */}
        {terminalExpanded && (
          <div style={styles.terminalExpanded}>
            <Suspense fallback={<div style={styles.loadingFallback} role="status"><div className="skeleton" style={{ width: '40%', height: 16 }} /></div>}>
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

    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    width: '100%',
    flex: 1,
    minHeight: 0,
    background: 'var(--color-bg-content)',
    overflow: 'hidden',
  },
  mainRow: {
    display: 'flex',
    flex: 1,
    minHeight: 0,
    overflow: 'hidden',
  },
  agentArea: {
    display: 'flex',
    flexDirection: 'column',
    flex: 1,
    minHeight: 0,
    minWidth: 0,
    overflow: 'hidden',
    position: 'relative',
  },
  summaryBar: {
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--space-4)',
    height: 52,
    padding: '0 var(--space-5)',
    borderBottom: '1px solid var(--color-divider)',
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
    minHeight: 0,
    minWidth: 0,
    overflow: 'hidden',
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
    borderBottom: '1px solid var(--color-divider)',
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
