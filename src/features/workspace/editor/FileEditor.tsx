import { useCallback, useEffect, useMemo, useRef } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { EditorView, keymap } from '@codemirror/view';
import { useThemeStore } from '../../../stores/themeStore';
import { makeDevhubTheme, devhubHighlight, getLanguageExtension } from '../components/cmTheme';

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
  const composingRef = useRef(false);

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

  // onChange fires the parent callback. During IME composition, the callback is
  // suppressed to prevent Store updates → React re-renders → typingLatch forceUpdate
  // from interrupting the browser's IME state. The final value is flushed on compositionEnd.
  const handleChange = useCallback((value: string) => {
    contentRef.current = value;
    // IME 组合期间不传播到 Store，避免重渲染打断浏览器 IME 状态
    if (!composingRef.current) {
      onChangeRef.current?.(value);
    }
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
    <div
      style={{ height: '100%', overflow: 'hidden' }}
      onCompositionStart={() => { composingRef.current = true; }}
      onCompositionEnd={() => {
        composingRef.current = false;
        // 组合结束后同步最终值到 Store
        onChangeRef.current?.(contentRef.current);
      }}
    >
      <CodeMirror
        value=""
        extensions={extensions}
        readOnly={readOnly}
        onChange={handleChange}
        onCreateEditor={handleCreateEditor}
        theme={isDark ? 'dark' : 'light'}
        style={{ height: '100%' }}
        // value="" satisfies the library’s string type requirement.
        // The actual content is managed imperatively via viewRef + useEffect,
        // and the initial dispatch in handleCreateEditor populates the document.
        // External content changes (file switches, git checkout) are synced
        // imperatively via the viewRef + useEffect below.
        basicSetup={basicSetup}
      />
    </div>
  );
}
