import { useState, useEffect, useCallback } from 'react';
import { gitApi } from '../../../api';
import type { GitFileChange, GitCommit } from '../git/gitTypes';

interface AgentGitTabProps {
  repoPath: string | null;
}

interface GitStatusData {
  files: GitFileChange[];
  branch: string;
}

function relativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = Math.max(0, now - then);
  const secs = Math.floor(diff / 1000);
  if (secs < 60) return 'just now';
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

function statusMeta(status: string): { icon: string; color: string } {
  switch (status) {
    case 'M': return { icon: 'edit', color: '#e2a700' };
    case 'A': return { icon: 'add', color: '#30a46c' };
    case 'D': return { icon: 'delete', color: '#e5484d' };
    case 'R': return { icon: 'compare_arrows', color: '#3e63dd' };
    case 'C': return { icon: 'content_copy', color: '#3e63dd' };
    case '?': return { icon: 'help', color: 'var(--md-on-surface-variant)' };
    default:  return { icon: 'circle', color: 'var(--md-on-surface-variant)' };
  }
}

export default function AgentGitTab({ repoPath }: AgentGitTabProps) {
  const [statusData, setStatusData] = useState<GitStatusData | null>(null);
  const [commits, setCommits] = useState<GitCommit[]>([]);
  const [commitMsg, setCommitMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!repoPath) return;
    setLoading(true);
    setError(null);
    try {
      const [s, logData] = await Promise.all([
        gitApi.status(repoPath),
        gitApi.log(repoPath, 5),
      ]);
      const status = s as unknown as { files: GitFileChange[]; branch: string };
      setStatusData({ files: status.files ?? [], branch: status.branch ?? '' });
      const log = logData as unknown as { commits: GitCommit[] };
      setCommits(log.commits ?? []);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, [repoPath]);

  useEffect(() => { load(); }, [load]);

  if (!repoPath) {
    return (
      <div style={styles.empty}>
        <span className="material-symbols-outlined" style={{ fontSize: 32, opacity: 0.4 }}>folder_off</span>
        <span style={styles.emptyText}>No git repository</span>
      </div>
    );
  }

  if (error && !statusData) {
    return (
      <div style={styles.empty}>
        <span className="material-symbols-outlined" style={{ fontSize: 32, opacity: 0.4 }}>error</span>
        <span style={styles.emptyText}>Failed to load git status</span>
        <button style={styles.retryBtn} onClick={load}>Retry</button>
      </div>
    );
  }

  const stagedFiles = statusData?.files.filter(f => f.staged) ?? [];
  const unstagedFiles = statusData?.files.filter(f => !f.staged) ?? [];

  const handleStageAll = async () => {
    if (!repoPath || unstagedFiles.length === 0) return;
    try {
      await gitApi.add(repoPath, unstagedFiles.map(f => f.path));
      await load();
    } catch { /* ignore */ }
  };

  const handleStageFile = async (path: string) => {
    if (!repoPath) return;
    try {
      await gitApi.add(repoPath, [path]);
      await load();
    } catch { /* ignore */ }
  };

  const handleUnstageFile = async (path: string) => {
    if (!repoPath) return;
    try {
      await gitApi.unstage(repoPath, [path]);
      await load();
    } catch { /* ignore */ }
  };

  const handleDiscard = async (path: string) => {
    if (!repoPath) return;
    try {
      await gitApi.restore(repoPath, [path]);
      await load();
    } catch { /* ignore */ }
  };

  const handleCommitAll = async () => {
    if (!repoPath || !commitMsg.trim()) return;
    try {
      await gitApi.add(repoPath, unstagedFiles.map(f => f.path));
      await gitApi.commit(repoPath, commitMsg.trim());
      setCommitMsg('');
      await load();
    } catch { /* ignore */ }
  };

  const handleFetch = async () => {
    if (!repoPath) return;
    try {
      await gitApi.fetch(repoPath);
      await load();
    } catch { /* ignore */ }
  };

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <div style={styles.branchRow}>
          <span className="material-symbols-outlined" style={{ fontSize: 16, color: 'var(--md-primary)' }}>account_tree</span>
          <span style={styles.branchName}>{statusData?.branch || '...'}</span>
        </div>
        <div style={{ display: 'flex', gap: 2 }}>
          <button style={styles.iconBtn} title="Fetch" onClick={handleFetch}>
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>cloud_sync</span>
          </button>
          <button style={styles.iconBtn} title="Refresh" onClick={load}>
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>refresh</span>
          </button>
        </div>
      </div>

      {/* Commit area */}
      {unstagedFiles.length > 0 && (
        <div style={styles.commitArea}>
          <input
            value={commitMsg}
            onChange={e => setCommitMsg(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleCommitAll(); } }}
            placeholder="Commit message..."
            style={styles.commitInput}
          />
          <button
            style={{
              ...styles.commitBtn,
              opacity: commitMsg.trim() ? 1 : 0.5,
            }}
            disabled={!commitMsg.trim() || loading}
            onClick={handleCommitAll}
          >
            Commit All
          </button>
        </div>
      )}

      {/* Scrollable file list + commits */}
      <div style={styles.scrollArea}>
        {/* Staged files */}
        {stagedFiles.length > 0 && (
          <div style={styles.section}>
            <div style={styles.sectionHeader}>
              <span style={styles.sectionTitle}>Staged</span>
              <span style={styles.sectionCount}>{stagedFiles.length}</span>
            </div>
            {stagedFiles.map(f => {
              const { icon, color } = statusMeta(f.status);
              return (
                <div key={`s-${f.path}`} style={styles.fileRow}>
                  <span className="material-symbols-outlined" style={{ fontSize: 14, color, flexShrink: 0 }}>{icon}</span>
                  <span style={styles.filePath} title={f.path}>{f.path}</span>
                  <button style={styles.actionBtn} title="Unstage" onClick={() => handleUnstageFile(f.path)}>
                    <span className="material-symbols-outlined" style={{ fontSize: 14 }}>remove</span>
                  </button>
                </div>
              );
            })}
            <button style={styles.stageAllBtn} onClick={handleStageAll}>
              <span className="material-symbols-outlined" style={{ fontSize: 13 }}>select_all</span>
              Stage all
            </button>
          </div>
        )}

        {/* Unstaged / Changes */}
        {unstagedFiles.length > 0 && (
          <div style={styles.section}>
            <div style={styles.sectionHeader}>
              <span style={styles.sectionTitle}>Changes</span>
              <span style={styles.sectionCount}>{unstagedFiles.length}</span>
            </div>
            {unstagedFiles.map(f => {
              const { icon, color } = statusMeta(f.status);
              return (
                <div key={`u-${f.path}`} style={styles.fileRow}>
                  <span className="material-symbols-outlined" style={{ fontSize: 14, color, flexShrink: 0 }}>{icon}</span>
                  <span style={styles.filePath} title={f.path}>{f.path}</span>
                  <button style={styles.actionBtn} title="Stage" onClick={() => handleStageFile(f.path)}>
                    <span className="material-symbols-outlined" style={{ fontSize: 14 }}>add</span>
                  </button>
                  <button style={styles.actionBtn} title="Discard" onClick={() => handleDiscard(f.path)}>
                    <span className="material-symbols-outlined" style={{ fontSize: 14 }}>undo</span>
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* Empty state */}
        {stagedFiles.length === 0 && unstagedFiles.length === 0 && (
          <div style={styles.cleanState}>
            <span className="material-symbols-outlined" style={{ fontSize: 20, opacity: 0.35 }}>check_circle</span>
            <span style={{ fontSize: 12, color: 'var(--md-on-surface-variant)', opacity: 0.6 }}>Working tree clean</span>
          </div>
        )}

        {/* Recent commits */}
        {commits.length > 0 && (
          <div style={styles.section}>
            <div style={styles.sectionHeader}>
              <span style={styles.sectionTitle}>Recent</span>
            </div>
            {commits.map(c => (
              <div key={c.hash} style={styles.commitRow}>
                <span style={styles.commitHash}>{c.shortHash}</span>
                <span style={styles.commitMsg} title={c.message}>{c.message}</span>
                <span style={styles.commitTime}>{relativeTime(c.date)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {loading && (
        <div style={styles.loadingOverlay}>
          <span className="material-symbols-outlined" style={{ fontSize: 16, animation: 'spin 1s linear infinite' }}>progress_activity</span>
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    fontFamily: 'var(--font-sans)',
    fontSize: 12,
    color: 'var(--md-on-surface)',
    position: 'relative',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '8px 12px',
    borderBottom: '1px solid var(--md-outline-variant)',
    flexShrink: 0,
  },
  branchRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    minWidth: 0,
  },
  branchName: {
    fontWeight: 600,
    fontSize: 13,
    fontFamily: 'var(--font-mono)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  iconBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: 'none',
    background: 'transparent',
    color: 'var(--md-on-surface-variant)',
    cursor: 'pointer',
    padding: 4,
    borderRadius: 6,
    transition: 'color 0.15s',
  },
  commitArea: {
    display: 'flex',
    gap: 6,
    padding: '8px 12px',
    borderBottom: '1px solid var(--md-outline-variant)',
    flexShrink: 0,
  },
  commitInput: {
    flex: 1,
    minWidth: 0,
    padding: '5px 8px',
    fontSize: 12,
    fontFamily: 'var(--font-sans)',
    background: 'var(--md-surface-container)',
    color: 'var(--md-on-surface)',
    border: '1px solid var(--md-outline-variant)',
    borderRadius: 6,
    outline: 'none',
  },
  commitBtn: {
    padding: '5px 10px',
    fontSize: 11,
    fontWeight: 600,
    fontFamily: 'var(--font-sans)',
    color: 'var(--md-on-primary)',
    background: 'var(--md-primary)',
    border: 'none',
    borderRadius: 6,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    flexShrink: 0,
    transition: 'opacity 0.15s',
  },
  scrollArea: {
    flex: 1,
    overflowY: 'auto',
    minHeight: 0,
  },
  section: {
    borderBottom: '1px solid var(--md-outline-variant)',
  },
  sectionHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '6px 12px',
    background: 'var(--md-surface-container-low)',
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: 600,
    color: 'var(--md-on-surface-variant)',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
  },
  sectionCount: {
    fontSize: 10,
    fontWeight: 600,
    color: 'var(--md-on-surface-variant)',
    background: 'var(--md-surface-container)',
    borderRadius: 8,
    padding: '0 5px',
    lineHeight: '16px',
  },
  fileRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '4px 12px',
    transition: 'background 0.1s',
  },
  filePath: {
    flex: 1,
    minWidth: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    fontFamily: 'var(--font-mono)',
    fontSize: 11,
  },
  actionBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: 'none',
    background: 'transparent',
    color: 'var(--md-on-surface-variant)',
    cursor: 'pointer',
    padding: 2,
    borderRadius: 4,
    flexShrink: 0,
    transition: 'color 0.15s',
  },
  stageAllBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    padding: '4px 12px',
    fontSize: 11,
    color: 'var(--md-primary)',
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    fontFamily: 'var(--font-sans)',
  },
  cleanState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 4,
    padding: '24px 12px',
  },
  commitRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '4px 12px',
  },
  commitHash: {
    fontFamily: 'var(--font-mono)',
    fontSize: 11,
    color: 'var(--md-primary)',
    flexShrink: 0,
  },
  commitMsg: {
    flex: 1,
    minWidth: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    fontSize: 11,
    color: 'var(--md-on-surface)',
  },
  commitTime: {
    fontSize: 10,
    color: 'var(--md-on-surface-variant)',
    flexShrink: 0,
    whiteSpace: 'nowrap',
  },
  empty: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: '100%',
    color: 'var(--md-on-surface-variant)',
    fontFamily: 'var(--font-sans)',
  },
  emptyText: {
    fontSize: 12,
    opacity: 0.7,
  },
  retryBtn: {
    padding: '4px 12px',
    fontSize: 11,
    fontFamily: 'var(--font-sans)',
    color: 'var(--md-primary)',
    background: 'var(--md-primary-container)',
    border: 'none',
    borderRadius: 6,
    cursor: 'pointer',
    marginTop: 4,
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    padding: 8,
    display: 'flex',
    alignItems: 'center',
    color: 'var(--md-on-surface-variant)',
    pointerEvents: 'none',
  },
};
