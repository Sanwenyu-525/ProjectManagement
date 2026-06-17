import { useState, useMemo } from 'react';
import { Empty } from 'antd';
import { useThemeStore } from '../../../stores/themeStore';
import { useBuilds, useBuildLogs } from '../../../hooks/useBuilds';

// ── UI types (parsed from JSON stored in DB) ──
interface PlatformStatus { name: string; status: 'ready' | 'building' | 'queued'; }
interface ArtifactEntry { name: string; size: string; }

const LEVEL_COLORS: Record<string, string> = {
  info: '#3b82f6',
  success: '#22c55e',
  warn: '#f59e0b',
  warning: '#f59e0b',
  error: '#ef4444',
};

function parseJsonArray<T>(json: string, fallback: T[]): T[] {
  try { const v = JSON.parse(json); return Array.isArray(v) ? v : fallback; } catch { return fallback; }
}

function formatDuration(seconds: number | null | undefined): string {
  if (!seconds) return '--';
  const m = Math.floor(seconds / 60).toString().padStart(2, '0');
  const s = (seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

export default function BuildCenterPage() {
  const isDark = useThemeStore(s => s.mode === 'dark');
  const [activeBuildId, setActiveBuildId] = useState<string | null>(null);

  const { data: builds = [], isLoading: loading } = useBuilds();

  const selectedBuildId = useMemo(() => {
    if (activeBuildId) return activeBuildId;
    const running = builds.find(b => b.status === 'running' || b.status === 'pending');
    return running?.id ?? builds[0]?.id;
  }, [activeBuildId, builds]);

  const { data: logs = [] } = useBuildLogs(selectedBuildId);

  const build = useMemo(() => builds.find(b => b.id === selectedBuildId) ?? builds[0] ?? null, [builds, selectedBuildId]);
  const platforms: PlatformStatus[] = useMemo(() => build ? parseJsonArray(build.platforms, []) : [], [build]);
  const artifacts: ArtifactEntry[] = useMemo(() => build ? parseJsonArray(build.artifacts, []) : [], [build]);
  const history = useMemo(() => builds.filter(b => b.id !== build?.id), [builds, build]);

  const elapsed = build?.duration ?? 0;
  const isActive = build?.status === 'running' || build?.status === 'pending';

  return (
    <div style={{ padding: 'var(--layout-container-padding)', maxWidth: 1200, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 32, fontWeight: 600, color: 'var(--md-on-surface)', lineHeight: '40px', letterSpacing: '-0.02em', margin: 0 }}>
          构建中心
        </h1>
        <p style={{ fontSize: 14, color: 'var(--md-on-surface-variant)', marginTop: 4, marginBottom: 0 }}>
          CI/CD 流水线管理
        </p>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 80, color: 'var(--md-on-surface-variant)' }}>加载中...</div>
      ) : !build ? (
        <Empty description="暂无构建记录" />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: 16 }}>
          {/* Active Build (8 cols) */}
          <div style={{ gridColumn: 'span 8' }}>
            <div style={{
              background: isDark ? 'var(--md-surface-container-lowest)' : '#ffffff',
              borderRadius: 12,
              border: `1px solid ${isDark ? 'var(--md-outline-variant)' : '#E2E8F0'}`,
              boxShadow: '0 4px 12px rgba(0,0,0,0.03)',
              overflow: 'hidden',
            }}>
              {/* Build header */}
              <div style={{
                padding: '16px 20px',
                borderBottom: `1px solid ${isDark ? 'var(--md-outline-variant)' : '#E2E8F0'}`,
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{
                    padding: '4px 10px', borderRadius: 6,
                    background: 'rgba(0, 107, 95, 0.12)', color: 'var(--md-primary)',
                    fontSize: 12, fontWeight: 600, fontFamily: 'var(--font-mono)',
                  }}>
                    {build.commitSha?.slice(0, 7) || build.id.slice(0, 8)}
                  </span>
                  <span style={{
                    padding: '3px 8px', borderRadius: 4,
                    background: isActive ? 'rgba(245, 158, 11, 0.12)' : build.status === 'success' ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)',
                    color: isActive ? '#f59e0b' : build.status === 'success' ? '#22c55e' : '#ef4444',
                    fontSize: 10, fontWeight: 600, fontFamily: 'var(--font-mono)',
                    letterSpacing: '0.05em', textTransform: 'uppercase',
                    ...(isActive ? { animation: 'pulse 2s infinite' } : {}),
                  }}>
                    {isActive ? '进行中' : build.status === 'success' ? '成功' : '失败'}
                  </span>
                  <style>{`@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.6; } }`}</style>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ fontSize: 12, color: 'var(--md-on-surface-variant)' }}>{build.branch || 'main'}</span>
                  <span style={{ fontSize: 12, color: 'var(--md-on-surface-variant)', fontFamily: 'var(--font-mono)' }}>
                    {formatDuration(elapsed)}
                  </span>
                </div>
              </div>

              {/* Commit message */}
              {build.commitMessage && (
                <div style={{ padding: '12px 20px 0', fontSize: 13, color: 'var(--md-on-surface)' }}>
                  {build.commitMessage}
                </div>
              )}

              {/* Live terminal */}
              <div style={{
                margin: '16px 20px 20px',
                background: '#0F172A',
                borderRadius: 8,
                padding: 12,
                fontFamily: 'var(--font-mono)',
                fontSize: 12,
                lineHeight: '18px',
                maxHeight: 200,
                overflowY: 'auto',
              }}>
                {logs.length === 0 ? (
                  <div style={{ color: '#64748b' }}>暂无日志</div>
                ) : (
                  logs.map((line, i) => (
                    <div key={i} style={{ color: LEVEL_COLORS[line.level] || '#e2e8f0' }}>
                      [{new Date(line.timestamp).toLocaleTimeString('zh-CN', { hour12: false })}] {line.message}
                    </div>
                  ))
                )}
                {isActive && (
                  <div style={{ display: 'flex', gap: 4, marginTop: 2 }}>
                    <span style={{ color: '#64748b' }}>{'>'}</span>
                    <span style={{
                      width: 7, height: 14, background: 'var(--md-primary)',
                      display: 'inline-block', animation: 'blink 1s step-end infinite',
                    }} />
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Target Platforms (4 cols) */}
          <div style={{ gridColumn: 'span 4' }}>
            {platforms.length > 0 && (
              <div style={{
                background: isDark ? 'var(--md-surface-container-lowest)' : '#ffffff',
                borderRadius: 12,
                border: `1px solid ${isDark ? 'var(--md-outline-variant)' : '#E2E8F0'}`,
                padding: 16,
                boxShadow: '0 4px 12px rgba(0,0,0,0.03)',
              }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--md-on-surface)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 16 }}>devices</span>
                  目标平台
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {platforms.map(p => (
                    <div key={p.name} style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '8px 12px', borderRadius: 8,
                      background: isDark ? 'var(--md-surface-container-low)' : 'var(--md-surface-container-low)',
                    }}>
                      <span style={{ fontSize: 13, color: 'var(--md-on-surface)' }}>{p.name}</span>
                      <span style={{
                        padding: '2px 8px', borderRadius: 4,
                        background: p.status === 'ready' ? 'rgba(0, 108, 73, 0.12)' : p.status === 'building' ? 'rgba(0, 107, 95, 0.12)' : 'var(--md-surface-container-high)',
                        color: p.status === 'ready' ? 'var(--md-tertiary)' : p.status === 'building' ? 'var(--md-primary)' : 'var(--md-on-surface-variant)',
                        fontSize: 10, fontFamily: 'var(--font-mono)',
                      }}>
                        {p.status === 'ready' ? '就绪' : p.status === 'building' ? '构建中' : '排队中'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Latest Artifacts */}
            {artifacts.length > 0 && (
              <div style={{
                background: isDark ? 'var(--md-surface-container-lowest)' : '#ffffff',
                borderRadius: 12,
                border: `1px solid ${isDark ? 'var(--md-outline-variant)' : '#E2E8F0'}`,
                padding: 16,
                boxShadow: '0 4px 12px rgba(0,0,0,0.03)',
                marginTop: 12,
              }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--md-on-surface)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 16 }}>download</span>
                  产物
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {artifacts.map(a => (
                    <div key={a.name} style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '6px 0',
                      borderBottom: `1px solid ${isDark ? 'rgba(187, 202, 198, 0.12)' : 'rgba(226, 232, 240, 0.6)'}`,
                    }}>
                      <div>
                        <div style={{ fontSize: 12, color: 'var(--md-on-surface)', fontFamily: 'var(--font-mono)' }}>{a.name}</div>
                        <div style={{ fontSize: 10, color: 'var(--md-on-surface-variant)' }}>{a.size}</div>
                      </div>
                      <button style={{
                        width: 28, height: 28, borderRadius: 6,
                        border: 'none', background: 'transparent',
                        color: 'var(--md-on-surface-variant)', cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        <span className="material-symbols-outlined" style={{ fontSize: 16 }}>download</span>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Build History (12 cols) */}
          {history.length > 0 && (
            <div style={{ gridColumn: '1 / -1' }}>
              <div style={{
                background: isDark ? 'var(--md-surface-container-lowest)' : '#ffffff',
                borderRadius: 12,
                border: `1px solid ${isDark ? 'var(--md-outline-variant)' : '#E2E8F0'}`,
                boxShadow: '0 4px 12px rgba(0,0,0,0.03)',
                overflow: 'hidden',
              }}>
                <div style={{
                  padding: '12px 16px',
                  borderBottom: `1px solid ${isDark ? 'var(--md-outline-variant)' : '#E2E8F0'}`,
                  fontSize: 13, fontWeight: 600, color: 'var(--md-on-surface)',
                  display: 'flex', alignItems: 'center', gap: 8,
                }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 16 }}>history</span>
                  构建历史
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: `1px solid ${isDark ? 'var(--md-outline-variant)' : '#E2E8F0'}` }}>
                      {['状态', '提交', '分支', '触发', '耗时'].map(h => (
                        <th key={h} style={{
                          padding: '10px 16px', fontSize: 11, fontWeight: 600,
                          color: 'var(--md-on-surface-variant)', textAlign: 'left',
                          fontFamily: 'var(--font-label)', letterSpacing: '0.03em',
                        }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {history.map(b => (
                      <tr key={b.id} style={{
                        borderBottom: `1px solid ${isDark ? 'rgba(187, 202, 198, 0.08)' : 'rgba(226, 232, 240, 0.4)'}`,
                        cursor: 'pointer',
                      }}
                        onClick={() => setActiveBuildId(b.id)}
                      >
                        <td style={{ padding: '10px 16px' }}>
                          <span style={{
                            width: 8, height: 8, borderRadius: '50%',
                            background: b.status === 'success' ? 'var(--md-tertiary)' : b.status === 'failed' ? 'var(--md-error)' : '#f59e0b',
                            display: 'inline-block',
                          }} />
                        </td>
                        <td style={{ padding: '10px 16px' }}>
                          <div style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--md-primary)' }}>{b.commitSha?.slice(0, 7) || '--'}</div>
                          <div style={{ fontSize: 12, color: 'var(--md-on-surface)' }}>{b.commitMessage || '--'}</div>
                        </td>
                        <td style={{ padding: '10px 16px' }}>
                          <span style={{
                            padding: '2px 8px', borderRadius: 4,
                            background: 'var(--md-surface-container-high)',
                            fontSize: 11, fontFamily: 'var(--font-mono)',
                            color: 'var(--md-on-surface)',
                          }}>
                            {b.branch || 'main'}
                          </span>
                        </td>
                        <td style={{ padding: '10px 16px' }}>
                          <span style={{ fontSize: 12, color: 'var(--md-on-surface-variant)' }}>{b.triggeredBy || '--'}</span>
                        </td>
                        <td style={{ padding: '10px 16px' }}>
                          <span style={{ fontSize: 12, color: 'var(--md-on-surface-variant)', fontFamily: 'var(--font-mono)' }}>{formatDuration(b.duration)}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
