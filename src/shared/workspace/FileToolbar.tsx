import { useState } from 'react';
import {
  SaveOutlined,
  CodeOutlined,
  SearchOutlined,
  ReloadOutlined,
  BranchesOutlined,
} from '@ant-design/icons';

interface Props {
  filePath: string | null;
  isDirty: boolean;
  isWritable: boolean;
  isBinary: boolean;
  language: string;
  lineCount: number;
  fileSize: number;
  hasGitChange?: boolean;
  onSave: () => void;
  onOpenIde: (ide: string) => void;
  onRefresh: () => void;
  onToggleSearch: () => void;
  onViewDiff?: (filePath: string) => void;
}

const IDE_OPTIONS = [
  { id: 'vscode', label: 'VSCode', color: '#007acc' },
  { id: 'cursor', label: 'Cursor', color: '#7c3aed' },
  { id: 'windsurf', label: 'Windsurf', color: '#0ea5e9' },
];

export default function FileToolbar({
  filePath,
  isDirty,
  isWritable,
  isBinary,
  language,
  lineCount,
  fileSize,
  hasGitChange,
  onSave,
  onOpenIde,
  onRefresh,
  onToggleSearch,
  onViewDiff,
}: Props) {
  const [ideMenuOpen, setIdeMenuOpen] = useState(false);

  return (
    <div style={styles.toolbar}>
      <div style={styles.left}>
        {filePath && (
          <span style={styles.path}>{filePath.split(/[/\\]/).pop()}</span>
        )}
        {isDirty && <span style={styles.dirtyDot}>●</span>}
        {!isWritable && filePath && (
          <span style={styles.readOnly}>只读</span>
        )}
      </div>

      <div style={styles.right}>
        {filePath && !isBinary && (
          <span style={styles.info}>
            {language} · {lineCount} 行 · {formatSize(fileSize)}
          </span>
        )}

        <button
          onClick={onToggleSearch}
          style={styles.btn}
          title="搜索 (Ctrl+F)"
        >
          <SearchOutlined style={{ fontSize: 11 }} />
        </button>

        {hasGitChange && filePath && onViewDiff && (
          <button
            onClick={() => onViewDiff(filePath)}
            style={{ ...styles.btn, ...styles.diffBtn }}
            title="查看 Diff"
          >
            <BranchesOutlined style={{ fontSize: 11 }} />
            <span style={styles.diffLabel}>Diff</span>
          </button>
        )}

        {isDirty && isWritable && (
          <button
            onClick={onSave}
            style={{ ...styles.btn, ...styles.saveBtn }}
            title="保存 (Ctrl+S)"
          >
            <SaveOutlined style={{ fontSize: 11 }} />
            <span style={styles.saveLabel}>保存</span>
          </button>
        )}

        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setIdeMenuOpen(!ideMenuOpen)}
            style={styles.btn}
            title="在 IDE 中打开"
            onBlur={() => setTimeout(() => setIdeMenuOpen(false), 150)}
          >
            <CodeOutlined style={{ fontSize: 11 }} />
          </button>
          {ideMenuOpen && (
            <div style={styles.ideMenu}>
              {IDE_OPTIONS.map(ide => (
                <button
                  key={ide.id}
                  onClick={() => {
                    onOpenIde(ide.id);
                    setIdeMenuOpen(false);
                  }}
                  style={styles.ideItem}
                >
                  <span style={{ ...styles.ideDot, background: ide.color }} />
                  {ide.label}
                </button>
              ))}
            </div>
          )}
        </div>

        <button onClick={onRefresh} style={styles.btn} title="刷新">
          <ReloadOutlined style={{ fontSize: 11 }} />
        </button>
      </div>
    </div>
  );
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const styles: Record<string, React.CSSProperties> = {
  toolbar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 30,
    padding: '0 8px',
    background: 'rgba(255, 255, 255, 0.03)',
    borderBottom: '1px solid var(--ws-border-subtle)',
    flexShrink: 0,
    gap: 6,
  },
  left: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    overflow: 'hidden',
    flex: 1,
  },
  path: {
    fontSize: 11,
    color: 'var(--ws-text)',
    fontFamily: "'Fira Code', monospace",
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  dirtyDot: {
    fontSize: 12,
    color: '#fbbf24',
    flexShrink: 0,
  },
  readOnly: {
    fontSize: 9,
    color: 'var(--ws-text-muted)',
    background: 'var(--ws-border-subtle)',
    padding: '0 4px',
    borderRadius: 3,
    lineHeight: '14px',
    flexShrink: 0,
  },
  right: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    flexShrink: 0,
  },
  info: {
    fontSize: 10,
    color: 'var(--ws-text-muted)',
    fontFamily: "'Fira Code', monospace",
    marginRight: 4,
    whiteSpace: 'nowrap',
  },
  btn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    height: 22,
    padding: '0 6px',
    borderRadius: 4,
    border: 'none',
    background: 'transparent',
    color: 'var(--ws-text-secondary)',
    cursor: 'pointer',
    fontSize: 11,
    fontFamily: "'Fira Code', monospace",
  },
  saveBtn: {
    background: 'rgba(99, 102, 241, 0.15)',
    color: '#818cf8',
  },
  saveLabel: {
    fontSize: 10,
  },
  diffBtn: {
    background: 'rgba(139, 92, 246, 0.15)',
    color: '#a78bfa',
  },
  diffLabel: {
    fontSize: 10,
  },
  ideMenu: {
    position: 'absolute',
    top: '100%',
    right: 0,
    marginTop: 4,
    background: 'rgba(15, 23, 42, 0.95)',
    border: '1px solid var(--ws-border)',
    borderRadius: 6,
    padding: '4px 0',
    zIndex: 100,
    minWidth: 120,
    boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
  },
  ideItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    width: '100%',
    padding: '5px 12px',
    border: 'none',
    background: 'transparent',
    color: 'var(--ws-text)',
    fontSize: 11,
    fontFamily: "'Fira Sans', sans-serif",
    cursor: 'pointer',
    textAlign: 'left',
  },
  ideDot: {
    width: 6,
    height: 6,
    borderRadius: '50%',
    flexShrink: 0,
  },
};
