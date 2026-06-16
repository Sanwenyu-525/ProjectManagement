import { useState, useCallback, useEffect, useLayoutEffect, useRef } from 'react';
import { CaretRightOutlined, CaretDownOutlined, LoadingOutlined, EditOutlined, DeleteOutlined, CopyOutlined, FileAddOutlined, FolderAddOutlined, BranchesOutlined, UndoOutlined, CodeOutlined } from '@ant-design/icons';
import { filesApi, type FileEntry } from '../../api';
import { getFileIcon } from './file-utils';
import { isEnterCommit } from '@/lib/keyboard';
import { useThemeStore } from '../../stores/themeStore';

interface GitChange {
  path: string;
  status: string;
  staged: boolean;
}

function getGitStatusForFile(changes: GitChange[], filePath: string): GitChange | undefined {
  return changes.find(c => c.path === filePath);
}

function getGitCountsForDir(changes: GitChange[], dirPath: string): { added: number; modified: number; deleted: number } {
  const prefix = dirPath.endsWith('/') || dirPath.endsWith('\\') ? dirPath : dirPath + '/';
  const prefixBack = dirPath.endsWith('\\') ? dirPath : dirPath + '\\';
  let added = 0, modified = 0, deleted = 0;
  for (const c of changes) {
    if (c.path.startsWith(prefix) || c.path.startsWith(prefixBack)) {
      if (c.status === 'Added' || c.status === 'Untracked') added++;
      else if (c.status === 'Modified') modified++;
      else if (c.status === 'Deleted') deleted++;
    }
  }
  return { added, modified, deleted };
}

function GitBadge({ status }: { status: string }) {
  const color = status === 'Added' || status === 'Untracked'
    ? '#4ade80'
    : status === 'Deleted'
      ? '#f87171'
      : '#fbbf24';
  const label = status === 'Modified' ? 'M'
    : status === 'Added' || status === 'Untracked' ? 'A'
    : status === 'Deleted' ? 'D'
    : status === 'Renamed' ? 'R'
    : '?';
  return (
    <span style={{ fontSize: 9, fontWeight: 700, color, fontFamily: "'Fira Code', monospace", marginLeft: 4, flexShrink: 0 }}>
      {label}
    </span>
  );
}

interface Props {
  rootPath: string;
  selectedFile: string | null;
  expandedDirs: Set<string>;
  highlightedPath: string | null;
  onSelectFile: (path: string) => void;
  onToggleDir: (path: string) => void;
  onRename: (oldPath: string, newPath: string) => void;
  onDelete: (path: string, isDir: boolean) => void;
  onDeleteBatch?: (paths: string[]) => void;
  onCreateInDir: (dirPath: string, type: 'file' | 'folder') => void;
  onMove: (srcPath: string, destDir: string) => void;
  onViewDiff?: (filePath: string) => void;
  onDiscardChanges?: (filePath: string) => void;
  onMultiSelect?: (paths: string[]) => void;
  onOpenTerminal?: (dirPath: string) => void;
  gitChanges?: GitChange[];
  filterText?: string;
  refreshKey?: number;
}

// ── Context menu ──

interface MenuPos { x: number; y: number; path: string; isDir: boolean; name: string; hasGitChange?: boolean }

