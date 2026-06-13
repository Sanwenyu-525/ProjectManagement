import { useState, useMemo } from 'react';
import { PlusOutlined, CaretDownOutlined, CaretRightOutlined, CodeOutlined, RobotOutlined, ThunderboltOutlined, GlobalOutlined, LinkOutlined } from '@ant-design/icons';
import { useTerminalStore } from '../../stores/terminalStore';
import { useWorkspaceStore } from '../../stores/workspaceStore';
import { usePreviewStore } from '../../stores/previewStore';
import { terminalApi } from '../../api';
import { DEFAULT_SHELL, SHELL_MAP } from '../../lib/constants';
import type { PaneNode, PaneLeaf } from './types';
import type { Terminal } from '../terminalTypes';
import { getRuntime } from './agent-runtimes';

// ── Tree helper ──

function findLeafWithTab(root: PaneNode, tabId: string): PaneLeaf | null {
  if (root.type === 'leaf' && root.tabIds.includes(tabId)) return root;
  if (root.type === 'split') {
    for (const child of root.children) {
      const found = findLeafWithTab(child, tabId);
      if (found) return found;
    }
  }
  return null;
}

// ── Section component ──

function Section({
  title,
  icon,
  defaultOpen = true,
  count,
  onAdd,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  defaultOpen?: boolean;
  count?: number;
  onAdd?: () => void;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const [hovered, setHovered] = useState(false);

  return (
    <div style={{ marginBottom: 4 }}>
      <div
        onClick={() => setOpen(!open)}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={styles.sectionHeader}
      >
        <div style={styles.sectionLeft}>
          {open ? <CaretDownOutlined style={styles.caret} /> : <CaretRightOutlined style={styles.caret} />}
          {icon}
          <span style={styles.sectionTitle}>{title}</span>
          {count !== undefined && count > 0 && (
            <span style={styles.countBadge}>{count}</span>
          )}
        </div>
        {onAdd && (
          <button
            onClick={(e) => { e.stopPropagation(); onAdd(); }}
            style={{ ...styles.addBtn, opacity: hovered ? 1 : 0 }}
            title={`新建${title}`}
          >
            <PlusOutlined style={{ fontSize: 9 }} />
          </button>
        )}
      </div>
      {open && (
        <div style={styles.sectionBody}>
          {children}
        </div>
      )}
    </div>
  );
}

// ── Terminal item ──

function TerminalItem({ terminal, isActive, onClick }: {
  terminal: Terminal;
  isActive: boolean;
  onClick: () => void;
}) {
  const statusColor =
    terminal.status === 'running' ? '#22c55e' :
    terminal.status === 'exited' ? '#6b7280' :
    '#ef4444';

  return (
    <div
      onClick={onClick}
      style={{
        ...styles.item,
        ...(isActive ? styles.itemActive : {}),
      }}
      onMouseEnter={e => {
        if (!isActive) e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
      }}
      onMouseLeave={e => {
        if (!isActive) e.currentTarget.style.background = 'transparent';
      }}
    >
      <span style={{
        ...styles.statusDot,
        background: statusColor,
        boxShadow: terminal.status === 'running' ? '0 0 4px rgba(34, 197, 94, 0.4)' : 'none',
      }} />
      <span style={styles.itemLabel}>{terminal.label}</span>
    </div>
  );
}

// ── Main navigator ──

export default function WorkspaceNavigator() {
  const allTerminals = useTerminalStore(s => s.terminals);
  const defaultCwd = useTerminalStore(s => s.defaultCwd);
  const root = useWorkspaceStore(s => s.root);
  const tabs = useWorkspaceStore(s => s.tabs);

  // Filter out agent-spawned terminals (IDs start with 'agent-')
  const terminals = useMemo(
    () => allTerminals.filter(t => !t.id.startsWith('agent-')),
    [allTerminals],
  );
  const activeTabId = useMemo(() => {
    // Find which tab is active across all leaves
    const walk = (n: PaneNode): string | null => {
      if (n.type === 'leaf' && n.activeTabId) return n.activeTabId;
      if (n.type === 'split') {
        for (const child of n.children) {
          const found = walk(child);
          if (found) return found;
        }
      }
      return null;
    };
    return walk(root);
  }, [root]);

  const agentSessions = useMemo(
    () => Object.values(tabs).filter(t => t.contentType === 'agent'),
    [tabs],
  );

  const browserSessions = useMemo(
    () => Object.values(tabs).filter(t => t.contentType === 'browser'),
    [tabs],
  );

  const discoveredPreviews = usePreviewStore(s => s.previews);

  const handleCreateTerminal = async () => {
    const state = useTerminalStore.getState();
    if (state.terminals.length >= 10) return;

    const id = `global-${Math.random().toString(36).slice(2, 10)}`;
    const shellPref = localStorage.getItem('devhub_terminal_shell') || DEFAULT_SHELL;
    const cfg = SHELL_MAP[shellPref] || SHELL_MAP[DEFAULT_SHELL];
    const label = `终端 ${state.terminals.length + 1}`;

    const newTerminal: Terminal = {
      id,
      label,
      createdAt: new Date(),
      shell: cfg.shell,
      cwd: defaultCwd,
      status: 'running',
      projectId: null,
      groupId: null,
      pane: 'left',
    };

    await terminalApi.startShell(id, cfg.shell, defaultCwd, cfg.args);
    state.addTerminal(newTerminal);

    // Add to first leaf
    const wsState = useWorkspaceStore.getState();
    const leaves = (() => {
      const walk = (n: PaneNode): PaneLeaf[] => {
        if (n.type === 'leaf') return [n];
        return n.children.flatMap(walk);
      };
      return walk(wsState.root);
    })();
    if (leaves[0]) {
      wsState.addTab(leaves[0].id, {
        id,
        label,
        contentType: 'terminal',
        status: 'running',
      });
    }
  };

  const handleSelectTerminal = (terminalId: string) => {
    const wsState = useWorkspaceStore.getState();
    const leaf = findLeafWithTab(wsState.root, terminalId);
    if (leaf) {
      wsState.setActiveTab(leaf.id, terminalId);
    }
  };

  const handleCreateAgent = (runtimeId: string = 'claude') => {
    const runtime = getRuntime(runtimeId);
    const runtimeName = runtime?.name || 'Agent';
    const id = `agent-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const label = `${runtimeName} ${agentSessions.length + 1}`;
    const wsState = useWorkspaceStore.getState();
    const leaves = (() => {
      const walk = (n: PaneNode): PaneLeaf[] => {
        if (n.type === 'leaf') return [n];
        return n.children.flatMap(walk);
      };
      return walk(wsState.root);
    })();
    if (leaves[0]) {
      wsState.addTab(leaves[0].id, {
        id,
        label,
        contentType: 'agent',
        runtimeId,
      });
    }
  };

  const handleSelectAgent = (agentId: string) => {
    const wsState = useWorkspaceStore.getState();
    const leaf = findLeafWithTab(wsState.root, agentId);
    if (leaf) {
      wsState.setActiveTab(leaf.id, agentId);
    }
  };

  const handleCreateBrowser = () => {
    const id = `browser-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const label = `预览 ${browserSessions.length + 1}`;
    const wsState = useWorkspaceStore.getState();
    const leaves = (() => {
      const walk = (n: PaneNode): PaneLeaf[] => {
        if (n.type === 'leaf') return [n];
        return n.children.flatMap(walk);
      };
      return walk(wsState.root);
    })();
    if (leaves[0]) {
      wsState.addTab(leaves[0].id, {
        id,
        label,
        contentType: 'browser',
      });
    }
  };

  const handleSelectBrowser = (browserId: string) => {
    const wsState = useWorkspaceStore.getState();
    const leaf = findLeafWithTab(wsState.root, browserId);
    if (leaf) {
      wsState.setActiveTab(leaf.id, browserId);
    }
  };

  return (
    <div style={styles.container}>
      {/* Terminal section */}
      <Section
        title="终端"
        icon={<CodeOutlined style={styles.sectionIcon} />}
        count={terminals.length}
        onAdd={handleCreateTerminal}
      >
        {terminals.length === 0 ? (
          <div style={styles.emptyHint}>无活动终端</div>
        ) : (
          terminals.map(t => (
            <TerminalItem
              key={t.id}
              terminal={t}
              isActive={t.id === activeTabId}
              onClick={() => handleSelectTerminal(t.id)}
            />
          ))
        )}
      </Section>

      {/* Agent section */}
      <Section
        title="Agent"
        icon={<RobotOutlined style={styles.sectionIcon} />}
        count={agentSessions.length}
        onAdd={handleCreateAgent}
      >
        {agentSessions.length === 0 ? (
          <div style={styles.emptyHint}>无活动会话</div>
        ) : (
          agentSessions.map(agent => {
            const rt = agent.runtimeId ? getRuntime(agent.runtimeId) : null;
            const agentColor = rt?.color || '#a5b4fc';
            return (
              <div
                key={agent.id}
                onClick={() => handleSelectAgent(agent.id)}
                style={{
                  ...styles.item,
                  ...(agent.id === activeTabId ? styles.itemActive : {}),
                }}
                onMouseEnter={e => {
                  if (agent.id !== activeTabId) e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                }}
                onMouseLeave={e => {
                  if (agent.id !== activeTabId) e.currentTarget.style.background = 'transparent';
                }}
              >
                <RobotOutlined style={{ fontSize: 11, color: agentColor, flexShrink: 0 }} />
                <span style={styles.itemLabel}>{agent.label}</span>
              </div>
            );
          })
        )}
      </Section>

      {/* Browser section */}
      <Section
        title="浏览器"
        icon={<GlobalOutlined style={styles.sectionIcon} />}
        count={discoveredPreviews.length}
        onAdd={handleCreateBrowser}
      >
        {discoveredPreviews.length === 0 ? (
          <div style={styles.emptyHint}>运行 dev server 后自动发现</div>
        ) : (
          discoveredPreviews.map(preview => {
            // Check if this preview is already open as a browser tab
            const isOpen = browserSessions.some(s => s.url === preview.url);
            return (
              <div
                key={preview.url}
                onClick={() => {
                  if (isOpen) {
                    // Focus existing tab
                    const existing = browserSessions.find(s => s.url === preview.url);
                    if (existing) handleSelectBrowser(existing.id);
                  } else {
                    // Create new browser tab with this URL
                    const id = `browser-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
                    const wsState = useWorkspaceStore.getState();
                    const leaves = (() => {
                      const walk = (n: PaneNode): PaneLeaf[] => {
                        if (n.type === 'leaf') return [n];
                        return n.children.flatMap(walk);
                      };
                      return walk(wsState.root);
                    })();
                    if (leaves[0]) {
                      wsState.addTab(leaves[0].id, {
                        id,
                        label: preview.label,
                        contentType: 'browser',
                        url: preview.url,
                      });
                    }
                  }
                }}
                style={styles.item}
                onMouseEnter={e => {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = 'transparent';
                }}
              >
                <LinkOutlined style={{ fontSize: 11, color: '#60a5fa', flexShrink: 0 }} />
                <span style={styles.itemLabel}>{preview.label}</span>
                {isOpen && <span style={styles.openBadge}>已打开</span>}
              </div>
            );
          })
        )}
      </Section>

      {/* Build section (placeholder) */}
      <Section
        title="构建"
        icon={<ThunderboltOutlined style={styles.sectionIcon} />}
        defaultOpen={false}
      >
        <div style={styles.emptyHint}>即将推出</div>
      </Section>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    width: 200,
    background: 'rgba(255, 255, 255, 0.02)',
    borderRight: '1px solid rgba(255, 255, 255, 0.06)',
    overflow: 'auto',
    flexShrink: 0,
    padding: '8px 0',
  },
  sectionHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '6px 12px',
    cursor: 'pointer',
    userSelect: 'none',
  },
  sectionLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  },
  caret: {
    fontSize: 8,
    color: '#64748b',
    width: 10,
  },
  sectionIcon: {
    fontSize: 11,
    color: '#64748b',
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: 600,
    color: '#94a3b8',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.5px',
    fontFamily: "'Fira Sans', sans-serif",
  },
  countBadge: {
    fontSize: 9,
    color: '#64748b',
    background: 'rgba(255, 255, 255, 0.06)',
    padding: '0 5px',
    borderRadius: 3,
    lineHeight: '14px',
    fontFamily: "'Fira Code', monospace",
  },
  addBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 18,
    height: 18,
    borderRadius: 3,
    border: 'none',
    background: 'transparent',
    color: '#64748b',
    cursor: 'pointer',
    padding: 0,
    transition: 'opacity 0.15s',
  },
  sectionBody: {
    padding: '2px 0',
  },
  item: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '5px 12px 5px 28px',
    cursor: 'pointer',
    borderRadius: 0,
    transition: 'background 0.1s',
  },
  itemActive: {
    background: 'rgba(255, 255, 255, 0.08)',
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: '50%',
    flexShrink: 0,
  },
  itemLabel: {
    fontSize: 12,
    color: '#cbd5e1',
    fontFamily: "'Fira Code', monospace",
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  emptyHint: {
    fontSize: 11,
    color: '#64748b',
    padding: '4px 12px 4px 28px',
    fontStyle: 'italic',
  },
  openBadge: {
    fontSize: 9,
    color: '#22c55e',
    background: 'rgba(34, 197, 94, 0.1)',
    padding: '0 4px',
    borderRadius: 3,
    lineHeight: '14px',
    flexShrink: 0,
  },
};
