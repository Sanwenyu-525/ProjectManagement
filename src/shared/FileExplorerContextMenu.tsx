import { useState, useEffect, useRef } from 'react';
import { useThemeStore } from '../stores/themeStore';

export interface ClipboardState {
  type: 'copy' | 'cut';
  path: string;
  isDir: boolean;
}

interface ContextMenuItem {
  key?: string;
  label?: string;
  icon?: React.ReactNode;
  onClick?: () => void;
  type?: 'divider';
  style?: React.CSSProperties;
}

export function ContextMenu({
  x, y, path, isDir, clipboard,
  onClose, onCopyPath, onCopyName, onOpenInExplorer, onOpenInTerminal,
  onRefresh, onCreateFile, onCreateFolder, onRename, onDelete,
  onCopy, onCut, onPaste, onSystemPaste, onRemoveDir,
}: {
  x: number; y: number; path: string; isDir: boolean;
  clipboard: ClipboardState | null;
  onClose: () => void;
  onCopyPath: (path: string) => void;
  onCopyName: (path: string) => void;
  onOpenInExplorer: (path: string) => void;
  onOpenInTerminal: (path: string) => void;
  onRefresh: (path: string) => void;
  onCreateFile: (path: string) => void;
  onCreateFolder: (path: string) => void;
  onRename: (path: string) => void;
  onDelete: (path: string, isDir: boolean) => void;
  onCopy: (path: string, isDir: boolean) => void;
  onCut: (path: string, isDir: boolean) => void;
  onPaste: (targetDir: string) => void;
  onSystemPaste: (targetDir: string) => void;
  onRemoveDir: (path: string) => void;
}) {
  const isDark = useThemeStore(s => s.mode === 'dark');
  const menuRef = useRef<HTMLDivElement>(null);
  const [menuX, setMenuX] = useState(x);
  const [menuY, setMenuY] = useState(y);

  useEffect(() => {
    const el = menuRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const maxX = window.innerWidth - rect.width - 8;
    const maxY = window.innerHeight - rect.height - 8;
    if (x > maxX) setMenuX(Math.max(0, maxX));
    if (y > maxY) setMenuY(Math.max(0, maxY));
  }, [x, y]);

  const items: ContextMenuItem[] = [];

  if (isDir) {
    items.push(
      { key: 'createFile', label: '新建文件', icon: <span className="material-symbols-outlined" style={{ fontSize: 16 }}>note_add</span>, onClick: () => { onCreateFile(path); onClose(); } },
      { key: 'createFolder', label: '新建文件夹', icon: <span className="material-symbols-outlined" style={{ fontSize: 16 }}>create_new_folder</span>, onClick: () => { onCreateFolder(path); onClose(); } },
      { type: 'divider' },
    );
  }

  items.push(
    { key: 'copy', label: '复制', icon: <span className="material-symbols-outlined" style={{ fontSize: 16 }}>content_copy</span>, onClick: () => { onCopy(path, isDir); onClose(); } },
    { key: 'cut', label: '剪切', icon: <span className="material-symbols-outlined" style={{ fontSize: 16 }}>content_cut</span>, onClick: () => { onCut(path, isDir); onClose(); } },
  );

  if (clipboard) {
    items.push(
      { key: 'paste', label: '粘贴', icon: <span className="material-symbols-outlined" style={{ fontSize: 16 }}>content_paste</span>, onClick: () => { onPaste(isDir ? path : path.replace(/[\\/][^\\/]+$/, '')); onClose(); } },
    );
  }

  items.push(
    { key: 'systemPaste', label: '从系统剪贴板粘贴', icon: <span className="material-symbols-outlined" style={{ fontSize: 16 }}>content_paste_go</span>, onClick: () => { onSystemPaste(isDir ? path : path.replace(/[\\/][^\\/]+$/, '')); onClose(); } },
  );

  items.push(
    { type: 'divider' },
    { key: 'copyPath', label: '复制路径', icon: <span className="material-symbols-outlined" style={{ fontSize: 16 }}>link</span>, onClick: () => { onCopyPath(path); onClose(); } },
    { key: 'copyName', label: '复制文件名', icon: <span className="material-symbols-outlined" style={{ fontSize: 16 }}>badge</span>, onClick: () => { onCopyName(path); onClose(); } },
    { type: 'divider' },
    { key: 'openExplorer', label: '在资源管理器中打开', icon: <span className="material-symbols-outlined" style={{ fontSize: 16 }}>folder_open</span>, onClick: () => { onOpenInExplorer(path); onClose(); } },
    { key: 'openTerminal', label: '在终端中打开', icon: <span className="material-symbols-outlined" style={{ fontSize: 16 }}>terminal</span>, onClick: () => { onOpenInTerminal(path); onClose(); } },
  );

  if (isDir) {
    items.push(
      { type: 'divider' },
      { key: 'refresh', label: '刷新', icon: <span className="material-symbols-outlined" style={{ fontSize: 16 }}>refresh</span>, onClick: () => { onRefresh(path); onClose(); } },
    );
  }

  items.push(
    { type: 'divider' },
    { key: 'rename', label: '重命名', icon: <span className="material-symbols-outlined" style={{ fontSize: 16 }}>edit</span>, onClick: () => { onRename(path); onClose(); } },
    { key: 'delete', label: '删除', icon: <span className="material-symbols-outlined" style={{ fontSize: 16 }}>delete</span>, style: { color: 'var(--md-error)' }, onClick: () => { onDelete(path, isDir); onClose(); } },
  );

  if (isDir) {
    items.push(
      { type: 'divider' },
      { key: 'remove', label: '从列表中移除', icon: <span className="material-symbols-outlined" style={{ fontSize: 16 }}>remove_circle_outline</span>, onClick: () => { onRemoveDir(path); onClose(); } },
    );
  }

  return (
    <div
      ref={menuRef}
      role="menu"
      aria-label="文件操作"
      onKeyDown={e => {
        if (e.key === 'Escape') onClose();
      }}
      style={{
        position: 'fixed',
        left: menuX,
        top: menuY,
        zIndex: 1000,
        background: isDark ? 'var(--md-surface-container-high)' : '#fff',
        border: '1px solid var(--border)',
        borderRadius: 8,
        padding: '4px 0',
        boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
        minWidth: 180,
      }}
    >
      {items.map((item, index) => {
        if (item.type === 'divider') {
          return (
            <div
              key={`divider-${index}`}
              style={{
                height: 1,
                background: isDark ? 'var(--md-outline-variant)' : 'rgba(187, 202, 198, 0.3)',
                margin: '4px 0',
              }}
            />
          );
        }
        return (
          <div
            key={item.key}
            role="menuitem"
            tabIndex={0}
            onKeyDown={e => {
              if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); item.onClick?.(); }
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '6px 12px',
              fontSize: 12,
              color: item.style?.color || 'var(--md-on-surface)',
              cursor: 'pointer',
              transition: 'background 0.1s',
              outline: 'none',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--md-surface-container-low)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
            onFocus={e => { e.currentTarget.style.background = 'var(--md-surface-container-low)'; }}
            onBlur={e => { e.currentTarget.style.background = 'transparent'; }}
            onClick={item.onClick}
          >
            {item.icon}
            {item.label}
          </div>
        );
      })}
    </div>
  );
}
