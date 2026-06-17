import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Select, Tooltip, Modal, Input, message, Spin } from 'antd';
import { projectsApi, gitApi } from '../../../api';
import type { ProjectWithStats } from '../../../types';
import type { Branch, GitCommit, GitFileChange, ProjectOption } from './gitTypes';
import GitCommitTable from './GitCommitTable';
import SplitDiffViewer from './SplitDiffViewer';
import CommitInspector from './CommitInspector';
import ConflictAlert from './ConflictAlert';
import RepoInsights from './RepoInsights';

type LeftTab = 'branches' | 'prs';
type FileStatus = 'M' | 'A' | 'D' | 'R' | 'C' | '?';

const FILE_ICONS: Record<string, string> = {
  html: 'html',
  css: 'css',
  js: 'javascript',
  ts: 'code',
  tsx: 'code',
  jsx: 'code',
  json: 'data_object',
  md: 'description',
  rs: 'code',
  py: 'code',
};

function getFileIcon(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase() || '';
  return FILE_ICONS[ext] || 'draft';
}

function getFileStatusColor(status: FileStatus): string {
  switch (status) {
    case 'M': return 'var(--color-tertiary)';
    case 'A': return 'var(--color-tertiary)';
    case 'D': return 'var(--md-error)';
    case 'R': return 'var(--color-info)';
    default: return 'var(--md-on-surface-variant)';
  }
}

function mapFileStatus(raw: string): FileStatus {
  const upper = raw.toUpperCase();
  if (upper === 'M' || upper === 'MODIFIED') return 'M';
  if (upper === 'A' || upper === 'ADDED' || upper === 'NEW') return 'A';
  if (upper === 'D' || upper === 'DELETED') return 'D';
  if (upper === 'R' || upper === 'RENAMED') return 'R';
  return '?';
}

