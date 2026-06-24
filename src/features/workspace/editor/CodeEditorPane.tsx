import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { EditorView } from '@codemirror/view';
import { message, Modal } from 'antd';
import { filesApi } from '../../../api';
import type { FileEntry } from '../../../api';
import { useTerminalStore } from '../../../stores/terminalStore';
import { useWorkspaceStore } from '../../../stores/workspaceStore';
import { useThemeStore } from '../../../stores/themeStore';
import FileViewer, { getFileIcon } from './FileViewer';

interface EditorFile {
  id: string;
  label: string;
  path: string;
  language: string;
  content: string;
  originalContent: string;
  modified: boolean;
  isBinary: boolean;
  tooLarge: boolean;
}

interface CodeEditorPaneProps {
  onEmpty?: () => void;
}

export default function CodeEditorPane({ onEmpty }: CodeEditorPaneProps) {
  const projectRoot = useTerminalStore(s => s.defaultCwd);
  const isDark = useThemeStore(s => s.mode === 'dark');
  const [files, setFiles] = useState<EditorFile[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const viewRef = useRef<EditorView | null>(null);
  const filesRef = useRef(files);
  filesRef.current = files;

  const activeFile = useMemo(
    () => files.find(f => f.id === activeId) ?? files[0] ?? null,
    [files, activeId],
  );

  const [autoCopyEnabled, setAutoCopyEnabled] = useState(false);

  // Helper: read a file from disk and add it to the editor
  const openFile = useCallback(async (path: string, inferredLang?: string) => {
    const result = await filesApi.read(path);
    const name = path.split(/[/\\]/).pop() || path;
    if (result.tooLarge) {
      message.warning(`${name} 超过 1MB，无法在编辑器中打开`);
    }
    const file: EditorFile = {
      id: path,
      label: name,
      path,
      language: inferredLang || result.language || 'text',
      content: result.content,
      originalContent: result.content,
      modified: false,
      isBinary: result.isBinary,
      tooLarge: result.tooLarge,
    };
    setFiles(prev => {
      if (prev.some(p => p.path === path)) return prev;
      const next = [...prev, file];
      if (next.length === prev.length + 1) setActiveId(file.id);
      return next;
    });
    return file;
  }, []);

  // Save handler — uses filesRef to avoid stale closure and stabilize deps
  const handleSave = useCallback(async () => {
    const file = filesRef.current.find(f => f.id === activeIdRef.current);
    if (!file || !file.modified) return;
    try {
      await filesApi.write(file.path, file.content);
      setFiles(prev => prev.map(f =>
        f.id === file.id ? { ...f, modified: false, originalContent: f.content } : f
      ));
      message.success(`保存文件 ${file.label} 成功`);
    } catch (e) {
      message.error(`Failed to save: ${e}`);
    }
  }, []);

  // Use ref for activeId in handleSave to avoid deps
  const activeIdRef = useRef(activeId);
  activeIdRef.current = activeId;

  // Index-based update on every keystroke — only clones 1 file, not all
  const handleChange = useCallback((value: string) => {
    setFiles(prev => {
      const idx = prev.findIndex(f => f.id === activeIdRef.current);
      if (idx < 0) return prev;
      const next = [...prev];
      next[idx] = { ...next[idx], content: value, modified: value !== next[idx].originalContent };
      return next;
    });
  }, []);

  const doCloseTab = useCallback((id: string) => {
    setFiles(prev => {
      const idx = prev.findIndex(f => f.id === id);
      const next = prev.filter(f => f.id !== id);
      if (activeIdRef.current === id) {
        setActiveId(next[Math.min(idx, next.length - 1)]?.id ?? null);
      }
      if (next.length === 0) {
        setTimeout(() => onEmpty?.(), 0);
      }
      return next;
    });
  }, [onEmpty]);

  const handleCloseTab = useCallback((id: string) => {
    const file = filesRef.current.find(f => f.id === id);
    if (!file || !file.modified) {
      doCloseTab(id);
      return;
    }
    Modal.confirm({
      title: '未保存的更改',
      content: `"${file.label}" 有未保存的更改，是否保存？`,
      okText: '保存',
      cancelText: '不保存',
      onOk: async () => {
        try {
          await filesApi.write(file.path, file.content);
          setFiles(prev => prev.map(f =>
            f.id === file.id ? { ...f, modified: false, originalContent: f.content } : f
          ));
          doCloseTab(id);
        } catch (e) {
          message.error(`保存失败: ${e}`);
        }
      },
      onCancel: () => {
        doCloseTab(id);
      },
    });
  }, [doCloseTab]);

  const handleCreateEditor = useCallback((view: EditorView) => {
    viewRef.current = view;
  }, []);

  // Sync CodeMirror content when switching tabs (text files only)
  useEffect(() => {
    if (!activeFile || activeFile.isBinary) return;
    const view = viewRef.current;
    if (!view) return;
    const current = view.state.doc.toString();
    if (current !== activeFile.content) {
      view.dispatch({
        changes: { from: 0, to: view.state.doc.length, insert: activeFile.content },
      });
    }
  }, [activeId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load project files from backend
  useEffect(() => {
    if (!projectRoot) return;
    const sep = projectRoot.includes('\\') ? '\\' : '/';
    const srcDir = projectRoot + sep + 'src';

    const loadFromDir = async (dir: string, pattern: RegExp, limit: number) => {
      const entries = await filesApi.listDirectory(dir);
      const targets = entries
        .filter((f: FileEntry) => !f.isDir && pattern.test(f.name))
        .slice(0, limit);
      await Promise.all(targets.map(f => openFile(f.path)));
    };

    setLoading(true);
    loadFromDir(srcDir, /\.(tsx?|jsx?)$/, 6).catch(() => {
      loadFromDir(projectRoot, /\.(tsx?|jsx?|rs|py|go)$/, 4).catch(() => {
        message.warning('无法自动加载项目文件');
      });
    }).finally(() => setLoading(false));
  }, [projectRoot]); // eslint-disable-line react-hooks/exhaustive-deps

  // Open file selected from FileExplorer sidebar — consume-and-clear pattern
  const selectedFile = useWorkspaceStore(s => s.selectedFile);
  const renamedFile = useWorkspaceStore(s => s.renamedFile);
  useEffect(() => {
    if (!selectedFile) return;
    // Already open? just activate it
    const existing = filesRef.current.find(f => f.path === selectedFile);
    if (existing) {
      setActiveId(existing.id);
    } else {
      openFile(selectedFile).catch(e => {
        message.error(`Failed to open: ${e}`);
      });
    }
    // Clear after consumption so re-selecting the same file works
    useWorkspaceStore.getState().selectFile(null);
  }, [selectedFile, openFile]);

  // Sync file path when FileExplorer renames a file — consume-and-clear
  useEffect(() => {
    if (!renamedFile) return;
    setFiles(prev => prev.map(f => {
      if (f.path !== renamedFile.oldPath) return f;
      const newName = renamedFile.newPath.split(/[/\\]/).pop() || renamedFile.newPath;
      return { ...f, id: renamedFile.newPath, path: renamedFile.newPath, label: newName };
    }));
    if (activeIdRef.current === renamedFile.oldPath) {
      setActiveId(renamedFile.newPath);
    }
    useWorkspaceStore.getState().setRenamedFile(null);
  }, [renamedFile]);

  // Empty state — no project loaded
  if (!projectRoot) {
    return (
      <div style={{ ...styles.container, alignItems: 'center', justifyContent: 'center' }}>
        <span className="material-symbols-outlined" style={{ fontSize: 32, color: 'var(--md-outline-variant)', marginBottom: 8 }}>
          folder_open
        </span>
        <span style={{ fontSize: 13, color: 'var(--md-on-surface-variant)' }}>
          Open a project to start editing
        </span>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      {/* Editor Tabs */}
      <div style={styles.tabBar}>
        <div style={styles.tabsRow}>
          {files.map(file => {
            const isActive = file.id === activeId;
            return (
              <div
                key={file.id}
                onClick={() => setActiveId(file.id)}
                style={{
                  ...styles.tab,
                  ...(isActive ? styles.tabActive : {}),
                  opacity: isActive ? 1 : 0.7,
                }}
              >
                <span className="material-symbols-outlined" style={{
                  fontSize: 16,
                  color: isActive ? 'var(--md-primary)' : 'var(--md-tertiary-container)',
                }}>{getFileIcon(file.isBinary, file.path)}</span>
                <span style={styles.tabLabel}>{file.label}</span>
                {file.modified && (
                  <span style={styles.modifiedDot} />
                )}
                <span
                  className="material-symbols-outlined"
                  style={styles.closeIcon}
                  onClick={e => { e.stopPropagation(); handleCloseTab(file.id); }}
                >close</span>
              </div>
            );
          })}
        </div>
        {files.length === 0 && (
          <span style={{ fontSize: 12, color: 'var(--md-outline-variant)', padding: '0 16px' }}>
            No files open
          </span>
        )}
        <button
          onClick={() => setAutoCopyEnabled(v => !v)}
          style={{
            marginLeft: 'auto',
            marginRight: 8,
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            padding: '3px 8px',
            borderRadius: 6,
            border: 'none',
            cursor: 'pointer',
            fontSize: 12,
            fontFamily: 'var(--font-sans)',
            background: autoCopyEnabled ? 'var(--md-primary-container, #e8def8)' : 'transparent',
            color: autoCopyEnabled ? 'var(--md-on-primary-container, #1d192b)' : 'var(--md-outline-variant)',
            transition: 'all 0.15s',
            flexShrink: 0,
          }}
          title={autoCopyEnabled ? '选中即复制：开启' : '选中即复制：关闭'}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 14 }}>
            {autoCopyEnabled ? 'content_copy' : 'copy_all'}
          </span>
        </button>
      </div>

      {/* Code Area */}
      <div style={styles.codeArea}>
        {activeFile ? (
          <FileViewer
            path={activeFile.path}
            content={activeFile.content}
            language={activeFile.language}
            isBinary={activeFile.isBinary}
            isDark={isDark}
            tooLarge={activeFile.tooLarge}
            onChange={handleChange}
            onSave={handleSave}
            onCreateEditor={handleCreateEditor}
            viewRef={viewRef}
            autoCopy={autoCopyEnabled}
          />
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
            {loading ? (
              <span style={{ fontSize: 12, color: 'var(--md-on-surface-variant)', display: 'flex', alignItems: 'center', gap: 6 }}>
                <span className="material-symbols-outlined" style={{ fontSize: 14, animation: 'spin 1s linear infinite' }}>progress_activity</span>
                加载文件中...
              </span>
            ) : (
              <span style={{ fontSize: 12, color: 'var(--md-outline-variant)' }}>
                选择文件开始编辑
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    flex: 1,
    minHeight: 0,
    background: 'var(--md-surface-container-lowest)',
    borderRadius: 12,
    border: '1px solid var(--border)',
    boxShadow: '0 2px 8px rgba(11, 28, 48, 0.04)',
    overflow: 'hidden',
  },
  tabBar: {
    display: 'flex',
    alignItems: 'center',
    borderBottom: '1px solid var(--border)',
    background: 'var(--md-surface-container-lowest)',
    overflowX: 'auto',
    flexShrink: 0,
  },
  tabsRow: {
    display: 'flex',
    alignItems: 'stretch',
    overflowX: 'auto',
    flex: 1,
    gap: 0,
  },
  tab: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '8px 16px',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    transition: 'all 0.15s',
    borderRight: '1px solid var(--border)',
    background: 'transparent',
    borderBottom: '2px solid transparent',
    flexShrink: 0,
  },
  tabActive: {
    background: 'var(--md-surface-container-lowest)',
    borderBottom: '2px solid var(--md-primary)',
    opacity: 1,
  },
  tabLabel: {
    fontSize: 13,
    fontFamily: 'var(--font-sans)',
    color: 'var(--md-on-surface)',
  },
  modifiedDot: {
    width: 8,
    height: 8,
    borderRadius: '50%',
    background: 'var(--md-tertiary-container)',
    flexShrink: 0,
  },
  closeIcon: {
    fontSize: 14,
    color: 'var(--md-outline-variant)',
    cursor: 'pointer',
    marginLeft: 4,
    transition: 'color 0.15s',
  },
  codeArea: {
    flex: 1,
    overflow: 'auto',
    background: 'var(--md-surface-container-low)',
  },
};
