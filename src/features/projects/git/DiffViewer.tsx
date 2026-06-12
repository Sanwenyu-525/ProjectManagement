import { useMemo } from 'react';
import { Empty, Spin } from 'antd';
import { FileTextOutlined } from '@ant-design/icons';

interface DiffViewerProps {
  content: string;
  loading?: boolean;
  title?: string;
}

export default function DiffViewer({ content, loading, title }: DiffViewerProps) {
  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
        <Spin />
      </div>
    );
  }

  if (!content) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
        <Empty
          image={<FileTextOutlined style={{ fontSize: 48, color: '#c4d0de' }} />}
          description="选择文件查看差异"
          styles={{ description: { color: '#9eadc0', fontSize: 12 } }}
        />
      </div>
    );
  }

  const sections = useMemo(() => parseDiff(content), [content]);

  return (
    <div style={{ height: '100%', overflow: 'auto', padding: '0 0 16px', background: 'rgba(255,255,255,0.95)' }}>
      {title && (
        <div style={{
          padding: '8px 16px', fontSize: 12, fontWeight: 600, color: '#1a1f36',
          borderBottom: '1px solid rgba(0,0,0,0.06)', background: '#f8fafc',
          position: 'sticky', top: 0, zIndex: 10,
          boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
        }}>
          {title}
        </div>
      )}
      {sections.map((section, si) => (
        <div key={si}>
          {/* File header */}
          {section.fileName && (
            <div style={{
              padding: '6px 16px', fontSize: 12, fontWeight: 600,
              color: '#1a1f36', background: 'rgba(0,0,0,0.03)',
              borderBottom: '1px solid rgba(0,0,0,0.06)',
              fontFamily: "'Fira Code', monospace",
            }}>
              {section.fileName}
            </div>
          )}
          {/* Hunk header */}
          {section.hunkHeader && (
            <div style={{
              padding: '3px 16px', fontSize: 11,
              color: '#6366f1', background: 'rgba(99,102,241,0.05)',
              fontFamily: "'Fira Code', monospace",
            }}>
              {section.hunkHeader}
            </div>
          )}
          {/* Diff lines */}
          {section.lines.map((line, li) => (
            <DiffLine key={li} line={line} />
          ))}
        </div>
      ))}
    </div>
  );
}

function DiffLine({ line }: { line: DiffLine }) {
  let bg = 'transparent';
  let color = '#1a1f36';
  let gutterBg = 'transparent';
  let gutterColor = '#c4d0de';

  if (line.type === 'add') {
    bg = 'rgba(34, 197, 94, 0.08)';
    color = '#166534';
    gutterBg = 'rgba(34, 197, 94, 0.12)';
    gutterColor = '#22c55e';
  } else if (line.type === 'del') {
    bg = 'rgba(239, 68, 68, 0.06)';
    color = '#991b1b';
    gutterBg = 'rgba(239, 68, 68, 0.1)';
    gutterColor = '#ef4444';
  }

  return (
    <div style={{
      display: 'flex', fontFamily: "'Fira Code', monospace", fontSize: 12, lineHeight: '20px',
      background: bg,
    }}>
      <span style={{
        width: 40, textAlign: 'right', paddingRight: 8, color: gutterColor,
        background: gutterBg, flexShrink: 0, userSelect: 'none',
      }}>
        {line.oldLine || ''}
      </span>
      <span style={{
        width: 40, textAlign: 'right', paddingRight: 8, color: gutterColor,
        background: gutterBg, flexShrink: 0, userSelect: 'none',
      }}>
        {line.newLine || ''}
      </span>
      <span style={{
        width: 20, textAlign: 'center', color: gutterColor, flexShrink: 0,
        userSelect: 'none', fontWeight: 700,
      }}>
        {line.type === 'add' ? '+' : line.type === 'del' ? '-' : ' '}
      </span>
      <span style={{ flex: 1, paddingLeft: 8, color, whiteSpace: 'pre', overflow: 'hidden' }}>
        {line.content}
      </span>
    </div>
  );
}

// ── Diff parsing ───────────────────────────────────────────────────────────

interface DiffLine {
  type: 'context' | 'add' | 'del';
  oldLine: number | null;
  newLine: number | null;
  content: string;
}

interface DiffSection {
  fileName: string | null;
  hunkHeader: string | null;
  lines: DiffLine[];
}

function parseDiff(raw: string): DiffSection[] {
  const sections: DiffSection[] = [];
  let current: DiffSection = { fileName: null, hunkHeader: null, lines: [] };
  let oldLine = 0;
  let newLine = 0;

  for (const line of raw.split('\n')) {
    // File header: --- a/file or +++ b/file
    if (line.startsWith('--- ')) {
      // Start new section
      if (current.lines.length > 0 || current.fileName) {
        sections.push(current);
      }
      current = { fileName: null, hunkHeader: null, lines: [] };
      continue;
    }
    if (line.startsWith('+++ ')) {
      current.fileName = line.slice(4).replace(/^b\//, '');
      continue;
    }

    // Hunk header: @@ -1,3 +1,4 @@
    const hunkMatch = line.match(/^@@ -(\d+),?\d* \+(\d+),?\d* @@(.*)/);
    if (hunkMatch) {
      oldLine = parseInt(hunkMatch[1], 10);
      newLine = parseInt(hunkMatch[2], 10);
      current.hunkHeader = line;
      continue;
    }

    // Diff content
    if (line.startsWith('+')) {
      current.lines.push({ type: 'add', oldLine: null, newLine, content: line.slice(1) });
      newLine++;
    } else if (line.startsWith('-')) {
      current.lines.push({ type: 'del', oldLine, newLine: null, content: line.slice(1) });
      oldLine++;
    } else if (line.startsWith(' ')) {
      current.lines.push({ type: 'context', oldLine, newLine, content: line.slice(1) });
      oldLine++;
      newLine++;
    }
  }

  if (current.lines.length > 0 || current.fileName) {
    sections.push(current);
  }

  return sections;
}