function ContextMenu({ pos, onClose, onRename, onDelete, onCopyPath, onCreateFile, onCreateFolder, onViewDiff, onDiscardChanges, onOpenTerminal }: {
  pos: MenuPos;
  onClose: () => void;
  onRename: () => void;
  onDelete: () => void;
  onCopyPath: () => void;
  onCreateFile: () => void;
  onCreateFolder: () => void;
  onViewDiff?: () => void;
  onDiscardChanges?: () => void;
  onOpenTerminal?: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    let x = pos.x, y = pos.y;
    if (x + rect.width > window.innerWidth - 8) x = window.innerWidth - rect.width - 8;
    if (y + rect.height > window.innerHeight - 8) y = window.innerHeight - rect.height - 8;
    if (x < 8) x = 8;
    if (y < 8) y = 8;
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
  }, [pos]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  return (
    <div ref={ref} style={{
      position: 'fixed',
      left: pos.x,
      top: pos.y,
      zIndex: 1000,
      minWidth: 180,
      background: 'var(--ws-contextmenu-bg)',
      border: '1px solid var(--ws-border)',
      borderRadius: 6,
      padding: '4px 0',
      boxShadow: 'var(--ws-contextmenu-shadow)',
      backdropFilter: 'blur(12px)',
    }}>
      {pos.isDir && (
        <>
          <CtxButton icon={<FileAddOutlined />} label="新建文件" shortcut="" onClick={() => { onCreateFile(); onClose(); }} />
          <CtxButton icon={<FolderAddOutlined />} label="新建文件夹" shortcut="" onClick={() => { onCreateFolder(); onClose(); }} />
          {onOpenTerminal && (
            <CtxButton icon={<CodeOutlined />} label="在终端中打开" shortcut="" onClick={() => { onOpenTerminal(); onClose(); }} />
          )}
          <div style={ctxStyles.separator} />
        </>
      )}
      <CtxButton icon={<EditOutlined />} label="重命名" shortcut="F2" onClick={() => { onRename(); onClose(); }} />
      <CtxButton icon={<CopyOutlined />} label="复制路径" shortcut="" onClick={() => { onCopyPath(); onClose(); }} />
      {pos.hasGitChange && onViewDiff && (
        <>
          <div style={ctxStyles.separator} />
          <CtxButton icon={<BranchesOutlined />} label="查看 Diff" shortcut="" onClick={() => { onViewDiff(); onClose(); }} />
        </>
      )}
      {pos.hasGitChange && !pos.isDir && onDiscardChanges && (
        <CtxButton icon={<UndoOutlined />} label="丢弃更改" shortcut="" danger onClick={() => { onDiscardChanges(); onClose(); }} />
      )}
      <div style={ctxStyles.separator} />
      <CtxButton icon={<DeleteOutlined />} label="删除" shortcut="Del" danger onClick={() => { onDelete(); onClose(); }} />
    </div>
  );
}

function CtxButton({ icon, label, shortcut, danger, onClick }: {
  icon: React.ReactNode;
  label: string;
  shortcut: string;
  danger?: boolean;
  onClick: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        ...ctxStyles.item,
        ...(danger ? ctxStyles.danger : {}),
        ...(hovered ? ctxStyles.itemHover : {}),
      }}
    >
      {icon}
      <span>{label}</span>
      {shortcut && <span style={ctxStyles.shortcut}>{shortcut}</span>}
    </button>
  );
}

const ctxStyles: Record<string, React.CSSProperties> = {
  menu: {
    position: 'fixed',
    zIndex: 1000,
    minWidth: 180,
    background: 'var(--ws-contextmenu-bg)',
    border: '1px solid var(--ws-border)',
    borderRadius: 6,
    padding: '4px 0',
    boxShadow: 'var(--ws-contextmenu-shadow)',
    backdropFilter: 'blur(12px)',
  },
  item: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    width: '100%',
    padding: '6px 12px',
    border: 'none',
    background: 'transparent',
    color: 'var(--ws-text)',
    fontSize: 12,
    fontFamily: "'Fira Sans', sans-serif",
    cursor: 'pointer',
    textAlign: 'left',
    lineHeight: '18px',
    borderRadius: 4,
    margin: '1px 4px',
    transition: 'background 0.08s',
  },
  itemHover: {
    background: 'var(--ws-border)',
  },
  danger: {
    color: '#f87171',
  },
  shortcut: {
    marginLeft: 'auto',
    fontSize: 10,
    color: 'var(--ws-text-muted)',
    fontFamily: "'Fira Code', monospace",
  },
  separator: {
    height: 1,
    background: 'var(--ws-border-subtle)',
    margin: '4px 8px',
  },
};

// ── Inline rename input ──