export default function GitDashboardPage() {
  // Projects
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const selectedProject = projects.find(p => p.id === selectedProjectId) || null;

  // Git data
  const [branches, setBranches] = useState<Branch[]>([]);
  const [commits, setCommits] = useState<GitCommit[]>([]);
  const [statusFiles, setStatusFiles] = useState<GitFileChange[]>([]);
  const [selectedCommit, setSelectedCommit] = useState<GitCommit | null>(null);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [diffContent, setDiffContent] = useState('');
  const [diffLoading, setDiffLoading] = useState(false);

  // UI state
  const [leftTab, setLeftTab] = useState<LeftTab>('branches');
  const [loading, setLoading] = useState(false);
  const [commitModalOpen, setCommitModalOpen] = useState(false);
  const [commitMsg, setCommitMsg] = useState('');
  const [committing, setCommitting] = useState(false);
  const [branchModalOpen, setBranchModalOpen] = useState(false);
  const [newBranchName, setNewBranchName] = useState('');
  const [creating, setCreating] = useState(false);
  const [fetching, setFetching] = useState(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  // Load projects
  useEffect(() => {
    projectsApi.list().then((list: ProjectWithStats[]) => {
      if (!mountedRef.current) return;
      const withPaths = list
        .filter(p => p.localPath)
        .map(p => ({ id: p.id, name: p.name, localPath: p.localPath! }));
      setProjects(withPaths);
      if (withPaths.length > 0) {
        setSelectedProjectId(withPaths[0].id);
      }
    }).catch(() => { /* ignore */ });
  }, []);

  // Load git data for selected project
  const loadRepoData = useCallback(async (repoPath: string) => {
    setLoading(true);
    setSelectedCommit(null);
    setSelectedFile(null);
    setDiffContent('');

    try {
      const [statusResult, logData] = await Promise.all([
        gitApi.status(repoPath).catch(() => []),
        gitApi.log(repoPath, 50).catch(() => null),
      ]);

      if (!mountedRef.current) return;

      // Map status files
      const files: GitFileChange[] = Array.isArray(statusResult)
        ? statusResult.map((f: Record<string, unknown>) => ({
            path: f.path as string || f.file as string || '',
            status: mapFileStatus((f.status || f.index || '?') as string),
            staged: f.staged as boolean || false,
          }))
        : [];
      setStatusFiles(files);

      // Map commits and branches
      if (logData && typeof logData === 'object') {
        const data = logData as Record<string, unknown>;
        const rawCommits = (data.commits || data.log || []) as GitCommit[];
        const rawBranches = (data.branches || []) as Branch[];
        setCommits(Array.isArray(rawCommits) ? rawCommits : []);
        setBranches(Array.isArray(rawBranches) ? rawBranches : []);

        // Auto-select first commit
        if (Array.isArray(rawCommits) && rawCommits.length > 0) {
          setSelectedCommit(rawCommits[0]);
        }
      }
    } catch {
      // ignore
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedProject?.localPath) {
      loadRepoData(selectedProject.localPath);
    }
  }, [selectedProject, loadRepoData]);

  // Load diff for selected commit
  useEffect(() => {
    if (!selectedCommit || !selectedProject?.localPath) return;
    setDiffLoading(true);
    gitApi.diffCommit(selectedProject.localPath, selectedCommit.hash)
      .then((result: unknown) => {
        if (!mountedRef.current) return;
        if (typeof result === 'string') {
          setDiffContent(result);
        } else if (result && typeof result === 'object' && 'diff' in (result as Record<string, unknown>)) {
          setDiffContent((result as Record<string, string>).diff);
        } else {
          setDiffContent('');
        }
      })
      .catch(() => { setDiffContent(''); })
      .finally(() => { if (mountedRef.current) setDiffLoading(false); });
  }, [selectedCommit, selectedProject]);

  // Load diff for selected file
  useEffect(() => {
    if (!selectedFile || !selectedProject?.localPath) return;
    const fileStatus = statusFiles.find(f => f.path === selectedFile);
    setDiffLoading(true);
    gitApi.diff(selectedProject.localPath, selectedFile, fileStatus?.staged)
      .then((result: unknown) => {
        if (!mountedRef.current) return;
        if (typeof result === 'string') {
          setDiffContent(result);
        } else if (result && typeof result === 'object' && 'diff' in (result as Record<string, unknown>)) {
          setDiffContent((result as Record<string, string>).diff);
        } else {
          setDiffContent('');
        }
      })
      .catch(() => { setDiffContent(''); })
      .finally(() => { if (mountedRef.current) setDiffLoading(false); });
  }, [selectedFile, selectedProject, statusFiles]);

  // Compute weekly activity (Mon-Sun) from commits
  const weeklyActivity = useMemo(() => {
    const counts = [0, 0, 0, 0, 0, 0, 0]; // Mon..Sun
    const now = new Date();
    const dayOfWeek = now.getDay(); // 0=Sun, 1=Mon...
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const weekStart = new Date(now);
    weekStart.setHours(0, 0, 0, 0);
    weekStart.setDate(weekStart.getDate() + mondayOffset);

    for (const commit of commits) {
      const d = new Date(commit.date);
      if (d >= weekStart) {
        const dayIdx = d.getDay(); // 0=Sun
        counts[dayIdx === 0 ? 6 : dayIdx - 1]++; // shift to Mon=0..Sun=6
      }
    }
    return counts;
  }, [commits]);

  const localBranches = branches.filter(b => !b.isRemote);
  const remoteBranches = branches.filter(b => b.isRemote);
  const currentBranch = branches.find(b => b.current);

  const handlePush = async () => {
    if (!selectedProject?.localPath) return;
    try {
      await gitApi.push(selectedProject.localPath);
      message.success('Push 成功');
      loadRepoData(selectedProject.localPath);
    } catch (err) {
      message.error(`Push 失败: ${String(err)}`);
    }
  };

  const handlePull = async () => {
    if (!selectedProject?.localPath) return;
    try {
      await gitApi.pull(selectedProject.localPath);
      message.success('Pull 成功');
      loadRepoData(selectedProject.localPath);
    } catch (err) {
      message.error(`Pull 失败: ${String(err)}`);
    }
  };

  const handleCommit = () => {
    const staged = statusFiles.filter(f => f.staged);
    if (staged.length === 0) {
      message.warning('没有已暂存的文件');
      return;
    }
    setCommitMsg('');
    setCommitModalOpen(true);
  };

  const handleDoCommit = async () => {
    if (!selectedProject?.localPath || !commitMsg.trim()) return;
    setCommitting(true);
    try {
      await gitApi.commit(selectedProject.localPath, commitMsg.trim());
      message.success('提交成功');
      setCommitModalOpen(false);
      setCommitMsg('');
      loadRepoData(selectedProject.localPath);
    } catch (err) {
      message.error(`提交失败: ${String(err)}`);
    } finally {
      setCommitting(false);
    }
  };

  const handleCreateBranch = async () => {
    if (!selectedProject?.localPath || !newBranchName.trim()) return;
    setCreating(true);
    try {
      await gitApi.branchCreate(selectedProject.localPath, newBranchName.trim());
      message.success(`分支 '${newBranchName.trim()}' 创建成功`);
      setBranchModalOpen(false);
      setNewBranchName('');
      loadRepoData(selectedProject.localPath);
    } catch (err) {
      message.error(`创建分支失败: ${String(err)}`);
    } finally {
      setCreating(false);
    }
  };

  const handleFetch = async () => {
    if (!selectedProject?.localPath) return;
    setFetching(true);
    try {
      await gitApi.fetch(selectedProject.localPath);
      message.success('已获取远程更新');
      loadRepoData(selectedProject.localPath);
    } catch (err) {
      message.error(`获取失败: ${String(err)}`);
    } finally {
      setFetching(false);
    }
  };

  const handleRevert = async (hash: string) => {
    if (!selectedProject?.localPath) return;
    try {
      await gitApi.revert(selectedProject.localPath, hash);
      message.success('已回退');
      loadRepoData(selectedProject.localPath);
    } catch (err) {
      message.error(`回退失败: ${String(err)}`);
    }
  };

  // Compute diff stats from diffContent
  const diffStats = diffContent ? {
    additions: (diffContent.match(/^\+[^+]/gm) || []).length,
    deletions: (diffContent.match(/^-[^-]/gm) || []).length,
  } : null;

  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      height: 'calc(100vh - var(--layout-topbar-height))',
      padding: 'var(--layout-container-padding)',
      gap: 'var(--space-component-gap)',
      overflow: 'hidden',
    }}>
      {/* Top Bar: Repo selector */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12,
        background: 'var(--md-surface-container-lowest)',
        borderRadius: 'var(--radius-sm)',
        border: '1px solid var(--md-outline-variant)',
        padding: '8px 16px',
        boxShadow: 'var(--shadow-xs)',
        flexShrink: 0,
      }}>
        <span className="material-symbols-outlined" style={{ fontSize: 20, color: 'var(--md-primary)' }}>book</span>
        <Select
          style={{ minWidth: 220 }}
          placeholder="选择仓库..."
          value={selectedProjectId}
          onChange={setSelectedProjectId}
          options={projects.map(p => ({ label: p.name, value: p.id }))}
          notFoundContent="没有本地路径的项目"
        />
        {currentBranch && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '2px 10px', borderRadius: 'var(--radius-full)',
            background: 'rgba(0,107,95,0.08)',
            border: '1px solid rgba(0,107,95,0.15)',
            fontSize: 'var(--text-xs)', fontFamily: 'var(--font-label)',
            color: 'var(--md-primary)',
          }}>
            <span className="material-symbols-outlined" style={{ fontSize: 14 }}>call_split</span>
            {currentBranch.name}
          </div>
        )}
        <div style={{ flex: 1 }} />
        {loading && <Spin size="small" />}
      </div>

      {/* Main Three-Panel Layout */}
      <div style={{ flex: 1, display: 'flex', gap: 'var(--space-component-gap)', overflow: 'hidden' }}>

        {/* ===== LEFT PANEL: Branches ===== */}
        <aside style={{
          width: 256, flexShrink: 0,
          background: 'var(--md-surface-container-lowest)',
          borderRadius: 'var(--radius-sm)',
          border: '1px solid var(--md-outline-variant)',
          boxShadow: 'var(--shadow-sm)',
          display: 'flex', flexDirection: 'column',
          overflow: 'hidden',
        }}>
          {/* Repo Header */}
          <div style={{
            padding: '12px 12px',
            borderBottom: '1px solid var(--md-outline-variant)',
            background: 'var(--md-surface-container-low)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, overflow: 'hidden' }}>
              <span className="material-symbols-outlined" style={{ fontSize: 20, color: 'var(--md-primary)' }}>book</span>
              <span style={{
                fontFamily: 'var(--font-sans)', fontSize: 'var(--text-base)',
                fontWeight: 600, color: 'var(--md-on-surface)',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {selectedProject?.name || '未选择仓库'}
              </span>
            </div>
          </div>

          {/* Tabs */}
          <div style={{
            display: 'flex', gap: 0, padding: '8px 8px 0',
            borderBottom: '1px solid var(--md-outline-variant)',
          }}>
            <button
              onClick={() => setLeftTab('branches')}
              style={{
                flex: 1, padding: '6px 0', border: 'none', cursor: 'pointer',
                fontFamily: 'var(--font-label)', fontSize: 'var(--text-xs)', fontWeight: 500,
                background: 'transparent',
                borderBottom: leftTab === 'branches' ? '2px solid var(--md-primary)' : '2px solid transparent',
                color: leftTab === 'branches' ? 'var(--md-primary)' : 'var(--md-on-surface-variant)',
                transition: 'all var(--transition-fast)',
              }}
            >
              分支
            </button>
            <button
              onClick={() => setLeftTab('prs')}
              style={{
                flex: 1, padding: '6px 0', border: 'none', cursor: 'pointer',
                fontFamily: 'var(--font-label)', fontSize: 'var(--text-xs)', fontWeight: 500,
                background: 'transparent',
                borderBottom: leftTab === 'prs' ? '2px solid var(--md-primary)' : '2px solid transparent',
                color: leftTab === 'prs' ? 'var(--md-primary)' : 'var(--md-on-surface-variant)',
                transition: 'all var(--transition-fast)',
              }}
            >
              PR
            </button>
          </div>

          {/* Branch List */}
          <div style={{ flex: 1, overflowY: 'auto', padding: 8 }}>
            {leftTab === 'branches' ? (
              <>
                {/* Local */}
                <div style={{ marginBottom: 16 }}>
                  <div style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '0 8px', marginBottom: 4,
                  }}>
                    <span style={{
                      fontFamily: 'var(--font-label)', fontSize: 'var(--text-xs)',
                      color: 'var(--md-on-surface-variant)', textTransform: 'uppercase',
                      letterSpacing: '0.04em', fontWeight: 500,
                    }}>
                      本地
                    </span>
                    <Tooltip title="新建本地分支" placement="top">
                      <span
                        className="material-symbols-outlined"
                        style={{ fontSize: 14, color: 'var(--md-on-surface-variant)', cursor: 'pointer' }}
                        onClick={() => { setNewBranchName(''); setBranchModalOpen(true); }}
                      >add</span>
                    </Tooltip>
                  </div>
                  <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                    {localBranches.map((b) => {
                      const isActive = b.current;
                      return (
                        <li key={b.name}>
                          <div style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            padding: '6px 8px', borderRadius: 'var(--radius-xs)',
                            cursor: 'pointer', transition: 'all var(--transition-fast)',
                            background: isActive ? 'rgba(0,107,95,0.08)' : 'transparent',
                            border: isActive ? '1px solid rgba(0,107,95,0.15)' : '1px solid transparent',
                          }}
                            onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.background = 'var(--md-surface-container-low)'; }}
                            onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, overflow: 'hidden' }}>
                              <span className="material-symbols-outlined" style={{
                                fontSize: 16,
                                color: isActive ? 'var(--md-primary)' : 'var(--md-on-surface-variant)',
                              }}>call_split</span>
                              <span style={{
                                fontSize: 'var(--text-sm)',
                                color: isActive ? 'var(--md-on-surface)' : 'var(--md-on-surface-variant)',
                                fontWeight: isActive ? 600 : 400,
                                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                              }}>
                                {b.name}
                              </span>
                            </div>
                            {(b.ahead > 0 || b.behind > 0) && (
                              <span style={{
                                fontSize: 'var(--text-xs)', fontFamily: 'var(--font-label)',
                                color: 'var(--md-on-surface-variant)', flexShrink: 0,
                              }}>
                                {b.ahead > 0 ? `${b.ahead}↑` : ''}{b.behind > 0 ? `${b.behind}↓` : ''}
                              </span>
                            )}
                          </div>
                        </li>
                      );
                    })}
                    {localBranches.length === 0 && (
                      <li style={{ padding: '8px', color: 'var(--md-on-surface-variant)', fontSize: 'var(--text-sm)' }}>
                        暂无本地分支
                      </li>
                    )}
                  </ul>
                </div>

                {/* Remote */}
                <div>
                  <div style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '0 8px', marginBottom: 4,
                  }}>
                    <span style={{
                      fontFamily: 'var(--font-label)', fontSize: 'var(--text-xs)',
                      color: 'var(--md-on-surface-variant)', textTransform: 'uppercase',
                      letterSpacing: '0.04em', fontWeight: 500,
                    }}>
                      远程
                    </span>
                    <Tooltip title="获取远程分支" placement="top">
                      <span
                        className="material-symbols-outlined"
                        style={{ fontSize: 14, color: fetching ? 'var(--md-primary)' : 'var(--md-on-surface-variant)', cursor: 'pointer' }}
                        onClick={handleFetch}
                      >sync</span>
                    </Tooltip>
                  </div>
                  <ul style={{ listStyle: 'none', margin: 0, padding: 0, opacity: 0.8 }}>
                    {remoteBranches.map((b) => (
                      <li key={b.name}>
                        <div style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                          padding: '6px 8px', borderRadius: 'var(--radius-xs)',
                          cursor: 'pointer', transition: 'background var(--transition-fast)',
                        }}
                          onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--md-surface-container-low)'; }}
                          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, overflow: 'hidden' }}>
                            <span className="material-symbols-outlined" style={{ fontSize: 16, color: 'var(--md-on-surface-variant)' }}>cloud</span>
                            <span style={{
                              fontSize: 'var(--text-sm)', color: 'var(--md-on-surface-variant)',
                              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                            }}>
                              {b.name}
                            </span>
                          </div>
                        </div>
                      </li>
                    ))}
                    {remoteBranches.length === 0 && (
                      <li style={{ padding: '8px', color: 'var(--md-on-surface-variant)', fontSize: 'var(--text-sm)' }}>
                        暂无远程分支
                      </li>
                    )}
                  </ul>
                </div>
              </>
            ) : (
              <div style={{ padding: 20, textAlign: 'center', color: 'var(--md-on-surface-variant)', fontSize: 'var(--text-sm)' }}>
                Pull Request — 即将推出
              </div>
            )}
          </div>
        </aside>

        {/* ===== CENTER PANEL: Graph + Diff ===== */}
        <section style={{
          flex: 1, display: 'flex', flexDirection: 'column',
          gap: 'var(--space-component-gap)',
          minWidth: 0,
        }}>
          {/* TOP: Commit Graph */}
          <div style={{
            height: '55%',
            background: 'var(--md-surface-container-lowest)',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--md-outline-variant)',
            boxShadow: 'var(--shadow-sm)',
            display: 'flex', flexDirection: 'column',
            overflow: 'hidden',
          }}>
            {/* Toolbar */}
            <div style={{
              padding: '8px 12px',
              borderBottom: '1px solid var(--md-outline-variant)',
              background: 'var(--md-surface-container-low)',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
              <div style={{ display: 'flex', gap: 8 }}>
                <Tooltip title="提交暂存区的更改" placement="bottom">
                  <button
                    onClick={handleCommit}
                    style={{
                      padding: '4px 12px', borderRadius: 'var(--radius-xs)',
                      background: 'var(--md-primary)', color: 'var(--md-on-primary)',
                      fontFamily: 'var(--font-label)', fontSize: 'var(--text-xs)', fontWeight: 500,
                      border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4,
                      transition: 'filter var(--transition-fast)',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.filter = 'brightness(1.1)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.filter = 'none'; }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: 16 }}>commit</span>
                    Commit
                  </button>
                </Tooltip>
                <Tooltip title="推送到远程仓库" placement="bottom">
                  <button
                    onClick={handlePush}
                    style={{
                      padding: '4px 12px', borderRadius: 'var(--radius-xs)',
                      background: 'var(--md-surface-container)',
                      border: '1px solid var(--md-outline-variant)',
                      color: 'var(--md-on-surface)',
                      fontFamily: 'var(--font-label)', fontSize: 'var(--text-xs)', fontWeight: 500,
                      cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4,
                      transition: 'background var(--transition-fast)',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--md-surface-container-high)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--md-surface-container)'; }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: 16 }}>publish</span>
                    Push
                  </button>
                </Tooltip>
                <Tooltip title="从远程仓库拉取更新" placement="bottom">
                  <button
                    onClick={handlePull}
                    style={{
                      padding: '4px 12px', borderRadius: 'var(--radius-xs)',
                      background: 'var(--md-surface-container)',
                      border: '1px solid var(--md-outline-variant)',
                      color: 'var(--md-on-surface)',
                      fontFamily: 'var(--font-label)', fontSize: 'var(--text-xs)', fontWeight: 500,
                      cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4,
                      transition: 'background var(--transition-fast)',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--md-surface-container-high)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--md-surface-container)'; }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: 16 }}>download</span>
                    Pull
                  </button>
                </Tooltip>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                {statusFiles.length > 0 && (
                  <span style={{
                    display: 'flex', alignItems: 'center', gap: 4,
                    fontSize: 'var(--text-xs)', fontFamily: 'var(--font-label)',
                    color: 'var(--color-error)',
                    background: 'rgba(186,26,26,0.06)',
                    padding: '2px 8px', borderRadius: 'var(--radius-full)',
                    border: '1px solid rgba(186,26,26,0.15)',
                  }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 14 }}>warning</span>
                    {statusFiles.length} 未暂存
                  </span>
                )}
                <Tooltip title="刷新仓库数据">
                  <button
                    onClick={() => selectedProject?.localPath && loadRepoData(selectedProject.localPath)}
                    style={{
                      padding: 4, background: 'transparent', border: 'none',
                      color: 'var(--md-on-surface-variant)', cursor: 'pointer',
                      borderRadius: 'var(--radius-xs)',
                      transition: 'color var(--transition-fast)',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--md-on-surface)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--md-on-surface-variant)'; }}
                  >
                    <span className="material-symbols-outlined">refresh</span>
                  </button>
                </Tooltip>
              </div>
            </div>

            {/* Commit Table */}
            <GitCommitTable
              commits={commits}
              selectedHash={selectedCommit?.shortHash || null}
              onSelect={setSelectedCommit}
              dirtyCount={statusFiles.filter(f => !f.staged).length}
            />
          </div>

          {/* BOTTOM: Changed Files + Diff */}
          <div style={{
            flex: 1,
            background: 'var(--md-surface-container-lowest)',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--md-outline-variant)',
            boxShadow: 'var(--shadow-sm)',
            display: 'flex',
            overflow: 'hidden',
          }}>
            {/* File List */}
            <div style={{
              width: 256, flexShrink: 0,
              borderRight: '1px solid var(--md-outline-variant)',
              background: 'rgba(239,244,255,0.5)',
              display: 'flex', flexDirection: 'column',
            }}>
              <div style={{
                padding: '8px 12px',
                borderBottom: '1px solid var(--md-outline-variant)',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              }}>
                <span style={{
                  fontFamily: 'var(--font-label)', fontSize: 'var(--text-xs)',
                  fontWeight: 600, color: 'var(--md-on-surface)',
                }}>
                  变更文件 ({statusFiles.length})
                </span>
                {statusFiles.length > 0 && (
                  <div style={{ display: 'flex', gap: 6, fontSize: 10, fontFamily: 'var(--font-mono)' }}>
                    <span style={{ color: 'var(--color-tertiary)' }}>
                      +{statusFiles.filter(f => f.status === 'A' || f.status === 'M').length}
                    </span>
                    <span style={{ color: 'var(--md-error)' }}>
                      -{statusFiles.filter(f => f.status === 'D').length}
                    </span>
                  </div>
                )}
              </div>
              <ul style={{ flex: 1, overflowY: 'auto', listStyle: 'none', margin: 0, padding: 4 }}>
                {statusFiles.map((f) => {
                  const isActive = f.path === selectedFile;
                  return (
                    <li key={f.path}>
                      <div
                        onClick={() => setSelectedFile(f.path)}
                        style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                          padding: '6px 8px', borderRadius: 'var(--radius-xs)',
                          cursor: 'pointer', transition: 'all var(--transition-fast)',
                          background: isActive ? 'rgba(0,107,95,0.08)' : 'transparent',
                          border: isActive ? '1px solid rgba(0,107,95,0.15)' : '1px solid transparent',
                        }}
                        onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.background = 'var(--md-surface-container-high)'; }}
                        onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, overflow: 'hidden' }}>
                          <span className="material-symbols-outlined" style={{ fontSize: 14, color: getFileStatusColor(f.status) }}>
                            {getFileIcon(f.path)}
                          </span>
                          <span style={{
                            fontSize: 'var(--text-sm)',
                            color: isActive ? 'var(--md-primary)' : 'var(--md-on-surface-variant)',
                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                            textDecoration: f.status === 'D' ? 'line-through' : undefined,
                            opacity: f.status === 'D' ? 0.7 : 1,
                          }}>
                            {f.path}
                          </span>
                        </div>
                        <span style={{
                          fontSize: 10, fontFamily: 'var(--font-mono)', flexShrink: 0,
                          color: getFileStatusColor(f.status),
                        }}>
                          {f.status}
                        </span>
                      </div>
                    </li>
                  );
                })}
                {statusFiles.length === 0 && (
                  <li style={{ padding: 20, textAlign: 'center', color: 'var(--md-on-surface-variant)', fontSize: 'var(--text-sm)' }}>
                    工作区干净
                  </li>
                )}
              </ul>
            </div>

            {/* Diff Viewer */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              {diffLoading ? (
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Spin />
                </div>
              ) : diffContent ? (
                <SplitDiffViewer
                  diffText={diffContent}
                  fileName={selectedFile || selectedCommit?.shortHash || ''}
                />
              ) : (
                <div style={{
                  flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: 'var(--md-on-surface-variant)', fontSize: 'var(--text-sm)',
                }}>
                  选择一个提交或文件查看 Diff
                </div>
              )}
            </div>
          </div>
        </section>

        {/* ===== RIGHT PANEL: Inspector + Insights ===== */}
        <aside style={{
          width: 320, flexShrink: 0,
          display: 'flex', flexDirection: 'column',
          gap: 'var(--space-component-gap)',
        }}>
          <CommitInspector commit={selectedCommit} diffSummary={diffStats} onRevert={handleRevert} />
          <ConflictAlert conflictFiles={[]} />
          <RepoInsights
            totalCommits={commits.length}
            activeBranches={branches.length}
            weeklyActivity={weeklyActivity}
          />
        </aside>
      </div>

      {/* Commit Modal */}
      <Modal
        title="提交更改"
        open={commitModalOpen}
        onOk={handleDoCommit}
        onCancel={() => setCommitModalOpen(false)}
        okText="提交"
        cancelText="取消"
        okButtonProps={{ loading: committing, disabled: !commitMsg.trim() }}
      >
        <div style={{ marginBottom: 8, fontSize: 12, color: 'var(--md-on-surface-variant)' }}>
          已暂存 {statusFiles.filter(f => f.staged).length} 个文件
        </div>
        <Input.TextArea
          value={commitMsg}
          onChange={e => setCommitMsg(e.target.value)}
          placeholder="提交信息..."
          autoSize={{ minRows: 3, maxRows: 6 }}
          autoFocus
          onKeyDown={e => {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
              e.preventDefault();
              handleDoCommit();
            }
          }}
        />
      </Modal>

      {/* New Branch Modal */}
      <Modal
        title="新建分支"
        open={branchModalOpen}
        onOk={handleCreateBranch}
        onCancel={() => setBranchModalOpen(false)}
        okText="创建"
        cancelText="取消"
        okButtonProps={{ loading: creating, disabled: !newBranchName.trim() }}
      >
        <Input
          value={newBranchName}
          onChange={e => setNewBranchName(e.target.value)}
          placeholder="分支名称..."
          autoFocus
          onPressEnter={handleCreateBranch}
        />
      </Modal>
    </div>
  );
}
