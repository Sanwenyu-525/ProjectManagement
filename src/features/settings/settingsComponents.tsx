export function GlassCard({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      background: 'var(--color-bg-card)',
      backdropFilter: 'blur(20px) saturate(1.4)',
      WebkitBackdropFilter: 'blur(20px) saturate(1.4)',
      borderRadius: 12,
      border: '1px solid var(--color-border)',
      boxShadow: 'var(--card-shadow)',
      overflow: 'hidden',
      transition: 'box-shadow 0.2s ease',
    }}>
      {children}
    </div>
  );
}

export function CardHeader({ title, badge }: { title: string; badge?: string }) {
  return (
    <div style={{
      padding: '14px 24px',
      borderBottom: '1px solid var(--color-divider)',
      background: 'var(--md-surface-container-low)',
      display: 'flex',
      alignItems: 'center',
      gap: 8,
    }}>
      <h3 style={{
        fontSize: 'var(--text-lg)',
        fontWeight: 600,
        color: 'var(--md-on-surface)',
        lineHeight: '24px',
        letterSpacing: '-0.01em',
        margin: 0,
      }}>
        {title}
      </h3>
      {badge && (
        <span style={{
          background: 'var(--md-primary)',
          color: 'var(--md-on-primary)',
          fontFamily: 'var(--font-label)',
          fontSize: 10,
          fontWeight: 500,
          padding: '2px 8px',
          borderRadius: 4,
          letterSpacing: '0.02em',
        }}>
          {badge}
        </span>
      )}
    </div>
  );
}

export function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <span style={{ fontSize: 'var(--text-base)', color: 'var(--md-on-surface-variant)' }}>{label}</span>
      <span style={{ fontSize: 'var(--text-base)', color: 'var(--md-on-surface)' }}>{value}</span>
    </div>
  );
}

export function ToggleRow({ label, description, checked, onChange }: {
  label: string;
  description: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <div>
        <div style={{ fontSize: 'var(--text-base)', color: 'var(--md-on-surface)' }}>{label}</div>
        <div style={{ fontSize: 'var(--text-sm)', color: 'var(--md-on-surface-variant)', marginTop: 2 }}>{description}</div>
      </div>
      <label style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', cursor: 'pointer' }}>
        <input
          type="checkbox"
          checked={checked}
          onChange={onChange}
          style={{ position: 'absolute', opacity: 0, width: 0, height: 0 }}
        />
        <div style={{
          width: 36,
          height: 20,
          borderRadius: 10,
          background: checked ? 'var(--md-primary)' : 'var(--md-surface-container-high)',
          position: 'relative',
          transition: 'background 0.2s ease',
        }}>
          <div style={{
            width: 16,
            height: 16,
            borderRadius: '50%',
            background: 'var(--md-surface)',
            border: '1px solid var(--border)',
            position: 'absolute',
            top: 1,
            left: checked ? 17 : 1,
            transition: 'left 0.2s ease',
          }} />
        </div>
      </label>
    </div>
  );
}
