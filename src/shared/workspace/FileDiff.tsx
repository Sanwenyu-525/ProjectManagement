import { useEffect, useRef } from 'react';
import { MergeView } from '@codemirror/merge';
import { EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { useThemeStore } from '../../stores/themeStore';
import { makeDevhubTheme, getLanguageExtension } from './cmTheme';

// Diff-specific CM overrides (beyond the shared DevHub theme)
const diffOverrides = EditorView.theme({
  '.cm-mergeView': { height: '100%' },
  '.cm-mergeViewEditor': { height: '100%' },
  '.cm-mergeViewPanel': { backgroundColor: 'var(--ws-panel-bg)' },
  '&.cm-focused': { outline: 'none' },
  '.cm-focused': { outline: 'none' },
});

interface Props {
  original: string;
  modified: string;
  language?: string;
}

export default function FileDiff({ original, modified, language = 'typescript' }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mergeViewRef = useRef<MergeView | null>(null);
  const isDark = useThemeStore(s => s.mode === 'dark');

  useEffect(() => {
    if (!containerRef.current) return;

    const langExt = getLanguageExtension(language);
    const extensions = [
      makeDevhubTheme(isDark),
      diffOverrides,
      ...(langExt ? [langExt] : []),
      EditorState.readOnly.of(true),
    ];

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
  }, [original, modified, language, isDark]);

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
