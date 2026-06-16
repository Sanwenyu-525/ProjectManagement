import { useCallback, useEffect, useMemo, useRef } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { EditorView, keymap } from '@codemirror/view';
import { useThemeStore } from '../../stores/themeStore';
import { makeDevhubTheme, devhubHighlight, getLanguageExtension } from './cmTheme';

interface Props {
  content: string;
  language: string;
  readOnly?: boolean;
  onChange?: (value: string) => void;
  onSave?: () => void;
}

// ── Extensions assembler ──

function getExtensions(language: string, isDark: boolean, onSave?: () => void) {
  const exts = [];

  const langExt = getLanguageExtension(language);
  if (langExt) exts.push(langExt);

  exts.push(makeDevhubTheme(isDark));
  exts.push(devhubHighlight);

  if (onSave) {
    exts.push(keymap.of([{
      key: 'Mod-s',
      run: () => { onSave(); return true; },
    }]));
  }

  return exts;
}

// ── Component ──

export default function FileEditor({ content, language, readOnly, onChange, onSave }: Props) {
  const isDark = useThemeStore(s => s.mode === 'dark');

  // Refs to hold latest callbacks
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const onSaveRef = useRef(onSave);
  onSaveRef.current = onSave;

  // Stable extensions — keymap reads onSave via ref, so deps stay minimal
  const extensions = useMemo(
    () => getExtensions(language, isDark, () => onSaveRef.current?.()),
    [language, isDark],
  );

  // Uncontrolled mode: CodeMirror owns its state. The `value` prop is NOT passed,
  // so the library skips its value-sync useEffect entirely (early return on
  // `value === undefined`). This prevents the library from doing full-document
  // replacement during IME composition — the root cause of Chinese input requiring
  // two attempts when the cursor is not at the end of the document.
  //
  // External content changes (file switches, git checkout) are synced
  // imperatively via the viewRef + useEffect below.

  const viewRef = useRef<EditorView | null>(null);
  const contentRef = useRef(content);

  // Capture the EditorView when CodeMirror creates it
  const handleCreateEditor = useCallback((view: EditorView) => {
    viewRef.current = view;
  }, []);

  // Sync external content changes (file switches) into CodeMirror.
  // Skips if content hasn't changed (prevents re-dispatching user's own edits).
  useEffect(() => {
    const view = viewRef.current;
    if (!view || content === contentRef.current) return;
    contentRef.current = content;
    view.dispatch({
      changes: { from: 0, to: view.state.doc.length, insert: content },
    });
  }, [content]);

  // onChange fires the parent callback. No composition guards needed —
  // in uncontrolled mode, React never re-renders CodeMirror on keystroke,
  // so the browser's IME composition is never interrupted.
  const handleChange = useCallback((value: string) => {
    contentRef.current = value;
    onChangeRef.current?.(value);
  }, []);

  // Stable basicSetup — inline object would create a new reference every render,
  // causing useCodeMirror to reconfigure the EditorView and interrupt IME composition.
  const basicSetup = useMemo(() => ({
    lineNumbers: true,
    bracketMatching: true,
    indentOnInput: true,
    highlightActiveLine: true,
    highlightActiveLineGutter: true,
    highlightSelectionMatches: true,
    foldGutter: true,
    closeBrackets: true,
    autocompletion: false,
    rectangularSelection: true,
    crosshairCursor: false,
    drawSelection: false,
    dropCursor: true,
    allowMultipleSelections: true,
    searchKeymap: true,
    tabSize: 2,
  }), []);

  return (
    <div style={{ height: '100%', overflow: 'hidden' }}>
      <CodeMirror
        extensions={extensions}
        readOnly={readOnly}
        onChange={handleChange}
        onCreateEditor={handleCreateEditor}
        theme={isDark ? 'dark' : 'light'}
        style={{ height: '100%' }}
        // Pass undefined explicitly to skip @uiw/react-codemirror's value = '' default,
        // which would otherwise trigger the sync effect to replace content with empty string.
        value={undefined as unknown as string}
        basicSetup={basicSetup}
      />
    </div>
  );
}
