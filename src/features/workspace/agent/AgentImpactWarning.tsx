import { useState } from 'react';

interface AgentImpactWarningProps {
  file: string;
  impactCount: number;
  directCount: number;
  indirectCount: number;
  summary: string;
  onDismiss: () => void;
}

export default function AgentImpactWarning({
  file,
  impactCount,
  directCount,
  indirectCount,
  summary,
  onDismiss,
}: AgentImpactWarningProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div style={styles.banner}>
      <div style={styles.header}>
        <span className="material-symbols-outlined" style={{ fontSize: 16, color: 'var(--md-error)' }}>
          warning
        </span>
        <span style={styles.title}>高影响文件变更</span>
        <button onClick={onDismiss} style={styles.dismissBtn}>
          <span className="material-symbols-outlined" style={{ fontSize: 14 }}>close</span>
        </button>
      </div>
      <p style={styles.summary}>{summary}</p>
      <div style={styles.actions}>
        <button onClick={() => setExpanded(!expanded)} style={styles.detailBtn}>
          {expanded ? '收起' : '查看详情'}
        </button>
      </div>
      {expanded && (
        <div style={styles.details}>
          <div style={styles.detailRow}>
            <span style={styles.detailLabel}>直接影响</span>
            <span style={styles.detailValue}>{directCount} 个文件</span>
          </div>
          <div style={styles.detailRow}>
            <span style={styles.detailLabel}>间接影响</span>
            <span style={styles.detailValue}>{indirectCount} 个文件</span>
          </div>
          <div style={styles.detailRow}>
            <span style={styles.detailLabel}>总计影响</span>
            <span style={{ ...styles.detailValue, color: 'var(--md-error)' }}>{impactCount} 个文件</span>
          </div>
          <div style={styles.detailRow}>
            <span style={styles.detailLabel}>文件路径</span>
            <span style={{ ...styles.detailValue, fontFamily: 'var(--font-mono)', fontSize: 10 }}>{file}</span>
          </div>
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  banner: {
    background: 'var(--md-error-container)',
    border: '1px solid var(--md-error)',
    borderRadius: 8,
    padding: '8px 12px',
    margin: '4px 0',
    fontSize: 12,
    fontFamily: 'var(--font-sans)',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  title: {
    fontWeight: 600,
    color: 'var(--md-error)',
    flex: 1,
  },
  dismissBtn: {
    background: 'none',
    border: 'none',
    padding: 2,
    cursor: 'pointer',
    color: 'var(--md-on-error-container)',
    display: 'flex',
    borderRadius: 4,
  },
  summary: {
    margin: 0,
    color: 'var(--md-on-error-container)',
    fontSize: 11,
    lineHeight: 1.4,
  },
  actions: {
    marginTop: 6,
    display: 'flex',
    gap: 8,
  },
  detailBtn: {
    background: 'none',
    border: '1px solid var(--md-outline)',
    borderRadius: 4,
    padding: '2px 8px',
    fontSize: 10,
    color: 'var(--md-on-error-container)',
    cursor: 'pointer',
    fontFamily: 'var(--font-sans)',
  },
  details: {
    marginTop: 8,
    paddingTop: 8,
    borderTop: '1px solid var(--md-outline-variant)',
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  detailRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  detailLabel: {
    fontSize: 10,
    color: 'var(--md-on-error-container)',
    opacity: 0.7,
  },
  detailValue: {
    fontSize: 11,
    fontWeight: 600,
    color: 'var(--md-on-error-container)',
  },
};
