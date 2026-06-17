import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { EditorView } from '@codemirror/view';
import { message } from 'antd';
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
}

export default function CodeEditorPane() {
  const projectRoot = useTerminalStore(s => s.defaultCwd);
  const isDark = useThemeStore(s => s.mode === 'dark');
  const [files, setFiles] = useState<EditorFile[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const viewRef = useRef<EditorView | null>(null);
  const filesRef = useRef(files);
  filesRef.current = files;

  const activeFile = useMemo(
    () => files.find(f => f.id === activeId) ?? files[0] ?? null,
    [files, activeId],
  );

  // Helper: read a file from disk and add it to the editor
  const openFile = useCallback(async (path: string, inferredLang?: string) => {
    const result = await filesApi.read(path);
    const name = path.split(/[/\\]/).pop() || path;
    const file: EditorFile = {
      id: path,
      label: name,
      path,
      language: inferredLang || result.language || 'text',
      content: result.content,
      originalContent: result.content,
      modified: false,
      isBinary: result.isBinary,
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
      message.success(`Saved ${file.label}`);
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

  const handleCloseTab = useCallback((id: string) => {
    setFiles(prev => {
      const next = prev.filter(f => f.id !== id);
      if (activeIdRef.current === id) {
        const idx = prev.findIndex(f => f.id === id);
        setActiveId(next[Math.min(idx, next.length - 1)]?.id ?? null);
      }
      return next;
    });
  }, []);

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

    loadFromDir(srcDir, /\.(tsx?|jsx?)$/, 6).catch(() => {
      loadFromDir(projectRoot, /\.(tsx?|jsx?|rs|py|go)$/, 4).catch(() => {});
    });
  }, [projectRoot]); // eslint-disable-line react-hooks/exhaustive-deps

  // Open file selected from FileExplorer sidebar — consume-and-clear pattern
  const selectedFile = useWorkspaceStore(s => s.selectedFile);
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
                {file.modified && !isActive && (
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
            onChange={handleChange}
            onSave={handleSave}
            onCreateEditor={handleCreateEditor}
            viewRef={viewRef}
          />
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
            <span style={{ fontSize: 12, color: 'var(--md-outline-variant)' }}>
              Select a file to edit
            </span>
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
    background: '#ffffff',
    borderRadius: 12,
    border: '1px solid rgba(187, 202, 198, 0.50)',
    boxShadow: '0 2px 8px rgba(11, 28, 48, 0.04)',
    overflow: 'hidden',
  },
  tabBar: {
    display: 'flex',
    alignItems: 'center',
    borderBottom: '1px solid rgba(187, 202, 198, 0.50)',
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
    borderRight: '1px solid rgba(187, 202, 198, 0.50)',
    background: 'transparent',
    borderBottom: '2px solid transparent',
    flexShrink: 0,
  },
  tabActive: {
    background: '#ffffff',
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
    background: '#FAFAFA',
  },
};
