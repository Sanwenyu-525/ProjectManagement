import { useState } from 'react';
import { Button, Input, Checkbox, Spin, message } from 'antd';
import {
  PlusOutlined,
  FileOutlined, DiffOutlined,
} from '@ant-design/icons';
import { gitApi } from '../../../api';
import { isEnterCommit } from '@/lib/keyboard';

interface FileEntry {
  path: string;
  status: string;
  staged: boolean;
}

interface StagingAreaProps {
  repoPath: string;
  files: FileEntry[];
  loading: boolean;
  onRefresh: () => void;
  onFileClick: (file: string, staged: boolean) => void;
  selectedFile?: string;
}

const STATUS_LABELS: Record<string, { text: string; color: string }> = {
  Modified: { text: 'M', color: 'var(--color-amber)' },
  Added: { text: 'A', color: 'var(--color-status-done)' },
  Deleted: { text: 'D', color: 'var(--color-status-cancel)' },
  Renamed: { text: 'R', color: 'var(--color-purple)' },
  Untracked: { text: 'U', color: 'var(--color-text-description)' },
  Conflicted: { text: 'C', color: 'var(--color-status-cancel)' },
  TypeChanged: { text: 'T', color: 'var(--color-purple)' },
};

export default function StagingArea({ repoPath, files, loading, onRefresh, onFileClick, selectedFile }: StagingAreaProps) {
  const [commitMsg, setCommitMsg] = useState('');
  const [committing, setCommitting] = useState(false);
  const [staging, setStaging] = useState(false);

  const stagedFiles = files.filter(f => f.staged);
  const unstagedFiles = files.filter(f => !f.staged);

  const handleStage = async (filePaths: string[]) => {
    setStaging(true);
    try {
      await gitApi.add(repoPath, filePaths);
      onRefresh();
    } catch (err) {
      message.error(String(err));
    } finally {
      setStaging(false);
    }
  };

  const handleUnstage = async (filePaths: string[]) => {
    setStaging(true);
    try {
      await gitApi.unstage(repoPath, filePaths);
      onRefresh();
    } catch (err) {
      message.error(String(err));
    } finally {
      setStaging(false);
    }
  };

  const handleUnstageAll = async () => {
    setStaging(true);
    try {
      await gitApi.unstage(repoPath, stagedFiles.map(f => f.path));
      onRefresh();
    } catch (err) {
      message.error(String(err));
    } finally {
      setStaging(false);
    }
  };

  const handleCommit = async () => {
    if (!commitMsg.trim()) {
      message.warning('请输入提交信息');
      return;
    }
    if (stagedFiles.length === 0) {
      message.warning('没有暂存的文件');
      return;
    }
    setCommitting(true);
    try {
      await gitApi.commit(repoPath, commitMsg.trim());
      message.success('提交成功');
      setCommitMsg('');
      onRefresh();
    } catch (err) {
      message.error(String(err));
    } finally {
      setCommitting(false);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
        <Spin />
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Staged files */}
      <div style={{ flex: stagedFiles.length > 0 ? 'none' : 1, overflow: 'auto', borderBottom: '1px solid var(--color-border-subtle)' }}>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '8px 12px', fontSize: 12, fontWeight: 600, color: 'var(--color-text-primary)',
        }}>
          <span>暂存区 ({stagedFiles.length})</span>
          {stagedFiles.length > 0 && (
            <Button type="text" size="small" onClick={handleUnstageAll}
              style={{ fontSize: 11, color: 'var(--color-text-secondary)', padding: '0 4px' }}>
              全部取消
            </Button>
          )}
        </div>
        {stagedFiles.length === 0 ? (
          <div style={{ padding: '8px 12px', fontSize: 12, color: 'var(--color-text-muted)' }}>无暂存文件</div>
        ) : (
          stagedFiles.map(f => (
            <FileRow
              key={`s-${f.path}`}
              file={f}
              checked
              onToggle={() => handleUnstage([f.path])}
              onClick={() => onFileClick(f.path, true)}
              selected={selectedFile === f.path}
              disabled={staging}
            />
          ))
        )}
      </div>

      {/* Unstaged files */}
      <div style={{ flex: 1, overflow: 'auto', borderBottom: '1px solid var(--color-border-subtle)' }}>
        <div style={{
          position: 'sticky', top: 0, zIndex: 1,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '8px 12px', fontSize: 12, fontWeight: 600, color: 'var(--color-text-primary)',
          background: 'var(--color-bg-card)', backdropFilter: 'blur(8px)',
        }}>
          <span>更改 ({unstagedFiles.length})</span>
          {unstagedFiles.length > 0 && (
            <Button type="text" size="small"
              icon={<PlusOutlined />}
              onClick={() => handleStage(unstagedFiles.map(f => f.path))}
              style={{ fontSize: 11, color: 'var(--color-primary)', padding: '0 4px' }}
              disabled={staging}>
              全部暂存
            </Button>
          )}
        </div>
        {unstagedFiles.length === 0 ? (
          <div style={{ padding: '8px 12px', fontSize: 12, color: 'var(--color-text-muted)' }}>工作区干净</div>
        ) : (
          unstagedFiles.map(f => (
            <FileRow
              key={`u-${f.path}`}
              file={f}
              checked={false}
              onToggle={() => handleStage([f.path])}
              onClick={() => onFileClick(f.path, false)}
              selected={selectedFile === f.path}
              disabled={staging}
            />
          ))
        )}
      </div>

      {/* Commit form */}
      <div style={{ padding: 12, flexShrink: 0 }}>
        <Input.TextArea
          value={commitMsg}
          onChange={e => setCommitMsg(e.target.value)}
          placeholder="提交信息..."
          autoSize={{ minRows: 2, maxRows: 4 }}
          style={{ fontSize: 12, marginBottom: 8 }}
          onKeyDown={e => {
            if (isEnterCommit(e) && (e.ctrlKey || e.metaKey)) {
              e.preventDefault();
              handleCommit();
            }
          }}
        />
        <Button
          type="primary"
          block
          icon={<DiffOutlined />}
          onClick={handleCommit}
          loading={committing}
          disabled={stagedFiles.length === 0 || !commitMsg.trim()}
          style={{ fontSize: 12 }}
        >
          提交 ({stagedFiles.length})
        </Button>
      </div>
    </div>
  );
}

