import { useMemo } from 'react';
import { useAgentContextStore } from '../../../stores/agentContextStore';
import type { FileOperation } from '../../../stores/agentContextStore';

interface AgentContextPanelProps {
  sessionId: string | null;
  cwd?: string;
}

const OP_CONFIG: Record<FileOperation, { icon: string; color: string; label: string }> = {
  read: { icon: 'description', color: 'var(--md-primary)', label: '读' },
  write: { icon: 'save', color: 'var(--md-secondary)', label: '写' },
  edit: { icon: 'edit_note', color: 'var(--md-tertiary)', label: '改' },
  search: { icon: 'search', color: 'var(--md-outline)', label: '搜' },
};

export default function AgentContextPanel({ sessionId, cwd }: AgentContextPanelProps) {
  // Subscribe to this session's context slice only
  const sessionContext = useAgentContextStore(s => sessionId ? s.contexts[sessionId] : undefined);
  const sessionFiles = sessionContext?.files;
  const displayFiles = useMemo(
    () => (sessionFiles ? Object.values(sessionFiles).sort((a, b) => b.lastAccessed - a.lastAccessed) : []),
    [sessionFiles],
  );
  const sessionGraphQueries = sessionContext?.graphQueries;
  const graphQueries = useMemo(
    () => sessionGraphQueries ?? [],
    [sessionGraphQueries],
  );
  const sessionImpactWarnings = sessionContext?.impactWarnings;
  const impactWarnings = useMemo(
    () => sessionImpactWarnings ?? [],
    [sessionImpactWarnings],
  );

  // Group files by primary operation
  const grouped = useMemo(() => {
    const groups: Record<string, typeof displayFiles> = { read: [], write: [], edit: [], search: [] };
    for (const f of displayFiles) {
      const primary = f.operations.length > 0 ? f.operations[f.operations.length - 1] : 'read';
      (groups[primary] ?? (groups[primary] = [])).push(f);
    }
    return groups;
  }, [displayFiles]);

  if (!sessionId) {
    return (
      <div style={styles.empty}>
        <span className="material-symbols-outlined" style={{ fontSize: 28, color: 'var(--md-outline-variant)', opacity: 0.6 }}>
          folder_open
        </span>
        <p style={styles.emptyText}>启动会话后查看 agent 引用的文件。</p>
      </div>
    );
  }

  if (displayFiles.length === 0 && graphQueries.length === 0 && impactWarnings.length === 0) {
    return (
      <div style={styles.empty}>
        <span className="material-symbols-outlined" style={{ fontSize: 28, color: 'var(--md-outline-variant)', opacity: 0.6 }}>
          folder_open
        </span>
        <p style={styles.emptyText}>开始对话后，agent 引用的文件和图谱查询会显示在这里。</p>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      {/* Summary */}
      <div style={styles.summary}>
        <span style={styles.summaryCount}>{displayFiles.length}</span>
        <span style={styles.summaryLabel}>个文件被引用</span>
      </div>

      {/* File list grouped by operation */}
      {(Object.keys(OP_CONFIG) as FileOperation[]).map(op => {
        const groupFiles = grouped[op];
        if (!groupFiles || groupFiles.length === 0) return null;
        const config = OP_CONFIG[op];
        return (
          <div key={op} style={styles.group}>
            <div style={styles.groupHeader}>
              <span className="material-symbols-outlined" style={{ fontSize: 13, color: config.color }}>
                {config.icon}
              </span>
              <span style={styles.groupLabel}>{config.label}取</span>
              <span style={styles.groupCount}>{groupFiles.length}</span>
            </div>
            {groupFiles.map(f => (
              <div key={f.path} style={styles.fileItem} title={f.path}>
                <span style={styles.fileName}>{getShortPath(f.path, cwd)}</span>
                <div style={styles.fileBadges}>
                  {f.operations.map(op2 => (
                    <span key={op2} style={{
                      ...styles.opBadge,
                      background: OP_CONFIG[op2]?.color ?? 'var(--md-outline)',
                    }}>
                      {OP_CONFIG[op2]?.label ?? op2}
                    </span>
                  ))}
                  {f.accessCount > 1 && (
                    <span style={styles.countBadge}>{f.accessCount}x</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        );
      })}

      {/* Graph query history */}
      {graphQueries.length > 0 && (
        <div style={styles.group}>
          <div style={styles.groupHeader}>
            <span className="material-symbols-outlined" style={{ fontSize: 13, color: 'var(--md-tertiary)' }}>
              hub
            </span>
            <span style={styles.groupLabel}>图谱查询</span>
            <span style={styles.groupCount}>{graphQueries.length}</span>
          </div>
          {graphQueries.map((q, i) => (
            <div key={i} style={styles.fileItem}>
              <span className="material-symbols-outlined" style={{ fontSize: 12, color: GRAPH_ICONS[q.queryType] ?? 'var(--md-outline)', flexShrink: 0 }}>
                {GRAPH_ICONS[q.queryType] ?? 'help'}
              </span>
              <span style={styles.fileName}>{q.target}</span>
              <span style={{ fontSize: 9, color: 'var(--md-on-surface-variant)', fontFamily: 'var(--font-sans)', flexShrink: 0 }}>
                {q.queryType}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Impact warnings */}
      {impactWarnings.length > 0 && (
        <div style={styles.group}>
          <div style={styles.groupHeader}>
            <span className="material-symbols-outlined" style={{ fontSize: 13, color: 'var(--md-error)' }}>
              warning
            </span>
            <span style={styles.groupLabel}>影响警告</span>
            <span style={styles.groupCount}>{impactWarnings.length}</span>
          </div>
          {impactWarnings.map((w, i) => (
            <div key={i} style={styles.fileItem} title={w.summary}>
              <span className="material-symbols-outlined" style={{ fontSize: 12, color: 'var(--md-error)', flexShrink: 0 }}>
                warning
              </span>
              <span style={styles.fileName}>{getShortPath(w.file, cwd)}</span>
              <span style={{ fontSize: 9, color: 'var(--md-error)', fontFamily: 'var(--font-mono)', fontWeight: 600, flexShrink: 0 }}>
                {w.impactCount} files
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** Shorten a file path relative to cwd */
function getShortPath(path: string, cwd?: string): string {
  if (cwd && path.startsWith(cwd)) {
    const rel = path.slice(cwd.length).replace(/^[/\\]+/, '');
    if (rel) return rel;
  }
  const parts = path.split(/[/\\]/);
  return parts.length > 2 ? parts.slice(-2).join('/') : path;
}

const GRAPH_ICONS: Record<string, string> = {
  impact: 'hub',
  deps: 'account_tree',
  layers: 'layers',
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    flex: 1,
    overflowY: 'auto',
    padding: 0,
  },
  empty: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    padding: '32px 16px',
  },
  emptyText: {
    margin: 0,
    fontSize: 12,
    color: 'var(--md-on-surface-variant)',
    textAlign: 'center',
    fontFamily: 'var(--font-sans)',
  },
  summary: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    padding: '8px 12px',
    borderBottom: '1px solid var(--border)',
    fontSize: 11,
    color: 'var(--md-on-surface-variant)',
    fontFamily: 'var(--font-sans)',
  },
  summaryCount: {
    fontWeight: 700,
    color: 'var(--md-primary)',
    fontSize: 13,
    fontFamily: 'var(--font-mono)',
  },
  summaryLabel: {
    fontSize: 11,
  },
  group: {
    padding: '6px 0',
    borderBottom: '1px solid var(--border)',
  },
  groupHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 5,
    padding: '3px 12px 5px',
  },
  groupLabel: {
    fontSize: 10,
    fontWeight: 600,
    color: 'var(--md-on-surface-variant)',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    fontFamily: 'var(--font-sans)',
  },
  groupCount: {
    fontSize: 10,
    color: 'var(--md-on-surface-variant)',
    fontFamily: 'var(--font-mono)',
    marginLeft: 'auto',
  },
  fileItem: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '3px 12px 3px 24px',
    gap: 8,
  },
  fileName: {
    fontSize: 11,
    fontFamily: 'var(--font-mono)',
    color: 'var(--md-on-surface)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    flex: 1,
    minWidth: 0,
  },
  fileBadges: {
    display: 'flex',
    alignItems: 'center',
    gap: 3,
    flexShrink: 0,
  },
  opBadge: {
    fontSize: 8,
    fontWeight: 700,
    color: '#fff',
    padding: '0 4px',
    borderRadius: 3,
    lineHeight: '14px',
    letterSpacing: '0.02em',
    fontFamily: 'var(--font-sans)',
  },
  countBadge: {
    fontSize: 9,
    fontWeight: 500,
    color: 'var(--md-on-surface-variant)',
    fontFamily: 'var(--font-mono)',
    opacity: 0.7,
  },
};
