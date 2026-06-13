import { useRef, useState, useCallback } from 'react';

interface Props {
  direction: 'horizontal' | 'vertical';
  onDrag: (delta: number) => void;
  style?: React.CSSProperties;
}

export default function PaneDivider({ direction, onDrag, style }: Props) {
  const [isDragging, setIsDragging] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const dragRef = useRef({ startX: 0, startY: 0 });

  const isHorizontal = direction === 'horizontal';

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragRef.current = { startX: e.clientX, startY: e.clientY };
    setIsDragging(true);
    document.body.style.cursor = isHorizontal ? 'col-resize' : 'row-resize';
    document.body.style.userSelect = 'none';

    const handleMouseMove = (ev: MouseEvent) => {
      const delta = isHorizontal
        ? ev.clientX - dragRef.current.startX
        : ev.clientY - dragRef.current.startY;
      onDrag(delta);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
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
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        flexShrink: 0,
        position: 'relative',
        zIndex: 11,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        ...(isHorizontal
          ? { width: 6, cursor: 'col-resize' }
          : { height: 6, cursor: 'row-resize' }),
        ...style,
      }}
    >
      {/* Visible line */}
      <div style={{
        ...(isHorizontal
          ? { width: 3, height: '40%', minHeight: 24, maxHeight: 80 }
          : { height: 3, width: '40%', minWidth: 24, maxWidth: 80 }),
        borderRadius: 2,
        background: isDragging
          ? 'rgba(255, 255, 255, 0.5)'
          : isHovered
            ? 'rgba(255, 255, 255, 0.35)'
            : 'rgba(255, 255, 255, 0.15)',
        transition: isDragging ? 'none' : 'background 0.15s',
      }} />
    </div>
  );
}
