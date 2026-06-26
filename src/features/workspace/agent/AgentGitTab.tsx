import { useState, useEffect, useCallback, useRef } from 'react';
import { message, Modal } from 'antd';
import { ExclamationCircleOutlined } from '@ant-design/icons';
import { gitApi } from '../../../api';
import type { GitLogResult } from '../../../types';

interface GitFileChange {
  path: string;
  status: 'M' | 'A' | 'D' | 'R' | 'C' | '?';
  staged: boolean;
}

interface GitCommit {
  hash: string;
  shortHash: string;
  message: string;
  author: string;
  date: string;
  branches?: string[];
  parents: string[];
  branchIdx: number;
}

interface AgentGitTabProps {
  repoPath: string | null;
}

interface GitStatusData {
  files: GitFileChange[];
  branch: string;
}

// ── Helpers ──────────────────────────────────────────────────────

import { formatRelativeTime as relativeTime } from '@/lib/format';

/** Status → display metadata. Uses semantic color tokens for consistency */
function statusMeta(status: string): { icon: string; color: string; bg: string; label: string } {
  switch (status) {
    case 'M': return { icon: 'edit', color: 'var(--color-amber)', bg: 'var(--color-amber-light)', label: '修改' };
    case 'A': return { icon: 'add_circle', color: 'var(--md-tertiary)', bg: 'var(--color-tertiary-light)', label: '新增' };
    case 'D': return { icon: 'remove_circle', color: 'var(--md-error)', bg: 'var(--color-error-light)', label: '删除' };
    case 'R': return { icon: 'compare_arrows', color: 'var(--md-secondary)', bg: 'color-mix(in srgb, var(--md-secondary) 12%, transparent)', label: '重命名' };
    case 'C': return { icon: 'content_copy', color: 'var(--md-secondary)', bg: 'color-mix(in srgb, var(--md-secondary) 12%, transparent)', label: '复制' };
    case '?': return { icon: 'help_circle', color: 'var(--md-outline)', bg: 'var(--md-surface-container-low)', label: '未跟踪' };
    default:  return { icon: 'circle', color: 'var(--md-on-surface-variant)', bg: 'transparent', label: '未知' };
  }
}

function mapStatus(raw: string): GitFileChange['status'] {
  switch (raw) {
    case 'Modified': return 'M';
    case 'Added': return 'A';
    case 'Deleted': return 'D';
    case 'Renamed': return 'R';
    case 'Copied': return 'C';
    case 'Untracked': return '?';
    default: return 'M';
  }
}

/** Group files by parent directory */
function groupByDir(files: GitFileChange[]): Map<string, GitFileChange[]> {
  const groups = new Map<string, GitFileChange[]>();
  for (const f of files) {
    const parts = f.path.replace(/\\/g, '/').split('/');
    const dir = parts.length > 1 ? parts.slice(0, -1).join('/') : '.';
    const arr = groups.get(dir) ?? [];
    arr.push(f);
    groups.set(dir, arr);
  }
  return groups;
}

// ── Component ──────────────────────────────────────────────────

