import { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Modal, message } from 'antd';
import { filesApi } from '../api';
import { useTerminalStore } from '../stores/terminalStore';
import { useWorkspaceStore } from '../stores/workspaceStore';
import { useThemeStore } from '../stores/themeStore';
import type { FileTreeNode } from '../api';

const STORAGE_KEY = 'devhub_explorer_dirs';

function loadDirs(): string[] {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); }
  catch { return []; }
}

function saveDirs(dirs: string[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(dirs));
}

function dirLabel(path: string): string {
  return path.split(/[/\\]/).pop() || path;
}

interface DirState {
  path: string;
  tree: FileTreeNode[];
  expanded: Set<string>;
  loading: boolean;
}

interface Props {
  collapsed: boolean;
}

// 剪贴板状态
interface ClipboardState {
  type: 'copy' | 'cut';
  path: string;
  isDir: boolean;
}

export default function FileExplorer({ collapsed }: Props) {
  const isDark = useThemeStore(s => s.mode === 'dark');
  const [dirs, setDirs] = useState<DirState[]>([]);
  const [hoveredDir, setHoveredDir] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [inputPath, setInputPath] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const fetchingRef = useRef(new Set<string>());
  const initializedRef = useRef(false);

  // 右键菜单状态
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; path: string; isDir: boolean } | null>(null);

  // 内联编辑状态
  const [editingPath, setEditingPath] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState('');
  const [creatingInDir, setCreatingInDir] = useState<{ path: string; isDir: boolean } | null>(null);
  const [creatingValue, setCreatingValue] = useState('');
  const editingInputRef = useRef<HTMLInputElement>(null);

  // 剪贴板状态
  const [clipboard, setClipboard] = useState<ClipboardState | null>(null);

  // Persist dir list to localStorage whenever it changes
  useEffect(() => {
    // 跳过初始空数组，避免覆盖 localStorage
    if (dirs.length === 0 && !initializedRef.current) return;
    saveDirs(dirs.map(d => d.path));
  }, [dirs]);

  // Load dirs from localStorage on mount
  useEffect(() => {
    const saved = loadDirs();
    if (saved.length === 0) {
      initializedRef.current = true;
      return;
    }
    const initial = saved.map(path => ({
      path,
      tree: [] as FileTreeNode[],
      expanded: new Set<string>(),
      loading: true,
    }));
    setDirs(initial);
    // Fetch trees for all saved dirs in parallel
    initial.forEach(dir => fetchTree(dir.path));
    initializedRef.current = true;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchTree = useCallback((path: string) => {
    if (fetchingRef.current.has(path)) return;
    fetchingRef.current.add(path);
    filesApi.getTree(path, 3)
      .then(tree => {
        setDirs(prev => prev.map(d =>
          d.path === path ? { ...d, tree, loading: false } : d
        ));
      })
      .catch(() => {
        setDirs(prev => prev.map(d =>
          d.path === path ? { ...d, tree: [], loading: false } : d
        ));
      })
      .finally(() => { fetchingRef.current.delete(path); });
  }, []);

  // Focus input when popover opens
  useEffect(() => {
    if (isAdding) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isAdding]);

  // Focus editing input
  useEffect(() => {
    if (editingPath || creatingInDir) {
      setTimeout(() => editingInputRef.current?.focus(), 50);
    }
  }, [editingPath, creatingInDir]);

  // Close popover on outside click
  useEffect(() => {
    if (!isAdding) return;
    const handler = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setIsAdding(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [isAdding]);

  // 关闭右键菜单
  useEffect(() => {
    if (!contextMenu) return;
    const handler = () => setContextMenu(null);
    document.addEventListener('click', handler);
    document.addEventListener('contextmenu', handler);
    return () => {
      document.removeEventListener('click', handler);
      document.removeEventListener('contextmenu', handler);
    };
  }, [contextMenu]);

  const addDir = useCallback((path: string) => {
    const trimmed = path.trim();
    if (!trimmed) return;
    setDirs(prev => {
      if (prev.some(d => d.path === trimmed)) return prev;
      return [...prev, { path: trimmed, tree: [], expanded: new Set<string>(), loading: true }];
    });
    setInputPath('');
    setIsAdding(false);
    fetchTree(trimmed);
  }, [fetchTree]);

  const handleBrowse = useCallback(async () => {
    const { open } = await import('@tauri-apps/plugin-dialog');
    const selected = await open({ directory: true });
    if (selected && typeof selected === 'string') {
      addDir(selected);
    }
  }, [addDir]);

  const removeDir = useCallback((path: string) => {
    setDirs(prev => prev.filter(d => d.path !== path));
  }, []);

  const toggleDir = useCallback((path: string) => {
    setDirs(prev => {
      const idx = prev.findIndex(d =>
        d.path === path ||
        path.startsWith(d.path + '/') || path.startsWith(d.path + '\\')
      );
      if (idx < 0) return prev;
      const dir = prev[idx];
      // Early bailout: skip if toggle would be a no-op
      if (dir.expanded.has(path) === false && dir.path !== path) {
        // Expanding — always proceed
      } else if (dir.expanded.has(path) && dir.path !== path) {
        // Collapsing a subdirectory — proceed
      } else if (dir.path === path && dir.expanded.size === 0) {
        // Expanding root with no children yet — proceed
      }
      const next = new Set(dir.expanded);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      const updated = [...prev];
      updated[idx] = { ...dir, expanded: next };
      return updated;
    });
  }, []);

  // 刷新指定目录
  const refreshDir = useCallback((path: string) => {
    fetchingRef.current.delete(path);
    setDirs(prev => prev.map(d => {
      if (d.path === path || path.startsWith(d.path + '/') || path.startsWith(d.path + '\\')) {
        return { ...d, tree: [], loading: true };
      }
      return d;
    }));
    // 找到根目录并刷新
    setDirs(prev => {
      const rootDir = prev.find(d =>
        d.path === path || path.startsWith(d.path + '/') || path.startsWith(d.path + '\\')
      );
      if (rootDir) fetchTree(rootDir.path);
      return prev;
    });
  }, [fetchTree]);

  const selectFile = useCallback((path: string) => {
    useWorkspaceStore.getState().selectFile(path);
  }, []);

  const handleMouseEnter = useCallback((path: string) => {
    clearTimeout(hoverTimerRef.current);
    setHoveredDir(path);
  }, []);

  const handleMouseLeave = useCallback(() => {
    hoverTimerRef.current = setTimeout(() => setHoveredDir(null), 200);
  }, []);

  // 右键菜单处理
  const handleContextMenu = useCallback((e: React.MouseEvent, path: string, isDir: boolean) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY, path, isDir });
  }, []);

  // 复制到剪贴板
  const copyToClipboard = useCallback(async (text: string) => {
    await navigator.clipboard.writeText(text);
    message.success('已复制到剪贴板');
  }, []);

  // 在资源管理器中打开
  const openInExplorer = useCallback(async (path: string) => {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('plugin:shell|open', { path: path.replace(/[\\/][^\\/]+$/, '') });
    } catch {
      // fallback: 尝试使用 open 命令
      try {
        const { open } = await import('@tauri-apps/plugin-shell');
        await open(path.replace(/[\\/][^\\/]+$/, ''));
      } catch {
        message.error('无法打开资源管理器');
      }
    }
  }, []);

  // 在终端中打开
  const openInTerminal = useCallback((path: string) => {
    const dirPath = path.replace(/[\\/][^\\/]+$/, '');
    useTerminalStore.getState().requestLaunch({ cwd: dirPath });
  }, []);

  // 创建文件/文件夹
  const handleCreate = useCallback(async (path: string, isDir: boolean, name: string) => {
    const trimmed = name.trim();
    if (!trimmed) {
      setCreatingInDir(null);
      return;
    }
    const separator = path.includes('\\') ? '\\' : '/';
    const fullPath = `${path}${separator}${trimmed}`;
    try {
      await filesApi.create(fullPath, isDir);
      message.success(`已创建 ${isDir ? '文件夹' : '文件'}`);
      // 找到根目录并刷新
      setDirs(prev => {
        const rootDir = prev.find(d =>
          d.path === path || path.startsWith(d.path + '/') || path.startsWith(d.path + '\\')
        );
        if (rootDir) fetchTree(rootDir.path);
        return prev;
      });
    } catch (err) {
      message.error(`创建失败: ${err}`);
    }
    setCreatingInDir(null);
  }, [fetchTree]);

  // 重命名
  const handleRename = useCallback(async (oldPath: string, newName: string) => {
    const trimmed = newName.trim();
    if (!trimmed || trimmed === dirLabel(oldPath)) {
      setEditingPath(null);
      return;
    }
    const parentPath = oldPath.replace(/[\\/][^\\/]+$/, '');
    const separator = oldPath.includes('\\') ? '\\' : '/';
    const newPath = `${parentPath}${separator}${trimmed}`;
    try {
      await filesApi.rename(oldPath, newPath);
      message.success('已重命名');
      // 找到根目录并刷新
      setDirs(prev => {
        const rootDir = prev.find(d =>
          d.path === oldPath || oldPath.startsWith(d.path + '/') || oldPath.startsWith(d.path + '\\')
        );
        if (rootDir) fetchTree(rootDir.path);
        return prev;
      });
    } catch (err) {
      message.error(`重命名失败: ${err}`);
    }
    setEditingPath(null);
  }, [fetchTree]);

  // 删除
  const handleDelete = useCallback((path: string, isDir: boolean) => {
    const name = dirLabel(path);
    const type = isDir ? '文件夹' : '文件';
    Modal.confirm({
      title: `删除${type}`,
      content: `确定要删除 "${name}" 吗？${isDir ? '文件夹内的所有内容都会被删除。' : ''}`,
      okText: '删除',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        try {
          await filesApi.delete(path);
          message.success(`已删除 ${type}`);
          // 找到根目录并刷新
          setDirs(prev => {
            const rootDir = prev.find(d =>
              d.path === path || path.startsWith(d.path + '/') || path.startsWith(d.path + '\\')
            );
            if (rootDir) fetchTree(rootDir.path);
            return prev;
          });
        } catch (err) {
          message.error(`删除失败: ${err}`);
        }
      },
    });
  }, [fetchTree]);

  // 复制文件/文件夹
  const handleCopy = useCallback((path: string, isDir: boolean) => {
    setClipboard({ type: 'copy', path, isDir });
    message.info('已复制，右键粘贴到目标位置');
  }, []);

  // 剪切文件/文件夹
  const handleCut = useCallback((path: string, isDir: boolean) => {
    setClipboard({ type: 'cut', path, isDir });
    message.info('已剪切，右键粘贴到目标位置');
  }, []);

  // 粘贴文件/文件夹
  const handlePaste = useCallback(async (targetDir: string) => {
    if (!clipboard) return;
    const sourceName = dirLabel(clipboard.path);
    const separator = targetDir.includes('\\') ? '\\' : '/';
    const destPath = `${targetDir}${separator}${sourceName}`;

    try {
      if (clipboard.type === 'copy') {
        // 复制文件/文件夹
        if (clipboard.isDir) {
          // 递归复制目录
          await copyDirectoryRecursive(clipboard.path, destPath);
        } else {
          const content = await filesApi.read(clipboard.path);
          await filesApi.write(destPath, content.content);
        }
        message.success('已粘贴');
      } else {
        // 剪切 = 重命名/移动
        await filesApi.rename(clipboard.path, destPath);
        message.success('已移动');
        setClipboard(null);
      }
      // 刷新
      setDirs(prev => {
        const rootDir = prev.find(d =>
          d.path === targetDir || targetDir.startsWith(d.path + '/') || targetDir.startsWith(d.path + '\\')
        );
        if (rootDir) fetchTree(rootDir.path);
        // 如果是剪切，也需要刷新源目录
        if (clipboard.type === 'cut') {
          const srcRoot = prev.find(d =>
            d.path === clipboard.path || clipboard.path.startsWith(d.path + '/') || clipboard.path.startsWith(d.path + '\\')
          );
          if (srcRoot) fetchTree(srcRoot.path);
        }
        return prev;
      });
    } catch (err) {
      message.error(`粘贴失败: ${err}`);
    }
  }, [clipboard, fetchTree]);

  return (
    <div style={{ padding: collapsed ? '12px 0 0' : '0', position: 'relative' }}>
      {/* Add directory popover */}
      {isAdding && (
        <div
          ref={popoverRef}
          style={{
            position: 'absolute',
            top: 36,
            right: 8,
            left: 8,
            zIndex: 10,
            background: isDark ? 'var(--md-surface-container-high)' : '#fff',
            border: `1px solid ${isDark ? 'var(--md-outline-variant)' : 'rgba(187, 202, 198, 0.6)'}`,
            borderRadius: 8,
            padding: 12,
            boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
          }}
        >
          <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--md-on-surface)', marginBottom: 8 }}>
            添加目录
          </div>
          <input
            ref={inputRef}
            type="text"
            value={inputPath}
            onChange={e => setInputPath(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') addDir(inputPath); if (e.key === 'Escape') setIsAdding(false); }}
            placeholder="输入路径，如 D:\Projects"
            style={{
              width: '100%',
              height: 32,
              padding: '0 8px',
              fontSize: 12,
              fontFamily: 'var(--font-mono)',
              color: 'var(--md-on-surface)',
              background: isDark ? 'var(--md-surface-container-lowest)' : 'var(--md-surface-container-lowest)',
              border: `1px solid ${isDark ? 'var(--md-outline-variant)' : 'rgba(187, 202, 198, 0.6)'}`,
              borderRadius: 6,
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button
              onClick={handleBrowse}
              style={{
                flex: 1,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
                height: 30, fontSize: 12, fontWeight: 500,
                color: 'var(--md-on-surface-variant)',
                background: isDark ? 'var(--md-surface-container-low)' : 'var(--md-surface-container-low)',
                border: `1px solid ${isDark ? 'var(--md-outline-variant)' : 'rgba(187, 202, 198, 0.6)'}`,
                borderRadius: 6, cursor: 'pointer',
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>folder_open</span>
              浏览
            </button>
            <button
              onClick={() => addDir(inputPath)}
              style={{
                flex: 1,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
                height: 30, fontSize: 12, fontWeight: 500,
                color: '#fff',
                background: 'var(--md-primary)',
                border: 'none',
                borderRadius: 6, cursor: 'pointer',
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>add</span>
              添加
            </button>
          </div>
        </div>
      )}

      {/* Empty state */}
      {!collapsed && dirs.length === 0 && !isAdding && (
        <div style={{ padding: '16px 12px', textAlign: 'center' }}>
          <span style={{ fontSize: 12, color: 'var(--md-outline-variant)', display: 'block', marginBottom: 8 }}>
            暂无目录
          </span>
          <button
            onClick={() => setIsAdding(true)}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              fontSize: 12, color: 'var(--md-primary)', background: 'none',
              border: '1px dashed var(--md-primary)', borderRadius: 6,
              padding: '4px 12px', cursor: 'pointer',
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 14 }}>add</span>
            添加目录
          </button>
        </div>
      )}

      {/* Directory trees */}
      {dirs.map(dir => (
        <div
          key={dir.path}
          onMouseEnter={() => handleMouseEnter(dir.path)}
          onMouseLeave={handleMouseLeave}
        >
          {/* Root dir header */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: collapsed ? '4px 0' : '4px 12px',
            justifyContent: collapsed ? 'center' : 'flex-start',
            cursor: 'pointer',
            fontFamily: 'var(--font-mono)',
            fontSize: 12,
            fontWeight: 500,
            lineHeight: '16px',
            color: 'var(--md-on-surface)',
          }}
            onClick={() => toggleDir(dir.path)}
            onContextMenu={(e) => handleContextMenu(e, dir.path, true)}
            title={collapsed ? dirLabel(dir.path) : dir.path}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 16, flexShrink: 0 }}>
              {dir.expanded.size > 0 ? 'folder_open' : 'folder'}
            </span>
            {!collapsed && (
              <>
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {dirLabel(dir.path)}
                </span>
                {hoveredDir === dir.path && (
                  <span
                    className="material-symbols-outlined"
                    style={{ fontSize: 14, color: 'var(--md-outline)', cursor: 'pointer', flexShrink: 0 }}
                    onClick={e => { e.stopPropagation(); removeDir(dir.path); }}
                  >close</span>
                )}
              </>
            )}
          </div>

          {/* Children */}
          {!collapsed && dir.expanded.has(dir.path) && (
            <div>
              {dir.loading && (
                <span style={{ fontSize: 12, color: 'var(--md-outline-variant)', padding: '4px 28px', display: 'block' }}>
                  加载中...
                </span>
              )}
              {!dir.loading && dir.tree.length === 0 && (
                <span style={{ fontSize: 12, color: 'var(--md-outline-variant)', padding: '4px 28px', display: 'block' }}>
                  空目录
                </span>
              )}
              {dir.tree.map(child => (
                <TreeNode
                  key={child.path}
                  node={child}
                  depth={1}
                  collapsed={collapsed}
                  expanded={dir.expanded}
                  onToggle={toggleDir}
                  onSelectFile={selectFile}
                  onContextMenu={handleContextMenu}
                  editingPath={editingPath}
                  editingValue={editingValue}
                  onEditStart={(path) => {
                    setEditingPath(path);
                    setEditingValue(dirLabel(path));
                  }}
                  onEditValueChange={setEditingValue}
                  onEditConfirm={handleRename}
                  onEditCancel={() => setEditingPath(null)}
                  creatingInDir={creatingInDir}
                  creatingValue={creatingValue}
                  onCreateStart={setCreatingInDir}
                  onCreateValueChange={setCreatingValue}
                  onCreateConfirm={handleCreate}
                  onCreateCancel={() => setCreatingInDir(null)}
                />
              ))}
            </div>
          )}
        </div>
      ))}

      {/* 右键菜单 — portal 到 body 避免被父级 stacking context 遮挡 */}
      {contextMenu && createPortal(
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          path={contextMenu.path}
          isDir={contextMenu.isDir}
          clipboard={clipboard}
          onClose={() => setContextMenu(null)}
          onCopyPath={(p) => copyToClipboard(p)}
          onCopyName={(p) => copyToClipboard(dirLabel(p))}
          onOpenInExplorer={openInExplorer}
          onOpenInTerminal={openInTerminal}
          onRefresh={refreshDir}
          onCreateFile={(p) => setCreatingInDir({ path: p, isDir: false })}
          onCreateFolder={(p) => setCreatingInDir({ path: p, isDir: true })}
          onRename={(p) => {
            setEditingPath(p);
            setEditingValue(dirLabel(p));
          }}
          onDelete={(p, isDir) => handleDelete(p, isDir)}
          onCopy={handleCopy}
          onCut={handleCut}
          onPaste={handlePaste}
          onRemoveDir={removeDir}
        />,
        document.body
      )}
    </div>
  );
}

// 右键菜单项类型
interface ContextMenuItem {
  key?: string;
  label?: string;
  icon?: React.ReactNode;
  onClick?: () => void;
  type?: 'divider';
  style?: React.CSSProperties;
}

// 右键菜单组件
function ContextMenu({
  x, y, path, isDir, clipboard,
  onClose, onCopyPath, onCopyName, onOpenInExplorer, onOpenInTerminal,
  onRefresh, onCreateFile, onCreateFolder, onRename, onDelete,
  onCopy, onCut, onPaste, onRemoveDir,
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
  onRemoveDir: (path: string) => void;
}) {
  const isDark = useThemeStore(s => s.mode === 'dark');

  // 计算菜单位置，确保不超出视口
  const menuWidth = 200;
  const menuHeight = isDir ? 300 : 240;
  const finalX = Math.min(x, window.innerWidth - menuWidth - 8);
  const finalY = Math.min(y, window.innerHeight - menuHeight - 8);

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

  if (isDir && clipboard) {
    items.push(
      { key: 'paste', label: '粘贴', icon: <span className="material-symbols-outlined" style={{ fontSize: 16 }}>content_paste</span>, onClick: () => { onPaste(path); onClose(); } },
    );
  }

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

  // 如果是根目录，添加"从列表中移除"
  if (isDir) {
    items.push(
      { type: 'divider' },
      { key: 'remove', label: '从列表中移除', icon: <span className="material-symbols-outlined" style={{ fontSize: 16 }}>remove_circle_outline</span>, onClick: () => { onRemoveDir(path); onClose(); } },
    );
  }

  return (
    <div
      style={{
        position: 'fixed',
        left: finalX,
        top: finalY,
        zIndex: 1000,
        background: isDark ? 'var(--md-surface-container-high)' : '#fff',
        border: `1px solid ${isDark ? 'var(--md-outline-variant)' : 'rgba(187, 202, 198, 0.6)'}`,
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
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '6px 12px',
              fontSize: 12,
              color: item.style?.color || 'var(--md-on-surface)',
              cursor: 'pointer',
              transition: 'background 0.1s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--md-surface-container-low)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
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

// TreeNode 组件
function TreeNode({
  node,
  depth,
  collapsed,
  expanded,
  onToggle,
  onSelectFile,
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
}: {
  node: FileTreeNode;
  depth: number;
  collapsed: boolean;
  expanded: Set<string>;
  onToggle: (path: string) => void;
  onSelectFile: (path: string) => void;
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
}) {
  const isDark = useThemeStore(s => s.mode === 'dark');
  const isExpanded = expanded.has(node.path);
  const showChildren = node.isDir && isExpanded && !collapsed;
  const icon = node.isDir
    ? (isExpanded ? 'folder_open' : 'folder')
    : fileIcon(node.extension);

  const handleClick = () => {
    if (node.isDir) onToggle(node.path);
    else onSelectFile(node.path);
  };

  const isEditing = editingPath === node.path;
  const isCreatingHere = creatingInDir?.path === node.path;

  return (
    <>
      <div
        title={collapsed ? node.name : undefined}
        onClick={handleClick}
        onContextMenu={(e) => onContextMenu(e, node.path, node.isDir)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: collapsed ? '4px 0' : '4px 8px',
          marginLeft: collapsed ? 0 : depth * 16,
          justifyContent: collapsed ? 'center' : 'flex-start',
          borderRadius: 4,
          cursor: 'pointer',
          fontFamily: 'var(--font-mono)',
          fontSize: 12,
          lineHeight: '16px',
          color: 'var(--md-on-surface-variant)',
          background: 'transparent',
          transition: 'background 0.15s',
        }}
        onMouseEnter={e => { e.currentTarget.style.background = 'var(--md-surface-container-low)'; }}
        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
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
            <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {node.name}
            </span>
          )
        )}
      </div>

      {/* 创建文件/文件夹输入框 */}
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
          onToggle={onToggle}
          onSelectFile={onSelectFile}
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
        />
      ))}
    </>
  );
}

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

// 递归复制目录
async function copyDirectoryRecursive(src: string, dest: string) {
  // 创建目标目录
  await filesApi.create(dest, true);

  // 列出源目录内容
  const entries = await filesApi.listDirectory(src);

  for (const entry of entries) {
    const srcPath = entry.path;
    const destPath = dest + (dest.includes('\\') ? '\\' : '/') + entry.name;

    if (entry.isDir) {
      await copyDirectoryRecursive(srcPath, destPath);
    } else {
      // 复制文件内容
      const content = await filesApi.read(srcPath);
      await filesApi.write(destPath, content.content);
    }
  }
}
