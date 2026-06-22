import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { EditorView, keymap } from '@codemirror/view';
import { convertFileSrc } from '@tauri-apps/api/core';
import { makeDevhubTheme, devhubHighlight, getLanguageExtension } from '../components/cmTheme';

const IMAGE_EXTS = new Set([
  'png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'bmp', 'ico', 'avif', 'tiff',
]);

export function isImageFile(filePath: string): boolean {
  const ext = filePath.split(/[/\\]/).pop()?.split('.').pop()?.toLowerCase() ?? '';
  return IMAGE_EXTS.has(ext);
}

export function getFileIcon(isBinary: boolean, filePath: string): string {
  if (isBinary && isImageFile(filePath)) return 'image';
  if (isBinary) return 'draft';
  return 'description';
}

interface FileViewerProps {
  path: string;
  content: string;
  language: string;
  isBinary: boolean;
  isDark: boolean;
  tooLarge?: boolean;
  onChange?: (value: string) => void;
  onSave?: () => void;
  onCreateEditor?: (view: EditorView) => void;
  viewRef?: React.MutableRefObject<EditorView | null>;
  autoCopy?: boolean;
}

export default function FileViewer({
  path, content, language, isBinary, isDark, tooLarge, onChange, onSave, onCreateEditor, viewRef, autoCopy,
}: FileViewerProps) {
  // Too large — show warning placeholder
  if (tooLarge) {
    return <TooLargePlaceholder path={path} />;
  }

  // Image preview
  if (isBinary && isImageFile(path)) {
    return <ImageViewer path={path} />;
  }

  // Other binary file — placeholder
  if (isBinary) {
    return <BinaryPlaceholder path={path} />;
  }

  // Text file — CodeMirror
  return (
    <TextEditor
      content={content}
      language={language}
      isDark={isDark}
      onChange={onChange}
      onSave={onSave}
      onCreateEditor={onCreateEditor}
      viewRef={viewRef}
      autoCopy={autoCopy}
    />
  );
}

/* ── Image Preview ──────────────────────────────────────────── */

function ImageViewer({ path }: { path: string }) {
  const src = useMemo(() => convertFileSrc(path), [path]);

  return (
    <div style={imageStyles.container}>
      <img src={src} alt={path} style={imageStyles.img} />
    </div>
  );
}

const imageStyles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    height: '100%',
    background: 'var(--md-surface-container-lowest, #fafafa)',
    overflow: 'auto',
    padding: 16,
  },
  img: {
    maxWidth: '100%',
    maxHeight: '100%',
    objectFit: 'contain',
    borderRadius: 4,
    boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
  },
};

/* ── Too Large Placeholder ────────────────────────────────────── */

function TooLargePlaceholder({ path }: { path: string }) {
  const name = path.split(/[/\\]/).pop() ?? path;

  return (
    <div style={binaryStyles.container}>
      <span className="material-symbols-outlined" style={{ fontSize: 48, color: 'var(--md-error, #b3261e)' }}>
        warning
      </span>
      <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--md-on-surface, #1c1b1f)' }}>
        {name}
      </span>
      <span style={{ fontSize: 12, color: 'var(--md-on-surface-variant, #49454f)' }}>
        文件超过 1MB，无法在编辑器中打开
      </span>
    </div>
  );
}

/* ── Binary Placeholder ─────────────────────────────────────── */

function BinaryPlaceholder({ path }: { path: string }) {
  const name = path.split(/[/\\]/).pop() ?? path;
  const ext = name.includes('.') ? name.split('.').pop()?.toUpperCase() : '';

  return (
    <div style={binaryStyles.container}>
      <span className="material-symbols-outlined" style={{ fontSize: 48, color: 'var(--md-outline-variant, #9e9e9e)' }}>
        draft
      </span>
      <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--md-on-surface, #1c1b1f)' }}>
        {name}
      </span>
      {ext && (
        <span style={{ fontSize: 12, color: 'var(--md-on-surface-variant, #49454f)' }}>
          .{ext} — Binary file
        </span>
      )}
    </div>
  );
}

