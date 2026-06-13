import { useCallback, useMemo, Fragment } from 'react';
import type { PaneNode, PaneSplit, PaneLeaf } from './types';
import { useWorkspaceStore } from '../../stores/workspaceStore';
import { useTerminalStore } from '../../stores/terminalStore';
import { terminalApi } from '../../api';
import { DEFAULT_SHELL, SHELL_MAP } from '../../lib/constants';
import PaneDivider from './PaneDivider';
import PaneTabBar from './PaneTabBar';
import TerminalLeafContent from './TerminalLeafContent';
import AgentPane from './AgentPane';
import BrowserPane from './BrowserPane';
import { getRuntime } from './agent-runtimes';

// ── Tree utilities (pure functions, no hooks) ──

function findLeaf(node: PaneNode, id: string): PaneLeaf | null {
  if (node.type === 'leaf') return node.id === id ? node : null;
  for (const child of node.children) {
    const found = findLeaf(child, id);
    if (found) return found;
  }
  return null;
}

// ── Content renderer ──

function PaneContent({ leafId }: { leafId: string }) {
  const root = useWorkspaceStore(s => s.root);
  const tabs = useWorkspaceStore(s => s.tabs);
  const closeTab = useWorkspaceStore(s => s.closeTab);
  const setActiveTab = useWorkspaceStore(s => s.setActiveTab);
  const closePane = useWorkspaceStore(s => s.closePane);
  const focusedLeafId = useWorkspaceStore(s => s.focusedLeafId);
  const setFocusedLeaf = useWorkspaceStore(s => s.setFocusedLeaf);
  const isFocused = focusedLeafId === leafId;

  const leaf = useMemo(() => findLeaf(root, leafId), [root, leafId]);
  const activeTabId = leaf?.activeTabId ?? null;
  const tabIds = leaf?.tabIds ?? [];
  const paneTabs = useMemo(
    () => tabIds.map(id => tabs[id]).filter(Boolean),
    [tabIds, tabs],
  );

  const activeTab = paneTabs.find(t => t.id === activeTabId);
  const isTerminal = activeTab?.contentType === 'terminal';
  const isAgent = activeTab?.contentType === 'agent';
  const isBrowser = activeTab?.contentType === 'browser';

  const handleAddTab = useCallback(() => {
    // Create the same type as the currently active tab
    const wsState = useWorkspaceStore.getState();
    const leaf = (() => {
      const walk = (n: PaneNode): PaneLeaf | null => {
        if (n.type === 'leaf' && n.id === leafId) return n;
        if (n.type === 'split') {
          for (const c of n.children) {
            const found = walk(c);
            if (found) return found;
          }
        }
        return null;
      };
      return walk(wsState.root);
    })();
    const currentTab = leaf?.activeTabId ? wsState.tabs[leaf.activeTabId] : null;

    if (currentTab?.contentType === 'agent') {
      // Create another agent of the same runtime
      const runtimeId = currentTab.runtimeId || 'claude';
      const runtime = getRuntime(runtimeId);
      const runtimeName = runtime?.name || 'Agent';
      const id = `agent-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const agentCount = Object.values(wsState.tabs).filter(t => t.contentType === 'agent').length;
      wsState.addTab(leafId, {
        id,
        label: `${runtimeName} ${agentCount + 1}`,
        contentType: 'agent',
        runtimeId,
      });
    } else if (currentTab?.contentType === 'browser') {
      // Create another browser tab
      const browserCount = Object.values(wsState.tabs).filter(t => t.contentType === 'browser').length;
      const id = `browser-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      wsState.addTab(leafId, {
        id,
        label: `预览 ${browserCount + 1}`,
        contentType: 'browser',
      });
    } else {
      // Create terminal
      const state = useTerminalStore.getState();
      if (state.terminals.length >= 10) return;

      const id = `global-${Math.random().toString(36).slice(2, 10)}`;
      const shellPref = localStorage.getItem('devhub_terminal_shell') || DEFAULT_SHELL;
      const cfg = SHELL_MAP[shellPref] || SHELL_MAP[DEFAULT_SHELL];
      const label = `终端 ${state.terminals.length + 1}`;
      const cwd = state.defaultCwd;

      const newTerminal = {
        id,
        label,
        createdAt: new Date(),
        shell: cfg.shell,
        cwd,
        status: 'running' as const,
        projectId: null,
        groupId: null,
        pane: 'left' as const,
      };

      terminalApi.startShell(id, cfg.shell, cwd, cfg.args);
      state.addTerminal(newTerminal);
      wsState.addTab(leafId, {
        id,
        label,
        contentType: 'terminal' as const,
        status: 'running' as const,
        shell: cfg.shell,
        cwd,
      });
    }
  }, [leafId]);

  const handleClose = useCallback((tabId: string) => {
    // Stop the terminal process if this is a terminal tab
    const tab = useWorkspaceStore.getState().tabs[tabId];
    if (tab?.contentType === 'terminal') {
      terminalApi.stop(tabId).catch(() => {});
      useTerminalStore.getState().removeTerminal(tabId);
    }

    closeTab(tabId);
    // If leaf is now empty and there are other leaves, close it
    const wsState = useWorkspaceStore.getState();
    const currentLeaf = findLeaf(wsState.root, leafId);
    const allLeaves = (() => {
      const walk = (n: PaneNode): PaneNode[] => {
        if (n.type === 'leaf') return [n];
        return n.children.flatMap(walk);
      };
      return walk(wsState.root);
    })();
    if (currentLeaf && currentLeaf.tabIds.length === 0 && allLeaves.length > 1) {
      closePane(leafId);
    }
  }, [closeTab, closePane, leafId]);

  return (
    <div
      onClick={() => setFocusedLeaf(leafId)}
      style={{
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
        height: '100%',
        boxShadow: isFocused ? '0 0 0 2px #6366f1 inset' : 'none',
        transition: 'box-shadow 0.15s ease',
      }}
    >
      <PaneTabBar
        tabs={paneTabs}
        activeTabId={activeTabId}
        onSelect={(tabId) => setActiveTab(leafId, tabId)}
        onClose={handleClose}
        onAdd={handleAddTab}
      />
      <div style={contentStyles.content}>
        {isTerminal ? (
          <TerminalLeafContent
            leafId={leafId}
            activeTabId={activeTabId}
            terminalIds={tabIds}
          />
        ) : isAgent && activeTabId ? (
          <AgentPane agentId={activeTabId} runtimeId={activeTab?.runtimeId || 'claude'} />
        ) : isBrowser && activeTabId ? (
          <BrowserPane tabId={activeTabId} />
        ) : activeTabId ? (
          <div style={contentStyles.placeholder}>
            <span style={contentStyles.placeholderIcon}>⌘</span>
            <span style={contentStyles.placeholderText}>{activeTab?.label || activeTabId}</span>
            <span style={contentStyles.placeholderHint}>内容将在后续阶段接入</span>
          </div>
        ) : (
          <div style={contentStyles.empty}>
            <span style={contentStyles.emptyHint}>点击 + 新建标签页</span>
          </div>
        )}
      </div>
    </div>
  );
}

