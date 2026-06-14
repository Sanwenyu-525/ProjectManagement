import { useState, useMemo, useEffect } from 'react';
import { Dropdown } from 'antd';
import { PlusOutlined, CaretDownOutlined, CaretRightOutlined, CodeOutlined, RobotOutlined, ThunderboltOutlined, GlobalOutlined, LinkOutlined, CloseOutlined, CheckCircleOutlined, CloseCircleOutlined, FileTextOutlined, ClearOutlined } from '@ant-design/icons';
import { useTerminalStore } from '../../stores/terminalStore';
import { useWorkspaceStore } from '../../stores/workspaceStore';
import type { TestReport } from '../../stores/workspaceStore';
import { usePreviewStore } from '../../stores/previewStore';
import { terminalApi, detectApi } from '../../api';
import type { PaneNode } from './types';
import { getRuntime, getAllRuntimes } from './agent-runtimes';
import { findLeafWithTab, getAllLeaves } from './treeUtils';
import { createTerminal } from './terminalFactory';
import { createAgent } from './agentFactory';

// ── Section component ──

function Section({
  title,
  icon,
  defaultOpen = true,
  count,
  onAdd,
  addButton,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  defaultOpen?: boolean;
  count?: number;
  onAdd?: () => void;
  addButton?: React.ReactNode;
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
        {addButton ? (
          <span style={{ opacity: hovered ? 1 : 0, transition: 'opacity 0.15s' }} onClick={(e) => e.stopPropagation()}>
            {addButton}
          </span>
        ) : onAdd ? (
          <button
            onClick={(e) => { e.stopPropagation(); onAdd(); }}
            style={{ ...styles.addBtn, opacity: hovered ? 1 : 0 }}
            title={`新建${title}`}
          >
            <PlusOutlined style={{ fontSize: 9 }} />
          </button>
        ) : null}
      </div>
      {open && (
        <div style={styles.sectionBody}>
          {children}
        </div>
      )}
    </div>
  );
}

// ── Nav item (shared by terminal, agent, browser sections) ──

type DragProps = {
  onDragStart: (e: React.DragEvent) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
  onDragEnd: () => void;
  isDragOver: boolean;
  isDragging: boolean;
};

function NavItem({ label, isActive, icon, onClick, onClose, dragProps }: {
  label: string;
  isActive: boolean;
  icon: React.ReactNode;
  onClick: () => void;
  onClose?: () => void;
  dragProps?: DragProps;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      draggable={!!dragProps}
      onDragStart={dragProps?.onDragStart}
      onDragOver={dragProps?.onDragOver}
      onDrop={dragProps?.onDrop}
      onDragEnd={dragProps?.onDragEnd}
      style={{
        ...styles.item,
        ...(isActive ? styles.itemActive : {}),
        ...(dragProps?.isDragOver ? { background: 'rgba(99, 102, 241, 0.15)', outline: '1px dashed rgba(99, 102, 241, 0.4)' } : {}),
        ...(dragProps?.isDragging ? { opacity: 0.4 } : {}),
      }}
    >
      {icon}
      <span style={styles.itemLabel}>{label}</span>
      {hovered && onClose && (
        <button
          onClick={(e) => { e.stopPropagation(); onClose(); }}
          style={styles.closeBtn}
          title="关闭"
        >
          <CloseOutlined style={{ fontSize: 8 }} />
        </button>
      )}
    </div>
  );
}

// ── Browser preview item ──

function BrowserPreviewItem({ label, isOpen, errorCount, onClick, onClose }: {
  label: string;
  isOpen: boolean;
  errorCount?: number;
  onClick: () => void;
  onClose?: () => void;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={styles.item}
    >
      <LinkOutlined style={{ fontSize: 11, color: '#60a5fa', flexShrink: 0 }} />
      <span style={styles.itemLabel}>{label}</span>
      {isOpen && <span style={styles.openBadge}>已打开</span>}
      {errorCount && errorCount > 0 && <span style={styles.errorBadge}>{errorCount}</span>}
      {hovered && isOpen && onClose && (
        <button
          onClick={(e) => { e.stopPropagation(); onClose(); }}
          style={styles.closeBtn}
          title="关闭"
        >
          <CloseOutlined style={{ fontSize: 8 }} />
        </button>
      )}
    </div>
  );
}

// ── Test report item ──

