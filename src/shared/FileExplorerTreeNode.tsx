import { memo } from 'react';
import { useThemeStore } from '../stores/themeStore';
import { normPath } from './useFileTreeExpand';
import type { FileTreeNode } from '../api';

function fileIcon(ext?: string): string {
  switch (ext) {
    case 'tsx': case 'ts': case 'jsx': case 'js': case 'rs': case 'py':
      return 'code';
    case 'json': case 'toml': case 'yaml': case 'yml':
      return 'settings';
    case 'md': case 'mdx':
      return 'description';
    case 'css': case 'scss': case 'less':
      return 'palette';
    case 'html': case 'htm':
      return 'language';
    case 'png': case 'jpg': case 'jpeg': case 'gif': case 'svg': case 'ico':
      return 'image';
    default:
      return 'description';
  }
}

function formatModified(iso: string): string {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return '刚刚';
  if (mins < 60) return `${mins}分钟前`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}小时前`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}天前`;
  return new Date(iso).toLocaleDateString('zh-CN', { year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export const TreeNode = memo(function TreeNode({
  node,
  depth,
  collapsed,
  expanded,
  selectedFiles,
  activeEditorFile,
  onToggle,
  onSelectFile,
  onOpenFile,
  onContextMenu,
  editingPath,
  editingValue,
  onEditStart,
  onEditValueChange,
  onEditConfirm,
  onEditCancel,
  creatingInDir,
  creatingValue,
  onCreateStart,
  onCreateValueChange,
  onCreateConfirm,
  onCreateCancel,
  loadingDirPaths,
}: {
  node: FileTreeNode;
  depth: number;
  collapsed: boolean;
  expanded: Set<string>;
  selectedFiles: Set<string>;
  activeEditorFile: string | null;
  onToggle: (path: string) => void;
  onSelectFile: (path: string, e?: React.MouseEvent) => void;
  onOpenFile: (path: string) => void;
  onContextMenu: (e: React.MouseEvent, path: string, isDir: boolean) => void;
  editingPath: string | null;
  editingValue: string;
  onEditStart: (path: string) => void;
  onEditValueChange: (value: string) => void;
  onEditConfirm: (path: string, newName: string) => void;
  onEditCancel: () => void;
  creatingInDir: { path: string; isDir: boolean } | null;
  creatingValue: string;
  onCreateStart: (state: { path: string; isDir: boolean } | null) => void;
  onCreateValueChange: (value: string) => void;
  onCreateConfirm: (path: string, isDir: boolean, name: string) => void;
  onCreateCancel: () => void;
  loadingDirPaths: Set<string>;
}) {
  const isDark = useThemeStore(s => s.mode === 'dark');
  const isExpanded = expanded.has(normPath(node.path));
  const showChildren = node.isDir && isExpanded && !collapsed;
  const isSelected = !node.isDir && (selectedFiles.has(node.path) || node.path === activeEditorFile);
  const icon = node.isDir
    ? (isExpanded ? 'folder_open' : 'folder')
    : fileIcon(node.extension);

  const handleClick = (e: React.MouseEvent) => {
    if (node.isDir) onToggle(node.path);
    else onSelectFile(node.path, e);
  };

  const handleDoubleClick = () => {
    if (!node.isDir) onOpenFile(node.path);
  };

  const isEditing = editingPath === node.path;
  const isCreatingHere = creatingInDir?.path === node.path;

  return (
    <>
      <div
        className="file-tree-item"
        title={collapsed ? node.name : undefined}
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
        onContextMenu={(e) => onContextMenu(e, node.path, node.isDir)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: collapsed ? '4px 0' : '4px 8px',
          marginLeft: collapsed ? 0 : depth * 16,
          justifyContent: collapsed ? 'center' : 'flex-start',
          borderRadius: 0,
          cursor: 'pointer',
          fontFamily: 'var(--font-mono)',
          fontSize: 12,
          lineHeight: '16px',
          color: isSelected ? 'var(--md-on-primary-container)' : 'var(--md-on-surface-variant)',
          background: isSelected ? 'var(--md-primary-container)' : 'transparent',
          transition: 'background 0.15s',
          userSelect: 'none',
        }}
        onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = 'var(--md-surface-container-low)'; }}
        onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = 'transparent'; }}
      >
        <span className="material-symbols-outlined" style={{ fontSize: 16, flexShrink: 0 }}>{icon}</span>
        {!collapsed && (
          isEditing ? (
            <input
              ref={(el) => { if (el) el.focus(); }}
              type="text"
              value={editingValue}
              onChange={(e) => onEditValueChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') onEditConfirm(node.path, editingValue);
                if (e.key === 'Escape') onEditCancel();
                e.stopPropagation();
              }}
              onBlur={() => onEditConfirm(node.path, editingValue)}
              onClick={(e) => e.stopPropagation()}
              style={{
                flex: 1,
                height: 20,
                padding: '0 4px',
                fontSize: 12,
                fontFamily: 'var(--font-mono)',
                color: 'var(--md-on-surface)',
                background: isDark ? 'var(--md-surface-container-lowest)' : '#fff',
                border: `1px solid var(--md-primary)`,
                borderRadius: 3,
                outline: 'none',
              }}
            />
          ) : (
            <>
              <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {node.name}
              </span>
              {node.modified && !node.isDir && (
                <span style={{
                  fontSize: 11,
                  color: 'var(--md-outline)',
                  flexShrink: 0,
                  marginLeft: 4,
                  whiteSpace: 'nowrap',
                }}>
                  {formatModified(node.modified)}
                </span>
              )}
            </>
          )
        )}
      </div>

      {isCreatingHere && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '4px 8px',
          marginLeft: (depth + 1) * 16,
        }}>
          <span className="material-symbols-outlined" style={{ fontSize: 16, flexShrink: 0 }}>
            {creatingInDir.isDir ? 'folder' : 'description'}
          </span>
          <input
            ref={(el) => { if (el) el.focus(); }}
            type="text"
            value={creatingValue}
            onChange={(e) => onCreateValueChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onCreateConfirm(node.path, creatingInDir.isDir, creatingValue);
              if (e.key === 'Escape') onCreateCancel();
              e.stopPropagation();
            }}
            onBlur={() => onCreateConfirm(node.path, creatingInDir.isDir, creatingValue)}
            onClick={(e) => e.stopPropagation()}
            placeholder={creatingInDir.isDir ? '文件夹名称' : '文件名称'}
            style={{
              flex: 1,
              height: 20,
              padding: '0 4px',
              fontSize: 12,
              fontFamily: 'var(--font-mono)',
              color: 'var(--md-on-surface)',
              background: isDark ? 'var(--md-surface-container-lowest)' : '#fff',
              border: `1px solid var(--md-primary)`,
              borderRadius: 3,
              outline: 'none',
            }}
          />
        </div>
      )}

      {showChildren && node.children?.map(child => (
        <TreeNode
          key={child.path}
          node={child}
          depth={depth + 1}
          collapsed={collapsed}
          expanded={expanded}
          selectedFiles={selectedFiles}
          activeEditorFile={activeEditorFile}
          onToggle={onToggle}
          onSelectFile={onSelectFile}
          onOpenFile={onOpenFile}
          onContextMenu={onContextMenu}
          editingPath={editingPath}
          editingValue={editingValue}
          onEditStart={onEditStart}
          onEditValueChange={onEditValueChange}
          onEditConfirm={onEditConfirm}
          onEditCancel={onEditCancel}
          creatingInDir={creatingInDir}
          creatingValue={creatingValue}
          onCreateStart={onCreateStart}
          onCreateValueChange={onCreateValueChange}
          onCreateConfirm={onCreateConfirm}
          onCreateCancel={onCreateCancel}
          loadingDirPaths={loadingDirPaths}
        />
      ))}
      {showChildren && (!node.children || node.children.length === 0) && (
        <span style={{
          fontSize: 12,
          color: 'var(--md-outline-variant)',
          padding: '4px 8px',
          marginLeft: (depth + 1) * 16,
          display: 'block',
        }}>
          {loadingDirPaths.has(normPath(node.path)) ? '加载中...' : '空目录'}
        </span>
      )}
    </>
  );
});