function RenameInput({
  defaultValue,
  onCommit,
  onCancel,
  depth,
  isDir,
}: {
  defaultValue: string;
  onCommit: (newName: string) => void;
  onCancel: () => void;
  depth: number;
  isDir: boolean;
}) {
  const [value, setValue] = useState(defaultValue);
  const ref = useRef<HTMLInputElement>(null);
  const composingRef = useRef(false);

  useEffect(() => {
    if (ref.current) {
      ref.current.focus();
      const dot = defaultValue.lastIndexOf('.');
      if (!isDir && dot > 0) ref.current.setSelectionRange(0, dot);
      else ref.current.select();
    }
  }, []);

  return (
    <input
      ref={ref}
      value={value}
      onChange={e => setValue(e.target.value)}
      onCompositionStart={() => { composingRef.current = true; }}
      onCompositionEnd={e => { composingRef.current = false; setValue(e.currentTarget.value); }}
      onBlur={() => {
        if (composingRef.current) return;
        const trimmed = value.trim();
        if (trimmed && trimmed !== defaultValue) onCommit(trimmed);
        else onCancel();
      }}
      onKeyDown={e => {
        if (composingRef.current) return;
        if (isEnterCommit(e)) {
          const trimmed = value.trim();
          if (trimmed && trimmed !== defaultValue) onCommit(trimmed);
          else onCancel();
        }
        if (e.key === 'Escape') onCancel();
        e.stopPropagation();
      }}
      onClick={e => e.stopPropagation()}
      style={{
        ...treeStyles.renameInput,
        marginLeft: 8 + depth * 14 + (isDir ? 0 : 14) + 18,
      }}
    />
  );
}

// ── DirNode ──

