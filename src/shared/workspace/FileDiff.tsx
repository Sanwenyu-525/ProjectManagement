import { useEffect, useRef } from 'react';
import { MergeView } from '@codemirror/merge';
import { EditorState } from '@codemirror/state';
import { javascript } from '@codemirror/lang-javascript';
import { json } from '@codemirror/lang-json';
import { markdown } from '@codemirror/lang-markdown';
import { rust } from '@codemirror/lang-rust';
import { css } from '@codemirror/lang-css';
import { html } from '@codemirror/lang-html';
import { yaml } from '@codemirror/lang-yaml';
import { sql } from '@codemirror/lang-sql';
import { python } from '@codemirror/lang-python';

// Reuse the same theme from FileEditor
import { EditorView } from '@codemirror/view';

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
  '.cm-foldPlaceholder': {
    backgroundColor: 'var(--ws-border-subtle)',
    color: 'var(--ws-text-muted)',
    border: 'none',
  },
  // Diff-specific styling
  '.cm-mergeView': {
    height: '100%',
  },
  '.cm-mergeViewEditor': {
    height: '100%',
  },
  '.cm-mergeViewPanel': {
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
  },
  '&.cm-focused': {
    outline: 'none',
  },
  '.cm-focused': {
    outline: 'none',
  },
}, { dark: true });

function getLanguageExtension(language: string) {
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
    default: return javascript();
  }
}

interface Props {
  original: string;
  modified: string;
  language?: string;
}

export default function FileDiff({ original, modified, language = 'typescript' }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mergeViewRef = useRef<MergeView | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const langExt = getLanguageExtension(language);
    const extensions = [devhubTheme, langExt, EditorState.readOnly.of(true)];

    const mv = new MergeView({
      parent: containerRef.current,
      orientation: 'a-b',
      highlightChanges: true,
      gutter: true,
      collapseUnchanged: { margin: 3, minSize: 4 },
      a: {
        doc: original,
        extensions,
      },
      b: {
        doc: modified,
        extensions,
      },
    });

    mergeViewRef.current = mv;

    return () => {
      mv.destroy();
      mergeViewRef.current = null;
    };
  }, [original, modified, language]);

  return (
    <div style={containerStyle}>
      {/* Labels */}
      <div style={labelBar}>
        <span style={labelLeft}>
          <span style={{ ...labelDot, background: '#f87171' }} />
          原始版本 (HEAD)
        </span>
        <span style={labelRight}>
          <span style={{ ...labelDot, background: '#4ade80' }} />
          当前修改
        </span>
      </div>
      {/* MergeView */}
      <div ref={containerRef} style={mergeContainer} />
    </div>
  );
}

const containerStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  width: '100%',
  height: '100%',
  overflow: 'hidden',
};

const labelBar: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  padding: '4px 12px',
  background: 'rgba(255, 255, 255, 0.03)',
  borderBottom: '1px solid var(--ws-border-subtle)',
  flexShrink: 0,
};

const labelLeft: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  fontSize: 11,
  color: 'var(--ws-text-secondary)',
  fontFamily: "'Fira Sans', sans-serif",
};

const labelRight: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  fontSize: 11,
  color: 'var(--ws-text-secondary)',
  fontFamily: "'Fira Sans', sans-serif",
};

const labelDot: React.CSSProperties = {
  width: 6,
  height: 6,
  borderRadius: '50%',
  display: 'inline-block',
};

const mergeContainer: React.CSSProperties = {
  flex: 1,
  overflow: 'auto',
};
