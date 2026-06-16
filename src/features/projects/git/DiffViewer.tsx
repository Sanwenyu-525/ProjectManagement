import { useMemo, useState } from 'react';
import { Empty, Spin, Button, Tooltip, message } from 'antd';
import { FileTextOutlined, CopyOutlined, CheckOutlined } from '@ant-design/icons';

interface DiffViewerProps {
  content: string;
  loading?: boolean;
  title?: string;
}

export default function DiffViewer({ content, loading, title }: DiffViewerProps) {
  const [copied, setCopied] = useState(false);
  const sections = useMemo(() => parseDiff(content), [content]);

  const handleCopy = () => {
    navigator.clipboard.writeText(content).then(() => {
      setCopied(true);
      message.success('已复制');
      setTimeout(() => setCopied(false), 2000);
    });
  };

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
          image={<FileTextOutlined style={{ fontSize: 48, color: 'var(--color-text-muted)' }} />}
          description="选择文件或提交查看差异"
          styles={{ description: { color: 'var(--color-text-secondary)', fontSize: 12 } }}
        />
      </div>
    );
  }

  return (
    <div style={{ height: '100%', overflow: 'auto', padding: '0 0 16px', background: 'var(--color-bg-card)' }}>
      {title && (
        <div style={{
          padding: '6px 12px', fontSize: 12, fontWeight: 600, color: 'var(--color-text-primary)',
          borderBottom: '1px solid var(--color-border)', background: 'var(--color-bg-surface)',
          position: 'sticky', top: 0, zIndex: 10,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <span style={{ fontFamily: "'Fira Code', monospace", overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {title}
          </span>
          <Tooltip title="复制差异内容">
            <Button
              type="text" size="small"
              icon={copied ? <CheckOutlined style={{ color: 'var(--color-primary)' }} /> : <CopyOutlined />}
              onClick={handleCopy}
              style={{ flexShrink: 0, marginLeft: 8, color: 'var(--color-text-secondary)' }}
            />
          </Tooltip>
        </div>
      )}
      {sections.map((section, si) => (
        <div key={si}>
          {/* File header */}
          {section.fileName && (
            <div style={{
              padding: '6px 16px', fontSize: 12, fontWeight: 600,
              color: 'var(--color-text-primary)', background: 'var(--color-bg-surface)',
              borderBottom: '1px solid var(--color-border)',
              fontFamily: "'Fira Code', monospace",
            }}>
              {section.fileName}
            </div>
          )}
          {/* Hunk header */}
          {section.hunkHeader && (
            <div style={{
              padding: '3px 16px', fontSize: 11,
              color: 'var(--color-purple)', background: 'var(--color-purple-light)',
              fontFamily: "'Fira Code', monospace",
              borderBottom: '1px solid var(--color-border-subtle)',
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

function DiffLine({ line }: { line: DiffLineInfo }) {
  let bg = 'transparent';
  let color = 'var(--color-text-primary)';
  let gutterBg = 'transparent';
  let gutterColor = 'var(--color-text-muted)';

  if (line.type === 'add') {
    bg = 'var(--color-diff-add-bg)';
    color = 'var(--color-diff-add-text)';
    gutterBg = 'var(--color-status-done)';
    gutterColor = 'var(--color-status-done)';
  } else if (line.type === 'del') {
    bg = 'var(--color-diff-del-bg)';
    color = 'var(--color-diff-del-text)';
    gutterBg = 'var(--color-status-cancel)';
    gutterColor = 'var(--color-status-cancel)';
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

interface DiffLineInfo {
  type: 'context' | 'add' | 'del';
  oldLine: number | null;
  newLine: number | null;
  content: string;
}

interface DiffSection {
  fileName: string | null;
  hunkHeader: string | null;
  lines: DiffLineInfo[];
}

function parseDiff(raw: string): DiffSection[] {
  const sections: DiffSection[] = [];
  let current: DiffSection = { fileName: null, hunkHeader: null, lines: [] };
  let oldLine = 0;
  let newLine = 0;

  for (const line of raw.split('\n')) {
    // File header: diff --git a/file b/file
    if (line.startsWith('diff --git ')) {
      if (current.lines.length > 0 || current.fileName) {
        sections.push(current);
      }
      current = { fileName: null, hunkHeader: null, lines: [] };
      // Extract "b/file" from "diff --git a/file b/file"
      const parts = line.split(' b/');
      if (parts.length > 1) {
        current.fileName = parts[parts.length - 1];
      }
      continue;
    }
    // File header: --- a/file or +++ b/file
    if (line.startsWith('--- ')) {
      if (!current.fileName && current.lines.length > 0) {
        sections.push(current);
        current = { fileName: null, hunkHeader: null, lines: [] };
      }
      continue;
    }
    if (line.startsWith('+++ ')) {
      current.fileName = line.slice(4).replace(/^b\//, '');
      continue;
    }

    // Binary files
    if (line.startsWith('Binary files ')) {
      if (current.lines.length > 0 || current.fileName) {
        sections.push(current);
      }
      current = { fileName: current.fileName, hunkHeader: null, lines: [] };
      current.lines.push({ type: 'context', oldLine: null, newLine: null, content: line });
      sections.push(current);
      current = { fileName: null, hunkHeader: null, lines: [] };
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
