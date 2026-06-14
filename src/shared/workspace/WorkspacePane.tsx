import { useCallback, useMemo, useRef, useState, Fragment } from 'react';
import type { PaneNode, PaneLeaf } from './types';
import { useWorkspaceStore } from '../../stores/workspaceStore';
import { useTerminalStore } from '../../stores/terminalStore';
import { terminalApi } from '../../api';
import { findLeaf, findLeafWithTab } from './treeUtils';
import { createTerminal } from './terminalFactory';
import PaneDivider from './PaneDivider';
import PaneTabBar from './PaneTabBar';
import TerminalLeafContent from './TerminalLeafContent';
import AgentPane from './AgentPane';
import BrowserPane from './BrowserPane';
import PluginPane from './PluginPane';
import { createAgent } from './agentFactory';

// ── Content renderer ──

function PaneContent({ leafId }: { leafId: string }) {
  const root = useWorkspaceStore(s => s.root);
  const tabs = useWorkspaceStore(s => s.tabs);
  const closeTab = useWorkspaceStore(s => s.closeTab);
  const setActiveTab = useWorkspaceStore(s => s.setActiveTab);
  const focusedLeafId = useWorkspaceStore(s => s.focusedLeafId);
  const setFocusedLeaf = useWorkspaceStore(s => s.setFocusedLeaf);
  const isFocused = focusedLeafId === leafId;

  const leaf = useMemo(() => findLeaf(root, leafId), [root, leafId]);
  const activeTabId = leaf?.activeTabId ?? null;
  const tabIds = useMemo(() => leaf?.tabIds ?? [], [leaf]);
  const paneTabs = useMemo(
    () => tabIds.map(id => tabs[id]).filter(Boolean),
    [tabIds, tabs],
  );

  const activeTab = paneTabs.find(t => t.id === activeTabId);
  const isTerminal = activeTab?.contentType === 'terminal';
  const isAgent = activeTab?.contentType === 'agent';
  const isBrowser = activeTab?.contentType === 'browser';
  const isPlugin = activeTab?.contentType === 'plugin';

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
      createAgent(currentTab.runtimeId || 'claude').then(result => {
        if (!result) return;
        wsState.addTab(leafId, {
          id: result.id,
          label: result.label,
          contentType: 'agent',
          runtimeId: result.runtimeId,
        });
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
      createTerminal().then(result => {
        if (!result) return;
        const { terminal } = result;
        wsState.addTab(leafId, {
          id: terminal.id,
          label: terminal.label,
          contentType: 'terminal',
          status: 'running',
          shell: terminal.shell,
          cwd: terminal.cwd,
        });
      });
    }
  }, [leafId]);

  const handleClose = useCallback((tabId: string) => {
    const tab = useWorkspaceStore.getState().tabs[tabId];
    if (tab?.contentType === 'terminal') {
      terminalApi.stop(tabId).catch(() => {});
      useTerminalStore.getState().removeTerminal(tabId);
    } else if (tab?.contentType === 'agent') {
      terminalApi.stop(tabId).catch(() => {});
    }

    closeTab(tabId);
  }, [closeTab]);

  const [isDragOver, setIsDragOver] = useState(false);
  const isDragOverRef = useRef(false);

  const handlePaneDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (!isDragOverRef.current) {
      isDragOverRef.current = true;
      setIsDragOver(true);
    }
  }, []);

  const handlePaneDragLeave = useCallback(() => {
    isDragOverRef.current = false;
    setIsDragOver(false);
  }, []);

  const handlePaneDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    isDragOverRef.current = false;
    setIsDragOver(false);
    const sourceId = e.dataTransfer.getData('text/plain');
    if (!sourceId) return;
    const wsState = useWorkspaceStore.getState();
    const sourceLeaf = findLeafWithTab(wsState.root, sourceId);
    if (!sourceLeaf || sourceLeaf.id === leafId) return;
    // Move tab from source leaf to this leaf
    wsState.closeTab(sourceId);
    const tab = wsState.tabs[sourceId];
    if (tab) {
      wsState.addTab(leafId, tab);
    }
  }, [leafId]);

  return (
    <div
      onClick={() => setFocusedLeaf(leafId)}
      onDragOver={handlePaneDragOver}
      onDragLeave={handlePaneDragLeave}
      onDrop={handlePaneDrop}
      style={{
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
        height: '100%',
        boxShadow: isFocused ? '0 0 0 2px #6366f1 inset' : 'none',
        transition: 'box-shadow 0.15s ease',
        outline: isDragOver ? '2px dashed rgba(99, 102, 241, 0.5)' : 'none',
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
        ) : isPlugin && activeTab?.contentType === 'plugin' ? (
          <PluginPane tab={activeTab} />
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

  const split = node.type === 'split' ? node : null;
  const isHorizontal = split?.direction === 'horizontal';
  const totalSize = split?.sizes.reduce((a, b) => a + b, 0) ?? 0;

  const handleDrag = useCallback((childIndex: number, delta: number) => {
    if (!split) return;
    const container = document.querySelector(`[data-split-id="${split.id}"]`);
    if (!container) return;
    const containerSize = isHorizontal ? container.clientWidth : container.clientHeight;
    const deltaRatio = delta / containerSize * totalSize;

    const newSizes = [...split.sizes];
    const prevIndex = childIndex - 1;
    newSizes[prevIndex] = Math.max(0.1, newSizes[prevIndex] + deltaRatio);
    newSizes[childIndex] = Math.max(0.1, newSizes[childIndex] - deltaRatio);
    updateSizes(split.id, newSizes);
  }, [split, isHorizontal, totalSize, updateSizes]);

  if (node.type === 'leaf') {
    return (
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', minWidth: 0, minHeight: 0 }}>
        <PaneContent leafId={node.id} />
      </div>
    );
  }

  // After early return for leaf nodes, split is guaranteed non-null
  const s = split!;

  return (
    <div
      data-split-id={s.id}
      style={{
        display: 'flex',
        flexDirection: isHorizontal ? 'row' : 'column',
        width: '100%',
        height: '100%',
        overflow: 'hidden',
      }}
    >
      {s.children.map((child, i) => (
        <Fragment key={child.id}>
          {i > 0 && (
            <PaneDivider
              direction={isHorizontal ? 'horizontal' : 'vertical'}
              onDrag={(delta) => handleDrag(i, delta)}
            />
          )}
          <div style={{
            flex: s.sizes[i],
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
