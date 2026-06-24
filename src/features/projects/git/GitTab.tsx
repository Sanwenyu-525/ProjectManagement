import { useState, useEffect, useCallback, useRef } from 'react';
import { Spin, message, Button, Tooltip, Tabs, Modal, Input } from 'antd';
import { ReloadOutlined, CloudUploadOutlined, InboxOutlined } from '@ant-design/icons';
import { gitApi } from '../../../api';
import { useThemeStore } from '../../../stores/themeStore';
import BranchSelector from './BranchSelector';
import CommitGraph from './CommitGraph';
import DiffViewer from './DiffViewer';
import StagingArea from './StagingArea';
import GitTagList from './GitTagList';

interface Branch { name: string; current: boolean; isRemote: boolean; upstream?: string; ahead: number; behind: number; }
interface GitCommit { hash: string; shortHash: string; message: string; author: string; date: string; branches?: string[]; parents: string[]; branchIdx: number; }

interface GitTabProps {
  project: {
    id: string;
    localPath?: string;
    name: string;
  };
}

export default function GitTab({ project }: GitTabProps) {
  const repoPath = project.localPath;
  const isDark = useThemeStore(s => s.mode === 'dark');

  const [loading, setLoading] = useState(true);
  const [files, setFiles] = useState<Array<{ path: string; status: string; staged: boolean }>>([]);
  const [logResult, setLogResult] = useState<{ commits: GitCommit[]; branches: Branch[] } | null>(null);

  const [selectedGitCommit, setSelectedGitCommit] = useState<GitCommit | null>(null);
  const [selectedFile, setSelectedFile] = useState<string | undefined>();
  const [diffContent, setDiffContent] = useState('');
  const [diffLoading, setDiffLoading] = useState(false);

  const [pushing, setPushing] = useState(false);
  const [leftTab, setLeftTab] = useState<'staging' | 'tags'>('staging');
  const [leftSideTab, setLeftSideTab] = useState<'branches' | 'prs'>('branches');
  const [commitModalOpen, setCommitModalOpen] = useState(false);
  const [commitMsg, setCommitMsg] = useState('');
  const [committing, setCommitting] = useState(false);

  // Drag state for resizable panels
  const [leftWidth, setLeftWidth] = useState(260);
  const [rightWidth, setRightWidth] = useState(380);
  const isDragging = useRef<'left' | 'right' | null>(null);
  const startX = useRef(0);
  const startWidth = useRef(0);

  const handleDragStart = useCallback((panel: 'left' | 'right') => (e: React.MouseEvent) => {
    isDragging.current = panel;
    startX.current = e.clientX;
    startWidth.current = panel === 'left' ? leftWidth : rightWidth;
    e.preventDefault();
  }, [leftWidth, rightWidth]);

  const handleDrag = useCallback((e: React.MouseEvent) => {
    if (!isDragging.current) return;
    const diff = e.clientX - startX.current;
    if (isDragging.current === 'left') {
      setLeftWidth(Math.max(180, Math.min(500, startWidth.current + diff)));
    } else if (isDragging.current === 'right') {
      setRightWidth(Math.max(250, startWidth.current - diff));
    }
  }, []);

  const handleDragEnd = useCallback(() => {
    isDragging.current = null;
  }, []);

  const refresh = useCallback(async () => {
    if (!repoPath) return;
    setLoading(true);
    try {
      const [statusResult, logData] = await Promise.all([
        gitApi.status(repoPath).catch(() => []),
        gitApi.log(repoPath, 50).catch(() => null),
      ]);
      setFiles(statusResult);
      setLogResult(logData);
    } catch {
      message.error('加载 Git 信息失败');
    } finally {
      setLoading(false);
    }
  }, [repoPath]);

  useEffect(() => { refresh(); }, [refresh]);

  const handleFileClick = useCallback(async (file: string, staged: boolean) => {
    if (!repoPath) return;
    setSelectedFile(file);
    setSelectedGitCommit(null);
    setDiffLoading(true);
    try {
      const content = await gitApi.diff(repoPath, file, staged);
      setDiffContent(content);
    } catch (err) {
      setDiffContent('');
      message.error(String(err));
    } finally {
      setDiffLoading(false);
    }
  }, [repoPath]);

  const handleGitCommitSelect = useCallback(async (commit: GitCommit) => {
    if (!repoPath) return;
    setSelectedGitCommit(commit);
    setSelectedFile(undefined);
    setDiffLoading(true);
    try {
      const content = await gitApi.diffCommit(repoPath, commit.hash);
      setDiffContent(content);
    } catch {
      setDiffContent('');
      message.error('无法加载提交差异');
    } finally {
      setDiffLoading(false);
    }
  }, [repoPath]);

  const handleBranchSwitch = useCallback(async (branch: string) => {
    if (!repoPath) return;
    try {
      await gitApi.branchSwitch(repoPath, branch);
      message.success(`已切换到 ${branch}`);
      refresh();
    } catch (err) {
      message.error(String(err));
    }
  }, [repoPath, refresh]);

  const handlePush = useCallback(async () => {
    if (!repoPath) return;
    setPushing(true);
    try {
      await gitApi.push(repoPath);
      message.success('推送成功');
      refresh();
    } catch (err) {
      message.error(String(err));
    } finally {
      setPushing(false);
    }
  }, [repoPath, refresh]);

  const handleToolbarCommit = () => {
    if (stagedCount === 0) {
      message.warning('没有已暂存的文件');
      return;
    }
    setCommitMsg('');
    setCommitModalOpen(true);
  };

  const handleDoCommit = async () => {
    if (!repoPath || !commitMsg.trim()) return;
    setCommitting(true);
    try {
      await gitApi.commit(repoPath, commitMsg.trim());
      message.success('提交成功');
      setCommitModalOpen(false);
      setCommitMsg('');
      refresh();
    } catch (err) {
      message.error(`提交失败: ${String(err)}`);
    } finally {
      setCommitting(false);
    }
  };

  const branches = logResult?.branches || [];
  const localBranches = branches.filter(b => !b.isRemote);
  const remoteBranches = branches.filter(b => b.isRemote);
  const currentBranch = branches.find(b => b.current);
  const unstagedCount = files.filter(f => !f.staged).length;
  const stagedCount = files.filter(f => f.staged).length;

  const diffTitle = selectedGitCommit
    ? `${selectedGitCommit.shortHash} - ${selectedGitCommit.message}`
    : selectedFile;

  if (!repoPath) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 300, color: 'var(--md-on-surface-variant)' }}>
        <InboxOutlined style={{ fontSize: 48, marginBottom: 12, color: 'var(--md-outline)' }} />
        <div style={{ fontSize: 14 }}>该项目未设置本地路径</div>
        <div style={{ fontSize: 12, marginTop: 4 }}>请先在配置中设置项目本地路径</div>
      </div>
    );
  }

  if (loading && !logResult) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 300 }}>
        <Spin tip="加载 Git 信息..." />
      </div>
    );
  }

  const panelBg = isDark ? 'var(--md-surface-container)' : '#ffffff';
  const panelBorder = 'var(--border)';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      {/* ── Toolbar ── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '8px 12px', marginBottom: 8,
        borderBottom: `1px solid ${panelBorder}`,
      }}>
        <BranchSelector branches={branches} onSwitch={handleBranchSwitch} loading={loading} />
        <div style={{ flex: 1 }} />

        {unstagedCount > 0 && (
          <span style={{
            padding: '2px 8px',
            borderRadius: 4,
            background: isDark ? 'rgba(245, 158, 11, 0.12)' : 'rgba(217, 119, 6, 0.10)',
            color: isDark ? 'var(--md-primary)' : '#d97706',
            fontSize: 11,
            fontFamily: 'var(--font-mono)',
          }}>
            {unstagedCount} 未暂存
          </span>
        )}

        <Tooltip title="提交">
          <Button size="small" disabled={stagedCount === 0} onClick={handleToolbarCommit} style={{ fontSize: 12 }}>
            <span className="material-symbols-outlined" style={{ fontSize: 14, marginRight: 4 }}>commit</span>
            Commit
          </Button>
        </Tooltip>
        {currentBranch?.upstream && (
          <Tooltip title="推送到远程">
            <Button size="small" icon={<CloudUploadOutlined />} onClick={handlePush} loading={pushing} style={{ fontSize: 12 }}>
              Push
            </Button>
          </Tooltip>
        )}
        <Tooltip title="拉取">
          <Button size="small" style={{ fontSize: 12 }}>
            <span className="material-symbols-outlined" style={{ fontSize: 14, marginRight: 4 }}>download</span>
            Pull
          </Button>
        </Tooltip>
        <Tooltip title="刷新">
          <Button size="small" icon={<ReloadOutlined />} onClick={refresh} loading={loading} />
        </Tooltip>
      </div>

      {/* ── Three-panel layout ── */}
      <div
        style={{ flex: 1, display: 'flex', gap: 0, overflow: 'hidden', borderRadius: 8, border: `1px solid ${panelBorder}` }}
        onMouseMove={handleDrag}
        onMouseUp={handleDragEnd}
        onMouseLeave={handleDragEnd}
      >
        {/* ── Left: Branches + Staging ── */}
        <div style={{
          width: leftWidth, flexShrink: 0, borderRight: `1px solid ${panelBorder}`,
          background: panelBg, overflow: 'hidden', display: 'flex', flexDirection: 'column',
        }}>
          {/* Branch list */}
          <div style={{ borderBottom: `1px solid ${panelBorder}` }}>
            {/* Branches/PRs tab */}
            <div style={{ display: 'flex', borderBottom: `1px solid ${panelBorder}` }}>
              {(['branches', 'prs'] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setLeftSideTab(tab)}
                  style={{
                    flex: 1, padding: '8px 0', border: 'none', cursor: 'pointer',
                    fontSize: 12, fontWeight: leftSideTab === tab ? 600 : 400,
                    fontFamily: 'var(--font-sans)',
                    color: leftSideTab === tab ? 'var(--md-primary)' : 'var(--md-on-surface-variant)',
                    background: 'transparent',
                    borderBottom: leftSideTab === tab ? '2px solid var(--md-primary)' : '2px solid transparent',
                    transition: 'all 0.15s',
                  }}
                >
                  {tab === 'branches' ? '分支' : 'PR'}
                </button>
              ))}
            </div>

            {/* Repo name */}
            <div style={{ padding: '8px 12px 4px', fontSize: 11, color: 'var(--md-on-surface-variant)', fontWeight: 500 }}>
              {project.name}
            </div>

            {/* Local branches */}
            {leftSideTab === 'branches' && (
              <div style={{ maxHeight: 180, overflowY: 'auto' }}>
                <div style={{ padding: '4px 12px', fontSize: 10, color: 'var(--md-on-surface-variant)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  本地分支
                </div>
                {localBranches.map(b => (
                  <button
                    key={b.name}
                    onClick={() => handleBranchSwitch(b.name)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      width: '100%', padding: '5px 12px', border: 'none',
                      background: b.current
                        ? (isDark ? 'rgba(79, 219, 200, 0.10)' : 'rgba(0, 107, 95, 0.08)')
                        : 'transparent',
                      color: b.current ? 'var(--md-primary)' : 'var(--md-on-surface)',
                      cursor: 'pointer', fontSize: 12, fontFamily: 'var(--font-mono)',
                      textAlign: 'left', transition: 'all 0.1s',
                    }}
                    onMouseEnter={e => { if (!b.current) e.currentTarget.style.background = isDark ? 'var(--md-surface-container-high)' : 'var(--md-surface-container-high)'; }}
                    onMouseLeave={e => { if (!b.current) e.currentTarget.style.background = 'transparent'; }}
                  >
                    {b.current && <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--md-primary)', flexShrink: 0 }} />}
                    <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.name}</span>
                    {b.ahead > 0 && <span style={{ fontSize: 10, color: 'var(--md-tertiary)' }}>↑{b.ahead}</span>}
                    {b.behind > 0 && <span style={{ fontSize: 10, color: 'var(--md-error)' }}>↓{b.behind}</span>}
                  </button>
                ))}

                {remoteBranches.length > 0 && (
                  <>
                    <div style={{ padding: '8px 12px 4px', fontSize: 10, color: 'var(--md-on-surface-variant)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      远程分支
                    </div>
                    {remoteBranches.map(b => (
                      <button
                        key={b.name}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 8,
                          width: '100%', padding: '5px 12px', border: 'none',
                          background: 'transparent',
                          color: 'var(--md-on-surface-variant)',
                          cursor: 'pointer', fontSize: 12, fontFamily: 'var(--font-mono)',
                          textAlign: 'left',
                        }}
                      >
                        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', opacity: 0.7 }}>{b.name.replace(/^origin\//, '')}</span>
                      </button>
                    ))}
                  </>
                )}
              </div>
            )}

            {leftSideTab === 'prs' && (
              <div style={{ padding: '16px 12px', fontSize: 12, color: 'var(--md-on-surface-variant)', textAlign: 'center' }}>
                PR 管理功能将在后续版本中开放
              </div>
            )}
          </div>

          {/* Staging area / Tags */}
          <Tabs
            activeKey={leftTab}
            onChange={k => setLeftTab(k as 'staging' | 'tags')}
            size="small"
            style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
            tabBarStyle={{ padding: '0 8px', marginBottom: 0, flexShrink: 0 }}
            items={[
              {
                key: 'staging',
                label: `暂存区${stagedCount > 0 ? ` (${stagedCount})` : ''}`,
                children: (
                  <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                    <StagingArea
                      repoPath={repoPath}
                      files={files}
                      loading={loading}
                      onRefresh={refresh}
                      onFileClick={handleFileClick}
                      selectedFile={selectedFile}
                    />
                  </div>
                ),
              },
              {
                key: 'tags',
                label: '标签',
                children: (
                  <div style={{ flex: 1, overflow: 'auto' }}>
                    <GitTagList repoPath={repoPath} onSelect={() => {}} />
                  </div>
                ),
              },
            ]}
          />
        </div>

        {/* Left drag handle */}
        <DragHandle isDragging={isDragging.current === 'left'} onMouseDown={handleDragStart('left')} />

        {/* ── Center: Commit graph + Diff ── */}
        <div style={{ flex: 1, overflow: 'hidden', background: panelBg, display: 'flex', flexDirection: 'column' }}>
          {/* Commit graph section */}
          <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            <div style={{
              padding: '6px 12px', fontSize: 12, fontWeight: 600, color: 'var(--md-on-surface)',
              borderBottom: `1px solid ${panelBorder}`,
              background: isDark ? 'var(--md-surface-container-low)' : 'var(--md-surface-container-low)',
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <span className="material-symbols-outlined" style={{ fontSize: 14 }}>history</span>
              提交历史
              {logResult?.commits && (
                <span style={{ fontSize: 11, color: 'var(--md-on-surface-variant)', fontWeight: 400 }}>
                  ({logResult.commits.length})
                </span>
              )}
            </div>
            <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
              <CommitGraph
                commits={logResult?.commits || []}
                branches={branches}
                selectedHash={selectedGitCommit?.hash}
                onSelect={handleGitCommitSelect}
              />
            </div>
          </div>

          {/* Diff viewer section */}
          <div style={{ height: '40%', minHeight: 200, borderTop: `1px solid ${panelBorder}`, overflow: 'hidden' }}>
            <DiffViewer content={diffContent} loading={diffLoading} title={diffTitle} />
          </div>
        </div>

        {/* Right drag handle */}
        <DragHandle isDragging={isDragging.current === 'right'} onMouseDown={handleDragStart('right')} />

        {/* ── Right: Commit Inspector ── */}
        <div style={{
          width: rightWidth, flexShrink: 0, borderLeft: `1px solid ${panelBorder}`,
          background: panelBg, overflow: 'hidden', display: 'flex', flexDirection: 'column',
        }}>
          {selectedGitCommit ? (
            <CommitInspector commit={selectedGitCommit} />
          ) : (
            <div style={{ padding: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--md-on-surface)', marginBottom: 12 }}>
                <span className="material-symbols-outlined" style={{ fontSize: 16, verticalAlign: 'middle', marginRight: 6 }}>info</span>
                提交详情
              </div>
              <div style={{ fontSize: 12, color: 'var(--md-on-surface-variant)', textAlign: 'center', padding: '24px 0' }}>
                选择一个提交查看详情
              </div>
            </div>
          )}
        </div>
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
          已暂存 {stagedCount} 个文件
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
    </div>
  );
}

// ── Commit Inspector ──

function CommitInspector({ commit }: { commit: GitCommit }) {
  const isDark = useThemeStore(s => s.mode === 'dark');
  const copyHash = () => {
    navigator.clipboard.writeText(commit.hash);
    message.success('已复制完整 hash');
  };

  return (
    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--md-on-surface)', display: 'flex', alignItems: 'center', gap: 6 }}>
        <span className="material-symbols-outlined" style={{ fontSize: 16 }}>info</span>
        提交详情
      </div>

      <div style={{
        padding: 12, borderRadius: 8,
        background: isDark ? 'var(--md-surface-container-low)' : 'var(--md-surface-container-low)',
        border: "1px solid var(--border)",
      }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--md-on-surface)', marginBottom: 6, lineHeight: '18px' }}>
          {commit.message}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <span style={{
            fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 600,
            color: 'var(--md-primary)',
          }}>
            {commit.shortHash}
          </span>
        </div>
        <div style={{ fontSize: 12, color: 'var(--md-on-surface-variant)', display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div><strong>作者：</strong>{commit.author}</div>
          <div><strong>时间：</strong>{new Date(commit.date).toLocaleString('zh-CN')}</div>
          {commit.branches && commit.branches.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
              {commit.branches.map(b => (
                <span key={b} style={{
                  padding: '1px 6px', borderRadius: 4, fontSize: 10,
                  background: 'var(--md-primary)', color: 'var(--md-on-primary)',
                  fontFamily: 'var(--font-mono)',
                }}>
                  {b}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        <Button size="small" block onClick={copyHash}>
          <span className="material-symbols-outlined" style={{ fontSize: 14, marginRight: 4 }}>content_copy</span>
          复制 Hash
        </Button>
      </div>

      {/* Repo Insights */}
      <div style={{
        marginTop: 8, padding: 12, borderRadius: 8,
        background: isDark ? 'var(--md-surface-container-low)' : 'var(--md-surface-container-low)',
        border: "1px solid var(--border)",
      }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--md-on-surface-variant)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          仓库概览
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 600, color: 'var(--md-on-surface)' }}>—</div>
            <div style={{ fontSize: 11, color: 'var(--md-on-surface-variant)' }}>总提交</div>
          </div>
          <div>
            <div style={{ fontSize: 18, fontWeight: 600, color: 'var(--md-on-surface)' }}>—</div>
            <div style={{ fontSize: 11, color: 'var(--md-on-surface-variant)' }}>活跃分支</div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Drag Handle ──

function DragHandle({ isDragging, onMouseDown }: {
  isDragging: boolean;
  onMouseDown: (e: React.MouseEvent) => void;
}) {
  return (
    <div
      onMouseDown={onMouseDown}
      style={{
        width: 6, flexShrink: 0, cursor: 'col-resize',
        background: isDragging ? 'var(--md-primary)' : 'transparent',
        transition: 'background 0.15s',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
      onMouseEnter={(e) => { if (!isDragging) e.currentTarget.style.background = 'rgba(0, 107, 95, 0.15)'; }}
      onMouseLeave={(e) => { if (!isDragging) e.currentTarget.style.background = 'transparent'; }}
    >
      <div style={{
        width: 2, height: 20, borderRadius: 1,
        background: isDragging ? 'var(--md-primary)' : 'var(--md-outline)',
        opacity: isDragging ? 0.8 : 0.3,
        transition: 'opacity 0.15s',
      }} />
    </div>
  );
}
