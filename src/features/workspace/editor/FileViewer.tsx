import { useMemo } from 'react';
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
  onChange?: (value: string) => void;
  onSave?: () => void;
  onCreateEditor?: (view: EditorView) => void;
  viewRef?: React.MutableRefObject<EditorView | null>;
}

export default function FileViewer({
  path, content, language, isBinary, isDark, onChange, onSave, onCreateEditor, viewRef,
}: FileViewerProps) {
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
}

function TextEditor({ content, language, isDark, onChange, onSave, onCreateEditor, viewRef }: TextEditorProps) {
  const extensions = useMemo(() => {
    const exts = [];
    const langExt = getLanguageExtension(language);
    if (langExt) exts.push(langExt);
    exts.push(makeDevhubTheme(isDark));
    exts.push(devhubHighlight);
    exts.push(EditorView.lineWrapping);
    if (onSave) {
      exts.push(keymap.of([{
        key: 'Mod-s',
        run: () => { onSave(); return true; },
      }]));
    }
    return exts;
  }, [language, isDark, onSave]);

  // Sync CodeMirror content on language/content change
  const handleCreateEditor = useMemo(() => {
    if (!onCreateEditor) return undefined;
    return (view: EditorView) => {
      if (viewRef) viewRef.current = view;
      onCreateEditor(view);
    };
  }, [onCreateEditor, viewRef]);

  return (
    <CodeMirror
      value={content}
      extensions={extensions}
      onChange={onChange}
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
  );
}
