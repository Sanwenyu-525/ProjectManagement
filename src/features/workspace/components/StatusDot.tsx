import { memo } from 'react';

interface StatusDotProps {
  status: 'running' | 'idle' | 'ended' | 'error' | 'none';
}

const TOOLTIPS: Record<StatusDotProps['status'], string> = {
  running: '运行中',
  idle: '空闲',
  ended: '已完成',
  error: '出错',
  none: '无会话',
};

const COLORS: Record<StatusDotProps['status'], string> = {
  running: 'var(--md-tertiary-container)',
  idle: 'var(--md-primary)',
  ended: 'var(--md-outline)',
  error: 'var(--color-error, #ef4444)',
  none: 'var(--md-outline-variant)',
};

const StatusDot = memo(function StatusDot({ status }: StatusDotProps) {
  return (
    <span style={{
      display: 'flex', height: 8, width: 8, flexShrink: 0,
      position: status === 'running' ? 'relative' : undefined,
    }}>
      {status === 'running' && (
        <span style={{
          position: 'absolute', inset: 0,
          borderRadius: '50%', background: COLORS.running,
          opacity: 0.6, animation: 'pulse 2s ease-in-out infinite',
        }} />
      )}
      <span style={{
        position: status === 'running' ? 'relative' : undefined,
        display: 'inline-flex', borderRadius: '50%',
        height: 8, width: 8, background: COLORS[status],
        flexShrink: 0,
      }} title={TOOLTIPS[status]} />
    </span>
  );
});

export default StatusDot;
