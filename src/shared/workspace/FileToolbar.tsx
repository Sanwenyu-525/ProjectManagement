import { useState, useRef, useCallback } from 'react';
import {
  SaveOutlined,
  AppstoreOutlined,
  SearchOutlined,
  ReloadOutlined,
  BranchesOutlined,
} from '@ant-design/icons';
import { useThemeStore } from '../../stores/themeStore';
import { formatSize } from './file-utils';

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
  const [menuStyle, setMenuStyle] = useState<React.CSSProperties>({});
  const btnRef = useRef<HTMLButtonElement>(null);
  const isDark = useThemeStore(s => s.mode === 'dark');
  const styles = makeStyles(isDark);

  const openIdeMenu = useCallback(() => {
    setIdeMenuOpen(true);
    requestAnimationFrame(() => {
      const btn = btnRef.current;
      if (!btn) return;
      const r = btn.getBoundingClientRect();
      const menuW = 120;
      const gap = 4;
      let left = r.left + r.width / 2 - menuW / 2;
      left = Math.max(8, Math.min(left, window.innerWidth - menuW - 8));
      setMenuStyle({
        position: 'fixed',
        top: r.bottom + gap,
        left,
        width: menuW,
      });
    });
  }, []);

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
            ref={btnRef}
            onClick={() => ideMenuOpen ? setIdeMenuOpen(false) : openIdeMenu()}
            style={styles.btn}
            title="在 IDE 中打开"
            onBlur={() => setTimeout(() => setIdeMenuOpen(false), 150)}
          >
            <AppstoreOutlined style={{ fontSize: 11 }} />
          </button>
          {ideMenuOpen && (
            <div style={{ ...styles.ideMenu, ...menuStyle }}>
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

function makeStyles(isDark: boolean): Record<string, React.CSSProperties> {
  return {
    toolbar: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      height: 30,
      padding: '0 8px',
      background: 'var(--ws-statusbar-bg, rgba(255, 255, 255, 0.03))',
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
      background: 'var(--ws-active-bg, rgba(99, 102, 241, 0.15))',
      color: isDark ? '#818cf8' : 'var(--ws-cursor, #4f46e5)',
    },
    saveLabel: {
      fontSize: 10,
    },
    diffBtn: {
      background: 'var(--color-purple-light)',
      color: 'var(--color-purple)',
    },
    diffLabel: {
      fontSize: 10,
    },
    ideMenu: {
      position: 'absolute',
      top: '100%',
      right: 0,
      marginTop: 4,
      background: 'var(--ws-contextmenu-bg, rgba(255, 255, 255, 0.92))',
      border: '1px solid var(--ws-border)',
      borderRadius: 6,
      padding: '4px 0',
      zIndex: 100,
      minWidth: 120,
      boxShadow: isDark ? '0 4px 16px rgba(0,0,0,0.3)' : '0 4px 16px rgba(0,0,0,0.12)',
      backdropFilter: 'blur(12px)',
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
}
