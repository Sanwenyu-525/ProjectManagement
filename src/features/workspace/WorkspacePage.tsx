import { useState, useEffect, useCallback, useMemo, useRef, Suspense, lazy } from 'react';
import { useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useThemeStore } from '../../stores/themeStore';
import { useAgentStore } from '../../stores/agentStore';
import { useAgentTabStore } from '../../stores/agentTabStore';
import { useAgentPlanStore } from '../../stores/agentPlanStore';
import { useAgentContextStore } from '../../stores/agentContextStore';
import { useWorkspaceStore } from '../../stores/workspaceStore';
import { sessionsApi, gitApi } from '../../api';
import { queryKeys } from '../../api/queryKeys';
import { usePreviewStore } from '../../stores/previewStore';
import { usePortScan } from './hooks/usePortScan';
import { useWorkspaceData } from './hooks/useWorkspaceData';
import AgentTabBar from './agent/AgentTabBar';
import AgentTerminal from './agent/AgentTerminal';
import { folderName } from './components/terminalFactory';
import { useLaunchQueue } from './hooks/useLaunchQueue';
import { useTerminalEvents } from './hooks/useTerminalEvents';
import { styles } from './WorkspacePage.styles';
import ResizeHandle from '../../shared/ResizeHandle';

// Lazy-load heavy components — only needed when editor/terminal/right-panel are open
const CodeEditorPane = lazy(() => import('./editor/CodeEditorPane'));
const PreviewPane = lazy(() => import('./editor/PreviewPane'));
const BottomPanel = lazy(() => import('./terminal/BottomPanel'));
const AgentRightPanel = lazy(() => import('./agent/AgentRightPanel'));

let staleSessionsCleanedUp = false; // Run cleanupStale only once per app session