export default function AgentGitTab({ repoPath }: AgentGitTabProps) {
  const [statusData, setStatusData] = useState<GitStatusData | null>(null);
  const [commits, setCommits] = useState<GitCommit[]>([]);
  const [commitMsg, setCommitMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Diff state
  const [expandedFile, setExpandedFile] = useState<string | null>(null);
  const expandedFileRef = useRef<string | null>(null);
  const [diffContent, setDiffContent] = useState<string>('');
  const [diffLoading, setDiffLoading] = useState(false);

  // Collapsed directory groups
  const [collapsedDirs, setCollapsedDirs] = useState<Set<string>>(new Set());
  const [hoveredFile, setHoveredFile] = useState<string | null>(null);

  const loadIdRef = useRef(0);

  const load = useCallback(async () => {
    if (!repoPath) return;
    const loadId = ++loadIdRef.current;
    setLoading(true);
    setError(null);
    try {
      const [statusResult, logData] = await Promise.all([
        gitApi.status(repoPath),
        gitApi.log(repoPath, 8),
      ]);
      // 陈旧检查：repoPath 可能已在 await 期间改变
      if (loadId !== loadIdRef.current) return;
      const rawEntries = Array.isArray(statusResult) ? statusResult : [];
      const files: GitFileChange[] = rawEntries.map((f: Record<string, unknown>) => ({
        path: String(f.path ?? ''),
        status: mapStatus(String(f.status ?? '')),
        staged: Boolean(f.staged),
      }));
      const logResult = logData as GitLogResult;
      const branchArr = logResult.branches ?? [];
      const current = branchArr.find(b => b.current);
      setStatusData({ files, branch: String(current?.name ?? '') });
      setCommits(logResult.commits as GitCommit[]);
    } catch (e) {
      if (loadId !== loadIdRef.current) return;
      setError(String(e));
    } finally {
      // 仅在未过期时更新 loading 状态
      if (loadId === loadIdRef.current) setLoading(false);
    }
  }, [repoPath]);

  useEffect(() => { load(); }, [load]);

  const isNotRepo = error?.toLowerCase().includes('not a git repository');

  if (!repoPath || isNotRepo) {
    return (
      <div style={styles.empty}>
        <span className="material-symbols-outlined" style={{ fontSize: 28, color: 'var(--md-outline-variant)', opacity: 0.6 }}>folder_off</span>
        <span style={styles.emptyText}>No git repository</span>
      </div>
    );
  }

  if (error && !statusData) {
    return (
      <div style={styles.empty}>
        <span className="material-symbols-outlined" style={{ fontSize: 28, color: 'var(--md-outline-variant)', opacity: 0.6 }}>error</span>
        <span style={styles.emptyText}>Failed to load git status</span>
        <button style={styles.retryBtn} onClick={load}>Retry</button>
      </div>
    );
  }

  const stagedFiles = statusData?.files.filter(f => f.staged) ?? [];
  const unstagedFiles = statusData?.files.filter(f => !f.staged) ?? [];
  const allFiles = statusData?.files ?? [];
  const clean = stagedFiles.length === 0 && unstagedFiles.length === 0;

  // Status counts for summary bar
  const statusCounts = allFiles.reduce((acc, f) => {
    acc[f.status] = (acc[f.status] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const toggleDir = (dir: string) => {
    setCollapsedDirs(prev => {
      const next = new Set(prev);
      if (next.has(dir)) next.delete(dir);
      else next.add(dir);
      return next;
    });
  };

  const toggleFile = async (file: GitFileChange) => {
    if (expandedFile === file.path) {
      setExpandedFile(null);
      expandedFileRef.current = null;
      setDiffContent('');
      return;
    }
    setExpandedFile(file.path);
    expandedFileRef.current = file.path;
    setDiffContent('');
    if (!repoPath) return;
    setDiffLoading(true);
    try {
      const diff = await gitApi.diff(repoPath, file.path, file.staged);
      // 陈旧检查：用户可能已点击其他文件（用 ref 而非 state 避免闭包过期）
      if (expandedFileRef.current !== file.path) return;
      setDiffContent(typeof diff === 'string' ? diff : '');
    } catch {
      if (expandedFileRef.current !== file.path) return;
      setDiffContent('(无法获取 diff)');
    } finally {
      setDiffLoading(false);
    }
  };

  // ── Actions ─────────────────────────────────────────────────

  const handleStageFile = async (path: string) => {
    if (!repoPath) return;
    try {
      await gitApi.add(repoPath, [path]);
      setExpandedFile(null);
      await load();
    } catch (e) {
      message.error(e instanceof Error ? e.message : '暂存失败');
    }
  };

  const handleStageAll = async () => {
    if (!repoPath || unstagedFiles.length === 0) return;
    try {
      await gitApi.add(repoPath, unstagedFiles.map(f => f.path));
      await load();
      message.success('已暂存所有文件');
    } catch (e) {
      message.error(e instanceof Error ? e.message : '暂存失败');
    }
  };

  const handleUnstageFile = async (path: string) => {
    if (!repoPath) return;
    try {
      await gitApi.unstage(repoPath, [path]);
      setExpandedFile(null);
      await load();
    } catch (e) {
      message.error(e instanceof Error ? e.message : '取消暂存失败');
    }
  };

  const handleDiscard = async (path: string) => {
    if (!repoPath) return;
    Modal.confirm({
      title: '丢弃更改',
      icon: <ExclamationCircleOutlined />,
      content: `确定要丢弃 "${path}" 的所有更改吗？此操作不可撤销。`,
      okText: '丢弃',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        try {
          await gitApi.restore(repoPath, [path]);
          setExpandedFile(null);
          await load();
          message.success('已丢弃更改');
        } catch (e) {
          message.error(e instanceof Error ? e.message : '丢弃失败');
        }
      },
    });
  };

  const handleCommitAll = async () => {
    if (!repoPath || !commitMsg.trim()) return;
    try {
      if (unstagedFiles.length > 0) {
        await gitApi.add(repoPath, unstagedFiles.map(f => f.path));
      }
      await gitApi.commit(repoPath, commitMsg.trim());
      setCommitMsg('');
      setExpandedFile(null);
      await load();
      message.success('已提交');
    } catch (e) {
      message.error(e instanceof Error ? e.message : '提交失败');
    }
  };

  const handleFetch = async () => {
    if (!repoPath) return;
    try {
      await gitApi.fetch(repoPath);
      await load();
      message.success('已同步远程');
    } catch (e) {
      message.error(e instanceof Error ? e.message : '同步失败');
    }
  };

  // ── Sub renderers ──────────────────────────────────────────

  const renderFileRow = (f: GitFileChange) => {
    const { color } = statusMeta(f.status);
    const isExpanded = expandedFile === f.path;
    const isHovered = hoveredFile === f.path;
    const parts = f.path.replace(/\\/g, '/').split('/');
    const filename = parts[parts.length - 1];

    return (
      <div key={f.path}>
        <div
          style={{
            ...styles.fileRow,
            background: isExpanded
              ? 'var(--md-primary-container)'
              : isHovered
                ? 'var(--md-surface-container-low)'
                : undefined,
            cursor: 'pointer',
          }}
          onClick={() => toggleFile(f)}
          onMouseEnter={() => setHoveredFile(f.path)}
          onMouseLeave={() => setHoveredFile(null)}
        >
          <span style={{ ...styles.statusDot, background: color }} />
          <span style={styles.fileName} title={f.path}>{filename}</span>
          {parts.length > 1 && (
            <span style={styles.dirHint} title={f.path}>{parts.slice(0, -1).join('/')}</span>
          )}
          <div
            style={{ ...styles.fileActions, opacity: isHovered ? 1 : 0.3 }}
            onClick={e => e.stopPropagation()}
          >
            {f.staged ? (
              <button style={styles.actionBtn} title="取消暂存" onClick={() => handleUnstageFile(f.path)}>
                <span className="material-symbols-outlined" style={{ fontSize: 14, color: 'var(--md-on-surface-variant)' }}>remove</span>
              </button>
            ) : (
              <>
                <button style={styles.actionBtn} title="暂存" onClick={() => handleStageFile(f.path)}>
                  <span className="material-symbols-outlined" style={{ fontSize: 14, color }}>add</span>
                </button>
                {f.status !== '?' && (
                  <button style={styles.actionBtn} title="丢弃更改" onClick={() => handleDiscard(f.path)}>
                    <span className="material-symbols-outlined" style={{ fontSize: 14, color: 'var(--md-on-surface-variant)' }}>undo</span>
                  </button>
                )}
              </>
            )}
          </div>
        </div>
        {/* Inline diff */}
        {isExpanded && (
          <div style={styles.diffContainer}>
            {diffLoading ? (
              <div style={styles.diffPlaceholder}>
                <span className="material-symbols-outlined" style={{ fontSize: 14, animation: 'spin 1s linear infinite' }}>progress_activity</span>
              </div>
            ) : diffContent ? (
              <pre style={styles.diffPre}>{diffContent}</pre>
            ) : (
              <div style={styles.diffPlaceholder}>无变更内容</div>
            )}
          </div>
        )}
      </div>
    );
  };

  const renderDirGroup = (dir: string, files: GitFileChange[]) => {
    const collapsed = collapsedDirs.has(dir);
    return (
      <div key={dir} style={styles.dirGroup}>
        <div style={styles.dirHeader} onClick={() => toggleDir(dir)}>
          <span className="material-symbols-outlined" style={{
            fontSize: 14,
            color: 'var(--md-on-surface-variant)',
            transform: collapsed ? 'rotate(-90deg)' : 'rotate(0deg)',
            transition: 'transform 0.15s',
          }}>expand_more</span>
          <span style={styles.dirName}>{dir === '.' ? '根目录' : dir}</span>
          <span style={styles.dirCount}>{files.length}</span>
        </div>
        {!collapsed && files.map(renderFileRow)}
      </div>
    );
  };

  // ── Main render ─────────────────────────────────────────────

  const summaryItems = (['M', 'A', 'D', 'R', '?'] as const)
    .filter(s => (statusCounts[s] ?? 0) > 0)
    .map(s => ({ status: s, ...statusMeta(s), count: statusCounts[s]! }));

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
          <button style={styles.iconBtn} title="刷新" onClick={load}>
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>refresh</span>
          </button>
        </div>
      </div>

      {/* Summary bar */}
      {allFiles.length > 0 && (
        <div style={styles.summaryBar}>
          {summaryItems.map(item => (
            <span key={item.status} style={{ ...styles.summaryChip, background: item.bg, color: item.color }}>
              <span className="material-symbols-outlined" style={{ fontSize: 12 }}>{item.icon}</span>
              {item.count} {item.label}
            </span>
          ))}
        </div>
      )}

      <div style={styles.scrollArea}>
        {/* Recent commits — always visible at top */}
        {commits.length > 0 && (
          <div style={styles.section}>
            <div style={styles.sectionHeader}>
              <span className="material-symbols-outlined" style={{ fontSize: 13, color: 'var(--md-on-surface-variant)' }}>history</span>
              <span style={styles.sectionTitle}>最近提交</span>
            </div>
            {commits.slice(0, 5).map(c => (
              <div key={c.hash} style={styles.commitRow}>
                <span style={styles.commitHash}>{c.shortHash}</span>
                <span style={styles.commitMsg} title={c.message}>{c.message}</span>
                <span style={styles.commitTime}>{relativeTime(c.date)}</span>
              </div>
            ))}
          </div>
        )}

        {/* Staged files */}
        {stagedFiles.length > 0 && (
          <div style={styles.section}>
            <div style={styles.sectionHeader}>
              <span className="material-symbols-outlined" style={{ fontSize: 13, color: 'var(--md-tertiary)' }}>check_circle</span>
              <span style={styles.sectionTitle}>暂存区</span>
              <span style={styles.sectionCount}>{stagedFiles.length}</span>
            </div>
            {(() => {
              const groups = groupByDir(stagedFiles);
              return Array.from(groups.entries()).map(([dir, files]) => renderDirGroup(dir, files));
            })()}
          </div>
        )}

        {/* Unstaged changes */}
        {unstagedFiles.length > 0 && (
          <div style={styles.section}>
            <div style={styles.sectionHeader}>
              <span className="material-symbols-outlined" style={{ fontSize: 13, color: 'var(--color-amber)' }}>pending</span>
              <span style={styles.sectionTitle}>更改</span>
              <span style={styles.sectionCount}>{unstagedFiles.length}</span>
              <button style={styles.stageAllBtn} onClick={handleStageAll}>
                <span className="material-symbols-outlined" style={{ fontSize: 12 }}>select_all</span>
                全部暂存
              </button>
            </div>
            {(() => {
              const groups = groupByDir(unstagedFiles);
              return Array.from(groups.entries()).map(([dir, files]) => renderDirGroup(dir, files));
            })()}
          </div>
        )}

        {/* Clean state */}
        {clean && (
          <div style={styles.cleanState}>
            <span className="material-symbols-outlined" style={{ fontSize: 24, color: 'var(--md-tertiary)', opacity: 0.6 }}>check_circle</span>
            <span style={{ fontSize: 12, color: 'var(--md-on-surface-variant)', opacity: 0.7 }}>工作区干净</span>
          </div>
        )}
      </div>

      {/* Commit area — always visible at bottom */}
      <div style={styles.commitArea}>
        <input
          value={commitMsg}
          onChange={e => setCommitMsg(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleCommitAll(); } }}
          placeholder="提交信息..."
          style={styles.commitInput}
        />
        <button
          style={{
            ...styles.commitBtn,
            opacity: commitMsg.trim() && allFiles.length > 0 ? 1 : 0.4,
          }}
          disabled={!commitMsg.trim() || loading || allFiles.length === 0}
          onClick={handleCommitAll}
        >
          提交
        </button>
      </div>

      {loading && (
        <div style={styles.loadingOverlay}>
          <span className="material-symbols-outlined" style={{ fontSize: 16, animation: 'spin 1s linear infinite' }}>progress_activity</span>
        </div>
      )}
    </div>
  );
}

// ── Styles ──────────────────────────────────────────────────────

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
    borderBottom: '1px solid var(--border)',
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
    transition: 'color 0.15s, background 0.15s',
  },
  summaryBar: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 4,
    padding: '6px 12px',
    borderBottom: '1px solid var(--border)',
    flexShrink: 0,
  },
  summaryChip: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 3,
    padding: '2px 8px',
    borderRadius: 10,
    fontSize: 11,
    fontWeight: 600,
    fontFamily: 'var(--font-sans)',
    lineHeight: '18px',
  },
  commitArea: {
    display: 'flex',
    gap: 6,
    padding: '8px 12px',
    borderTop: '1px solid var(--border)',
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
    border: '1px solid var(--border)',
    borderRadius: 6,
    outline: 'none',
  },
  commitBtn: {
    padding: '5px 12px',
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
    borderBottom: '1px solid var(--border)',
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
    letterSpacing: '0.02em',
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
  stageAllBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 3,
    padding: '2px 8px',
    marginLeft: 'auto',
    fontSize: 10,
    fontWeight: 500,
    color: 'var(--md-primary)',
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    fontFamily: 'var(--font-sans)',
    borderRadius: 4,
  },
  dirGroup: {
    // no visual boundary — files flow naturally
  },
  dirHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    padding: '3px 12px',
    cursor: 'pointer',
    userSelect: 'none',
    background: 'var(--md-surface-container-lowest)',
  },
  dirName: {
    fontSize: 11,
    fontWeight: 500,
    color: 'var(--md-on-surface-variant)',
    fontFamily: 'var(--font-mono)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    flex: 1,
    minWidth: 0,
  },
  dirCount: {
    fontSize: 9,
    fontWeight: 600,
    color: 'var(--md-on-surface-variant)',
    background: 'var(--md-surface-container)',
    borderRadius: 6,
    padding: '0 4px',
    lineHeight: '14px',
  },
  fileRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '4px 12px 4px 28px',
    transition: 'background 0.1s',
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: '50%',
    flexShrink: 0,
  },
  fileName: {
    fontFamily: 'var(--font-mono)',
    fontSize: 11,
    fontWeight: 500,
    color: 'var(--md-on-surface)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    flexShrink: 0,
    maxWidth: '45%',
  },
  dirHint: {
    fontFamily: 'var(--font-mono)',
    fontSize: 10,
    color: 'var(--md-on-surface-variant)',
    opacity: 0.5,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    flex: 1,
    minWidth: 0,
    textAlign: 'right',
  },
  fileActions: {
    display: 'flex',
    gap: 1,
    flexShrink: 0,
    transition: 'opacity 0.15s',
  },
  actionBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: 'none',
    background: 'transparent',
    cursor: 'pointer',
    padding: 2,
    borderRadius: 4,
    flexShrink: 0,
    transition: 'opacity 0.15s',
  },
  diffContainer: {
    borderBottom: '1px solid var(--border)',
    background: 'var(--md-surface-container-lowest)',
  },
  diffPre: {
    margin: 0,
    padding: '6px 12px 6px 36px',
    fontFamily: 'var(--font-mono)',
    fontSize: 11,
    lineHeight: '1.5',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-all',
    color: 'var(--md-on-surface)',
    overflowX: 'auto',
    maxHeight: 200,
    overflowY: 'auto',
  },
  diffPlaceholder: {
    padding: '8px 12px 8px 36px',
    fontSize: 11,
    color: 'var(--md-on-surface-variant)',
    fontStyle: 'italic',
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  },
  cleanState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 6,
    padding: '32px 12px',
  },
  commitRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '4px 12px',
  },
  commitHash: {
    fontFamily: 'var(--font-mono)',
    fontSize: 10,
    fontWeight: 600,
    color: 'var(--md-primary)',
    flexShrink: 0,
    opacity: 0.8,
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
    opacity: 0.7,
  },
  empty: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: '100%',
    padding: '32px 16px',
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
