import { useRef, useEffect } from 'react';
import type { GitCommit } from './gitTypes';

interface GitCommitTableProps {
  commits: GitCommit[];
  selectedHash: string | null;
  onSelect: (commit: GitCommit) => void;
  dirtyCount: number;
}

const graphColors = [
  'var(--md-primary)',
  'var(--md-secondary)',
  'var(--color-error)',
  'var(--md-tertiary)',
  'var(--color-info)',
  'var(--color-amber)',
];

function getGraphColor(idx: number) {
  return graphColors[idx % graphColors.length];
}

function relativeDate(dateStr: string): string {
  if (!dateStr || dateStr === 'Now') return '现在';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  const now = Date.now();
  const diff = now - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return '刚刚';
  if (mins < 60) return `${mins}分钟前`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}小时前`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return '昨天';
  if (days < 7) return `${days}天前`;
  return d.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
}

export default function GitCommitTable({ commits, selectedHash, onSelect, dirtyCount }: GitCommitTableProps) {
  const selectedRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (selectedRef.current) {
      selectedRef.current.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedHash]);

  return (
    <div style={{ flex: 1, overflow: 'auto', background: '#ffffff', position: 'relative' }}>
      {/* Table Header */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 10,
        background: 'var(--md-surface-container-lowest)',
        borderBottom: '1px solid var(--md-outline-variant)',
        display: 'flex', fontFamily: 'var(--font-label)', fontSize: 'var(--text-xs)',
        color: 'var(--md-on-surface-variant)', padding: '6px 16px',
        boxShadow: 'var(--shadow-xs)',
      }}>
        <div style={{ width: 60, flexShrink: 0 }}>图谱</div>
        <div style={{ flex: 1 }}>描述</div>
        <div style={{ width: 120, flexShrink: 0 }}>提交</div>
        <div style={{ width: 140, flexShrink: 0 }}>作者</div>
        <div style={{ width: 90, flexShrink: 0, textAlign: 'right' }}>日期</div>
      </div>

      <div style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', position: 'relative' }}>
        {/* Vertical graph line */}
        <div style={{
          position: 'absolute', left: 44, top: 0, bottom: 0,
          width: 2, background: 'rgba(0,107,95,0.12)', zIndex: 0,
        }} />

        {/* Uncommitted Changes Row */}
        {dirtyCount > 0 && (
          <div style={{
            display: 'flex', alignItems: 'center', padding: '8px 16px',
            borderBottom: '1px solid rgba(187,202,198,0.3)',
            cursor: 'pointer', background: 'rgba(186,26,26,0.03)',
          }}>
            <div style={{ width: 60, flexShrink: 0, display: 'flex', justifyContent: 'center', position: 'relative' }}>
              <div style={{
                width: 12, height: 12, borderRadius: '50%',
                border: '2px solid var(--md-error)', background: '#ffffff', zIndex: 1,
              }} />
            </div>
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontWeight: 600, color: 'var(--md-error)', fontStyle: 'italic' }}>
                未提交变更 ({dirtyCount})
              </span>
            </div>
            <div style={{ width: 120, flexShrink: 0, fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)', color: 'var(--md-on-surface-variant)' }}>--</div>
            <div style={{ width: 140, flexShrink: 0, color: 'var(--md-on-surface-variant)' }}>你</div>
            <div style={{ width: 90, flexShrink: 0, textAlign: 'right', color: 'var(--md-on-surface-variant)' }}>现在</div>
          </div>
        )}

        {/* Commit Rows */}
        {commits.map((commit, i) => {
          const isSelected = commit.shortHash === selectedHash;
          const graphColor = getGraphColor(commit.branchIdx);

          return (
            <div
              key={commit.hash}
              ref={isSelected ? selectedRef : undefined}
              onClick={() => onSelect(commit)}
              style={{
                display: 'flex', alignItems: 'center', padding: '8px 16px',
                borderBottom: '1px solid rgba(187,202,198,0.3)',
                cursor: 'pointer',
                background: isSelected ? 'rgba(0,107,95,0.08)' : 'transparent',
                borderLeft: isSelected ? '2px solid var(--md-primary)' : '2px solid transparent',
                transition: 'background var(--transition-fast)',
              }}
              onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.background = 'var(--md-surface-container-low)'; }}
              onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.background = 'transparent'; }}
            >
              {/* Graph */}
              <div style={{ width: 60, flexShrink: 0, display: 'flex', justifyContent: 'center', position: 'relative' }}>
                <div style={{
                  width: i === 0 ? 12 : 10, height: i === 0 ? 12 : 10,
                  borderRadius: '50%', zIndex: 1,
                  background: isSelected ? graphColor : '#ffffff',
                  border: `2px solid ${graphColor}`,
                  boxShadow: isSelected ? `0 0 0 4px rgba(0,107,95,0.15)` : 'none',
                }} />
              </div>

              {/* Description */}
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, overflow: 'hidden' }}>
                <span style={{
                  fontWeight: isSelected ? 600 : 400,
                  color: 'var(--md-on-surface)',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {commit.message}
                </span>
                {commit.branches?.map((b) => (
                  <span key={b} style={{
                    padding: '1px 6px', fontSize: 10, fontFamily: 'var(--font-label)',
                    borderRadius: 'var(--radius-xs)',
                    border: b === 'HEAD'
                      ? '1px solid var(--md-primary)'
                      : b === 'main'
                        ? '1px solid var(--md-outline-variant)'
                        : '1px solid var(--color-error)',
                    color: b === 'HEAD'
                      ? 'var(--md-primary)'
                      : b === 'main'
                        ? 'var(--md-on-surface-variant)'
                        : 'var(--color-error)',
                    background: b === 'HEAD'
                      ? 'rgba(0,107,95,0.12)'
                      : b === 'main'
                        ? 'transparent'
                        : 'rgba(186,26,26,0.12)',
                    flexShrink: 0,
                  }}>
                    {b}
                  </span>
                ))}
              </div>

              {/* Commit Hash */}
              <div style={{
                width: 120, flexShrink: 0,
                fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)',
                color: isSelected ? 'var(--md-primary)' : 'var(--md-on-surface-variant)',
              }}>
                {commit.shortHash}
              </div>

              {/* Author */}
              <div style={{ width: 140, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 6, overflow: 'hidden' }}>
                <div style={{
                  width: 16, height: 16, borderRadius: '50%',
                  background: getGraphColor(commit.branchIdx),
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#fff', fontSize: 9, fontWeight: 700, flexShrink: 0,
                }}>
                  {commit.author?.[0]?.toUpperCase() || '?'}
                </div>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--md-on-surface-variant)', fontSize: 'var(--text-sm)' }}>
                  {commit.author}
                </span>
              </div>

              {/* Date */}
              <div style={{
                width: 90, flexShrink: 0, textAlign: 'right',
                color: 'var(--md-on-surface-variant)', fontSize: 'var(--text-sm)',
              }}>
                {relativeDate(commit.date)}
              </div>
            </div>
          );
        })}

        {commits.length === 0 && (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--md-on-surface-variant)' }}>
            暂无提交记录
          </div>
        )}
      </div>
    </div>
  );
}