export default function WorkspacePage() {
  const location = useLocation();
  const tabs = useAgentTabStore(s => s.tabs);
  const activeTabId = useAgentTabStore(s => s.activeTabId);
  const addTab = useAgentTabStore(s => s.addTab);

  useLaunchQueue();
  useTerminalEvents();
  usePortScan();

  const { stats, lastCommitTime, defaultCwd, deferredReady } = useWorkspaceData();

  // Derive active tab
  const activeTab = useMemo(() => tabs.find(t => t.id === activeTabId), [tabs, activeTabId]);

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

  // Preview panel state
  const [previewOpen, setPreviewOpen] = useState(false);
  const previews = usePreviewStore(s => s.previews);
  const prevPreviewCount = useRef(previews.length);
  useEffect(() => {
    if (previews.length > 0 && prevPreviewCount.current === 0) {
      setPreviewOpen(true);
    }
    prevPreviewCount.current = previews.length;
  }, [previews.length]);

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
      sessionsApi.cleanupStale(60, 30).catch((e) => console.error('[Workspace] cleanupStale failed:', e));
    }
  }, []);

  // Close a tab — clean up agent store data and the AgentTerminal handles its own cleanup via unmount
  const handleTabClose = useCallback((tabId: string) => {
    const tab = useAgentTabStore.getState().tabs.find(t => t.id === tabId);
    if (tab?.sessionId) {
      sessionsApi.end(tab.sessionId).catch(() => {});
      useAgentStore.getState().clearMessages(tab.sessionId);
      useAgentContextStore.getState().clearContext(tab.sessionId);
    }
    useAgentTabStore.getState().closeTab(tabId);
  }, []);

  // Auto-create a tab when none is active
  useEffect(() => {
    if (!activeTabId) addTab();
  }, [activeTabId, addTab]);

  // Divider drag handlers
  const handleDividerMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
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
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  }, [splitRatio]);

  // Editor panel state
  const editorOpen = useWorkspaceStore(s => s.editorOpen);
  const setEditorOpen = useWorkspaceStore(s => s.setEditorOpen);
  const selectedFile = useWorkspaceStore(s => s.fileToOpen);
  const pendingAgentMsg = useWorkspaceStore(s => s.pendingAgentMessage);
  const setPendingAgentMsg = useWorkspaceStore(s => s.setPendingAgentMessage);

  // Open editor when a file is requested from FileExplorer (only when on workspace page)
  useEffect(() => {
    if (selectedFile && location.pathname.startsWith('/workspace')) {
      setEditorOpen(true);
    }
  }, [selectedFile, setEditorOpen, location.pathname]);

  // Send pending agent message when arriving from another page
  useEffect(() => {
    if (pendingAgentMsg) {
      // Clear immediately to avoid re-sending
      setPendingAgentMsg(null);
      // Dispatch to agent terminal via custom event
      const timer = setTimeout(() => {
        window.dispatchEvent(new CustomEvent('agentQuickCommand', { detail: pendingAgentMsg + '\n' }));
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [pendingAgentMsg, setPendingAgentMsg]);

  // Reset planMode when plan execution completes
  const planModeState = useAgentPlanStore(s => s.mode);
  useEffect(() => {
    if (planModeState === 'completed' || planModeState === 'error') {
      // Reset planMode flag (so UI returns to normal), but keep steps visible
      const timer = setTimeout(() => {
        setPlanMode(false);
      }, 500);
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

          {/* Effective cwd path */}
          <span
            style={{
              fontSize: isCompact ? 10 : 'var(--text-xs)',
              fontFamily: 'var(--font-mono)',
              color: 'var(--md-on-surface-variant)',
              maxWidth: 160,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              flexShrink: 0,
            }}
            title={effectiveCwd}
          >
            {folderName(effectiveCwd)}
          </span>

          {/* Agent status */}
          <div style={{
            ...styles.summaryStatus,
            marginLeft: isCompact ? 0 : 'auto',
            gap: isCompact ? 4 : 6,
          }}>
            <div
              role="button"
              aria-label="切换预览面板"
              tabIndex={0}
              onClick={() => setPreviewOpen(v => !v)}
              onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setPreviewOpen(v => !v); } }}
              onMouseEnter={e => { if (!previewOpen) e.currentTarget.style.background = 'rgba(0,0,0,0.06)'; }}
              onMouseLeave={e => { if (!previewOpen) e.currentTarget.style.background = 'transparent'; }}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 28,
                height: 28,
                borderRadius: 6,
                cursor: 'pointer',
                background: previewOpen ? 'var(--md-primary-container, #e8def8)' : 'transparent',
                color: previewOpen ? 'var(--md-on-primary-container, #1d192b)' : 'var(--md-on-surface-variant)',
                border: 'none',
                transition: 'all 0.15s',
              }}
              title={previewOpen ? '关闭预览' : '打开预览'}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>language</span>
            </div>
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
              <div style={{ ...styles.editorPane, flex: `0 0 ${splitRatio * (previewOpen ? 55 : 100)}%` }}>
                <div style={styles.editorHeader}>
                  <span style={{ fontSize: 'var(--text-sm)', fontWeight: 500, color: 'var(--md-on-surface)', fontFamily: 'var(--font-sans)' }}>
                    Editor
                  </span>
                  <span
                    className="material-symbols-outlined"
                    role="button"
                    aria-label="关闭编辑器"
                    onClick={() => setEditorOpen(false)}
                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(0,0,0,0.06)'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                    style={{ fontSize: 'var(--text-lg)', cursor: 'pointer', color: 'var(--md-on-surface-variant)', padding: 8, borderRadius: 'var(--radius-xs)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  >close</span>
                </div>
                <Suspense fallback={<div style={styles.loadingFallback} role="status"><div className="skeleton" style={{ width: '60%', height: 16 }} /></div>}>
                  <CodeEditorPane onEmpty={() => setEditorOpen(false)} />
                </Suspense>
              </div>
            )}

            {/* Draggable divider — editor | preview/chat */}
            {editorOpen && (
              <ResizeHandle
                orientation="horizontal"
                onResizeStart={handleDividerMouseDown}
                role="separator"
                aria-orientation="vertical"
                aria-label="调整编辑器宽度"
                tabIndex={0}
                onKeyDown={e => {
                  if (e.key === 'ArrowLeft') setSplitRatio(r => Math.max(0.2, r - 0.05));
                  if (e.key === 'ArrowRight') setSplitRatio(r => Math.min(0.8, r + 0.05));
                }}
                style={{
                  position: 'relative',
                  width: 6,
                  flexShrink: 0,
                  zIndex: 5,
                }}
              >
                {(isDragging) => (
                  <div style={{
                    position: 'absolute',
                    top: 0, bottom: 0, left: '50%',
                    width: 4,
                    transform: 'translateX(-50%)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 3,
                    borderRadius: 2,
                    background: isDragging ? 'var(--md-primary-container)' : 'transparent',
                    transition: isDragging ? 'none' : 'background 0.15s',
                  }}>
                    {[0, 1, 2].map(i => (
                      <div key={i} style={{
                        width: 2,
                        height: 2,
                        borderRadius: '50%',
                        background: isDragging ? 'var(--md-on-primary-container)' : 'var(--md-on-surface-variant)',
                        transition: isDragging ? 'none' : 'background 0.15s',
                      }} />
                    ))}
                  </div>
                )}
              </ResizeHandle>
            )}

            {/* Preview panel (middle) */}
            {previewOpen && (
              <>
                <div style={{
                  ...styles.editorPane,
                  flex: editorOpen ? '0 0 45%' : '0 0 45%',
                }}>
                  <div style={styles.editorHeader}>
                    <span style={{ fontSize: 'var(--text-sm)', fontWeight: 500, color: 'var(--md-on-surface)', fontFamily: 'var(--font-sans)', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span className="material-symbols-outlined" style={{ fontSize: 16 }}>language</span>
                      Preview
                    </span>
                    <span
                      className="material-symbols-outlined"
                      role="button"
                      aria-label="关闭预览"
                      onClick={() => setPreviewOpen(false)}
                      onMouseEnter={e => { e.currentTarget.style.background = 'rgba(0,0,0,0.06)'; }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                      style={{ fontSize: 'var(--text-lg)', cursor: 'pointer', color: 'var(--md-on-surface-variant)', padding: 8, borderRadius: 'var(--radius-xs)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    >close</span>
                  </div>
                  <Suspense fallback={<div style={styles.loadingFallback} role="status"><div className="skeleton" style={{ width: '60%', height: 16 }} /></div>}>
                    <PreviewPane />
                  </Suspense>
                </div>
                {/* Divider between preview and chat */}
                <div style={{ width: 1, alignSelf: 'stretch', background: 'var(--border)', flexShrink: 0 }} />
              </>
            )}

            {/* Chat / Idle area (right) */}
            <div style={{
              ...styles.agentPane,
              flex: (() => {
                if (editorOpen && previewOpen) return '1 1 0';
                if (editorOpen) return `0 0 ${(1 - splitRatio) * 100}%`;
                if (previewOpen) return '1 1 0';
                return '1 1 100%';
              })(),
            }}>
              <AgentTabBar onCloseTab={handleTabClose} />
              <GraphQuickBar cwd={effectiveCwd} />
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

        {/* Floating terminal toggle — only visible when terminal is collapsed */}
        {!terminalExpanded && (
          <div
            role="button"
            aria-label="展开终端"
            tabIndex={0}
            onClick={() => setTerminalExpanded(true)}
            onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setTerminalExpanded(true); } }}
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
              zIndex: 20,
            }}
            title="展开终端"
            onMouseEnter={e => { e.currentTarget.style.color = 'var(--md-primary)'; }}
            onMouseLeave={e => { e.currentTarget.style.color = 'var(--md-on-surface-variant)'; }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>terminal</span>
          </div>
        )}

        {/* Bottom terminal panel — always mounted, hidden via display:none */}
        <div style={{ ...styles.terminalExpanded, display: terminalExpanded ? 'block' : 'none' }}>
          <Suspense fallback={<div style={styles.loadingFallback} role="status"><div className="skeleton" style={{ width: '40%', height: 16 }} /></div>}>
            <BottomPanel
              defaultHeight={240}
              cwd={effectiveCwd}
              visible={terminalExpanded}
              onToggleTerminal={() => setTerminalExpanded(false)}
            />
          </Suspense>
        </div>
      </div>

      {/* Plan/Right panel */}
      <Suspense fallback={null}>
        <AgentRightPanel sessionId={planMode ? planSessionId : (activeTab?.sessionId ?? null)} cwd={effectiveCwd} />
      </Suspense>
      </div>

    </div>
  );
}

