import { useState, useRef, useCallback } from 'react';

interface Props {
  direction: 'horizontal' | 'vertical';
  onDrag: (delta: number) => void;
  style?: React.CSSProperties;
}

export default function PaneDivider({ direction, onDrag, style }: Props) {
  const [hovered, setHovered] = useState(false);
  const dragRef = useRef({ startX: 0, startY: 0 });

  const isHorizontal = direction === 'horizontal';

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragRef.current = { startX: e.clientX, startY: e.clientY };
    document.body.style.cursor = isHorizontal ? 'col-resize' : 'row-resize';
    document.body.style.userSelect = 'none';

    const handleMouseMove = (ev: MouseEvent) => {
      const delta = isHorizontal
        ? ev.clientX - dragRef.current.startX
        : ev.clientY - dragRef.current.startY;
      onDrag(delta);
    };

    const handleMouseUp = () => {
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [isHorizontal, onDrag]);

  return (
    <div
      onMouseDown={handleMouseDown}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      role="separator"
      aria-orientation={isHorizontal ? 'vertical' : 'horizontal'}
      style={{
        flexShrink: 0,
        position: 'relative',
        zIndex: 11,
        cursor: isHorizontal ? 'col-resize' : 'row-resize',
        transition: 'background 0.15s, flex-basis 0.15s',
        ...(isHorizontal
          ? { width: hovered ? 3 : 1, marginLeft: hovered ? -1 : 0 }
          : { height: hovered ? 3 : 1, marginTop: hovered ? -1 : 0 }),
        background: hovered
          ? 'var(--ws-active-border, rgba(99,102,241,0.4))'
          : 'var(--ws-border-subtle, rgba(0,0,0,0.06))',
        ...style,
      }}
    />
  );
}
