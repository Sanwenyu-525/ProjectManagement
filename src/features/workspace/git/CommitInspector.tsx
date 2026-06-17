import type { GitCommit } from './gitTypes';

interface CommitInspectorProps {
  commit: GitCommit | null;
  diffSummary?: { additions: number; deletions: number } | null;
  onRevert?: (hash: string) => void;
}

export default function CommitInspector({ commit, diffSummary, onRevert }: CommitInspectorProps) {
  if (!commit) {
    return (
      <div style={panelStyle}>
        <div style={{ color: 'var(--md-on-surface-variant)', fontSize: 'var(--text-sm)', textAlign: 'center', padding: 40 }}>
          选择一个提交查看详情
        </div>
      </div>
    );
  }

  return (
    <div style={{ ...panelStyle, gap: 16 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <h2 style={{ margin: 0, fontFamily: 'var(--font-sans)', fontSize: 'var(--text-lg)', fontWeight: 600, color: 'var(--md-on-surface)' }}>
          提交详情
        </h2>
        <span style={{
          fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)',
          color: 'var(--md-primary)', background: 'rgba(0,107,95,0.08)',
          padding: '4px 8px', borderRadius: 'var(--radius-xs)',
          border: '1px solid rgba(0,107,95,0.15)',
        }}>
          {commit.shortHash}
        </span>
      </div>

      {/* Author */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 4 }}>
        <div style={{
          width: 40, height: 40, borderRadius: '50%',
          background: 'var(--md-primary-container)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'var(--md-on-primary-container)', fontSize: 16, fontWeight: 700,
          border: '2px solid var(--md-surface-container-high)',
        }}>
          {commit.author?.[0]?.toUpperCase() || '?'}
        </div>
        <div>
          <div style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-base)', fontWeight: 600, color: 'var(--md-on-surface)' }}>
            {commit.author}
          </div>
          <div style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', color: 'var(--md-on-surface-variant)' }}>
            {commit.date}
          </div>
        </div>
      </div>

      {/* Message */}
      <div style={{
        padding: 12, borderRadius: 'var(--radius-sm)',
        background: 'var(--md-surface-container-low)',
        border: '1px solid rgba(187,202,198,0.5)',
      }}>
        <pre style={{
          margin: 0, fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)',
          color: 'var(--md-on-surface)', whiteSpace: 'pre-wrap', lineHeight: 1.5,
        }}>
          {commit.message}
        </pre>
      </div>

      {/* Diff summary */}
      {diffSummary && (
        <div style={{ display: 'flex', gap: 12, fontSize: 'var(--text-xs)', fontFamily: 'var(--font-mono)' }}>
          {diffSummary.additions > 0 && (
            <span style={{ color: 'var(--color-tertiary)' }}>+{diffSummary.additions}</span>
          )}
          {diffSummary.deletions > 0 && (
            <span style={{ color: 'var(--md-error)' }}>-{diffSummary.deletions}</span>
          )}
        </div>
      )}

      {/* Branches */}
      {commit.branches && commit.branches.length > 0 && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {commit.branches.map((b) => (
            <span key={b} style={{
              padding: '2px 8px', fontSize: 'var(--text-xs)', fontFamily: 'var(--font-label)',
              borderRadius: 'var(--radius-xs)',
              border: `1px solid ${b === 'HEAD' ? 'var(--md-primary)' : 'var(--md-outline-variant)'}`,
              color: b === 'HEAD' ? 'var(--md-primary)' : 'var(--md-on-surface-variant)',
              background: b === 'HEAD' ? 'rgba(0,107,95,0.08)' : 'transparent',
            }}>
              {b}
            </span>
          ))}
        </div>
      )}

      {/* Actions */}
      <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
        <button
          onClick={() => navigator.clipboard?.writeText(commit.hash)}
          style={{
            flex: 1, padding: '6px 0', borderRadius: 'var(--radius-sm)',
            background: 'var(--md-surface-container)',
            border: '1px solid var(--md-outline-variant)',
            color: 'var(--md-on-surface)', fontFamily: 'var(--font-label)',
            fontSize: 'var(--text-xs)', fontWeight: 500, cursor: 'pointer',
            transition: 'background var(--transition-fast)',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--md-surface-container-high)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--md-surface-container)'; }}
        >
          复制哈希
        </button>
        <button
          onClick={() => onRevert?.(commit.hash)}
          style={{
            flex: 1, padding: '6px 0', borderRadius: 'var(--radius-sm)',
            background: 'var(--md-surface-container)',
            border: '1px solid var(--md-outline-variant)',
            color: 'var(--md-error)', fontFamily: 'var(--font-label)',
            fontSize: 'var(--text-xs)', fontWeight: 500, cursor: 'pointer',
            transition: 'all var(--transition-fast)',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = 'rgba(186,26,26,0.3)';
            e.currentTarget.style.color = 'var(--md-error)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = 'var(--md-outline-variant)';
            e.currentTarget.style.color = 'var(--md-error)';
          }}
        >
          回退
        </button>
      </div>
    </div>
  );
}

const panelStyle: React.CSSProperties = {
  background: 'var(--md-surface-container-lowest)',
  borderRadius: 'var(--radius-sm)',
  border: '1px solid var(--md-outline-variant)',
  boxShadow: 'var(--shadow-sm)',
  padding: 16,
  display: 'flex',
  flexDirection: 'column',
};
