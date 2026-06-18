import { useThemeStore } from '../../stores/themeStore';

export function GlassCard({ children, isDark }: { children: React.ReactNode; isDark: boolean }) {
  return (
    <div style={{
      background: isDark ? 'var(--md-surface-container)' : '#ffffff',
      borderRadius: 12,
      border: `1px solid ${isDark ? 'var(--md-outline-variant)' : '#E2E8F0'}`,
      boxShadow: '0 4px 12px rgba(0,0,0,0.03)',
      overflow: 'hidden',
    }}>
      {children}
    </div>
  );
}

export function CardHeader({ title, badge }: { title: string; badge?: string }) {
  const isDark = useThemeStore(s => s.mode === 'dark');
  return (
    <div style={{
      padding: '14px 24px',
      borderBottom: `1px solid ${isDark ? 'rgba(187, 202, 198, 0.15)' : 'rgba(187, 202, 198, 0.3)'}`,
      background: isDark ? 'var(--md-surface-container-lowest)' : 'rgba(255,255,255,0.5)',
      display: 'flex',
      alignItems: 'center',
      gap: 8,
    }}>
      <h3 style={{
        fontSize: 16,
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
      <span style={{ fontSize: 14, color: 'var(--md-on-surface-variant)' }}>{label}</span>
      <span style={{ fontSize: 14, color: 'var(--md-on-surface)' }}>{value}</span>
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
        <div style={{ fontSize: 14, color: 'var(--md-on-surface)' }}>{label}</div>
        <div style={{ fontSize: 12, color: 'var(--md-on-surface-variant)', marginTop: 2 }}>{description}</div>
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
          background: checked ? 'var(--md-primary)' : 'rgba(187, 202, 198, 0.5)',
          position: 'relative',
          transition: 'background 0.2s ease',
        }}>
          <div style={{
            width: 16,
            height: 16,
            borderRadius: '50%',
            background: '#ffffff',
            border: '1px solid var(--md-outline-variant)',
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
