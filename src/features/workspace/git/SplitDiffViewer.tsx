import { useState } from 'react';

interface DiffLine {
  type: 'context' | 'add' | 'del' | 'hunk' | 'header';
  oldNum: number | null;
  newNum: number | null;
  content: string;
}

interface SplitDiffViewerProps {
  diffText: string;
  fileName: string;
}

/** Parse unified diff text into structured lines. */
function parseDiff(text: string): DiffLine[] {
  const lines = text.split('\n');
  const result: DiffLine[] = [];
  let oldLine = 0;
  let newLine = 0;

  for (const raw of lines) {
    if (raw.startsWith('@@')) {
      const match = raw.match(/@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
      if (match) {
        oldLine = parseInt(match[1], 10);
        newLine = parseInt(match[2], 10);
      }
      result.push({ type: 'hunk', oldNum: null, newNum: null, content: raw });
    } else if (raw.startsWith('---') || raw.startsWith('+++')) {
      result.push({ type: 'header', oldNum: null, newNum: null, content: raw });
    } else if (raw.startsWith('-')) {
      result.push({ type: 'del', oldNum: oldLine++, newNum: null, content: raw.slice(1) });
    } else if (raw.startsWith('+')) {
      result.push({ type: 'add', oldNum: null, newNum: newLine++, content: raw.slice(1) });
    } else {
      const content = raw.startsWith(' ') ? raw.slice(1) : raw;
      result.push({ type: 'context', oldNum: oldLine++, newNum: newLine++, content });
    }
  }
  return result;
}

interface SplitRow {
  left: DiffLine | null;
  right: DiffLine | null;
}

/** Convert flat diff lines into paired split rows. */
function buildSplitRows(lines: DiffLine[]): SplitRow[] {
  const rows: SplitRow[] = [];
  const pendingDel: DiffLine[] = [];

  for (const line of lines) {
    if (line.type === 'hunk' || line.type === 'header') {
      // Flush any pending deletes
      for (const d of pendingDel) rows.push({ left: d, right: null });
      pendingDel.length = 0;
      rows.push({ left: line, right: line });
    } else if (line.type === 'del') {
      pendingDel.push(line);
    } else if (line.type === 'add') {
      // Pair with pending deletes
      if (pendingDel.length > 0) {
        const del = pendingDel.shift()!;
        rows.push({ left: del, right: line });
      } else {
        rows.push({ left: null, right: line });
      }
    } else {
      // context
      for (const d of pendingDel) rows.push({ left: d, right: null });
      pendingDel.length = 0;
      rows.push({ left: line, right: line });
    }
  }
  // Flush remaining
  for (const d of pendingDel) rows.push({ left: d, right: null });

  return rows;
}

function DiffPaneCell({ line, side }: { line: DiffLine | null; side: 'left' | 'right' }) {
  if (!line || line.type === 'header') {
    return (
      <div style={cellStyle}>
        <span style={lineNumStyle}>{''}</span>
        <span style={{ flex: 1 }} />
      </div>
    );
  }

  if (line.type === 'hunk') {
    return (
      <div style={{ ...cellStyle, background: 'var(--color-diff-hunk-bg)', fontStyle: 'italic' }}>
        <span style={lineNumStyle}>{''}</span>
        <span style={{ flex: 1, color: 'var(--md-on-surface-variant)', fontSize: 'var(--text-xs)' }}>{line.content}</span>
      </div>
    );
  }

  const isAdd = line.type === 'add';
  const isDel = line.type === 'del';
  const lineNum = side === 'left' ? line.oldNum : line.newNum;

  const bg = isAdd
    ? 'var(--color-diff-add-bg)'
    : isDel
      ? 'var(--color-diff-del-bg)'
      : 'transparent';

  const numColor = isAdd
    ? 'var(--color-tertiary)'
    : isDel
      ? 'var(--md-error)'
      : undefined;

  return (
    <div style={{ ...cellStyle, background: bg }}>
      <span style={{ ...lineNumStyle, color: numColor || undefined }}>
        {lineNum ?? ''}
      </span>
      <span style={{ flex: 1, whiteSpace: 'pre', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {(isDel || isAdd) && (
          <span style={{ fontWeight: 700, color: isDel ? 'var(--md-error)' : 'var(--color-tertiary)', marginRight: 4 }}>
            {isDel ? '-' : '+'}
          </span>
        )}
        {line.content}
      </span>
    </div>
  );
}

export default function SplitDiffViewer({ diffText, fileName }: SplitDiffViewerProps) {
  const [viewMode, setViewMode] = useState<'split' | 'unified'>('split');
  const lines = parseDiff(diffText);
  const splitRows = viewMode === 'split' ? buildSplitRows(lines) : null;

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#ffffff' }}>
      {/* Header */}
      <div style={{
        padding: '8px 12px', borderBottom: '1px solid var(--md-outline-variant)',
        background: 'var(--md-surface-container-lowest)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className="material-symbols-outlined" style={{ fontSize: 16, color: 'var(--md-on-surface-variant)' }}>description</span>
          <span style={{ fontSize: 'var(--text-sm)', color: 'var(--md-on-surface)', fontFamily: 'var(--font-mono)' }}>{fileName}</span>
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          <button
            onClick={() => setViewMode('unified')}
            style={{
              padding: '2px 8px', borderRadius: 'var(--radius-xs)', fontSize: 11, fontFamily: 'var(--font-label)',
              background: viewMode === 'unified' ? 'var(--md-surface-container-high)' : 'var(--md-surface-container)',
              border: viewMode === 'unified' ? '1px solid var(--md-outline-variant)' : '1px solid transparent',
              color: 'var(--md-on-surface-variant)', cursor: 'pointer', transition: 'all var(--transition-fast)',
            }}
          >
            统一
          </button>
          <button
            onClick={() => setViewMode('split')}
            style={{
              padding: '2px 8px', borderRadius: 'var(--radius-xs)', fontSize: 11, fontFamily: 'var(--font-label)',
              background: viewMode === 'split' ? 'rgba(0,107,95,0.12)' : 'var(--md-surface-container)',
              border: viewMode === 'split' ? '1px solid rgba(0,107,95,0.2)' : '1px solid transparent',
              color: viewMode === 'split' ? 'var(--md-primary)' : 'var(--md-on-surface-variant)',
              cursor: 'pointer', transition: 'all var(--transition-fast)',
            }}
          >
            分屏
          </button>
        </div>
      </div>

      {/* Diff Content */}
      <div style={{ flex: 1, overflow: 'auto', fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)', color: 'var(--md-on-surface)', display: 'flex' }}>
        {viewMode === 'split' && splitRows ? (
          <>
            {/* Left Pane */}
            <div style={{ flex: 1, borderRight: '1px solid rgba(187,202,198,0.5)' }}>
              {splitRows.map((row, i) => (
                <DiffPaneCell key={`l${i}`} line={row.left} side="left" />
              ))}
            </div>
            {/* Right Pane */}
            <div style={{ flex: 1 }}>
              {splitRows.map((row, i) => (
                <DiffPaneCell key={`r${i}`} line={row.right} side="right" />
              ))}
            </div>
          </>
        ) : (
          /* Unified view */
          <div style={{ flex: 1 }}>
            {lines.map((line, i) => (
              <DiffPaneCell key={i} line={line} side="right" />
            ))}
          </div>
        )}

        {lines.length === 0 && (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--md-on-surface-variant)', width: '100%' }}>
            无 Diff 内容
          </div>
        )}
      </div>
    </div>
  );
}

const cellStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'stretch', minHeight: 22,
  borderBottom: '1px solid rgba(187,202,198,0.15)',
};

const lineNumStyle: React.CSSProperties = {
  width: 32, flexShrink: 0, textAlign: 'right', paddingRight: 8,
  borderRight: '1px solid rgba(187,202,198,0.3)', marginRight: 8,
  color: 'var(--md-on-surface-variant)', opacity: 0.5,
  userSelect: 'none', display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
};
