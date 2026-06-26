export function DragHandle({ isDragging, onMouseDown }: {
  isDragging: boolean;
  onMouseDown: (e: React.MouseEvent) => void;
}) {
  return (
    <div
      onMouseDown={onMouseDown}
      style={{
        width: 6, flexShrink: 0, cursor: 'col-resize',
        background: isDragging ? 'var(--md-primary)' : 'transparent',
        transition: 'background 0.15s',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
      onMouseEnter={(e) => { if (!isDragging) e.currentTarget.style.background = 'rgba(0, 107, 95, 0.15)'; }}
      onMouseLeave={(e) => { if (!isDragging) e.currentTarget.style.background = 'transparent'; }}
    >
      <div style={{
        width: 2, height: 20, borderRadius: 1,
        background: isDragging ? 'var(--md-primary)' : 'var(--md-outline)',
        opacity: isDragging ? 0.8 : 0.3,
        transition: 'opacity 0.15s',
      }} />
    </div>
  );
}