const contentStyles: Record<string, React.CSSProperties> = {
  content: {
    flex: 1,
    overflow: 'hidden',
    display: 'flex',
    background: '#1a1b26',
  },
  placeholder: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    height: '100%',
    gap: 8,
    color: '#94a3b8',
  },
  placeholderIcon: {
    fontSize: 24,
    opacity: 0.3,
    fontFamily: "'Fira Code', monospace",
  },
  placeholderText: {
    fontSize: 13,
    fontFamily: "'Fira Code', monospace",
    color: '#64748b',
  },
  placeholderHint: {
    fontSize: 11,
    color: '#94a3b8',
  },
  empty: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    height: '100%',
  },
  emptyHint: {
    fontSize: 12,
    color: '#94a3b8',
  },
};

// ── Recursive split renderer ──

interface SplitNodeProps {
  node: PaneNode;
}

function SplitNode({ node }: SplitNodeProps) {
  const updateSizes = useWorkspaceStore(s => s.updateSizes);

  if (node.type === 'leaf') {
    return (
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', minWidth: 0, minHeight: 0 }}>
        <PaneContent leafId={node.id} />
      </div>
    );
  }

  const split = node as PaneSplit;
  const isHorizontal = split.direction === 'horizontal';
  const totalSize = split.sizes.reduce((a, b) => a + b, 0);

  const handleDrag = useCallback((childIndex: number, delta: number) => {
    const container = document.querySelector(`[data-split-id="${split.id}"]`);
    if (!container) return;
    const containerSize = isHorizontal ? container.clientWidth : container.clientHeight;
    const deltaRatio = delta / containerSize * totalSize;

    const newSizes = [...split.sizes];
    const prevIndex = childIndex - 1;
    newSizes[prevIndex] = Math.max(0.1, newSizes[prevIndex] + deltaRatio);
    newSizes[childIndex] = Math.max(0.1, newSizes[childIndex] - deltaRatio);
    updateSizes(split.id, newSizes);
  }, [split.id, split.sizes, isHorizontal, totalSize, updateSizes]);

  return (
    <div
      data-split-id={split.id}
      style={{
        display: 'flex',
        flexDirection: isHorizontal ? 'row' : 'column',
        width: '100%',
        height: '100%',
        overflow: 'hidden',
      }}
    >
      {split.children.map((child, i) => (
        <Fragment key={child.id}>
          {i > 0 && (
            <PaneDivider
              direction={isHorizontal ? 'horizontal' : 'vertical'}
              onDrag={(delta) => handleDrag(i, delta)}
            />
          )}
          <div style={{
            flex: split.sizes[i],
            overflow: 'hidden',
            display: 'flex',
            minWidth: 0,
            minHeight: 0,
          }}>
            <SplitNode node={child} />
          </div>
        </Fragment>
      ))}
    </div>
  );
}

// ── Main export ──

export default function WorkspacePane() {
  const root = useWorkspaceStore(s => s.root);
  return <SplitNode node={root} />;
}
