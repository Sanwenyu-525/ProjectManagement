interface ConflictAlertProps {
  conflictFiles?: string[];
  onOpenEditor?: () => void;
}

export default function ConflictAlert({ conflictFiles = [], onOpenEditor }: ConflictAlertProps) {
  if (conflictFiles.length === 0) return null;

  return (
    <div style={{
      background: 'rgba(186,26,26,0.06)',
      borderRadius: 'var(--radius-sm)',
      border: '1px solid rgba(186,26,26,0.2)',
      boxShadow: 'var(--shadow-sm)',
      padding: 16,
      display: 'flex', flexDirection: 'column', gap: 12,
      position: 'relative', overflow: 'hidden',
    }}>
      {/* Decorative corner */}
      <div style={{
        position: 'absolute', top: 0, right: 0,
        width: 64, height: 64,
        background: 'rgba(186,26,26,0.03)',
        transform: 'rotate(45) translateX(32px) translateY(-32px)',
      }} />

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--md-error)' }}>
        <span className="material-symbols-outlined" style={{ fontSize: 20 }}>warning</span>
        <h2 style={{
          margin: 0, fontFamily: 'var(--font-sans)', fontSize: 'var(--text-base)', fontWeight: 600,
        }}>
          检测到冲突
        </h2>
      </div>

      <p style={{
        margin: 0, fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)',
        color: 'var(--md-on-surface-variant)', lineHeight: 1.5,
      }}>
        文件 <code style={{
          fontFamily: 'var(--font-mono)', background: 'var(--md-surface-container)',
          padding: '1px 4px', borderRadius: 'var(--radius-xs)',
          color: 'var(--md-on-surface)',
        }}>
          {conflictFiles[0]}
        </code>
        {conflictFiles.length > 1 && ` (+${conflictFiles.length - 1} 个文件)`}{' '}存在合并冲突，请解决后继续合并。
      </p>

      <button
        onClick={onOpenEditor}
        style={{
          width: '100%', padding: '8px 0', borderRadius: 'var(--radius-sm)',
          background: 'var(--md-error)', color: 'var(--md-on-error)',
          fontFamily: 'var(--font-label)', fontSize: 'var(--text-xs)', fontWeight: 500,
          border: 'none', cursor: 'pointer', boxShadow: 'var(--shadow-sm)',
          transition: 'opacity var(--transition-fast)',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.9'; }}
        onMouseLeave={(e) => { e.currentTarget.style.opacity = '1'; }}
      >
        打开冲突编辑器
      </button>
    </div>
  );
}
