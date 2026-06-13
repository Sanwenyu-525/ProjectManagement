import { useMemo, useState, useRef, useCallback } from 'react';

interface Commit {
  hash: string;
  shortHash: string;
  message: string;
  author: string;
  date: string;
  parents: string[];
  branchIdx: number;
}

interface Branch {
  name: string;
  current: boolean;
  isRemote: boolean;
  upstream?: string;
  ahead: number;
  behind: number;
}

interface CommitGraphProps {
  commits: Commit[];
  branches: Branch[];
  selectedHash?: string;
  onSelect: (commit: Commit) => void;
}

const LANE_COLORS = [
  '#22c55e', '#3b82f6', '#f59e0b', '#8b5cf6',
  '#ec4899', '#06b6d4', '#f97316', '#6366f1',
];

const LANE_HEIGHT = 40;
const COMMIT_RADIUS = 7;
const COMMIT_GAP = 64;
const LEFT_MARGIN = 170;
const COMMIT_X_START = LEFT_MARGIN + 16;
const LANE_Y_START = 44;

export default function CommitGraph({ commits, branches, selectedHash, onSelect }: CommitGraphProps) {
  const [hoveredHash, setHoveredHash] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [scrollOffset, setScrollOffset] = useState({ top: 0, left: 0 });

  const handleWheel = useCallback((e: React.WheelEvent) => {
    const el = scrollRef.current;
    if (!el) return;
    // Only intercept vertical scroll when at the vertical boundary
    const atTop = el.scrollTop <= 0;
    const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 1;
    if ((e.deltaY < 0 && atTop) || (e.deltaY > 0 && atBottom)) {
      e.preventDefault();
      el.scrollLeft += e.deltaY;
    }
  }, []);

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setScrollOffset({ top: el.scrollTop, left: el.scrollLeft });
  }, []);

  const { displayBranches, displayCommits, positions, hashIdx, width, height } = useMemo(() => {
    if (commits.length === 0 || branches.length === 0) {
      return { displayBranches: [] as Branch[], displayCommits: [] as Commit[], positions: [] as {x:number,y:number}[], hashIdx: new Map<string, number>(), width: 600, height: 100 };
    }

    const usedIndices = new Set(commits.map(c => c.branchIdx));

    // Build a Set of local branch names for O(1) lookup
    const localBranchNames = new Set<string>();
    for (let i = 0; i < branches.length; i++) {
      if (!branches[i].isRemote && usedIndices.has(i)) {
        localBranchNames.add(branches[i].name);
      }
    }

    const deduped: Branch[] = [];
    const origToNew = new Map<number, number>();
    const seenNorm = new Set<string>();

    for (let i = 0; i < branches.length; i++) {
      const b = branches[i];
      if (!usedIndices.has(i)) continue;
      if (b.isRemote) {
        const localName = b.name.replace(/^origin\//, '');
        if (localBranchNames.has(localName)) continue;
      }
      const normName = b.isRemote ? b.name.replace(/^origin\//, '') : b.name;
      if (seenNorm.has(normName)) continue;
      seenNorm.add(normName);
      origToNew.set(i, deduped.length);
      deduped.push(b);
    }

    const remapped = commits.map(c => ({
      ...c,
      branchIdx: origToNew.get(c.branchIdx) ?? 0,
    }));

    const hIdx = new Map<string, number>();
    remapped.forEach((c, i) => hIdx.set(c.hash, i));

    const pos = remapped.map((c, i) => ({
      x: COMMIT_X_START + i * COMMIT_GAP,
      y: LANE_Y_START + c.branchIdx * LANE_HEIGHT,
    }));

    const w = Math.max(COMMIT_X_START + remapped.length * COMMIT_GAP + 20, 600);
    const h = LANE_Y_START + deduped.length * LANE_HEIGHT + 16;

    return { displayBranches: deduped, displayCommits: remapped, positions: pos, hashIdx: hIdx, width: w, height: h };
  }, [commits, branches]);

  if (displayCommits.length === 0) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', color: 'var(--color-text-muted)', fontSize: 13 }}>
        无提交记录
      </div>
    );
  }

  return (
    <div style={{ height: '100%', display: 'flex', overflow: 'hidden', position: 'relative' }}>
      {/* Fixed branch labels on the left */}
      <div style={{
        width: LEFT_MARGIN,
        flexShrink: 0,
        overflow: 'hidden',
        borderRight: '1px solid var(--color-border)',
        background: 'var(--color-bg-card)',
      }}>
        <svg width={LEFT_MARGIN} height={height} style={{ display: 'block' }}>
          {displayBranches.map((branch, i) => {
            const color = LANE_COLORS[i % LANE_COLORS.length];
            const isCurrent = branch.current;
            return (
              <g key={`label-${i}`}>
                <rect x={8} y={LANE_Y_START + i * LANE_HEIGHT - 10}
                  width={branch.name.length * 7.2 + 16} height={20} rx={4}
                  fill={isCurrent ? color : 'var(--color-bg-surface)'}
                />
                <text x={16} y={LANE_Y_START + i * LANE_HEIGHT + 4}
                  fontSize={11} fontFamily="'Fira Code', monospace"
                  fontWeight={isCurrent ? 600 : 400}
                  fill={isCurrent ? '#fff' : 'var(--color-text-secondary)'}
                >
                  {branch.name}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {/* Scrollable commit graph */}
      <div
        ref={scrollRef}
        style={{ flex: 1, overflow: 'auto', position: 'relative' }}
        onWheel={handleWheel}
        onScroll={handleScroll}
      >
        <svg width={width} height={height} style={{ display: 'block' }}>

          {/* Lane backgrounds */}
          {displayBranches.map((_, i) => (
            <rect key={`lane-bg-${i}`}
              x={0} y={LANE_Y_START + i * LANE_HEIGHT - LANE_HEIGHT / 2}
              width={width} height={LANE_HEIGHT}
              fill={i % 2 === 0 ? 'transparent' : 'rgba(0,0,0,0.015)'}
            />
          ))}

          {/* Lane guide lines */}
          {displayBranches.map((_, i) => (
            <line key={`lane-${i}`}
              x1={0} y1={LANE_Y_START + i * LANE_HEIGHT}
              x2={width} y2={LANE_Y_START + i * LANE_HEIGHT}
              stroke="rgba(0,0,0,0.04)" strokeWidth={1}
            />
          ))}

          {/* Connection lines */}
          {displayCommits.map((commit, i) => {
            const cp = positions[i];
            const color = LANE_COLORS[commit.branchIdx % LANE_COLORS.length];

            return commit.parents.map(ph => {
              const pi = hashIdx.get(ph);
              if (pi === undefined) return null;
              const pp = positions[pi];
              const pc = displayCommits[pi];

              if (commit.branchIdx === pc.branchIdx) {
                return (
                  <line key={`${i}-${ph}`}
                    x1={cp.x} y1={cp.y} x2={pp.x} y2={pp.y}
                    stroke={color} strokeWidth={2} strokeLinecap="round" opacity={0.5}
                  />
                );
              }

              const midX = (cp.x + pp.x) / 2;
              return (
                <path key={`${i}-${ph}`}
                  d={`M ${cp.x} ${cp.y} C ${midX} ${cp.y}, ${midX} ${pp.y}, ${pp.x} ${pp.y}`}
                  stroke={LANE_COLORS[pc.branchIdx % LANE_COLORS.length]}
                  strokeWidth={2} fill="none" strokeLinecap="round" opacity={0.4}
                  strokeDasharray="4 2"
                />
              );
            });
          })}

          {/* Commit dots */}
          {displayCommits.map((commit, i) => {
            const pos = positions[i];
            const color = LANE_COLORS[commit.branchIdx % LANE_COLORS.length];
            const isSelected = commit.hash === selectedHash;
            const isHovered = commit.hash === hoveredHash;
            const isMerge = commit.parents.length > 1;

            return (
              <g key={commit.hash}
                onClick={() => onSelect(commit)}
                onMouseEnter={() => setHoveredHash(commit.hash)}
                onMouseLeave={() => setHoveredHash(null)}
                style={{ cursor: 'pointer' }}
              >
                {/* Invisible large hit area for click/hover detection */}
                <circle cx={pos.x} cy={pos.y} r={22}
                  fill="white" fillOpacity={0} stroke="none"
                />
                {/* Selection ring */}
                {isSelected && (
                  <circle cx={pos.x} cy={pos.y} r={COMMIT_RADIUS + 5}
                    fill="none" stroke={color} strokeWidth={2} opacity={0.25}
                  />
                )}
                {/* Merge ring */}
                {isMerge && !isSelected && (
                  <circle cx={pos.x} cy={pos.y} r={COMMIT_RADIUS + 3}
                    fill="none" stroke={color} strokeWidth={1.5} opacity={0.3}
                  />
                )}
                {/* Main dot */}
                <circle cx={pos.x} cy={pos.y}
                  r={isSelected ? COMMIT_RADIUS + 2 : isHovered ? COMMIT_RADIUS + 1 : COMMIT_RADIUS}
                  fill={isSelected ? color : '#fff'}
                  stroke={color}
                  strokeWidth={isSelected ? 2.5 : 2}
                />
                {/* Time label below dot */}
                <text
                  x={pos.x}
                  y={pos.y + COMMIT_RADIUS + 18}
                  textAnchor="middle"
                  fontSize={9}
                  fill="var(--color-text-muted)"
                  fontFamily="'Fira Code', monospace"
                >
                  {formatDate(commit.date)}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {/* Hover/selected tooltip — rendered outside scroll container to avoid clipping */}
      {displayCommits.map((commit, i) => {
        if (commit.hash !== hoveredHash && commit.hash !== selectedHash) return null;
        const pos = positions[i];
        const branch = displayBranches[commit.branchIdx];
        const branchColor = LANE_COLORS[commit.branchIdx % LANE_COLORS.length];

        // Position relative to visible area (account for scroll), always above node
        const visibleY = pos.y - scrollOffset.top;
        const visibleX = pos.x - scrollOffset.left;
        const viewportW = scrollRef.current?.clientWidth || 800;
        const tipHeight = 80;
        const tipTop = visibleY - tipHeight;
        const tipLeft = visibleX < 140 ? 8
          : visibleX > viewportW - 140 ? viewportW - 288
          : visibleX - 140;

        return (
          <div key={`tip-${commit.hash}`}
            style={{
              position: 'absolute',
              left: tipLeft,
              top: tipTop,
              width: 280,
              pointerEvents: 'none',
              zIndex: 9999,
            }}
          >
            <div style={{
              background: 'var(--color-bg-elevated, rgba(255,255,255,0.95))',
              color: 'var(--color-text-primary)',
              borderRadius: 8,
              padding: '8px 12px', fontSize: 11, lineHeight: 1.5,
              boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
              border: '1px solid var(--color-border)',
              backdropFilter: 'blur(12px)',
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                <span style={{
                  fontFamily: "'Fira Code', monospace",
                  background: branchColor,
                  color: '#fff',
                  padding: '1px 6px',
                  borderRadius: 4,
                  fontSize: 10,
                  fontWeight: 600,
                }}>
                  {branch?.name || 'unknown'}
                </span>
                <span style={{ fontFamily: "'Fira Code', monospace", color: branchColor }}>
                  {commit.shortHash}
                </span>
              </div>
              <div style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {commit.message}
              </div>
              <div style={{ color: 'var(--color-text-secondary)', fontSize: 10, marginTop: 2 }}>
                {commit.author} · {formatDate(commit.date)}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    const mins = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    if (mins < 1) return '刚刚';
    if (mins < 60) return `${mins}分钟前`;
    if (hours < 24) return `${hours}小时前`;
    if (days < 30) return `${days}天前`;
    return d.toLocaleDateString('zh-CN');
  } catch {
    return dateStr;
  }
}