// ── Graph Quick Bar ──────────────────────────────────────────────

function GraphQuickBar({ cwd }: { cwd: string }) {
  const [filePath, setFilePath] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  if (!cwd) return null;

  const dispatch = (text: string) => {
    window.dispatchEvent(new CustomEvent('agentQuickCommand', { detail: text }));
  };

  const handleFileAction = (subCmd: string) => {
    if (filePath.trim()) {
      dispatch(`/graph ${subCmd} ${filePath.trim()}`);
      setFilePath('');
    } else {
      // No file path — focus input to hint user
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  };

  const btnBase: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: 3,
    padding: '2px 8px', borderRadius: 4,
    border: '1px solid var(--border)',
    background: 'var(--md-surface-container-low)',
    color: 'var(--md-on-surface-variant)',
    fontSize: 10, fontWeight: 600, fontFamily: 'var(--font-sans)',
    cursor: 'pointer', transition: 'all 0.12s', whiteSpace: 'nowrap' as const,
  };

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 6,
      padding: '3px 10px',
      borderBottom: '1px solid var(--border)',
      background: 'var(--md-surface-container-lowest)',
      flexShrink: 0,
    }}>
      <span className="material-symbols-outlined" style={{ fontSize: 12, color: 'var(--md-primary)' }}>
        hub
      </span>

      <button
        onClick={() => dispatch('/graph layers')}
        style={btnBase}
        title="/graph layers — 查询架构分层"
        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(0,0,0,0.04)'; }}
        onMouseLeave={e => { e.currentTarget.style.background = 'var(--md-surface-container-low)'; }}
      >
        <span className="material-symbols-outlined" style={{ fontSize: 11 }}>layers</span>
        Layers
      </button>

      <input
        ref={inputRef}
        value={filePath}
        onChange={e => setFilePath(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter' && filePath.trim()) {
            dispatch(`/graph impact ${filePath.trim()}`);
            setFilePath('');
          }
        }}
        placeholder="输入文件路径后点击 Impact/Deps"
        style={{
          width: 180, padding: '3px 8px', borderRadius: 4,
          border: '1px solid var(--border)',
          background: 'var(--md-surface-container-low)',
          fontSize: 10, fontFamily: 'var(--font-mono)',
          color: 'var(--md-on-surface)', outline: 'none',
        }}
      />

      <button
        onClick={() => handleFileAction('impact')}
        style={btnBase}
        title="/graph impact — 查询影响范围"
        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(0,0,0,0.04)'; }}
        onMouseLeave={e => { e.currentTarget.style.background = 'var(--md-surface-container-low)'; }}
      >
        <span className="material-symbols-outlined" style={{ fontSize: 11 }}>hub</span>
        Impact
      </button>

      <button
        onClick={() => handleFileAction('deps')}
        style={btnBase}
        title="/graph deps — 查询依赖链"
        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(0,0,0,0.04)'; }}
        onMouseLeave={e => { e.currentTarget.style.background = 'var(--md-surface-container-low)'; }}
      >
        <span className="material-symbols-outlined" style={{ fontSize: 11 }}>account_tree</span>
        Deps
      </button>
    </div>
  );
}
