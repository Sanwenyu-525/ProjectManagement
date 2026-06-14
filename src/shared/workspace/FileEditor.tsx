import { useCallback, useMemo } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { EditorView } from '@codemirror/view';
import { javascript } from '@codemirror/lang-javascript';
import { json } from '@codemirror/lang-json';
import { markdown } from '@codemirror/lang-markdown';
import { rust } from '@codemirror/lang-rust';
import { css } from '@codemirror/lang-css';
import { html } from '@codemirror/lang-html';
import { yaml } from '@codemirror/lang-yaml';
import { sql } from '@codemirror/lang-sql';
import { python } from '@codemirror/lang-python';
import { keymap } from '@codemirror/view';

interface Props {
  content: string;
  language: string;
  readOnly?: boolean;
  onChange?: (value: string) => void;
  onSave?: () => void;
}

// ── DevHub dark theme ──

const devhubTheme = EditorView.theme({
  '&': {
    backgroundColor: 'transparent',
    color: 'var(--ws-text)',
    fontFamily: "'Fira Code', monospace",
    fontSize: '13px',
    height: '100%',
  },
  '.cm-content': {
    caretColor: '#818cf8',
    padding: '8px 0',
  },
  '.cm-cursor': {
    borderLeftColor: '#818cf8',
    borderLeftWidth: '2px',
  },
  '.cm-gutters': {
    backgroundColor: 'transparent',
    color: 'var(--ws-text-muted)',
    border: 'none',
    paddingRight: '4px',
    fontFamily: "'Fira Code', monospace",
    fontSize: '12px',
  },
  '.cm-activeLineGutter': {
    backgroundColor: 'var(--ws-border-subtle)',
    color: 'var(--ws-text-secondary)',
  },
  '.cm-activeLine': {
    backgroundColor: 'var(--ws-hover)',
  },
  '.cm-selectionBackground': {
    backgroundColor: 'rgba(99, 102, 241, 0.2) !important',
  },
  '&.cm-focused .cm-selectionBackground': {
    backgroundColor: 'rgba(99, 102, 241, 0.25) !important',
  },
  '.cm-matchingBracket': {
    backgroundColor: 'rgba(99, 102, 241, 0.25)',
    outline: '1px solid rgba(99, 102, 241, 0.4)',
  },
  '.cm-searchMatch': {
    backgroundColor: 'rgba(250, 204, 21, 0.2)',
    outline: '1px solid rgba(250, 204, 21, 0.4)',
  },
  '.cm-searchMatch.cm-searchMatch-selected': {
    backgroundColor: 'rgba(250, 204, 21, 0.35)',
  },
  '.cm-foldPlaceholder': {
    backgroundColor: 'var(--ws-border-subtle)',
    color: 'var(--ws-text-muted)',
    border: 'none',
  },
  '.cm-tooltip': {
    backgroundColor: '#1e293b',
    border: '1px solid var(--ws-border)',
    color: 'var(--ws-text)',
  },
  '.cm-panels': {
    backgroundColor: 'rgba(15, 23, 42, 0.9)',
    color: 'var(--ws-text)',
  },
  '.cm-panel.cm-search': {
    backgroundColor: 'rgba(15, 23, 42, 0.95)',
  },
}, { dark: true });

// ── Token colors (solarized-ish) ──

const devhubHighlight = EditorView.baseTheme({
  '.ͼb': { color: '#7dd3fc' },     // keyword
  '.ͼc': { color: '#a5f3fc' },     // comment
  '.ͼd': { color: '#86efac' },     // string
  '.ͼe': { color: '#fbbf24' },     // number
  '.ͼi': { color: '#c4b5fd' },     // type name
  '.ͼg': { color: '#f9a8d4' },     // variable name
});

// ── Language extension resolver ──

function getExtensions(language: string, onSave?: () => void) {
  const exts = [];

  switch (language) {
    case 'typescript':
      exts.push(javascript({ jsx: true, typescript: true }));
      break;
    case 'javascript':
      exts.push(javascript({ jsx: true }));
      break;
    case 'json':
      exts.push(json());
      break;
    case 'markdown':
      exts.push(markdown());
      break;
    case 'rust':
      exts.push(rust());
      break;
    case 'css':
      exts.push(css());
      break;
    case 'html':
      exts.push(html());
      break;
    case 'yaml':
      exts.push(yaml());
      break;
    case 'sql':
      exts.push(sql());
      break;
    case 'python':
      exts.push(python());
      break;
  }

  exts.push(devhubTheme);
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
  const extensions = useMemo(
    () => getExtensions(language, onSave),
    [language, onSave],
  );

  const handleChange = useCallback((value: string) => {
    onChange?.(value);
  }, [onChange]);

  return (
    <div style={{ height: '100%', overflow: 'hidden' }}>
      <CodeMirror
        value={content}
        extensions={extensions}
        readOnly={readOnly}
        onChange={handleChange}
        theme="dark"
        style={{ height: '100%' }}
        basicSetup={{
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
          drawSelection: true,
          dropCursor: true,
          allowMultipleSelections: true,
          searchKeymap: true,
          tabSize: 2,
        }}
      />
    </div>
  );
}
