import { useState, useEffect, useCallback, useRef, useImperativeHandle, useMemo, forwardRef, memo } from 'react';
import { createPortal } from 'react-dom';
import { Modal, message } from 'antd';
import { listen } from '@tauri-apps/api/event';
import { filesApi, workspacesApi } from '../api';
import { useTerminalStore } from '../stores/terminalStore';
import { useWorkspaceStore } from '../stores/workspaceStore';
import { useThemeStore } from '../stores/themeStore';
import { useFileTreeExpand, mergeTrees, normPath, type DirState } from './useFileTreeExpand';
import type { FileTreeNode, FileChangedEvent } from '../api';

const STORAGE_KEY = 'devhub_explorer_dirs';
const EXPANDED_KEY = 'devhub_explorer_expanded';

function loadDirsLocal(): string[] {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); }
  catch { return []; }
}

function loadExpandedLocal(): string[] {
  try { return JSON.parse(localStorage.getItem(EXPANDED_KEY) || '[]'); }
  catch { return []; }
}

function dirLabel(path: string): string {
  return path.split(/[/\\]/).pop() || path;
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

/** Check if a path belongs to a directory (normalized comparison) */
function isDirContainedIn(dirPath: string, targetPath: string): boolean {
  const nd = normPath(dirPath);
  const nt = normPath(targetPath);
  return nt === nd || nt.startsWith(nd + '/');
}

// 剪贴板状态
interface ClipboardState {
  type: 'copy' | 'cut';
  path: string;
  isDir: boolean;
}

interface Props {
  collapsed: boolean;
}

/** 深度优先遍历展开的文件树，返回所有可见文件路径（目录不包含在内） */
function getVisibleFilePaths(dirs: DirState[]): string[] {
  const result: string[] = [];
  const walk = (nodes: FileTreeNode[], expanded: Set<string>) => {
    for (const node of nodes) {
      if (!node.isDir) result.push(node.path);
      if (node.isDir && expanded.has(normPath(node.path)) && node.children) {
        walk(node.children, expanded);
      }
    }
  };
  for (const dir of dirs) {
    if (dir.expanded.has(normPath(dir.path)) && dir.tree.length > 0) {
      walk(dir.tree, dir.expanded);
    }
  }
  return result;
}

export interface FileExplorerHandle {
  openAddDirectory: () => void;
}

export default forwardRef<FileExplorerHandle, Props>(function FileExplorer({ collapsed }, ref) {
  const isDark = useThemeStore(s => s.mode === 'dark');
  const selectedFiles = useWorkspaceStore(s => s.selectedFiles);
  const activeEditorFile = useWorkspaceStore(s => s.activeEditorFile);
  const selectedFilesSet = useMemo(() => new Set(selectedFiles), [selectedFiles]);
  const [hoveredDir, setHoveredDir] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [inputPath, setInputPath] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const loadedRef = useRef(false);
  const changeDebounceRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const suppressWatcherRef = useRef(new Set<string>());
  const persistTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const expandState = useFileTreeExpand([], (expandedPaths) => {
    workspacesApi.saveExplorerState(dirsRef.current.map(d => d.path), expandedPaths).catch(() => {});
  });
  const { dirs, toggleDir, loadChildren, refreshDir: hookRefreshDir, initRootTrees, updateDirs: setDirs } = expandState;
  const dirsRef = useRef(dirs);
  dirsRef.current = dirs;

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

  // Expose methods to parent via ref
  useImperativeHandle(ref, () => ({
    openAddDirectory: () => setIsAdding(true),
  }));

  // Persist dir list: localStorage immediately, backend debounced
  useEffect(() => {
    if (!loadedRef.current) return;
    const paths = dirs.map(d => d.path);
    const expandedList = [...new Set(dirs.flatMap(d => [...d.expanded]))];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(paths));
    localStorage.setItem(EXPANDED_KEY, JSON.stringify(expandedList));
    clearTimeout(persistTimerRef.current);
    persistTimerRef.current = setTimeout(() => {
      workspacesApi.saveExplorerState(paths, expandedList).catch(() => {});
    }, 500);
  }, [dirs]);

  // Load dirs from backend (fallback to localStorage) on mount
  useEffect(() => {
    let cancelled = false;

    const initWithData = (paths: string[], expandedPaths: string[]) => {
      if (cancelled || paths.length === 0) {
        loadedRef.current = true;
        return;
      }
      initRootTrees(
        paths.map(p => ({ path: p })),
        new Set(expandedPaths),
        (rootPath) => fetchTree(rootPath),
      );
      paths.forEach(p => filesApi.watcherAddRoot(p).catch(() => {}));
      loadedRef.current = true;
    };

    workspacesApi.loadExplorerState()
      .then(state => {
        if (state.paths.length > 0) {
          initWithData(state.paths, state.expandedPaths);
          localStorage.setItem(STORAGE_KEY, JSON.stringify(state.paths));
          localStorage.setItem(EXPANDED_KEY, JSON.stringify(state.expandedPaths));
        } else {
          const localPaths = loadDirsLocal();
          const localExpanded = loadExpandedLocal();
          if (localPaths.length > 0) {
            workspacesApi.saveExplorerState(localPaths, localExpanded).catch(() => {});
          }
          initWithData(localPaths, localExpanded);
        }
      })
      .catch(() => {
        initWithData(loadDirsLocal(), loadExpandedLocal());
      });

    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initRootTrees]);

  const fetchTree = useCallback((path: string, depth?: number) => {
    const np = normPath(path);
    filesApi.getTree(np, depth ?? 1)
      .then(tree => {
        setDirs(prev => {
          const updated = prev.map(d => {
            if (normPath(d.path) !== np) return d;
            const merged = mergeTrees(tree, d.tree, d.expanded);
            return { ...d, tree: merged, loading: false };
          });
          // Auto-expand: queue lazy-load for expanded children that have no data yet
          const dir = updated.find(d => normPath(d.path) === np);
          if (dir) {
            for (const node of dir.tree) {
              if (!node.isDir) continue;
              const nodeNp = normPath(node.path);
              if (dir.expanded.has(nodeNp) && (!node.children || node.children.length === 0)) {
                loadChildren(nodeNp);
              }
            }
          }
          return updated;
        });
      })
      .catch(() => {
        setDirs(prev => prev.map(d =>
          normPath(d.path) === np ? { ...d, tree: [], loading: false } : d
        ));
      });
  }, [loadChildren]);

  // Listen for filesystem change events from backend watcher
  useEffect(() => {
    const unlisten = listen<FileChangedEvent>('file-changed', (event) => {
      const { rootPath } = event.payload;
      // Suppress events triggered by user-initiated mutations
      if (suppressWatcherRef.current.has(rootPath)) {
        suppressWatcherRef.current.delete(rootPath);
        return;
      }
      // Debounce: clear existing timer, set new one (500ms)
      const existing = changeDebounceRef.current.get(rootPath);
      if (existing) clearTimeout(existing);
      const timer = setTimeout(() => {
        changeDebounceRef.current.delete(rootPath);
        fetchTree(rootPath);
      }, 500);
      changeDebounceRef.current.set(rootPath, timer);
    });

    return () => {
      unlisten.then(fn => fn());
      changeDebounceRef.current.forEach(timer => clearTimeout(timer));
      changeDebounceRef.current.clear();
    };
  }, [fetchTree]);

  // Cleanup watchers on unmount
  useEffect(() => {
    return () => {
      dirsRef.current.forEach(d => {
        filesApi.watcherRemoveRoot(d.path).catch(() => {});
      });
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setContextMenu(null);
    };
    const clickHandler = () => setContextMenu(null);
    document.addEventListener('click', clickHandler);
    document.addEventListener('contextmenu', clickHandler);
    window.addEventListener('keydown', handler);
    return () => {
      document.removeEventListener('click', clickHandler);
      document.removeEventListener('contextmenu', clickHandler);
      window.removeEventListener('keydown', handler);
    };
  }, [contextMenu]);

  const addDir = useCallback((path: string) => {
    const trimmed = path.trim();
    if (!trimmed) return;
    const np = normPath(trimmed);
    setDirs(prev => {
      if (prev.some(d => normPath(d.path) === np)) return prev;
      return [...prev, { path: trimmed, tree: [], expanded: new Set<string>(), loading: true }];
    });
    setInputPath('');
    setIsAdding(false);
    fetchTree(trimmed);
    filesApi.watcherAddRoot(trimmed).catch(() => {});
  }, [fetchTree]);

  const handleBrowse = useCallback(async () => {
    const { open } = await import('@tauri-apps/plugin-dialog');
    const selected = await open({ directory: true });
    if (selected && typeof selected === 'string') {
      addDir(selected);
    }
  }, [addDir]);

  const removeDir = useCallback((path: string) => {
    const np = normPath(path);
    setDirs(prev => prev.filter(d => normPath(d.path) !== np));
    filesApi.watcherRemoveRoot(path).catch(() => {});
  }, []);

  // 刷新指定目录
  const refreshDir = useCallback((path: string) => {
    hookRefreshDir(path, fetchTree);
  }, [hookRefreshDir, fetchTree]);

  const selectFile = useCallback((path: string, e?: React.MouseEvent) => {
    const store = useWorkspaceStore.getState();
    if (e?.shiftKey) {
      const visiblePaths = getVisibleFilePaths(dirsRef.current);
      store.selectFile(path, 'range', visiblePaths);
    } else if (e?.ctrlKey || e?.metaKey) {
      store.selectFile(path, 'toggle');
    } else {
      store.selectFile(path, 'single');
      store.requestOpenFile(path);
    }
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
        const rootDir = prev.find(d => isDirContainedIn(d.path, path));
        if (rootDir) {
          suppressWatcherRef.current.add(rootDir.path);
          fetchTree(rootDir.path);
        }
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
      // Notify editor of the path change
      useWorkspaceStore.getState().setRenamedFile({ oldPath, newPath });
      // 找到根目录并刷新
      setDirs(prev => {
        const rootDir = prev.find(d => isDirContainedIn(d.path, oldPath));
        if (rootDir) {
          suppressWatcherRef.current.add(rootDir.path);
          fetchTree(rootDir.path);
        }
        return prev;
      });
    } catch (err) {
      message.error(`重命名失败: ${err}`);
    }
    setEditingPath(null);
  }, [fetchTree]);

  // 删除（支持批量：右键的文件在选中列表中时，删除所有选中文件）
  const handleDelete = useCallback((path: string, isDir: boolean) => {
    const store = useWorkspaceStore.getState();
    // 如果右键的文件在多选列表中且有多个，批量删除
    const targets = store.selectedFiles.length > 1 && store.selectedFiles.includes(path)
      ? store.selectedFiles
      : [path];
    const count = targets.length;
    const type = isDir ? '文件夹' : '文件';
    const label = count > 1
      ? `${count} 个文件`
      : (isDir ? `文件夹 "${dirLabel(path)}"` : `文件 "${dirLabel(path)}"`);
    Modal.confirm({
      title: `删除${count > 1 ? '' : type}`,
      content: `确定要删除${label}吗？${count > 1 ? '部分可能是文件夹，其内容也会被删除。' : isDir ? '文件夹内的所有内容都会被删除。' : ''}`,
      okText: '删除',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        let deleted = 0;
        const rootsToRefresh = new Set<string>();
        for (const target of targets) {
          try {
            await filesApi.delete(target);
            deleted++;
            const rootDir = dirsRef.current.find(d => isDirContainedIn(d.path, target));
            if (rootDir) rootsToRefresh.add(rootDir.path);
          } catch (err) {
            message.error(`删除失败: ${target.split(/[/\\]/).pop()} — ${err}`);
          }
        }
        if (deleted > 0) {
          if (deleted < count) {
            message.success(`已删除 ${deleted}/${count} 个`);
          } else {
            message.success(`已删除 ${deleted} 个${type}`);
          }
          store.clearSelection();
          for (const root of rootsToRefresh) {
            suppressWatcherRef.current.add(root);
            fetchTree(root);
          }
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
        const rootDir = prev.find(d => isDirContainedIn(d.path, targetDir));
        if (rootDir) {
          suppressWatcherRef.current.add(rootDir.path);
          fetchTree(rootDir.path);
        }
        // 如果是剪切，也需要刷新源目录
        if (clipboard.type === 'cut') {
          const srcRoot = prev.find(d => isDirContainedIn(d.path, clipboard.path));
          if (srcRoot) {
            suppressWatcherRef.current.add(srcRoot.path);
            fetchTree(srcRoot.path);
          }
        }
        return prev;
      });
    } catch (err) {
      message.error(`粘贴失败: ${err}`);
    }
  }, [clipboard, fetchTree]);

  // 从系统剪贴板粘贴
  const handleSystemPaste = useCallback(async (targetDir: string) => {
    try {
      const result = await filesApi.pasteFromSystemClipboard(targetDir);
      if (result.kind === 'empty') {
        message.info(result.message);
        return;
      }
      message.success(result.message);
      // 刷新目标目录
      setDirs(prev => {
        const rootDir = prev.find(d => isDirContainedIn(d.path, targetDir));
        if (rootDir) {
          suppressWatcherRef.current.add(rootDir.path);
          fetchTree(rootDir.path);
        }
        return prev;
      });
    } catch (err) {
      message.error(`粘贴失败: ${err}`);
    }
  }, [fetchTree]);

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
            border: '1px solid var(--border)',
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
              border: '1px solid var(--border)',
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
                border: '1px solid var(--border)',
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
              {dir.expanded.has(normPath(dir.path)) ? 'folder_open' : 'folder'}
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

          {/* 根目录创建输入框 — TreeNode 不覆盖根目录本身 */}
          {!collapsed && creatingInDir?.path === dir.path && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '4px 8px',
              marginLeft: 16,
            }}>
              <span className="material-symbols-outlined" style={{ fontSize: 16, flexShrink: 0 }}>
                {creatingInDir.isDir ? 'folder' : 'description'}
              </span>
              <input
                ref={(el) => { if (el) el.focus(); }}
                type="text"
                value={creatingValue}
                onChange={(e) => setCreatingValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCreate(dir.path, creatingInDir.isDir, creatingValue);
                  if (e.key === 'Escape') setCreatingInDir(null);
                  e.stopPropagation();
                }}
                onBlur={() => handleCreate(dir.path, creatingInDir.isDir, creatingValue)}
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
                  border: '1px solid var(--md-primary)',
                  borderRadius: 3,
                  outline: 'none',
                }}
              />
            </div>
          )}

          {/* Children */}
          {!collapsed && dir.expanded.has(normPath(dir.path)) && (
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
                  selectedFiles={selectedFilesSet}
                  activeEditorFile={activeEditorFile}
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
          onSystemPaste={handleSystemPaste}
          onRemoveDir={removeDir}
        />,
        document.body
      )}
    </div>
  );
})

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

  // After render, measure actual menu size and clamp to viewport
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

  // 如果是根目录，添加"从列表中移除"
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

// TreeNode 组件
const TreeNode = memo(function TreeNode({
  node,
  depth,
  collapsed,
  expanded,
  selectedFiles,
  activeEditorFile,
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
  selectedFiles: Set<string>;
  activeEditorFile: string | null;
  onToggle: (path: string) => void;
  onSelectFile: (path: string, e?: React.MouseEvent) => void;
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
          selectedFiles={selectedFiles}
          activeEditorFile={activeEditorFile}
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
});

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
