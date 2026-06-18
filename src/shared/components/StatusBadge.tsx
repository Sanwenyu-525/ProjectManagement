interface StatusBadgeProps {
  status: string;
  variant?: 'pill' | 'dot';
}

const STATUS_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  Idea: { bg: 'rgba(140, 140, 140, 0.12)', text: 'var(--md-outline)', border: 'rgba(140, 140, 140, 0.24)' },
  Planning: { bg: 'rgba(24, 144, 255, 0.12)', text: 'var(--color-info)', border: 'rgba(24, 144, 255, 0.24)' },
  Active: { bg: 'rgba(0, 107, 95, 0.12)', text: 'var(--md-primary)', border: 'rgba(0, 107, 95, 0.24)' },
  Completed: { bg: 'rgba(0, 108, 73, 0.12)', text: 'var(--md-tertiary)', border: 'rgba(0, 108, 73, 0.24)' },
  Archived: { bg: 'var(--md-surface-container-high)', text: 'var(--md-on-surface-variant)', border: 'var(--md-outline-variant)' },
};

const styles = {
  pill: {
    display: 'inline-block',
    padding: '2px 8px',
    borderRadius: 4,
    fontSize: 10,
    fontFamily: 'var(--font-mono)',
    fontWeight: 500,
    letterSpacing: '0.03em',
    textTransform: 'uppercase' as const,
  },
  dot: {
    display: 'inline-block',
    width: 8,
    height: 8,
    borderRadius: '50%',
  },
};

export function StatusBadge({ status, variant = 'pill' }: StatusBadgeProps) {
  const c = STATUS_COLORS[status] || STATUS_COLORS.Active;

  if (variant === 'dot') {
    return (
      <span
        style={{ ...styles.dot, background: c.text }}
        title={status}
      />
    );
  }

  return (
    <span style={{
      ...styles.pill,
      background: c.bg,
      color: c.text,
      border: `1px solid ${c.border}`,
    }}>
      {status}
    </span>
  );
}
