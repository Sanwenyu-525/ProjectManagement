import { useState, useRef, useEffect, useMemo } from 'react';
import { ClearOutlined, WarningOutlined, CloseCircleOutlined, InfoCircleOutlined, ToolOutlined } from '@ant-design/icons';
import type { ConsoleLogEntry, NetworkRequestEntry } from '../../stores/workspaceStore';

// Re-export for backward compatibility
export type ConsoleEntry = ConsoleLogEntry;
export type NetworkEntry = NetworkRequestEntry;

interface Props {
  consoleLogs: ConsoleLogEntry[];
  networkRequests: NetworkRequestEntry[];
  onClearConsole: () => void;
  onClearNetwork: () => void;
  onSendError?: (error: string) => void;
}

type DevToolsTab = 'console' | 'network';

function ConsoleLogRow({ entry, onSendError }: { entry: ConsoleLogEntry; onSendError?: (error: string) => void }) {
  const [hovered, setHovered] = useState(false);
  const errorText = entry.args.join(' ');

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        ...styles.logRow,
        background: entry.method === 'error'
          ? 'rgba(239, 68, 68, 0.08)'
          : entry.method === 'warn'
          ? 'rgba(234, 179, 8, 0.06)'
          : 'transparent',
      }}
    >
      <span style={styles.logIcon}>
        {entry.method === 'error' ? <CloseCircleOutlined style={{ color: '#ef4444', fontSize: 11 }} />
          : entry.method === 'warn' ? <WarningOutlined style={{ color: '#eab308', fontSize: 11 }} />
          : <InfoCircleOutlined style={{ color: 'var(--ws-text-muted)', fontSize: 11 }} />}
      </span>
      <span style={styles.logText}>{errorText}</span>
      {hovered && onSendError && (
        <button
          onClick={(e) => { e.stopPropagation(); onSendError(errorText); }}
          style={styles.fixBtn}
          title="发送给 Agent 修复"
        >
          <ToolOutlined style={{ fontSize: 9 }} />
        </button>
      )}
    </div>
  );
}