function ReportItem({ report, isExpanded, onToggle }: {
  report: TestReport;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const allPassed = report.summary.failed === 0;
  const time = new Date(report.timestamp);
  const timeStr = `${time.getHours().toString().padStart(2, '0')}:${time.getMinutes().toString().padStart(2, '0')}`;

  return (
    <div>
      <div
        onClick={onToggle}
        style={styles.item}
      >
        {allPassed
          ? <CheckCircleOutlined style={{ fontSize: 11, color: '#22c55e', flexShrink: 0 }} />
          : <CloseCircleOutlined style={{ fontSize: 11, color: '#ef4444', flexShrink: 0 }} />
        }
        <span style={styles.itemLabel}>{report.name}</span>
        <span style={styles.reportCount}>{report.summary.passed}/{report.summary.total}</span>
        <span style={styles.reportTime}>{timeStr}</span>
      </div>
      {isExpanded && (
        <div style={styles.reportDetail}>
          {report.steps.map((step, i) => (
            <div key={i} style={styles.reportStep}>
              <span>{step.pass ? '✅' : '❌'}</span>
              <span style={styles.stepLabel}>{i + 1}. {step.label}</span>
              {step.duration > 500 && (
                <span style={styles.stepTime}>{step.duration}ms</span>
              )}
            </div>
          ))}
          {report.steps.some(s => !s.pass && s.detail) && (
            <div style={styles.reportErrors}>
              {report.steps.filter(s => !s.pass).map((s, i) => (
                <div key={i} style={styles.errorLine}>{s.detail}</div>
              ))}
            </div>
          )}
          <div style={styles.reportSummary}>
            耗时: {(report.summary.duration / 1000).toFixed(1)}s
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main navigator ──

export default function WorkspaceNavigator() {
  const allTerminals = useTerminalStore(s => s.terminals);
  const root = useWorkspaceStore(s => s.root);
  const tabs = useWorkspaceStore(s => s.tabs);

  // Filter to only terminals in current workspace (by tab membership)
  const terminalTabIds = useMemo(
    () => new Set(Object.values(tabs).filter(t => t.contentType === 'terminal').map(t => t.id)),
    [tabs],
  );
  const terminals = useMemo(
    () => allTerminals.filter(t => terminalTabIds.has(t.id)),
    [allTerminals, terminalTabIds],
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

  // Detect installed agent CLIs
  const [installedAgents, setInstalledAgents] = useState<Record<string, boolean>>({});
  useEffect(() => {
    const agentCommands = getAllRuntimes().map(rt => rt.id);
    detectApi.installedAgents(agentCommands).then(setInstalledAgents).catch(() => {});
  }, []);

  const browserLogs = useWorkspaceStore(s => s.browserLogs);
  const browserErrorCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const [tabId, logs] of Object.entries(browserLogs)) {
      const errors = logs.consoleLogs.filter(l => l.method === 'error').length;
      if (errors > 0) counts[tabId] = errors;
    }
    return counts;
  }, [browserLogs]);

  const discoveredPreviews = usePreviewStore(s => s.previews);

  const testReports = useWorkspaceStore(s => s.testReports);
  const clearTestReports = useWorkspaceStore(s => s.clearTestReports);
  const [expandedReportId, setExpandedReportId] = useState<string | null>(null);

  const handleCreateTerminal = async () => {
    // Ask user for path via folder picker
    let cwd: string | undefined;
    try {
      const { open } = await import('@tauri-apps/plugin-dialog');
      const selected = await open({ directory: true, title: '选择终端工作目录' });
      if (selected) {
        cwd = selected as string;
      } else {
        // User cancelled dialog — use default path
        cwd = undefined;
      }
    } catch {
      // Dialog plugin not available — use default path
      cwd = undefined;
    }

    const result = await createTerminal(cwd ? { cwd } : undefined);
    if (!result) return;
    const { terminal } = result;
    const wsState = useWorkspaceStore.getState();
    const leaves = getAllLeaves(wsState.root);
    if (leaves[0]) {
      wsState.addTab(leaves[0].id, {
        id: terminal.id,
        label: terminal.label,
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

  const handleCloseTerminal = (terminalId: string) => {
    terminalApi.stop(terminalId).catch(() => {});
    useTerminalStore.getState().removeTerminal(terminalId);
    useWorkspaceStore.getState().closeTab(terminalId);
  };

  const handleCloseAgent = (agentId: string) => {
    terminalApi.stop(agentId).catch(() => {});
    useTerminalStore.getState().removeTerminal(agentId);
    useWorkspaceStore.getState().closeTab(agentId);
  };

  const handleCloseBrowser = (browserId: string) => {
    useWorkspaceStore.getState().closeTab(browserId);
  };

  // ── Drag-and-drop state ──
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  const handleDragStart = (e: React.DragEvent, tabId: string) => {
    e.dataTransfer.setData('text/plain', tabId);
    e.dataTransfer.effectAllowed = 'move';
    setDraggedId(tabId);
  };

  const handleDragEnd = () => {
    setDraggedId(null);
    setDragOverId(null);
  };

  const handleItemDragOver = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (targetId !== draggedId) setDragOverId(targetId);
  };

  const handleItemDrop = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    const sourceId = e.dataTransfer.getData('text/plain');
    if (!sourceId || sourceId === targetId) return;

    const wsState = useWorkspaceStore.getState();
    const sourceLeaf = findLeafWithTab(wsState.root, sourceId);
    const targetLeaf = findLeafWithTab(wsState.root, targetId);
    if (!sourceLeaf || !targetLeaf) return;

    // Same leaf: reorder tabs
    if (sourceLeaf.id === targetLeaf.id) {
      const ids = [...sourceLeaf.tabIds];
      const fromIdx = ids.indexOf(sourceId);
      const toIdx = ids.indexOf(targetId);
      if (fromIdx === -1 || toIdx === -1) return;
      ids.splice(fromIdx, 1);
      ids.splice(toIdx, 0, sourceId);
      wsState.reorderTabs(sourceLeaf.id, ids);
    } else {
      // Different leaves: move tab from source to target
      wsState.closeTab(sourceId);
      const sourceTab = wsState.tabs[sourceId];
      if (sourceTab) {
        wsState.addTab(targetLeaf.id, { ...sourceTab });
      }
    }
    setDraggedId(null);
    setDragOverId(null);
  };

  const handleCreateAgent = async (runtimeId: string = 'claude') => {
    const result = await createAgent(runtimeId);
    if (!result) return;
    const wsState = useWorkspaceStore.getState();
    const leaves = getAllLeaves(wsState.root);
    if (leaves[0]) {
      wsState.addTab(leaves[0].id, {
        id: result.id,
        label: result.label,
        contentType: 'agent',
        runtimeId: result.runtimeId,
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
    const leaves = getAllLeaves(wsState.root);
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
          terminals.map(t => {
            const statusColor = t.status === 'running' ? '#22c55e' : t.status === 'exited' ? '#6b7280' : '#ef4444';
            return (
              <NavItem
                key={t.id}
                label={t.label}
                isActive={t.id === activeTabId}
                icon={<span style={{ ...styles.statusDot, background: statusColor, boxShadow: t.status === 'running' ? '0 0 4px rgba(34, 197, 94, 0.4)' : 'none' }} />}
                onClick={() => handleSelectTerminal(t.id)}
                onClose={() => handleCloseTerminal(t.id)}
                dragProps={{
                  onDragStart: (e) => handleDragStart(e, t.id),
                  onDragOver: (e) => handleItemDragOver(e, t.id),
                  onDrop: (e) => handleItemDrop(e, t.id),
                  onDragEnd: handleDragEnd,
                  isDragOver: dragOverId === t.id,
                  isDragging: draggedId === t.id,
                }}
              />
            );
          })
        )}
      </Section>

      {/* Agent section */}
      <Section
        title="Agent"
        icon={<RobotOutlined style={styles.sectionIcon} />}
        count={agentSessions.length}
        addButton={
          <Dropdown
            menu={{
              items: (() => {
                const available = getAllRuntimes().filter(rt => installedAgents[rt.id]);
                if (available.length === 0) {
                  return [{
                    key: 'none',
                    label: <span style={{ color: '#94a3b8', fontSize: 12 }}>未检测到已安装的 Agent</span>,
                    disabled: true,
                  }];
                }
                return available.map(rt => ({
                  key: rt.id,
                  label: (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '2px 0' }}>
                      <span style={{
                        width: 26, height: 26, borderRadius: 6,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        background: `${rt.color}15`, color: rt.color, fontSize: 13,
                      }}>
                        <RobotOutlined />
                      </span>
                      <span style={{ fontWeight: 500, color: '#1a1f36' }}>{rt.name}</span>
                    </div>
                  ),
                  onClick: () => handleCreateAgent(rt.id),
                }));
              })(),
            }}
            trigger={['click']}
            placement="bottomCenter"
          >
            <button
              style={styles.addBtn}
              title="新建 Agent"
            >
              <PlusOutlined style={{ fontSize: 9 }} />
            </button>
          </Dropdown>
        }
      >
        {agentSessions.length === 0 ? (
          <div style={styles.emptyHint}>无活动会话</div>
        ) : (
          agentSessions.map(agent => {
            const rt = agent.runtimeId ? getRuntime(agent.runtimeId) : null;
            const agentColor = rt?.color || '#a5b4fc';
            return (
              <NavItem
                key={agent.id}
                label={agent.label}
                isActive={agent.id === activeTabId}
                icon={<RobotOutlined style={{ fontSize: 11, color: agentColor, flexShrink: 0 }} />}
                onClick={() => handleSelectAgent(agent.id)}
                onClose={() => handleCloseAgent(agent.id)}
                dragProps={{
                  onDragStart: (e) => handleDragStart(e, agent.id),
                  onDragOver: (e) => handleItemDragOver(e, agent.id),
                  onDrop: (e) => handleItemDrop(e, agent.id),
                  onDragEnd: handleDragEnd,
                  isDragOver: dragOverId === agent.id,
                  isDragging: draggedId === agent.id,
                }}
              />
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
            const existingTab = isOpen ? browserSessions.find(s => s.url === preview.url) : null;
            // Count console errors for this tab
            const errorCount = existingTab ? (browserErrorCounts[existingTab.id] || 0) : 0;
            return (
              <BrowserPreviewItem
                key={preview.url}
                label={preview.label}
                isOpen={isOpen}
                errorCount={errorCount}
                onClick={() => {
                  if (existingTab) {
                    handleSelectBrowser(existingTab.id);
                  } else {
                    const id = `browser-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
                    const wsState = useWorkspaceStore.getState();
                    const leaves = getAllLeaves(wsState.root);
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
                onClose={existingTab ? () => handleCloseBrowser(existingTab.id) : undefined}
              />
            );
          })
        )}
      </Section>

      {/* Test Reports section */}
      <Section
        title="测试报告"
        icon={<FileTextOutlined style={styles.sectionIcon} />}
        count={testReports.length}
        addButton={
          testReports.length > 0 ? (
            <button
              onClick={(e) => { e.stopPropagation(); clearTestReports(); }}
              style={styles.addBtn}
              title="清除全部"
            >
              <ClearOutlined style={{ fontSize: 9 }} />
            </button>
          ) : undefined
        }
      >
        {testReports.length === 0 ? (
          <div style={styles.emptyHint}>运行 scenario 命令后显示</div>
        ) : (
          testReports.slice(0, 20).map(report => (
            <ReportItem
              key={report.id}
              report={report}
              isExpanded={expandedReportId === report.id}
              onToggle={() => setExpandedReportId(
                expandedReportId === report.id ? null : report.id
              )}
            />
          ))
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
    width: '100%',
    height: '100%',
    background: 'rgba(255, 255, 255, 0.02)',
    borderRight: '1px solid rgba(255, 255, 255, 0.06)',
    overflow: 'auto',
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
  errorBadge: {
    fontSize: 9,
    color: '#ef4444',
    background: 'rgba(239, 68, 68, 0.15)',
    padding: '0 4px',
    borderRadius: 3,
    lineHeight: '14px',
    flexShrink: 0,
  },
  closeBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 16,
    height: 16,
    borderRadius: 3,
    border: 'none',
    background: 'transparent',
    color: '#64748b',
    cursor: 'pointer',
    padding: 0,
    marginLeft: 'auto',
    flexShrink: 0,
  },
  reportCount: {
    fontSize: 9,
    color: '#64748b',
    fontFamily: "'Fira Code', monospace",
    flexShrink: 0,
  },
  reportTime: {
    fontSize: 9,
    color: '#64748b',
    fontFamily: "'Fira Code', monospace",
    flexShrink: 0,
  },
  reportDetail: {
    padding: '4px 12px 4px 28px',
    background: 'rgba(255, 255, 255, 0.02)',
    borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
  },
  reportStep: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '2px 0',
    fontSize: 10,
    color: '#94a3b8',
    fontFamily: "'Fira Code', monospace",
  },
  stepLabel: {
    flex: 1,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  stepTime: {
    color: '#64748b',
    flexShrink: 0,
  },
  reportErrors: {
    marginTop: 4,
    padding: '4px 6px',
    borderRadius: 3,
    background: 'rgba(239, 68, 68, 0.06)',
    border: '1px solid rgba(239, 68, 68, 0.12)',
  },
  errorLine: {
    fontSize: 9,
    color: '#f87171',
    fontFamily: "'Fira Code', monospace",
    lineHeight: '14px',
  },
  reportSummary: {
    marginTop: 4,
    fontSize: 9,
    color: '#64748b',
    fontFamily: "'Fira Code', monospace",
  },
};
