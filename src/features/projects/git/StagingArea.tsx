import { useState } from 'react';
import { Button, Input, Checkbox, Spin, message } from 'antd';
import {
  PlusOutlined,
  FileOutlined, DiffOutlined,
} from '@ant-design/icons';
import { gitApi } from '../../../api';

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
  Modified: { text: 'M', color: '#f59e0b' },
  Added: { text: 'A', color: '#22c55e' },
  Deleted: { text: 'D', color: '#ef4444' },
  Renamed: { text: 'R', color: '#8b5cf6' },
  Untracked: { text: 'U', color: '#6b7a99' },
  Conflicted: { text: 'C', color: '#ef4444' },
  TypeChanged: { text: 'T', color: '#6366f1' },
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
      <div style={{ flex: stagedFiles.length > 0 ? 'none' : 1, overflow: 'auto', borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '8px 12px', fontSize: 12, fontWeight: 600, color: '#1a1f36',
        }}>
          <span>暂存区 ({stagedFiles.length})</span>
          {stagedFiles.length > 0 && (
            <Button type="text" size="small" onClick={handleUnstageAll}
              style={{ fontSize: 11, color: '#6b7a99', padding: '0 4px' }}>
              全部取消
            </Button>
          )}
        </div>
        {stagedFiles.length === 0 ? (
          <div style={{ padding: '8px 12px', fontSize: 12, color: '#9eadc0' }}>无暂存文件</div>
        ) : (
          stagedFiles.map(f => (
            <FileRow
              key={`s-${f.path}`}
              file={f}
              checked
              onToggle={() => handleStage([f.path])}
              onClick={() => onFileClick(f.path, true)}
              selected={selectedFile === f.path}
              disabled={staging}
            />
          ))
        )}
      </div>

      {/* Unstaged files */}
      <div style={{ flex: 1, overflow: 'auto', borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '8px 12px', fontSize: 12, fontWeight: 600, color: '#1a1f36',
        }}>
          <span>更改 ({unstagedFiles.length})</span>
          {unstagedFiles.length > 0 && (
            <Button type="text" size="small"
              icon={<PlusOutlined />}
              onClick={() => handleStage(unstagedFiles.map(f => f.path))}
              style={{ fontSize: 11, color: '#22c55e', padding: '0 4px' }}
              disabled={staging}>
              全部暂存
            </Button>
          )}
        </div>
        {unstagedFiles.length === 0 ? (
          <div style={{ padding: '8px 12px', fontSize: 12, color: '#9eadc0' }}>工作区干净</div>
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
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
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
  const info = STATUS_LABELS[file.status] || { text: '?', color: '#6b7a99' };

  return (
    <div
      style={{
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '4px 12px', cursor: 'pointer', fontSize: 12,
        background: selected ? 'rgba(34,197,94,0.08)' : 'transparent',
        transition: 'background 0.1s',
      }}
      onClick={onClick}
      onMouseEnter={e => { if (!selected) e.currentTarget.style.background = 'rgba(0,0,0,0.02)'; }}
      onMouseLeave={e => { if (!selected) e.currentTarget.style.background = 'transparent'; }}
    >
      <Checkbox checked={checked} onChange={onToggle} disabled={disabled} onClick={e => e.stopPropagation()} />
      <FileOutlined style={{ fontSize: 11, color: '#9eadc0' }} />
      <span style={{
        display: 'inline-block', width: 14, textAlign: 'center',
        fontSize: 10, fontWeight: 700, color: info.color,
        background: `${info.color}15`, borderRadius: 2, lineHeight: '16px',
      }}>
        {info.text}
      </span>
      <span style={{ color: '#1a1f36', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {file.path}
      </span>
    </div>
  );
}