export default function BrowserDevTools({ consoleLogs, networkRequests, onClearConsole, onClearNetwork, onSendError }: Props) {
  const [activeTab, setActiveTab] = useState<DevToolsTab>('console');
  const [expandedRequest, setExpandedRequest] = useState<number | null>(null);
  const consoleEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll console to bottom
  useEffect(() => {
    if (activeTab === 'console' && consoleEndRef.current) {
      consoleEndRef.current.scrollIntoView({ block: 'end' });
    }
  }, [consoleLogs.length, activeTab]);

  const errorCount = useMemo(() => consoleLogs.filter(l => l.method === 'error').length, [consoleLogs]);
  const warnCount = useMemo(() => consoleLogs.filter(l => l.method === 'warn').length, [consoleLogs]);

  return (
    <div style={styles.container}>
      {/* Tab bar */}
      <div style={styles.tabBar}>
        <button
          onClick={() => setActiveTab('console')}
          style={{
            ...styles.tab,
            ...(activeTab === 'console' ? styles.tabActive : {}),
          }}
        >
          Console
          {errorCount > 0 && <span style={styles.errorBadge}>{errorCount}</span>}
          {warnCount > 0 && <span style={styles.warnBadge}>{warnCount}</span>}
        </button>
        <button
          onClick={() => setActiveTab('network')}
          style={{
            ...styles.tab,
            ...(activeTab === 'network' ? styles.tabActive : {}),
          }}
        >
          Network
          {networkRequests.length > 0 && <span style={styles.countBadge}>{networkRequests.length}</span>}
        </button>
        <div style={styles.tabRight}>
          <button
            onClick={activeTab === 'console' ? onClearConsole : onClearNetwork}
            style={styles.clearBtn}
            title="清空"
          >
            <ClearOutlined style={{ fontSize: 10 }} />
          </button>
        </div>
      </div>

      {/* Content */}
      <div style={styles.content}>
        {activeTab === 'console' ? (
          consoleLogs.length === 0 ? (
            <div style={styles.empty}>暂无日志</div>
          ) : (
            <div style={styles.scrollArea}>
              {consoleLogs.map(entry => (
                <ConsoleLogRow
                  key={entry.id}
                  entry={entry}
                  onSendError={entry.method === 'error' ? onSendError : undefined}
                />
              ))}
              <div ref={consoleEndRef} />
            </div>
          )
        ) : (
          networkRequests.length === 0 ? (
            <div style={styles.empty}>暂无请求</div>
          ) : (
            <div style={styles.scrollArea}>
              {networkRequests.map(req => {
                const isExpanded = expandedRequest === req.id;
                const statusColor = req.status >= 200 && req.status < 300 ? '#22c55e'
                  : req.status >= 400 && req.status < 500 ? '#eab308'
                  : req.status >= 500 ? '#ef4444'
                  : '#64748b';
                return (
                  <div key={req.id}>
                    <div
                      onClick={() => setExpandedRequest(isExpanded ? null : req.id)}
                      style={styles.netRow}
                    >
                      <span style={{ ...styles.netMethod, color: statusColor }}>{req.method}</span>
                      <span style={styles.netUrl}>{req.url}</span>
                      <span style={{ ...styles.netStatus, color: statusColor }}>{req.status}</span>
                      <span style={styles.netDuration}>{req.duration}ms</span>
                    </div>
                    {isExpanded && (
                      <div style={styles.netExpanded}>
                        <div style={styles.netDetail}>
                          <span style={styles.netDetailLabel}>URL:</span> {req.url}
                        </div>
                        <div style={styles.netDetail}>
                          <span style={styles.netDetailLabel}>Status:</span> {req.status}
                        </div>
                        <div style={styles.netDetail}>
                          <span style={styles.netDetailLabel}>Duration:</span> {req.duration}ms
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )
        )}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    borderTop: '1px solid var(--ws-border)',
    background: 'var(--ws-content-bg)',
    flexShrink: 0,
  },
  tabBar: {
    display: 'flex',
    alignItems: 'center',
    height: 28,
    background: 'rgba(255, 255, 255, 0.03)',
    borderBottom: '1px solid var(--ws-border-subtle)',
    padding: '0 8px',
    gap: 2,
  },
  tab: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    padding: '0 10px',
    height: 22,
    border: 'none',
    background: 'transparent',
    color: 'var(--ws-text-secondary)',
    fontSize: 11,
    fontFamily: "'Fira Code', monospace",
    cursor: 'pointer',
    borderRadius: 3,
  },
  tabActive: {
    background: 'var(--ws-border)',
    color: 'var(--ws-text)',
  },
  tabRight: {
    marginLeft: 'auto',
    display: 'flex',
    gap: 4,
  },
  clearBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 18,
    height: 18,
    borderRadius: 3,
    border: 'none',
    background: 'transparent',
    color: 'var(--ws-text-muted)',
    cursor: 'pointer',
    padding: 0,
  },
  errorBadge: {
    fontSize: 9,
    color: '#ef4444',
    background: 'rgba(239, 68, 68, 0.15)',
    padding: '0 4px',
    borderRadius: 3,
    lineHeight: '14px',
  },
  warnBadge: {
    fontSize: 9,
    color: '#eab308',
    background: 'rgba(234, 179, 8, 0.12)',
    padding: '0 4px',
    borderRadius: 3,
    lineHeight: '14px',
  },
  countBadge: {
    fontSize: 9,
    color: 'var(--ws-text-muted)',
    background: 'var(--ws-border-subtle)',
    padding: '0 4px',
    borderRadius: 3,
    lineHeight: '14px',
  },
  content: {
    flex: 1,
    overflow: 'hidden',
  },
  scrollArea: {
    height: '100%',
    overflow: 'auto',
    padding: '4px 0',
  },
  empty: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    fontSize: 11,
    color: 'var(--ws-text-muted)',
    fontStyle: 'italic',
  },
  logRow: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 6,
    padding: '3px 8px',
    fontSize: 11,
    fontFamily: "'Fira Code', monospace",
    lineHeight: '16px',
  },
  logIcon: {
    flexShrink: 0,
    marginTop: 1,
  },
  logText: {
    flex: 1,
    color: 'var(--ws-text)',
    wordBreak: 'break-all',
  },
  fixBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 18,
    height: 18,
    borderRadius: 3,
    border: 'none',
    background: 'rgba(99, 102, 241, 0.15)',
    color: '#818cf8',
    cursor: 'pointer',
    padding: 0,
    flexShrink: 0,
  },
  netRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '3px 8px',
    fontSize: 11,
    fontFamily: "'Fira Code', monospace",
    cursor: 'pointer',
  },
  netMethod: {
    width: 32,
    fontWeight: 600,
    flexShrink: 0,
  },
  netUrl: {
    flex: 1,
    color: 'var(--ws-text)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  netStatus: {
    width: 28,
    textAlign: 'right',
    flexShrink: 0,
  },
  netDuration: {
    width: 44,
    textAlign: 'right',
    color: 'var(--ws-text-muted)',
    flexShrink: 0,
  },
  netExpanded: {
    padding: '4px 8px 4px 48px',
    fontSize: 11,
    fontFamily: "'Fira Code', monospace",
    color: 'var(--ws-text-secondary)',
    background: 'rgba(255, 255, 255, 0.02)',
  },
  netDetail: {
    padding: '1px 0',
  },
  netDetailLabel: {
    color: 'var(--ws-text-muted)',
    marginRight: 6,
  },
};