const binaryStyles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    height: '100%',
    gap: 8,
    background: 'var(--md-surface-container-lowest, #fafafa)',
  },
};

/* ── Text Editor (CodeMirror) ───────────────────────────────── */

interface TextEditorProps {
  content: string;
  language: string;
  isDark: boolean;
  onChange?: (value: string) => void;
  onSave?: () => void;
  onCreateEditor?: (view: EditorView) => void;
  viewRef?: React.MutableRefObject<EditorView | null>;
  autoCopy?: boolean;
}

function TextEditor({ content, language, isDark, onChange, onSave, onCreateEditor, viewRef, autoCopy }: TextEditorProps) {
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const onSaveRef = useRef(onSave);
  onSaveRef.current = onSave;
  const composingRef = useRef(false);
  const autoCopyRef = useRef(autoCopy);
  autoCopyRef.current = autoCopy;
  const [viewReady, setViewReady] = useState(false);

  // Stable extensions — keymap reads onSave via ref, deps stay minimal
  const extensions = useMemo(() => {
    const exts = [];
    const langExt = getLanguageExtension(language);
    if (langExt) exts.push(langExt);
    exts.push(makeDevhubTheme(isDark));
    exts.push(devhubHighlight);
    exts.push(EditorView.lineWrapping);
    exts.push(keymap.of([{
      key: 'Mod-s',
      run: () => { onSaveRef.current?.(); return true; },
    }]));
    exts.push(EditorView.updateListener.of((update) => {
      if (update.selectionSet && autoCopyRef.current) {
        const text = update.state.sliceDoc(update.state.selection.main.from, update.state.selection.main.to);
        if (text) {
          navigator.clipboard.writeText(text).catch(() => {});
        }
      }
    }));
    return exts;
  }, [language, isDark]);

  const handleCreateEditor = useCallback((view: EditorView) => {
    if (viewRef) viewRef.current = view;
    setViewReady(true);
    onCreateEditor?.(view);
  }, [onCreateEditor, viewRef]);

  // Sync external content changes (tab switches, file reloads) into CodeMirror imperatively.
  // Depends on viewReady to handle initial mount race: EditorView is created in the library's
  // useLayoutEffect, which runs after this effect on first render. When viewReady flips to true,
  // this effect re-runs and dispatches the content into the now-ready view.
  useEffect(() => {
    const view = viewRef?.current;
    if (!view) return;
    const current = view.state.doc.toString();
    if (current !== content) {
      view.dispatch({
        changes: { from: 0, to: view.state.doc.length, insert: content },
      });
    }
  }, [content, viewRef, viewReady]);

  // Suppress onChange during IME composition to prevent React re-renders from
  // interrupting the browser's IME state (root cause of Chinese input requiring two attempts).
  const handleChange = useCallback((value: string) => {
    if (!composingRef.current) {
      onChangeRef.current?.(value);
    }
  }, []);

  // Clean up viewRef on unmount
  useEffect(() => {
    return () => { if (viewRef) viewRef.current = null; };
  }, [viewRef]);

  return (
    <div
      onCompositionStart={() => { composingRef.current = true; }}
      onCompositionEnd={() => {
        composingRef.current = false;
      }}
      style={{ height: '100%' }}
    >
      <CodeMirror
        value=""
        extensions={extensions}
        onChange={handleChange}
        onCreateEditor={handleCreateEditor}
        basicSetup={{
          lineNumbers: true,
          highlightActiveLineGutter: true,
          highlightActiveLine: true,
          foldGutter: true,
          bracketMatching: true,
          closeBrackets: true,
          autocompletion: false,
          indentOnInput: true,
        }}
        style={{ height: '100%' }}
      />
    </div>
  );
}
