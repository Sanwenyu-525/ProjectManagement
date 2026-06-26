import { useState, useCallback, useMemo, useRef } from 'react';
import { useAgentContextStore } from '../../../stores/agentContextStore';

const QUERY_ICONS: Record<string, string> = {
  impact: 'hub',
  deps: 'account_tree',
  layers: 'layers',
};

const QUERY_LABELS: Record<string, string> = {
  impact: '影响分析',
  deps: '依赖链',
  layers: '架构分层',
};

export default function AgentGraphPanel() {
  const [filePath, setFilePath] = useState('');
  const [lastQuery, setLastQuery] = useState<string | null>(null);
  const graphInputRef = useRef<HTMLInputElement>(null);

  const sessionContext = useAgentContextStore(s => {
    // Get the most recent session's context
    const keys = Object.keys(s.contexts);
    if (keys.length === 0) return undefined;
    return s.contexts[keys[keys.length - 1]];
  });

  const graphQueries = useMemo(() => sessionContext?.graphQueries ?? [], [sessionContext?.graphQueries]);
  const impactWarnings = useMemo(() => sessionContext?.impactWarnings ?? [], [sessionContext?.impactWarnings]);

  const dispatch = useCallback((text: string) => {
    setLastQuery(text);
    window.dispatchEvent(new CustomEvent('agentQuickCommand', { detail: text }));
    setFilePath('');
  }, []);

  const handleLayers = useCallback(() => dispatch('/graph layers'), [dispatch]);

  const handleFileAction = useCallback((subCmd: string) => {
    if (filePath.trim()) {
      dispatch(`/graph ${subCmd} ${filePath.trim()}`);
    } else {
      // Focus input to hint user
      graphInputRef.current?.focus();
      graphInputRef.current?.select();
    }
  }, [filePath, dispatch]);

  return (
    <div style={styles.container}>
      {/* Quick actions */}
      <div style={styles.section}>
        <div style={styles.sectionHeader}>
          <span className="material-symbols-outlined" style={{ fontSize: 13, color: 'var(--md-primary)' }}>
            hub
          </span>
          <span style={styles.sectionLabel}>快速查询</span>
        </div>

        <div style={styles.buttonRow}>
          <button onClick={handleLayers} style={styles.btn} title="查询架构分层">
            <span className="material-symbols-outlined" style={{ fontSize: 14 }}>layers</span>
            Layers
          </button>
          <button
            onClick={() => handleFileAction('impact')}
            style={styles.btn}
            title="查询文件影响范围"
          >
            <span className="material-symbols-outlined" style={{ fontSize: 14 }}>hub</span>
            Impact
          </button>
          <button
            onClick={() => handleFileAction('deps')}
            style={styles.btn}
            title="查询依赖链"
          >
            <span className="material-symbols-outlined" style={{ fontSize: 14 }}>account_tree</span>
            Deps
          </button>
        </div>

        {/* File path input */}
        <div style={styles.inputRow}>
          <span className="material-symbols-outlined" style={{ fontSize: 13, color: 'var(--md-outline)' }}>
            description
          </span>
          <input
            ref={graphInputRef}
            data-graph-input
            value={filePath}
            onChange={e => setFilePath(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && filePath.trim()) {
                handleFileAction('impact');
              }
            }}
            placeholder="文件路径 (如 src/index.ts)"
            style={styles.input}
          />
        </div>

        {lastQuery && (
          <div style={styles.lastQuery}>
            <span style={{ fontSize: 10, color: 'var(--md-on-surface-variant)', fontFamily: 'var(--font-mono)' }}>
              {lastQuery}
            </span>
          </div>
        )}
      </div>

      {/* Query history */}
      {graphQueries.length > 0 && (
        <div style={styles.section}>
          <div style={styles.sectionHeader}>
            <span className="material-symbols-outlined" style={{ fontSize: 13, color: 'var(--md-tertiary)' }}>
              history
            </span>
            <span style={styles.sectionLabel}>查询历史</span>
            <span style={styles.count}>{graphQueries.length}</span>
          </div>
          {graphQueries.slice(-5).reverse().map((q, i) => (
            <div key={i} style={styles.historyItem}>
              <span className="material-symbols-outlined" style={{ fontSize: 12, color: 'var(--md-primary)' }}>
                {QUERY_ICONS[q.queryType] ?? 'help'}
              </span>
              <span style={styles.historyTarget}>{q.target}</span>
              <span style={styles.historyType}>{QUERY_LABELS[q.queryType] ?? q.queryType}</span>
            </div>
          ))}
        </div>
      )}

      {/* Impact warnings */}
      {impactWarnings.length > 0 && (
        <div style={styles.section}>
          <div style={styles.sectionHeader}>
            <span className="material-symbols-outlined" style={{ fontSize: 13, color: 'var(--md-error)' }}>
              warning
            </span>
            <span style={styles.sectionLabel}>影响警告</span>
            <span style={styles.count}>{impactWarnings.length}</span>
          </div>
          {impactWarnings.slice(-3).reverse().map((w, i) => (
            <div key={i} style={styles.warningItem}>
              <span className="material-symbols-outlined" style={{ fontSize: 12, color: 'var(--md-error)' }}>
                warning
              </span>
              <div style={styles.warningContent}>
                <span style={styles.warningFile}>{w.file.split(/[/\\]/).pop()}</span>
                <span style={styles.warningCount}>{w.impactCount} 个文件受影响</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {graphQueries.length === 0 && impactWarnings.length === 0 && (
        <div style={styles.empty}>
          <span className="material-symbols-outlined" style={{ fontSize: 24, color: 'var(--md-outline-variant)', opacity: 0.5 }}>
            hub
          </span>
          <p style={styles.emptyText}>选择文件后点击 Impact 或 Deps 查询依赖关系。</p>
          <p style={styles.emptyHint}>Layers 可直接查询架构分层。</p>
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    flex: 1,
    overflowY: 'auto',
    gap: 0,
  },
  section: {
    padding: '8px 12px',
    borderBottom: '1px solid var(--border)',
  },
  sectionHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 5,
    marginBottom: 8,
  },
  sectionLabel: {
    fontSize: 10,
    fontWeight: 700,
    color: 'var(--md-on-surface-variant)',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.04em',
    fontFamily: 'var(--font-sans)',
    flex: 1,
  },
  count: {
    fontSize: 10,
    color: 'var(--md-on-surface-variant)',
    fontFamily: 'var(--font-mono)',
  },
  buttonRow: {
    display: 'flex',
    gap: 6,
    marginBottom: 8,
  },
  btn: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    padding: '5px 10px',
    borderRadius: 6,
    border: '1px solid var(--border)',
    background: 'var(--md-surface-container)',
    color: 'var(--md-on-surface)',
    fontSize: 11,
    fontWeight: 600,
    fontFamily: 'var(--font-sans)',
    cursor: 'pointer',
    transition: 'all 0.15s',
    flex: 1,
    justifyContent: 'center',
  },
  inputRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '4px 8px',
    borderRadius: 6,
    border: '1px solid var(--border)',
    background: 'var(--md-surface-container-low)',
  },
  input: {
    flex: 1,
    border: 'none',
    background: 'transparent',
    outline: 'none',
    fontSize: 11,
    fontFamily: 'var(--font-mono)',
    color: 'var(--md-on-surface)',
    padding: '2px 0',
  },
  lastQuery: {
    marginTop: 6,
    padding: '3px 6px',
    borderRadius: 4,
    background: 'var(--md-surface-container)',
  },
  historyItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '3px 0',
  },
  historyTarget: {
    fontSize: 11,
    fontFamily: 'var(--font-mono)',
    color: 'var(--md-on-surface)',
    flex: 1,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  historyType: {
    fontSize: 9,
    color: 'var(--md-on-surface-variant)',
    fontFamily: 'var(--font-sans)',
    flexShrink: 0,
  },
  warningItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '4px 0',
  },
  warningContent: {
    display: 'flex',
    flexDirection: 'column',
    gap: 1,
    flex: 1,
    minWidth: 0,
  },
  warningFile: {
    fontSize: 11,
    fontFamily: 'var(--font-mono)',
    color: 'var(--md-on-surface)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  warningCount: {
    fontSize: 9,
    color: 'var(--md-error)',
    fontWeight: 600,
    fontFamily: 'var(--font-sans)',
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
  emptyHint: {
    margin: 0,
    fontSize: 10,
    color: 'var(--md-outline)',
    textAlign: 'center',
    fontFamily: 'var(--font-sans)',
  },
};
