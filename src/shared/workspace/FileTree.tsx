import { useState, useCallback, useEffect, useRef } from 'react';
import { CaretRightOutlined, CaretDownOutlined, LoadingOutlined, EditOutlined, DeleteOutlined, CopyOutlined, FileAddOutlined, FolderAddOutlined, BranchesOutlined, UndoOutlined } from '@ant-design/icons';
import { filesApi, type FileEntry } from '../../api';
import { getFileIcon } from './file-utils';

interface GitChange {
  path: string;
  status: string;
  staged: boolean;
}

function getGitStatusForFile(changes: GitChange[], filePath: string): GitChange | undefined {
  return changes.find(c => c.path === filePath);
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
  onCreateInDir: (dirPath: string, type: 'file' | 'folder') => void;
  onMove: (srcPath: string, destDir: string) => void;
  onViewDiff?: (filePath: string) => void;
  onDiscardChanges?: (filePath: string) => void;
  gitChanges?: GitChange[];
  filterText?: string;
  refreshKey?: number;
}

// ── Context menu ──

interface MenuPos { x: number; y: number; path: string; isDir: boolean; name: string; hasGitChange?: boolean }

function ContextMenu({ pos, onClose, onRename, onDelete, onCopyPath, onCreateFile, onCreateFolder, onViewDiff, onDiscardChanges }: {
  pos: MenuPos;
  onClose: () => void;
  onRename: () => void;
  onDelete: () => void;
  onCopyPath: () => void;
  onCreateFile: () => void;
  onCreateFolder: () => void;
  onViewDiff?: () => void;
  onDiscardChanges?: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  return (
    <div ref={ref} style={{ ...ctxStyles.menu, left: pos.x, top: pos.y }}>
      {pos.isDir && (
        <>
          <CtxButton icon={<FileAddOutlined />} label="新建文件" shortcut="" onClick={() => { onCreateFile(); onClose(); }} />
          <CtxButton icon={<FolderAddOutlined />} label="新建文件夹" shortcut="" onClick={() => { onCreateFolder(); onClose(); }} />
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
    background: 'rgba(15, 23, 42, 0.96)',
    border: '1px solid var(--ws-border)',
    borderRadius: 6,
    padding: '4px 0',
    boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
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
      onBlur={() => {
        const trimmed = value.trim();
        if (trimmed && trimmed !== defaultValue) onCommit(trimmed);
        else onCancel();
      }}
      onKeyDown={e => {
        if (e.key === 'Enter') {
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
  expandedDirs,
  highlightedPath,
  renamingPath,
  gitChanges,
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
  expandedDirs: Set<string>;
  highlightedPath: string | null;
  renamingPath: string | null;
  gitChanges?: GitChange[];
  onSelectFile: (path: string) => void;
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
  const renaming = renamingPath === dirPath || localRenaming;
  const loadedRef = useRef(false);

  // Load children when opened for the first time
  useEffect(() => {
    if (!isOpen || loadedRef.current) return;
    loadedRef.current = true;
    let cancelled = false;
    setLoading(true);
    filesApi.listDirectory(dirPath)
      .then(entries => { if (!cancelled) { setChildren(entries); setLoading(false); } })
      .catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [isOpen, dirPath]);

  const handleClick = () => {
    if (renaming) return;
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
        onContextMenu={e => {
          e.preventDefault();
          e.stopPropagation();
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
            {getFileIcon(name, true, isOpen)}
            <span style={treeStyles.name}>{name}</span>
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
                expandedDirs={expandedDirs}
                highlightedPath={highlightedPath}
                renamingPath={renamingPath}
                gitChanges={gitChanges}
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
                isHighlighted={highlightedPath === entry.path}
                renamingPath={renamingPath}
                gitChange={getGitStatusForFile(gitChanges || [], entry.path)}
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
  isHighlighted,
  renamingPath,
  gitChange,
  onSelect,
  onRename,
  filterText,
  onContextMenu,
}: {
  name: string;
  path: string;
  depth: number;
  isSelected: boolean;
  isHighlighted: boolean;
  renamingPath: string | null;
  gitChange?: GitChange;
  onSelect: (path: string) => void;
  onRename: (oldPath: string, newPath: string) => void;
  filterText?: string;
  onContextMenu: (pos: MenuPos) => void;
}) {
  const [localRenaming, setLocalRenaming] = useState(false);
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
      draggable={!renaming}
      onDragStart={e => {
        e.dataTransfer.setData('text/plain', filePath);
        e.dataTransfer.effectAllowed = 'move';
      }}
      onClick={() => { if (!renaming) onSelect(filePath); }}
      onDoubleClick={e => { e.stopPropagation(); setLocalRenaming(true); }}
      onContextMenu={e => {
        e.preventDefault();
        e.stopPropagation();
        onContextMenu({ x: e.clientX, y: e.clientY, path: filePath, isDir: false, name, hasGitChange: !!gitChange });
      }}
      style={{
        ...treeStyles.item,
        paddingLeft: 8 + depth * 14 + 14,
        ...(isSelected ? treeStyles.itemSelected : {}),
        ...(isHighlighted ? treeStyles.highlighted : {}),
      }}
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
          {getFileIcon(name, false)}
          <span style={{ ...treeStyles.name, ...(isSelected ? treeStyles.nameSelected : {}) }}>{name}</span>
          {gitChange && <GitBadge status={gitChange.status} />}
</>
      )}
    </div>
  );
}

// ── Main FileTree ──

export default function FileTree({ rootPath, selectedFile, expandedDirs, highlightedPath, onSelectFile, onToggleDir, onRename, onDelete, onCreateInDir, onMove, onViewDiff, onDiscardChanges, gitChanges, filterText, refreshKey }: Props) {
  const [rootEntries, setRootEntries] = useState<FileEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [menuPos, setMenuPos] = useState<MenuPos | null>(null);
  const [renamingPath, setRenamingPath] = useState<string | null>(null);

  const loadRoot = useCallback(() => {
    setLoading(true);
    filesApi.listDirectory(rootPath)
      .then(entries => { setRootEntries(entries); setLoading(false); })
      .catch(() => setLoading(false));
  }, [rootPath]);

  useEffect(() => { loadRoot(); }, [rootPath, refreshKey]);

  if (loading) {
    return (
      <div style={treeStyles.loading}>
        <LoadingOutlined style={{ fontSize: 14, color: 'var(--ws-text-muted)' }} />
      </div>
    );
  }

  return (
    <div style={treeStyles.container}>
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
            expandedDirs={expandedDirs}
            highlightedPath={highlightedPath}
            renamingPath={renamingPath}
            gitChanges={gitChanges}
            onSelectFile={onSelectFile}
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
            isHighlighted={highlightedPath === entry.path}
            renamingPath={renamingPath}
            gitChange={getGitStatusForFile(gitChanges || [], entry.path)}
            onSelect={onSelectFile}
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
          onDelete={() => onDelete(menuPos.path, menuPos.isDir)}
          onCopyPath={() => { navigator.clipboard.writeText(menuPos.path).catch(() => {}); }}
          onCreateFile={() => onCreateInDir(menuPos.isDir ? menuPos.path : menuPos.path.replace(/[/\\][^/\\]+$/, ''), 'file')}
          onCreateFolder={() => onCreateInDir(menuPos.isDir ? menuPos.path : menuPos.path.replace(/[/\\][^/\\]+$/, ''), 'folder')}
          onViewDiff={onViewDiff ? () => onViewDiff(menuPos.path) : undefined}
          onDiscardChanges={onDiscardChanges ? () => onDiscardChanges(menuPos.path) : undefined}
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
    background: 'rgba(99, 102, 241, 0.15)',
  },
  highlighted: {
    background: 'rgba(34, 197, 94, 0.2)',
    animation: 'fileHighlight 1.5s ease-out forwards',
  },
  dropTarget: {
    background: 'rgba(99, 102, 241, 0.2)',
    outline: '1px dashed rgba(99, 102, 241, 0.5)',
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
    border: '1px solid #6366f1',
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
