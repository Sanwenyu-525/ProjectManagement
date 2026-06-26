import { Button, message } from 'antd';
import { useThemeStore } from '../../../stores/themeStore';

interface GitCommit { hash: string; shortHash: string; message: string; author: string; date: string; branches?: string[]; parents: string[]; branchIdx: number; }

export function CommitInspector({ commit }: { commit: GitCommit }) {
  const isDark = useThemeStore(s => s.mode === 'dark');
  const copyHash = () => {
    navigator.clipboard.writeText(commit.hash);
    message.success('已复制完整 hash');
  };

  return (
    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--md-on-surface)', display: 'flex', alignItems: 'center', gap: 6 }}>
        <span className="material-symbols-outlined" style={{ fontSize: 16 }}>info</span>
        提交详情
      </div>

      <div style={{
        padding: 12, borderRadius: 8,
        background: isDark ? 'var(--md-surface-container-low)' : 'var(--md-surface-container-low)',
        border: "1px solid var(--border)",
      }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--md-on-surface)', marginBottom: 6, lineHeight: '18px' }}>
          {commit.message}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <span style={{
            fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 600,
            color: 'var(--md-primary)',
          }}>
            {commit.shortHash}
          </span>
        </div>
        <div style={{ fontSize: 12, color: 'var(--md-on-surface-variant)', display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div><strong>作者：</strong>{commit.author}</div>
          <div><strong>时间：</strong>{new Date(commit.date).toLocaleString('zh-CN')}</div>
          {commit.branches && commit.branches.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
              {commit.branches.map(b => (
                <span key={b} style={{
                  padding: '1px 6px', borderRadius: 4, fontSize: 10,
                  background: 'var(--md-primary)', color: 'var(--md-on-primary)',
                  fontFamily: 'var(--font-mono)',
                }}>
                  {b}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        <Button size="small" block onClick={copyHash}>
          <span className="material-symbols-outlined" style={{ fontSize: 14, marginRight: 4 }}>content_copy</span>
          复制 Hash
        </Button>
      </div>

      {/* Repo Insights */}
      <div style={{
        marginTop: 8, padding: 12, borderRadius: 8,
        background: isDark ? 'var(--md-surface-container-low)' : 'var(--md-surface-container-low)',
        border: "1px solid var(--border)",
      }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--md-on-surface-variant)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          仓库概览
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 600, color: 'var(--md-on-surface)' }}>—</div>
            <div style={{ fontSize: 11, color: 'var(--md-on-surface-variant)' }}>总提交</div>
          </div>
          <div>
            <div style={{ fontSize: 18, fontWeight: 600, color: 'var(--md-on-surface)' }}>—</div>
            <div style={{ fontSize: 11, color: 'var(--md-on-surface-variant)' }}>活跃分支</div>
          </div>
        </div>
      </div>
    </div>
  );
}
