interface RepoInsightsProps {
  totalCommits: number;
  activeBranches: number;
  weeklyActivity?: number[]; // 7 values for 周一-周日
}

const DAYS = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];

export default function RepoInsights({ totalCommits, activeBranches, weeklyActivity }: RepoInsightsProps) {
  const activity = weeklyActivity && weeklyActivity.length === 7
    ? weeklyActivity
    : [0, 0, 0, 0, 0, 0, 0];
  const maxVal = Math.max(...activity, 1);

  return (
    <div style={{
      background: 'var(--md-surface-container-lowest)',
      borderRadius: 'var(--radius-sm)',
      border: '1px solid var(--md-outline-variant)',
      boxShadow: 'var(--shadow-sm)',
      padding: 16,
      display: 'flex', flexDirection: 'column', flex: 1,
    }}>
      <h2 style={{
        margin: '0 0 16px 0', fontFamily: 'var(--font-sans)',
        fontSize: 'var(--text-base)', fontWeight: 600, color: 'var(--md-on-surface)',
      }}>
        仓库洞察
      </h2>

      {/* Stats Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 24 }}>
        <div style={{
          padding: 12, borderRadius: 'var(--radius-sm)',
          background: 'var(--md-surface-container-low)',
          textAlign: 'center',
        }}>
          <div style={{
            fontFamily: 'var(--font-sans)', fontSize: 28, fontWeight: 600,
            color: 'var(--md-primary)', lineHeight: 1.2,
          }}>
            {totalCommits}
          </div>
          <div style={{
            fontFamily: 'var(--font-label)', fontSize: 'var(--text-xs)',
            color: 'var(--md-on-surface-variant)', marginTop: 4,
          }}>
            总提交数
          </div>
        </div>
        <div style={{
          padding: 12, borderRadius: 'var(--radius-sm)',
          background: 'var(--md-surface-container-low)',
          textAlign: 'center',
        }}>
          <div style={{
            fontFamily: 'var(--font-sans)', fontSize: 28, fontWeight: 600,
            color: 'var(--md-secondary)', lineHeight: 1.2,
          }}>
            {activeBranches}
          </div>
          <div style={{
            fontFamily: 'var(--font-label)', fontSize: 'var(--text-xs)',
            color: 'var(--md-on-surface-variant)', marginTop: 4,
          }}>
            活跃分支
          </div>
        </div>
      </div>

      {/* Activity Chart */}
      <h3 style={{
        margin: '0 0 12px 0', fontFamily: 'var(--font-label)',
        fontSize: 'var(--text-xs)', fontWeight: 500,
        color: 'var(--md-on-surface-variant)', textTransform: 'uppercase',
        letterSpacing: '0.04em',
      }}>
        本周活动
      </h3>

      <div style={{ flex: 1, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 4, minHeight: 120, position: 'relative' }}>
        {activity.map((val, i) => {
          const heightPct = (val / maxVal) * 100;
          const isWeekend = i >= 5;
          const barColor = isWeekend
            ? 'var(--md-surface-container-high)'
            : val > maxVal * 0.7
              ? 'var(--md-primary)'
              : val > maxVal * 0.3
                ? 'rgba(0,107,95,0.5)'
                : 'rgba(0,107,95,0.2)';

          return (
            <div
              key={i}
              style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}
            >
              <div
                title={`${DAYS[i]}: ${val} 次提交`}
                style={{
                  width: '100%', height: `${heightPct}%`, minHeight: val > 0 ? 4 : 0,
                  background: barColor, borderRadius: 'var(--radius-xs) var(--radius-xs) 0 0',
                  transition: 'background var(--transition-fast)',
                  cursor: 'pointer',
                }}
                onMouseEnter={(e) => { if (!isWeekend) e.currentTarget.style.opacity = '0.8'; }}
                onMouseLeave={(e) => { e.currentTarget.style.opacity = '1'; }}
              />
            </div>
          );
        })}
      </div>

      <div style={{
        display: 'flex', justifyContent: 'space-between',
        fontFamily: 'var(--font-mono)', fontSize: 10,
        color: 'var(--md-on-surface-variant)', marginTop: 8, padding: '0 2px',
      }}>
        <span>周一</span>
        <span>周三</span>
        <span>周日</span>
      </div>
    </div>
  );
}
