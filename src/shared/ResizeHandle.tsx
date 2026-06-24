import { useState, useCallback, type ReactNode } from 'react';

type Orientation = 'horizontal' | 'vertical';

interface ResizeHandleProps {
  orientation: Orientation;
  onResizeStart: (e: React.MouseEvent) => void;
  /** Custom indicator element. If omitted, renders a default 4px bar. */
  indicator?: ReactNode;
  /** Optional: render prop to expose drag state to children. */
  children?: (isDragging: boolean) => ReactNode;
  style?: React.CSSProperties;
}

/**
 * Unified resize handle with built-in drag cursor management.
 *
 * - horizontal: vertical bar (col-resize), default width 4px
 * - vertical: horizontal bar (row-resize), default height 4px
 */
export default function ResizeHandle({
  orientation,
  onResizeStart,
  indicator,
  children,
  style,
}: ResizeHandleProps) {
  const [isDragging, setIsDragging] = useState(false);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    document.body.style.cursor = orientation === 'horizontal' ? 'col-resize' : 'row-resize';
    document.body.style.userSelect = 'none';

    const onMouseUp = () => {
      setIsDragging(false);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      document.removeEventListener('mouseup', onMouseUp);
    };
    document.addEventListener('mouseup', onMouseUp);

    onResizeStart(e);
  }, [onResizeStart, orientation]);

  const isHorizontal = orientation === 'horizontal';

  const defaultIndicator = (
    <div
      style={{
        position: 'absolute',
        ...(isHorizontal
          ? { top: 0, bottom: 0, left: '50%', width: 4, transform: 'translateX(-50%)' }
          : { left: 0, right: 0, top: '50%', height: 4, transform: 'translateY(-50%)' }),
        borderRadius: 2,
        background: isDragging
          ? 'var(--md-primary-container, rgba(0,0,0,0.06))'
          : 'transparent',
        transition: isDragging ? 'none' : 'background 0.15s',
      }}
    />
  );

  const containerStyle: React.CSSProperties = {
    position: 'absolute',
    cursor: isHorizontal ? 'col-resize' : 'row-resize',
    zIndex: 10,
    ...(isHorizontal
      ? { top: 0, bottom: 0, left: 0, width: 4 }
      : { left: 0, right: 0, top: 0, height: 4 }),
    ...style,
  };

  return (
    <div style={containerStyle} onMouseDown={handleMouseDown}>
      {indicator ?? defaultIndicator}
      {children?.(isDragging)}
    </div>
  );
}
