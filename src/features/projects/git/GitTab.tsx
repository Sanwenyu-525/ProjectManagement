import { useState, useEffect, useCallback, useRef } from 'react';
import { Spin, message, Button, Tooltip, Tabs } from 'antd';
import { ReloadOutlined, CloudUploadOutlined, InboxOutlined } from '@ant-design/icons';
import { gitApi } from '../../../api';
import BranchSelector from './BranchSelector';
import CommitGraph from './CommitGraph';
import DiffViewer from './DiffViewer';
import StagingArea from './StagingArea';
import GitTagList from './GitTagList';

interface GitTabProps {
  project: {
    id: string;
    localPath?: string;
    name: string;
  };
}

export default function GitTab({ project }: GitTabProps) {
  const repoPath = project.localPath;

  const [loading, setLoading] = useState(true);
  const [files, setFiles] = useState<any[]>([]);
  const [logResult, setLogResult] = useState<any>(null);

  const [selectedCommit, setSelectedCommit] = useState<any>(null);
  const [selectedFile, setSelectedFile] = useState<string | undefined>();
  const [diffContent, setDiffContent] = useState('');
  const [diffLoading, setDiffLoading] = useState(false);

  const [pushing, setPushing] = useState(false);

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
      const newWidth = Math.max(180, Math.min(500, startWidth.current + diff));
      setLeftWidth(newWidth);
    } else if (isDragging.current === 'right') {
      const newWidth = Math.max(250, startWidth.current - diff);
      setRightWidth(newWidth);
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

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleFileClick = useCallback(async (file: string, staged: boolean) => {
    if (!repoPath) return;
    setSelectedFile(file);
    setSelectedCommit(null);
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

  const handleCommitSelect = useCallback(async (commit: any) => {
    if (!repoPath) return;
    setSelectedCommit(commit);
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

  // Branches come from logResult (already fetched, avoids double git branch call)
  const branches = logResult?.branches || [];

  const diffTitle = selectedCommit
    ? `${selectedCommit.shortHash} - ${selectedCommit.message}`
    : selectedFile;

  if (!repoPath) {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        height: 300, color: '#9eadc0',
      }}>
        <InboxOutlined style={{ fontSize: 48, marginBottom: 12, color: '#c4d0de' }} />
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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      {/* Toolbar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '8px 0', marginBottom: 8,
        borderBottom: '1px solid var(--color-border)',
      }}>
        <BranchSelector
          branches={branches}
          onSwitch={handleBranchSwitch}
          loading={loading}
        />
        <div style={{ flex: 1 }} />
        {branches.some((b: any) => b.current && b.upstream) && (
          <Tooltip title="推送到远程">
            <Button
              size="small"
              icon={<CloudUploadOutlined />}
              onClick={handlePush}
              loading={pushing}
              style={{ fontSize: 12 }}
            >
              Push
            </Button>
          </Tooltip>
        )}
        <Tooltip title="刷新">
          <Button
            size="small"
            icon={<ReloadOutlined />}
            onClick={refresh}
            loading={loading}
          />
        </Tooltip>
      </div>

      {/* Three-panel layout */}
      <div
        style={{ flex: 1, display: 'flex', gap: 1, overflow: 'hidden', borderRadius: 8, border: '1px solid var(--color-border)' }}
        onMouseMove={handleDrag}
        onMouseUp={handleDragEnd}
        onMouseLeave={handleDragEnd}
      >
        {/* Left: Staging area + Tags */}
        <div style={{
          width: leftWidth, flexShrink: 0, borderRight: '1px solid var(--color-border)',
          background: 'var(--color-bg-card)', overflow: 'hidden', display: 'flex', flexDirection: 'column',
        }}>
          <Tabs
            defaultActiveKey="staging"
            size="small"
            style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
            tabBarStyle={{ padding: '0 8px', marginBottom: 0, flexShrink: 0 }}
            items={[
              {
                key: 'staging',
                label: '暂存区',
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
                    <GitTagList
                      repoPath={repoPath}
                      onSelect={() => {}}
                    />
                  </div>
                ),
              },
            ]}
          />
        </div>

        {/* Left drag handle */}
        <DragHandle isDragging={isDragging.current === 'left'} onMouseDown={handleDragStart('left')} />

        {/* Center: Commit graph */}
        <div style={{
          flex: 1, overflow: 'hidden',
          background: 'var(--color-bg-card)',
        }}>
          <div style={{
            padding: '6px 12px', fontSize: 12, fontWeight: 600, color: 'var(--color-text-primary)',
            borderBottom: '1px solid var(--color-border)', background: 'var(--color-bg-surface)',
          }}>
            提交历史
          </div>
          <CommitGraph
            commits={logResult?.commits || []}
            branches={branches}
            selectedHash={selectedCommit?.hash}
            onSelect={handleCommitSelect}
          />
        </div>

        {/* Right drag handle */}
        <DragHandle isDragging={isDragging.current === 'right'} onMouseDown={handleDragStart('right')} />

        {/* Right: Diff viewer */}
        <div style={{
          width: rightWidth, flexShrink: 0, borderLeft: '1px solid var(--color-border)',
          background: 'var(--color-bg-card)', overflow: 'hidden',
        }}>
          <DiffViewer
            content={diffContent}
            loading={diffLoading}
            title={diffTitle}
          />
        </div>
      </div>
    </div>
  );
}

function DragHandle({ isDragging, onMouseDown }: {
  isDragging: boolean;
  onMouseDown: (e: React.MouseEvent) => void;
}) {
  return (
    <div
      onMouseDown={onMouseDown}
      style={{
        width: 8, flexShrink: 0, cursor: 'col-resize',
        background: isDragging ? 'rgba(34,197,94,0.4)' : 'transparent',
        transition: 'background 0.15s',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
      onMouseEnter={(e) => { if (!isDragging) e.currentTarget.style.background = 'rgba(34,197,94,0.2)'; }}
      onMouseLeave={(e) => { if (!isDragging) e.currentTarget.style.background = 'transparent'; }}
    >
      <div style={{
        width: 2, height: 20, borderRadius: 1,
        background: isDragging ? 'var(--color-primary)' : 'var(--color-text-muted)',
        opacity: isDragging ? 0.8 : 0.4,
        transition: 'opacity 0.15s',
      }} />
    </div>
  );
}