interface TechTagProps {
  label: string;
  size?: 'sm' | 'md';
  removable?: boolean;
  onRemove?: () => void;
}

const sizeStyles = {
  sm: { padding: '1px 6px', fontSize: 10 },
  md: { padding: '2px 8px', fontSize: 11 },
};

export function TechTag({ label, size = 'md', removable, onRemove }: TechTagProps) {
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 4,
      background: 'var(--md-surface-container-high)',
      color: 'var(--md-on-surface)',
      border: '1px solid var(--md-outline-variant)',
      borderRadius: 6,
      fontFamily: 'var(--font-mono)',
      ...sizeStyles[size],
    }}>
      {label}
      {removable && (
        <button
          onClick={(e) => { e.stopPropagation(); onRemove?.(); }}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 14,
            height: 14,
            borderRadius: '50%',
            border: 'none',
            background: 'transparent',
            color: 'var(--md-on-surface-variant)',
            cursor: 'pointer',
            fontSize: 10,
            lineHeight: 1,
            padding: 0,
          }}
        >
          x
        </button>
      )}
    </span>
  );
}
