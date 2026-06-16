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
import type { Extension } from '@codemirror/state';

// ── DevHub theme (theme-aware, supports light/dark) ──

export function makeDevhubTheme(isDark: boolean) {
  return EditorView.theme({
    '&': {
      backgroundColor: 'transparent',
      color: 'var(--ws-text)',
      fontFamily: "'Fira Code', monospace",
      fontSize: '13px',
      height: '100%',
    },
    '.cm-content': {
      caretColor: 'var(--ws-cursor)',
      padding: '8px 0',
    },
    '.cm-cursor': {
      borderLeftColor: 'var(--ws-cursor)',
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
      backgroundColor: 'var(--ws-selection-bg) !important',
    },
    '&.cm-focused .cm-selectionBackground': {
      backgroundColor: 'var(--ws-selection-focus-bg) !important',
    },
    '.cm-matchingBracket': {
      backgroundColor: 'var(--ws-bracket-bg)',
      outline: '1px solid var(--ws-bracket-outline)',
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
      backgroundColor: 'var(--ws-tooltip-bg)',
      border: '1px solid var(--ws-border)',
      color: 'var(--ws-tooltip-text)',
    },
    '.cm-panels': {
      backgroundColor: 'var(--ws-panel-bg)',
      color: 'var(--ws-text)',
    },
    '.cm-panel.cm-search': {
      backgroundColor: 'var(--ws-panel-bg)',
    },
  }, { dark: isDark });
}

// ── Token colors (solarized-ish) ──

export const devhubHighlight = EditorView.baseTheme({
  '.ͼb': { color: '#7dd3fc' },     // keyword
  '.ͼc': { color: '#a5f3fc' },     // comment
  '.ͼd': { color: '#86efac' },     // string
  '.ͼe': { color: '#fbbf24' },     // number
  '.ͼi': { color: '#c4b5fd' },     // type name
  '.ͼg': { color: '#f9a8d4' },     // variable name
});

// ── Language → CodeMirror extension ──

export function getLanguageExtension(language: string): Extension | null {
  switch (language) {
    case 'typescript': return javascript({ jsx: true, typescript: true });
    case 'javascript': return javascript({ jsx: true });
    case 'json': return json();
    case 'markdown': return markdown();
    case 'rust': return rust();
    case 'css': return css();
    case 'html': return html();
    case 'yaml': return yaml();
    case 'sql': return sql();
    case 'python': return python();
    default: return null;
  }
}
