interface StatusDotProps {
  status: 'running' | 'ended' | 'none';
}

export default function StatusDot({ status }: StatusDotProps) {
  if (status === 'running') {
    return (
      <span style={{ display: 'flex', height: 8, width: 8, position: 'relative' }}>
        <span style={{
          position: 'absolute', display: 'inline-flex', height: '100%', width: '100%',
          borderRadius: '50%', background: 'var(--md-tertiary-container)',
          opacity: 0.75, animation: 'ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite',
        }} />
        <span style={{
          position: 'relative', display: 'inline-flex', borderRadius: '50%',
          height: 8, width: 8, background: 'var(--md-tertiary-container)',
        }} />
      </span>
    );
  }
  return (
    <div style={{
      width: 8, height: 8, borderRadius: '50%',
      background: status === 'ended' ? 'var(--md-outline)' : 'var(--md-outline-variant)',
    }} title={status === 'ended' ? 'Ended' : 'No session'} />
  );
}