function FileRow({ file, checked, onToggle, onClick, selected, disabled }: {
  file: FileEntry;
  checked: boolean;
  onToggle: () => void;
  onClick: () => void;
  selected: boolean;
  disabled: boolean;
}) {
  const info = STATUS_LABELS[file.status] || { text: '?', color: 'var(--color-text-secondary)' };

  return (
    <div
      role="button"
      tabIndex={0}
      style={{
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '5px 12px', cursor: 'pointer', fontSize: 12,
        background: selected ? 'var(--color-primary-light)' : 'transparent',
        transition: 'background 0.1s',
        outline: 'none',
      }}
      onClick={onClick}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } }}
      onFocus={(e) => { if (!selected) e.currentTarget.style.background = 'var(--color-bg-card)'; }}
      onBlur={(e) => { if (!selected) e.currentTarget.style.background = 'transparent'; }}
      onMouseEnter={e => { if (!selected) e.currentTarget.style.background = 'var(--color-bg-card)'; }}
      onMouseLeave={e => { if (!selected) e.currentTarget.style.background = 'transparent'; }}
    >
      <Checkbox checked={checked} onChange={onToggle} disabled={disabled} onClick={e => e.stopPropagation()} />
      <FileOutlined style={{ fontSize: 11, color: 'var(--color-text-muted)' }} />
      <span style={{
        display: 'inline-block', minWidth: 16, height: 16, textAlign: 'center',
        fontSize: 10, fontWeight: 700, color: info.color,
        background: `${info.color}15`, borderRadius: 3, lineHeight: '16px',
        padding: '0 2px',
      }}>
        {info.text}
      </span>
      <span style={{ color: 'var(--color-text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {file.path}
      </span>
    </div>
  );
}
