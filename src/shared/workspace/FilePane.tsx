import { useState, useCallback, useEffect, useRef } from 'react';
import { FileTextOutlined, PlusOutlined, FolderAddOutlined, SearchOutlined, BranchesOutlined, UndoOutlined, CloseOutlined } from '@ant-design/icons';
import { convertFileSrc } from '@tauri-apps/api/core';
import { Modal, message } from 'antd';
import { useWorkspaceStore } from '../../stores/workspaceStore';
import { useThemeStore } from '../../stores/themeStore';
import { filesApi, gitApi } from '../../api';
import { isEnterCommit } from '@/lib/keyboard';
import { createTerminal } from './terminalFactory';
import { getAllLeaves } from './treeUtils';
import type { FileTab } from './types';
import type { GitChange } from '../../stores/workspaceStore';
import FileTree from './FileTree';
import FileEditor from './FileEditor';
import FileDiff from './FileDiff';
import FileToolbar from './FileToolbar';
import { formatSize } from './file-utils';

const IMAGE_EXTS = new Set(['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'ico', 'bmp', 'avif']);

function isImageFile(filePath: string): boolean {
  const ext = filePath.split('.').pop()?.toLowerCase() || '';
  return IMAGE_EXTS.has(ext);
}

interface Props {
  tab: FileTab;
}

export default function FilePane({ tab }: Props) {
  const { rootPath } = tab;
  const tabId = tab.id;
  const isDark = useThemeStore(s => s.mode === 'dark');
  const styles = makeStyles(isDark);

  const panel = useWorkspaceStore(s => s.filePanelState[tabId]);
  const toggleFileDir = useWorkspaceStore(s => s.toggleFileDir);
  const selectFile = useWorkspaceStore(s => s.selectFile);
  const setFileContent = useWorkspaceStore(s => s.setFileContent);
  const updateFileContent = useWorkspaceStore(s => s.updateFileContent);
  const clearFileDirty = useWorkspaceStore(s => s.clearFileDirty);
  const setGitChanges = useWorkspaceStore(s => s.setGitChanges);
  const openDiff = useWorkspaceStore(s => s.openDiff);
  const closeDiff = useWorkspaceStore(s => s.closeDiff);
  const renameSelectedFile = useWorkspaceStore(s => s.renameSelectedFile);

  const [searchText, setSearchText] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const composingRef = useRef(false);

  // Root path prompt
  const [inputRoot, setInputRoot] = useState(rootPath || '');
  const showRootInput = !rootPath;

  // Tree refresh key
  const [refreshKey, setRefreshKey] = useState(0);
  const refresh = useCallback(() => setRefreshKey(k => k + 1), []);

  // Highlight newly created/pasted files
  const [highlightedPath, setHighlightedPath] = useState<string | null>(null);
  const highlightTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flashHighlight = useCallback((path: string) => {
    setHighlightedPath(path);
    if (highlightTimer.current) clearTimeout(highlightTimer.current);
    highlightTimer.current = setTimeout(() => setHighlightedPath(null), 1500);
  }, []);

  // New file/folder input
  const [newItemType, setNewItemType] = useState<'file' | 'folder' | null>(null);
  const [newItemName, setNewItemName] = useState('');
  const [newItemTargetDir, setNewItemTargetDir] = useState<string | null>(null);
  const newItemRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (newItemType && newItemRef.current) {
      newItemRef.current.focus();
    }
  }, [newItemType]);

  // ── Git change detection ──
  const refreshGitChanges = useCallback(async () => {
    if (!rootPath) return;
    try {
      const changes = await gitApi.status(rootPath);
      // git status returns relative paths — convert to absolute for matching with file tree
      const sep = rootPath.includes('\\') ? '\\' : '/';
      const absolute = (changes as GitChange[]).map(c => ({
        ...c,
        path: rootPath + sep + c.path.replace(/\//g, sep),
      }));
      setGitChanges(tabId, absolute);
    } catch {
      setGitChanges(tabId, []);
    }
  }, [rootPath, tabId, setGitChanges]);

  // Load git status on mount and when refreshKey changes
  useEffect(() => { refreshGitChanges(); }, [refreshGitChanges, refreshKey]);

  // ── Diff view handlers ──
  const handleViewDiff = useCallback(async (filePath: string) => {
    if (!rootPath) return;
    // Get the relative path from root
    const relativePath = filePath.startsWith(rootPath)
      ? filePath.slice(rootPath.length).replace(/^[/\\]/, '')
      : filePath;
    try {
      const headContent = await gitApi.showFile(rootPath, relativePath);
      openDiff(tabId, filePath, headContent);
    } catch {
      // File might be new (no HEAD version), show empty original
      openDiff(tabId, filePath, '');
    }
  }, [rootPath, tabId, openDiff]);

  const handleCloseDiff = useCallback(() => {
    closeDiff(tabId);
  }, [tabId, closeDiff]);

  const handleDiscardChanges = useCallback(async (filePath: string) => {
    if (!rootPath) return;
    Modal.confirm({
      title: '丢弃更改',
      content: `确定丢弃「${filePath.split(/[/\\]/).pop()}」的所有更改？`,
      okText: '丢弃',
      cancelText: '取消',
      okButtonProps: { danger: true },
      centered: true,
      onOk: async () => {
        // git restore needs relative path from repo root
        const relativePath = filePath.startsWith(rootPath)
          ? filePath.slice(rootPath.length).replace(/^[/\\]/, '')
          : filePath;
        try {
          await gitApi.restore(rootPath, [relativePath]);
          refresh();
          refreshGitChanges();
          // If the discarded file is currently selected, reload it
          if (panel?.selectedFile === filePath) {
            selectFile(tabId, null);
            setTimeout(() => selectFile(tabId, filePath), 0);
          }
          // Close diff if viewing this file
          if (panel?.diffTarget === filePath) {
            closeDiff(tabId);
          }
        } catch (e) {
          console.error('Failed to discard changes:', e);
        }
      },
    });
  }, [rootPath, tabId, panel?.selectedFile, panel?.diffTarget, refresh, refreshGitChanges, selectFile, closeDiff]);

  // Load file content when selectedFile changes
  useEffect(() => {
    const filePath = panel?.selectedFile;
    if (!filePath || !panel) return;

    let cancelled = false;
    filesApi.read(filePath).then(result => {
      if (cancelled) return;
      setFileContent(
        tabId,
        result.content,
        result.content,
        result.language,
        result.isBinary,
        result.isWritable,
      );
    }).catch(() => {
      if (!cancelled) {
        setFileContent(tabId, '', '', 'text', false, false);
      }
    });

    return () => { cancelled = true; };
  }, [panel?.selectedFile, tabId]);

  const handleSelectFile = useCallback((filePath: string) => {
    selectFile(tabId, filePath);
  }, [tabId, selectFile]);

  const handleToggleDir = useCallback((dirPath: string) => {
    toggleFileDir(tabId, dirPath);
  }, [tabId, toggleFileDir]);

  const handleEditorChange = useCallback((value: string) => {
    updateFileContent(tabId, value);
  }, [tabId, updateFileContent]);

  const handleSave = useCallback(async () => {
    const filePath = panel?.selectedFile;
    const content = panel?.fileContent;
    if (!filePath || content === null || content === undefined) return;

    try {
      await filesApi.write(filePath, content);
      clearFileDirty(tabId);
      refreshGitChanges();
    } catch (e) {
      console.error('Failed to save file:', e);
      message.error('保存失败：' + String(e));
    }
  }, [tabId, panel?.selectedFile, panel?.fileContent, clearFileDirty, refreshGitChanges]);

  const handleOpenIde = useCallback((ide: string) => {
    const target = panel?.selectedFile || rootPath;
    if (target) {
      filesApi.openInIde(target, ide).catch(() => {});
    }
  }, [panel?.selectedFile, rootPath]);

  const handleRefresh = useCallback(() => {
    refresh();
    refreshGitChanges();
    const filePath = panel?.selectedFile;
    if (!filePath) return;
    const isDirty = panel && panel.fileContent !== null && panel.originalContent !== null
      && panel.fileContent !== panel.originalContent;
    if (isDirty) {
      Modal.confirm({
        title: '刷新文件',
        content: '当前文件有未保存的更改，刷新将丢失这些更改。是否继续？',
        okText: '刷新',
        cancelText: '取消',
        okButtonProps: { danger: true },
        centered: true,
        onOk: () => {
          selectFile(tabId, null);
          setTimeout(() => selectFile(tabId, filePath), 0);
        },
      });
    } else {
      selectFile(tabId, null);
      setTimeout(() => selectFile(tabId, filePath), 0);
    }
  }, [tabId, panel?.selectedFile, panel?.fileContent, panel?.originalContent, selectFile, refresh, refreshGitChanges]);

  const handleToggleSearch = useCallback(() => {
    setShowSearch(prev => !prev);
    setTimeout(() => searchRef.current?.focus(), 0);
  }, []);

  const handleRename = useCallback(async (oldPath: string, newPath: string) => {
    try {
      await filesApi.rename(oldPath, newPath);
      refresh();
      // Update the selectedFile path without re-reading from disk (preserves dirty content)
      if (panel?.selectedFile === oldPath) {
        renameSelectedFile(tabId, newPath);
      }
    } catch (e) {
      console.error('Failed to rename:', e);
    }
  }, [tabId, panel?.selectedFile, renameSelectedFile, refresh]);

  const handleCreateItem = useCallback(async () => {
    if (!newItemType || !newItemName.trim()) return;
    const parentDir = newItemTargetDir || rootPath;
    if (!parentDir) return;
    const sep = parentDir.includes('\\') ? '\\' : '/';
    const fullPath = parentDir + sep + newItemName.trim();
    try {
      await filesApi.create(fullPath, newItemType === 'folder');
      setNewItemType(null);
      setNewItemName('');
      setNewItemTargetDir(null);
      refresh();
      if (newItemType === 'file') flashHighlight(fullPath);
    } catch (e) {
      console.error('Failed to create:', e);
    }
  }, [newItemType, newItemName, newItemTargetDir, rootPath, refresh]);

  const handleCreateInDir = useCallback((dirPath: string, type: 'file' | 'folder') => {
    setNewItemType(type);
    setNewItemName('');
    setNewItemTargetDir(dirPath);
    setTimeout(() => newItemRef.current?.focus(), 0);
  }, []);

  const handleDelete = useCallback(async (path: string, isDir: boolean) => {
    const name = path.split(/[/\\]/).pop() || path;
    const msg = isDir
      ? `确定删除文件夹「${name}」及其所有内容？`
      : `确定删除文件「${name}」？`;
    Modal.confirm({
      title: isDir ? '删除文件夹' : '删除文件',
      content: msg,
      okText: '删除',
      cancelText: '取消',
      okButtonProps: { danger: true },
      centered: true,
      onOk: async () => {
        try {
          await filesApi.delete(path);
          refresh();
          // If deleted file was selected, clear selection
          if (panel?.selectedFile === path) {
            selectFile(tabId, null);
          }
        } catch (e) {
          console.error('Failed to delete:', e);
        }
      },
    });
  }, [tabId, panel?.selectedFile, selectFile, refresh]);

  const handleDeleteBatch = useCallback(async (paths: string[]) => {
    const names = paths.map(p => p.split(/[/\\]/).pop() || p);
    const msg = paths.length === 1
      ? `确定删除文件「${names[0]}」？`
      : `确定删除选中的 ${paths.length} 个文件？\n${names.join('、')}`;
    Modal.confirm({
      title: `删除${paths.length === 1 ? '文件' : `${paths.length}个文件`}`,
      content: msg,
      okText: '删除',
      cancelText: '取消',
      okButtonProps: { danger: true },
      centered: true,
      onOk: async () => {
        try {
          for (const p of paths) {
            await filesApi.delete(p);
          }
          refresh();
          if (paths.includes(panel?.selectedFile || '')) {
            selectFile(tabId, null);
          }
        } catch (e) {
          console.error('Failed to batch delete:', e);
        }
      },
    });
  }, [tabId, panel?.selectedFile, selectFile, refresh]);

  const handleOpenTerminal = useCallback(async (dirPath: string) => {
    const result = await createTerminal({ cwd: dirPath });
    if (!result) return;
    const wsState = useWorkspaceStore.getState();
    const leaves = getAllLeaves(wsState.root);
    if (leaves[0]) {
      wsState.addTab(leaves[0].id, {
        id: result.terminal.id,
        label: result.terminal.label,
        contentType: 'terminal',
        status: 'running',
        shell: result.terminal.shell,
        cwd: result.terminal.cwd,
      });
    }
  }, []);

  const handleMove = useCallback(async (srcPath: string, destDir: string) => {
    const fileName = srcPath.split(/[/\\]/).pop() || srcPath;
    const sep = destDir.includes('\\') ? '\\' : '/';
    const newPath = destDir + sep + fileName;
    try {
      await filesApi.rename(srcPath, newPath);
      refresh();
      flashHighlight(newPath);
      // Update selectedFile if the moved file was selected
      if (panel?.selectedFile === srcPath) {
        selectFile(tabId, newPath);
      }
    } catch (e) {
      console.error('Failed to move file:', e);
    }
  }, [tabId, panel?.selectedFile, selectFile, refresh, flashHighlight]);

  const handlePaste = useCallback(async (e: React.ClipboardEvent) => {
    if (!rootPath) return;
    const items = e.clipboardData?.items;
    if (!items) return;

    for (const item of items) {
      if (!item.type.startsWith('image/')) continue;
      e.preventDefault();

      const blob = item.getAsFile();
      if (!blob) continue;

      const reader = new FileReader();
      reader.onload = async () => {
        const dataUrl = reader.result as string;
        const mimeType = item.type || blob.type || 'image/png';
        const mimeParts = mimeType.split('/');
        const rawExt = mimeParts.length > 1 ? mimeParts[1] : '';
        const ext = rawExt === 'jpeg' ? 'jpg' : rawExt || 'png';
        const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
        const sep = rootPath.includes('\\') ? '\\' : '/';
        const filePath = rootPath + sep + `pasted-${ts}.${ext}`;

        try {
          await filesApi.writeBase64(filePath, dataUrl);
          refresh();
          flashHighlight(filePath);
        } catch (err) {
          console.error('Failed to save pasted image:', err);
        }
      };
      reader.readAsDataURL(blob);
      break; // only handle first image
    }
  }, [rootPath, refresh]);

  // Root path input
  if (showRootInput || !rootPath) {
    return (
      <div style={styles.rootInput}>
        <FileTextOutlined style={{ fontSize: 32, color: ICON_GRAY, marginBottom: 12 }} />
        <span style={styles.rootLabel}>选择项目文件夹</span>
        <div style={styles.rootInputRow}>
          <input
            value={inputRoot}
            onChange={e => setInputRoot(e.target.value)}
            onKeyDown={e => {
              if (isEnterCommit(e) && inputRoot.trim()) {
                // Update the tab's rootPath
                useWorkspaceStore.getState().updateTabLabel(tabId, inputRoot.trim().split(/[/\\]/).pop() || inputRoot);
                // We need to update rootPath on the tab itself
                const wsState = useWorkspaceStore.getState();
                const currentTab = wsState.tabs[tabId];
                if (currentTab && currentTab.contentType === 'file') {
                  // Re-add tab with rootPath
                  const leaf = (() => {
                    const walk = (n: any): any => {
                      if (n.type === 'leaf' && n.tabIds.includes(tabId)) return n;
                      if (n.type === 'split') {
                        for (const c of n.children) {
                          const found = walk(c);
                          if (found) return found;
                        }
                      }
                      return null;
                    };
                    return walk(wsState.root);
                  })();
                  if (leaf) {
                    wsState.closeTab(tabId);
                    wsState.addTab(leaf.id, {
                      ...currentTab,
                      rootPath: inputRoot.trim(),
                      label: inputRoot.trim().split(/[/\\]/).pop() || inputRoot,
                    } as FileTab);
                  }
                }
              }
            }}
            placeholder="输入项目路径，如 D:\\Projects\\my-app"
            style={styles.rootInputField}
          />
        </div>
        <span style={styles.rootHint}>或通过 Navigator 的 + 按钮选择文件夹</span>
      </div>
    );
  }

  const isDirty = panel && panel.fileContent !== null && panel.originalContent !== null
    && panel.fileContent !== panel.originalContent;

  return (
    <div style={styles.container} onPaste={handlePaste}>
      {/* Search bar (when visible) */}
      {showSearch && (
        <div style={styles.searchBar}>
          <SearchOutlined style={{ fontSize: 11, color: 'var(--ws-text-muted)', marginRight: 6 }} />
          <input
            ref={searchRef}
            value={searchText}
            onChange={e => setSearchText(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Escape') {
                setShowSearch(false);
                setSearchText('');
              }
            }}
            placeholder="过滤文件..."
            style={styles.searchInput}
          />
        </div>
      )}

      <div style={styles.main}>
        {/* Left: file tree */}
        <div style={styles.sidebar}>
          <div style={styles.sidebarHeader}>
            <span style={styles.sidebarTitle}>
              {rootPath.split(/[/\\]/).pop()}
            </span>
            <div style={styles.sidebarActions}>
              <button
                onClick={() => handleCreateInDir(rootPath, 'file')}
                style={styles.sidebarBtn}
                title="新建文件"
              >
                <PlusOutlined style={{ fontSize: 10 }} />
              </button>
              <button
                onClick={() => handleCreateInDir(rootPath, 'folder')}
                style={styles.sidebarBtn}
                title="新建文件夹"
              >
                <FolderAddOutlined style={{ fontSize: 10 }} />
              </button>
            </div>
          </div>

          {/* New item input */}
          {newItemType && (
            <div style={styles.newItemRow}>
              {newItemType === 'folder'
                ? <FolderAddOutlined style={{ fontSize: 11, color: '#60a5fa', flexShrink: 0 }} />
                : <PlusOutlined style={{ fontSize: 10, color: '#818cf8', flexShrink: 0 }} />
              }
              <input
                ref={newItemRef}
                value={newItemName}
                onChange={e => setNewItemName(e.target.value)}
                onCompositionStart={() => { composingRef.current = true; }}
                onCompositionEnd={() => { composingRef.current = false; }}
                onKeyDown={e => {
                  if (isEnterCommit(e)) handleCreateItem();
                  if (e.key === 'Escape') { setNewItemType(null); setNewItemName(''); setNewItemTargetDir(null); }
                }}
                onBlur={() => {
                  if (!composingRef.current && !newItemName.trim()) { setNewItemType(null); setNewItemTargetDir(null); }
                }}
                placeholder={newItemType === 'folder' ? '文件夹名称' : '文件名 (如 App.tsx)'}
                style={styles.newItemInput}
              />
            </div>
          )}

          <FileTree
            rootPath={rootPath}
            selectedFile={panel?.selectedFile || null}
            expandedDirs={panel?.expandedDirs || new Set()}
            highlightedPath={highlightedPath}
            gitChanges={panel?.gitChanges}
            onSelectFile={handleSelectFile}
            onToggleDir={handleToggleDir}
            onRename={handleRename}
            onDelete={handleDelete}
            onDeleteBatch={handleDeleteBatch}
            onCreateInDir={handleCreateInDir}
            onMove={handleMove}
            onViewDiff={handleViewDiff}
            onDiscardChanges={handleDiscardChanges}
            onOpenTerminal={handleOpenTerminal}
            filterText={searchText || undefined}
            refreshKey={refreshKey}
          />
        </div>

        {/* Divider */}
        <div style={styles.divider} />

        {/* Right: editor */}
        <div style={styles.editorArea}>
          {panel?.loading ? (
            <div style={styles.empty}>
              <span style={{ color: 'var(--ws-text-muted)', fontSize: 12 }}>加载中...</span>
            </div>
          ) : panel?.diffTarget ? (
            // Diff view mode
            <>
              <div style={styles.diffToolbar}>
                <BranchesOutlined style={{ fontSize: 12, color: '#818cf8' }} />
                <span style={styles.diffToolbarTitle}>
                  Diff: {panel.diffTarget.split(/[/\\]/).pop()}
                </span>
                <div style={{ flex: 1 }} />
                <button onClick={() => handleDiscardChanges(panel.diffTarget!)} style={styles.diffActionBtnDanger} title="丢弃更改">
                  <UndoOutlined style={{ fontSize: 10 }} />
                  <span>丢弃</span>
                </button>
                <button onClick={handleCloseDiff} style={styles.diffActionBtn} title="关闭 Diff">
                  <CloseOutlined style={{ fontSize: 10 }} />
                </button>
              </div>
              <FileDiff
                original={panel.diffOriginal || ''}
                modified={panel.fileContent || ''}
                language={panel.language}
              />
            </>
          ) : panel?.selectedFile && panel.fileContent !== null ? (
            <>
              <FileToolbar
                filePath={panel.selectedFile}
                isDirty={!!isDirty}
                isWritable={panel.isWritable}
                isBinary={panel.isBinary}
                language={panel.language}
                lineCount={panel.fileContent.split('\n').length}
                fileSize={panel.fileContent.length}
                hasGitChange={!!panel.gitChanges?.some(c => c.path === panel.selectedFile)}
                onSave={handleSave}
                onOpenIde={handleOpenIde}
                onRefresh={handleRefresh}
                onToggleSearch={handleToggleSearch}
                onViewDiff={handleViewDiff}
              />
              {panel.isBinary ? (
                isImageFile(panel.selectedFile) ? (
                  <div style={styles.imagePreview}>
                    <img
                      src={convertFileSrc(panel.selectedFile)}
                      alt={panel.selectedFile.split(/[/\\]/).pop() || 'image'}
                      style={styles.image}
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  </div>
                ) : (
                  <div style={styles.empty}>
                    <FileTextOutlined style={{ fontSize: 28, color: ICON_GRAY, marginBottom: 8 }} />
                    <span style={{ color: 'var(--ws-text-secondary)', fontSize: 12 }}>二进制文件，无法预览</span>
                    <span style={{ color: 'var(--ws-text-muted)', fontSize: 10, marginTop: 4 }}>
                      {formatSize(panel.fileContent.length || 0)}
                    </span>
                  </div>
                )
              ) : (
                <FileEditor
                  content={panel.fileContent}
                  language={panel.language}
                  readOnly={!panel.isWritable}
                  onChange={handleEditorChange}
                  onSave={panel.isWritable ? handleSave : undefined}
                />
              )}
            </>
          ) : (
            <div style={styles.empty}>
              <FileTextOutlined style={{ fontSize: 28, color: ICON_GRAY, marginBottom: 8 }} />
              <span style={{ color: 'var(--ws-text-secondary)', fontSize: 12 }}>选择文件查看内容</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Styles ──

const ICON_GRAY = 'var(--ws-icon-muted, #94a3b8)';

function makeStyles(isDark: boolean): Record<string, React.CSSProperties> {
  return {
    container: {
      display: 'flex',
      flexDirection: 'column',
      width: '100%',
      height: '100%',
      background: 'var(--ws-content-bg)',
    },
    searchBar: {
      display: 'flex',
      alignItems: 'center',
      padding: '4px 8px',
      background: isDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.03)',
      borderBottom: '1px solid var(--ws-border-subtle)',
      flexShrink: 0,
    },
    searchInput: {
      flex: 1,
      height: 24,
      padding: '0 8px',
      background: 'var(--ws-hover)',
      border: '1px solid var(--ws-border)',
      borderRadius: 4,
      color: 'var(--ws-text)',
      fontSize: 12,
      fontFamily: "'Fira Code', monospace",
      outline: 'none',
    },
    main: {
      display: 'flex',
      flex: 1,
      overflow: 'hidden',
    },
    sidebar: {
      display: 'flex',
      flexDirection: 'column',
      width: 200,
      minWidth: 150,
      maxWidth: 350,
      background: isDark ? 'rgba(255, 255, 255, 0.015)' : 'rgba(0, 0, 0, 0.02)',
      borderRight: '1px solid var(--ws-border-subtle)',
      flexShrink: 0,
      overflow: 'hidden',
    },
    sidebarHeader: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '6px 10px',
      borderBottom: '1px solid var(--ws-border-subtle)',
      flexShrink: 0,
    },
    sidebarTitle: {
      fontSize: 10,
      fontWeight: 600,
      color: 'var(--ws-text-muted)',
      textTransform: 'uppercase' as const,
      letterSpacing: '0.5px',
      fontFamily: "'Fira Sans', sans-serif",
    },
    sidebarActions: {
      display: 'flex',
      gap: 2,
    },
    sidebarBtn: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: 20,
      height: 20,
      borderRadius: 4,
      border: 'none',
      background: 'transparent',
      color: 'var(--ws-text-muted)',
      cursor: 'pointer',
      padding: 0,
    },
    newItemRow: {
      display: 'flex',
      alignItems: 'center',
      gap: 6,
      padding: '4px 10px',
      borderBottom: '1px solid var(--ws-border-subtle)',
      flexShrink: 0,
    },
    newItemInput: {
      flex: 1,
      height: 22,
      padding: '0 6px',
      background: 'var(--ws-border-subtle)',
      border: '1px solid rgba(99, 102, 241, 0.4)',
      borderRadius: 3,
      color: 'var(--ws-text)',
      fontSize: 11,
      fontFamily: "'Fira Code', monospace",
      outline: 'none',
    },
    divider: {
      width: 1,
      background: 'var(--ws-border-subtle)',
      flexShrink: 0,
    },
    editorArea: {
      display: 'flex',
      flexDirection: 'column',
      flex: 1,
      overflow: 'hidden',
      minWidth: 0,
    },
    empty: {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      width: '100%',
      height: '100%',
      gap: 4,
    },
    imagePreview: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: '100%',
      height: '100%',
      padding: 16,
      overflow: 'auto',
      background: isDark
        ? 'repeating-conic-gradient(rgba(255,255,255,0.03) 0% 25%, transparent 0% 50%) 0 0 / 16px 16px'
        : 'repeating-conic-gradient(rgba(0,0,0,0.04) 0% 25%, transparent 0% 50%) 0 0 / 16px 16px',
    },
    image: {
      maxWidth: '100%',
      maxHeight: '100%',
      objectFit: 'contain',
      borderRadius: 4,
      boxShadow: isDark ? '0 2px 12px rgba(0,0,0,0.3)' : '0 2px 12px rgba(0,0,0,0.12)',
    },
    rootInput: {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      width: '100%',
      height: '100%',
      gap: 8,
      background: 'var(--ws-content-bg)',
      padding: 20,
    },
    rootLabel: {
      fontSize: 13,
      color: 'var(--ws-text-secondary)',
      fontFamily: "'Fira Sans', sans-serif",
      fontWeight: 500,
    },
    rootInputRow: {
      display: 'flex',
      gap: 6,
      width: '100%',
      maxWidth: 400,
    },
    rootInputField: {
      flex: 1,
      padding: '6px 10px',
      background: 'var(--ws-hover)',
      border: '1px solid var(--ws-border)',
      borderRadius: 6,
      color: 'var(--ws-text)',
      fontSize: 12,
      fontFamily: "'Fira Code', monospace",
      outline: 'none',
    },
    rootHint: {
      fontSize: 10,
      color: 'var(--ws-text-muted)',
      fontStyle: 'italic',
    },
    diffToolbar: {
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      padding: '4px 10px',
      background: 'rgba(99, 102, 241, 0.08)',
      borderBottom: '1px solid var(--ws-active-bg, rgba(99, 102, 241, 0.15))',
      flexShrink: 0,
    },
    diffToolbarTitle: {
      fontSize: 11,
      color: isDark ? '#c4b5fd' : '#6d28d9',
      fontFamily: "'Fira Code', monospace",
      fontWeight: 500,
    },
    diffActionBtn: {
      display: 'flex',
      alignItems: 'center',
      gap: 4,
      padding: '3px 8px',
      border: '1px solid var(--ws-border)',
      borderRadius: 4,
      background: 'var(--ws-hover)',
      color: 'var(--ws-text-secondary)',
      fontSize: 11,
      cursor: 'pointer',
      fontFamily: "'Fira Sans', sans-serif",
    },
    diffActionBtnDanger: {
      display: 'flex',
      alignItems: 'center',
      gap: 4,
      padding: '3px 8px',
      border: '1px solid rgba(248, 113, 113, 0.3)',
      borderRadius: 4,
      background: 'rgba(248, 113, 113, 0.08)',
      color: '#f87171',
      fontSize: 11,
      cursor: 'pointer',
      fontFamily: "'Fira Sans', sans-serif",
    },
  };
}