function DirNode({
  name,
  path: dirPath,
  depth,
  selectedFile,
  selectedFiles,
  expandedDirs,
  highlightedPath,
  renamingPath,
  gitChanges,
  isDark,
  onSelectFile,
  onToggleDir,
  onRename,
  onDelete,
  onCreateInDir,
  onMove,
  onViewDiff,
  onDiscardChanges,
  filterText,
  onContextMenu,
}: {
  name: string;
  path: string;
  depth: number;
  selectedFile: string | null;
  selectedFiles: Set<string>;
  expandedDirs: Set<string>;
  highlightedPath: string | null;
  renamingPath: string | null;
  gitChanges?: GitChange[];
  isDark: boolean;
  onSelectFile: (path: string, e: React.MouseEvent) => void;
  onToggleDir: (path: string) => void;
  onRename: (oldPath: string, newPath: string) => void;
  onDelete: (path: string, isDir: boolean) => void;
  onCreateInDir: (dirPath: string, type: 'file' | 'folder') => void;
  onMove: (srcPath: string, destDir: string) => void;
  onViewDiff?: (filePath: string) => void;
  onDiscardChanges?: (filePath: string) => void;
  filterText?: string;
  onContextMenu: (pos: MenuPos) => void;
}) {
  const isOpen = expandedDirs.has(dirPath);
  const [children, setChildren] = useState<FileEntry[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [localRenaming, setLocalRenaming] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [hovered, setHovered] = useState(false);
  const renaming = renamingPath === dirPath || localRenaming;
  const loadedRef = useRef(false);

  // Load children when opened for the first time; reset when closed so re-expand re-fetches
  useEffect(() => {
    if (!isOpen) {
      loadedRef.current = false;
      return;
    }
    if (loadedRef.current) return;
    loadedRef.current = true;
    let cancelled = false;
    setLoading(true);
    filesApi.listDirectory(dirPath)
      .then(entries => { if (!cancelled) { setChildren(entries); setLoading(false); } })
      .catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [isOpen, dirPath]);

  const handleClick = (e: React.MouseEvent) => {
    if (renaming) return;
    // Skip toggle on the second click of a double-click (e.detail=2)
    // so the folder stays open for the rename that follows
    if (isOpen && e.detail > 1) return;
    onToggleDir(dirPath);
  };

  const handleRenameCommit = (newName: string) => {
    const parent = dirPath.replace(/[/\\][^/\\]+$/, '');
    const sep = dirPath.includes('\\') ? '\\' : '/';
    onRename(dirPath, parent + sep + newName);
    setLocalRenaming(false);
  };

  if (filterText && children) {
    const nameMatches = name.toLowerCase().includes(filterText.toLowerCase());
    const childMatches = children.some(e => e.name.toLowerCase().includes(filterText.toLowerCase()));
    if (!nameMatches && !childMatches) return null;
  }

  return (
    <div>
      <div
        onClick={handleClick}
        onDoubleClick={e => { e.stopPropagation(); setLocalRenaming(true); }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onContextMenu={e => {
          e.preventDefault();
          e.stopPropagation();
          if (!renaming) onSelectFile(dirPath, e);
          onContextMenu({ x: e.clientX, y: e.clientY, path: dirPath, isDir: true, name, hasGitChange: false });
        }}
        onDragOver={e => {
          e.preventDefault();
          e.dataTransfer.dropEffect = 'move';
          if (!dragOver) setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={e => {
          e.preventDefault();
          setDragOver(false);
          const srcPath = e.dataTransfer.getData('text/plain');
          if (srcPath && srcPath !== dirPath) onMove(srcPath, dirPath);
        }}
        style={{
          ...treeStyles.item,
          paddingLeft: 8 + depth * 14,
          ...(selectedFile === dirPath ? treeStyles.itemSelected : {}),
          ...(hovered && !dragOver && selectedFile !== dirPath ? { background: 'var(--ws-hover)' } : {}),
          ...(dragOver ? treeStyles.dropTarget : {}),
        }}
      >
        {renaming ? (
          <RenameInput
            defaultValue={name}
            onCommit={handleRenameCommit}
            onCancel={() => setLocalRenaming(false)}
            depth={depth}
            isDir={true}
          />
        ) : (
          <>
            {loading
              ? <LoadingOutlined style={treeStyles.caret} />
              : isOpen
                ? <CaretDownOutlined style={treeStyles.caret} />
                : <CaretRightOutlined style={treeStyles.caret} />
            }
            {getFileIcon(name, true, isOpen, isDark)}
            <span style={treeStyles.name}>{name}</span>
            {gitChanges && (() => {
              const counts = getGitCountsForDir(gitChanges, dirPath);
              return (counts.added + counts.modified + counts.deleted) > 0 ? (
                <span style={{ display: 'inline-flex', gap: 3, marginLeft: 4, flexShrink: 0, fontSize: 9, fontWeight: 700, fontFamily: "'Fira Code', monospace" }}>
                  {counts.added > 0 && <span style={{ color: '#4ade80' }}>A{counts.added}</span>}
                  {counts.modified > 0 && <span style={{ color: '#fbbf24' }}>M{counts.modified}</span>}
                  {counts.deleted > 0 && <span style={{ color: '#f87171' }}>D{counts.deleted}</span>}
                </span>
              ) : null;
            })()}
          </>
        )}
      </div>
      {isOpen && children && (
        <div>
          {children.map(entry => (
            entry.isDir ? (
              <DirNode
                key={entry.path}
                name={entry.name}
                path={entry.path}
                depth={depth + 1}
                selectedFile={selectedFile}
                selectedFiles={selectedFiles}
                expandedDirs={expandedDirs}
                highlightedPath={highlightedPath}
                renamingPath={renamingPath}
                gitChanges={gitChanges}
                isDark={isDark}
                onSelectFile={onSelectFile}
                onToggleDir={onToggleDir}
                onRename={onRename}
                onDelete={onDelete}
                onCreateInDir={onCreateInDir}
                onMove={onMove}
                onViewDiff={onViewDiff}
                onDiscardChanges={onDiscardChanges}
                filterText={filterText}
                onContextMenu={onContextMenu}
              />
            ) : (
              <FileNode
                key={entry.path}
                name={entry.name}
                path={entry.path}
                depth={depth + 1}
                isSelected={selectedFile === entry.path}
                isMultiSelected={selectedFiles.has(entry.path)}
                isHighlighted={highlightedPath === entry.path}
                renamingPath={renamingPath}
                gitChange={getGitStatusForFile(gitChanges || [], entry.path)}
                isDark={isDark}
                onSelect={onSelectFile}
                onRename={onRename}
                filterText={filterText}
                onContextMenu={onContextMenu}
              />
            )
          ))}
        </div>
      )}
    </div>
  );
}

// ── FileNode ──

function FileNode({
  name,
  path: filePath,
  depth,
  isSelected,
  isMultiSelected,
  isHighlighted,
  renamingPath,
  gitChange,
  isDark,
  onSelect,
  onRename,
  filterText,
  onContextMenu,
}: {
  name: string;
  path: string;
  depth: number;
  isSelected: boolean;
  isMultiSelected: boolean;
  isHighlighted: boolean;
  renamingPath: string | null;
  gitChange?: GitChange;
  isDark: boolean;
  onSelect: (path: string, e: React.MouseEvent) => void;
  onRename: (oldPath: string, newPath: string) => void;
  filterText?: string;
  onContextMenu: (pos: MenuPos) => void;
}) {
  const [localRenaming, setLocalRenaming] = useState(false);
  const [hovered, setHovered] = useState(false);
  const renaming = renamingPath === filePath || localRenaming;

  if (filterText && !name.toLowerCase().includes(filterText.toLowerCase())) return null;

  const handleRenameCommit = (newName: string) => {
    const parent = filePath.replace(/[/\\][^/\\]+$/, '');
    const sep = filePath.includes('\\') ? '\\' : '/';
    onRename(filePath, parent + sep + newName);
    setLocalRenaming(false);
  };

  return (
    <div
      className="filetree-file"
      data-path={filePath}
      draggable={!renaming}
      onDragStart={e => {
        e.dataTransfer.setData('text/plain', filePath);
        e.dataTransfer.effectAllowed = 'move';
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={(e) => { if (!renaming) onSelect(filePath, e); }}
      onDoubleClick={e => { e.stopPropagation(); setLocalRenaming(true); }}
      onContextMenu={e => {
        e.preventDefault();
        e.stopPropagation();
        if (!renaming) onSelect(filePath, e);
        onContextMenu({ x: e.clientX, y: e.clientY, path: filePath, isDir: false, name, hasGitChange: !!gitChange });
      }}
      style={{
        ...treeStyles.item,
        paddingLeft: 8 + depth * 14 + 14,
        ...(isSelected ? treeStyles.itemSelected : {}),
        ...(!isSelected && isMultiSelected ? treeStyles.itemMultiSelected : {}),
        ...(hovered && !isSelected && !isMultiSelected ? { background: 'var(--ws-hover)' } : {}),
        ...(isHighlighted ? treeStyles.highlighted : {}),
      }}
      title={gitChange?.status === 'Modified' ? '已修改' : gitChange?.status === 'Added' ? '已添加' : gitChange?.status === 'Untracked' ? '未跟踪' : gitChange?.status === 'Deleted' ? '已删除' : gitChange?.status === 'Renamed' ? '已重命名' : undefined}
    >
      {renaming ? (
        <RenameInput
          defaultValue={name}
          onCommit={handleRenameCommit}
          onCancel={() => setLocalRenaming(false)}
          depth={depth}
          isDir={false}
        />
      ) : (
        <>
          {getFileIcon(name, false, undefined, isDark)}
          <span style={{ ...treeStyles.name, ...(isSelected ? treeStyles.nameSelected : {}) }}>{name}</span>
          {gitChange && <GitBadge status={gitChange.status} />}
        </>
      )}
    </div>
  );
}

// ── Main FileTree ──

export default function FileTree({ rootPath, selectedFile, expandedDirs, highlightedPath, onSelectFile, onToggleDir, onRename, onDelete, onDeleteBatch, onCreateInDir, onMove, onViewDiff, onDiscardChanges, onMultiSelect, onOpenTerminal, gitChanges, filterText, refreshKey }: Props) {
  const [rootEntries, setRootEntries] = useState<FileEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [menuPos, setMenuPos] = useState<MenuPos | null>(null);
  const [renamingPath, setRenamingPath] = useState<string | null>(null);
  const isDark = useThemeStore(s => s.mode === 'dark');

  // ── Multi-select state ──
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const lastClickedPathRef = useRef<string | null>(null);

  const loadRoot = useCallback(() => {
    setLoading(true);
    filesApi.listDirectory(rootPath)
      .then(entries => { setRootEntries(entries); setLoading(false); })
      .catch(() => setLoading(false));
  }, [rootPath]);

  useEffect(() => { loadRoot(); }, [rootPath, refreshKey]);

  // Sync external selectedFile change into multi-select state
  // Skip when multi-select just happened (clickedFile is already in the set)
  useEffect(() => {
    if (selectedFile) {
      setSelectedFiles(prev => {
        if (prev.has(selectedFile)) return prev; // multi-select just happened, keep it
        return new Set([selectedFile]);
      });
      // NOTE: anchor is NOT updated here — only plain clicks set the anchor
    }
  }, [selectedFile]);

  const handleFileSelect = useCallback((path: string, e: React.MouseEvent) => {
    // Build render order from DOM — most reliable for lazy-loaded trees
    const container = document.querySelector('.filetree-container');
    const renderOrder = container
      ? [...container.querySelectorAll<HTMLElement>('.filetree-file')].map(el => el.dataset.path!).filter(Boolean)
      : [];

    if (e.shiftKey && lastClickedPathRef.current && renderOrder.length > 0) {
      // Shift+click: range select
      const anchorIdx = renderOrder.indexOf(lastClickedPathRef.current);
      const clickedIdx = renderOrder.indexOf(path);
      if (anchorIdx >= 0 && clickedIdx >= 0) {
        const start = Math.min(anchorIdx, clickedIdx);
        const end = Math.max(anchorIdx, clickedIdx);
        const range = renderOrder.slice(start, end + 1);
        setSelectedFiles(new Set(range));
        onMultiSelect?.(range);
        onSelectFile(path);
        return;
      }
      // Anchor not found in render order — fall through to single select
    }

    if (e.ctrlKey || e.metaKey) {
      // Ctrl+click: toggle
      setSelectedFiles(prev => {
        const next = new Set(prev);
        if (next.has(path)) {
          next.delete(path);
        } else {
          next.add(path);
        }
        onMultiSelect?.([...next]);
        return next;
      });
      onSelectFile(path);
    } else {
      // Plain click: single select — only plain clicks update the anchor
      setSelectedFiles(new Set([path]));
      onMultiSelect?.([path]);
      onSelectFile(path);
      lastClickedPathRef.current = path;
    }
  }, [onSelectFile, onMultiSelect]);

  if (loading) {
    return (
      <div style={treeStyles.loading}>
        <LoadingOutlined style={{ fontSize: 14, color: 'var(--ws-text-muted)' }} />
      </div>
    );
  }

  return (
    <div className="filetree-container" style={treeStyles.container}>
      <style>{`
        @keyframes fileHighlight {
          0% { background: rgba(34, 197, 94, 0.3); }
          100% { background: transparent; }
        }
      `}</style>
      {rootEntries.map(entry => (
        entry.isDir ? (
          <DirNode
            key={entry.path}
            name={entry.name}
            path={entry.path}
            depth={0}
            selectedFile={selectedFile}
            selectedFiles={selectedFiles}
            expandedDirs={expandedDirs}
            highlightedPath={highlightedPath}
            renamingPath={renamingPath}
            gitChanges={gitChanges}
            isDark={isDark}
            onSelectFile={handleFileSelect}
            onToggleDir={onToggleDir}
            onRename={(oldPath, newPath) => { onRename(oldPath, newPath); setRenamingPath(null); }}
            onDelete={onDelete}
            onCreateInDir={onCreateInDir}
            onMove={onMove}
            onViewDiff={onViewDiff}
            onDiscardChanges={onDiscardChanges}
            filterText={filterText}
            onContextMenu={setMenuPos}
          />
        ) : (
          <FileNode
            key={entry.path}
            name={entry.name}
            path={entry.path}
            depth={0}
            isSelected={selectedFile === entry.path}
            isMultiSelected={selectedFiles.has(entry.path)}
            isHighlighted={highlightedPath === entry.path}
            renamingPath={renamingPath}
            gitChange={getGitStatusForFile(gitChanges || [], entry.path)}
            isDark={isDark}
            onSelect={handleFileSelect}
            onRename={(oldPath, newPath) => { onRename(oldPath, newPath); setRenamingPath(null); }}
            filterText={filterText}
            onContextMenu={setMenuPos}
          />
        )
      ))}

      {menuPos && (
        <ContextMenu
          pos={menuPos}
          onClose={() => setMenuPos(null)}
          onRename={() => setRenamingPath(menuPos.path)}
          onDelete={() => {
            // If right-clicked file is in multi-selection, batch delete all selected
            if (onDeleteBatch && selectedFiles.size > 1 && selectedFiles.has(menuPos.path)) {
              onDeleteBatch([...selectedFiles]);
            } else {
              onDelete(menuPos.path, menuPos.isDir);
            }
          }}
          onCopyPath={() => { navigator.clipboard.writeText(menuPos.path).catch(() => {}); }}
          onCreateFile={() => onCreateInDir(menuPos.isDir ? menuPos.path : menuPos.path.replace(/[/\\][^/\\]+$/, ''), 'file')}
          onCreateFolder={() => onCreateInDir(menuPos.isDir ? menuPos.path : menuPos.path.replace(/[/\\][^/\\]+$/, ''), 'folder')}
          onViewDiff={onViewDiff ? () => onViewDiff(menuPos.path) : undefined}
          onDiscardChanges={onDiscardChanges ? () => onDiscardChanges(menuPos.path) : undefined}
          onOpenTerminal={onOpenTerminal && menuPos.isDir ? () => onOpenTerminal(menuPos.path) : undefined}
        />
      )}
    </div>
  );
}

// ── Styles ──

const treeStyles: Record<string, React.CSSProperties> = {
  container: {
    fontFamily: "'Fira Code', monospace",
    fontSize: 12,
    lineHeight: '22px',
    overflow: 'auto',
    flex: 1,
    paddingTop: 4,
    paddingBottom: 4,
    position: 'relative',
  },
  loading: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  item: {
    display: 'flex',
    alignItems: 'center',
    gap: 5,
    cursor: 'pointer',
    paddingRight: 8,
    transition: 'background 0.08s',
    minHeight: 22,
    whiteSpace: 'nowrap',
  },
  itemSelected: {
    background: 'var(--ws-active-bg)',
  },
  itemMultiSelected: {
    background: 'var(--ws-hover)',
  },
  highlighted: {
    background: 'rgba(34, 197, 94, 0.2)',
    animation: 'fileHighlight 1.5s ease-out forwards',
  },
  dropTarget: {
    background: 'var(--ws-active-bg)',
    outline: '1px dashed var(--ws-active-border)',
  },
  caret: {
    fontSize: 8,
    color: 'var(--ws-text-muted)',
    width: 10,
    flexShrink: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: {
    color: 'var(--ws-text)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  nameSelected: {
    color: 'var(--ws-text)',
  },
  renameInput: {
    background: 'var(--ws-border)',
    border: '1px solid var(--ws-active-border)',
    borderRadius: 3,
    color: 'var(--ws-text)',
    fontSize: 12,
    fontFamily: "'Fira Code', monospace",
    padding: '0 4px',
    height: 20,
    outline: 'none',
    width: 'calc(100% - 20px)',
    minWidth: 80,
  },
};
