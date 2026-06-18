import React from 'react';

interface ToggleSwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  label?: string;
}

const styles = {
  wrapper: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    cursor: 'pointer',
  } as React.CSSProperties,
  track: {
    position: 'relative',
    width: 44,
    height: 24,
    borderRadius: 12,
    border: '2px solid transparent',
    transition: 'all 0.2s ease',
    flexShrink: 0,
  } as React.CSSProperties,
  thumb: {
    position: 'absolute',
    top: 2,
    width: 18,
    height: 18,
    borderRadius: '50%',
    transition: 'all 0.2s ease',
    boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
  } as React.CSSProperties,
  label: {
    fontSize: 14,
    color: 'var(--md-on-surface)',
    userSelect: 'none',
  } as React.CSSProperties,
  disabled: {
    opacity: 0.5,
    cursor: 'not-allowed',
  } as React.CSSProperties,
};

export function ToggleSwitch({ checked, onChange, disabled, label }: ToggleSwitchProps) {
  return (
    <label style={{ ...styles.wrapper, ...(disabled ? styles.disabled : {}) }}>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        disabled={disabled}
        style={{ position: 'absolute', opacity: 0, width: 0, height: 0, pointerEvents: 'none' }}
      />
      <span style={{
        ...styles.track,
        background: checked ? 'var(--md-primary)' : 'var(--md-surface-container-highest)',
        borderColor: checked ? 'var(--md-primary)' : 'var(--md-outline-variant)',
      }}>
        <span style={{
          ...styles.thumb,
          left: checked ? 22 : 2,
          background: checked ? 'var(--md-on-primary)' : 'var(--md-on-surface-variant)',
        }} />
      </span>
      {label && <span style={styles.label}>{label}</span>}
    </label>
  );
}
