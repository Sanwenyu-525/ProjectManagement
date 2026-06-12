import { useRef, useCallback, useState } from 'react';
import { useTerminalStore } from '../../stores/terminalStore';

export default function SplitDivider() {
  const splitRatio = useTerminalStore(s => s.splitRatio);
  const setSplitRatio = useTerminalStore(s => s.setSplitRatio);
  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef({ dragging: false, startX: 0, startRatio: 0 });

  const handleDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    dragRef.current = { dragging: true, startX: e.clientX, startRatio: splitRatio };
    setIsDragging(true);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    const handleDragMove = (ev: MouseEvent) => {
      if (!dragRef.current.dragging) return;
      const container = (e.target as HTMLElement).closest('[data-split-container]') as HTMLElement;
      if (!container) return;
      const containerWidth = container.getBoundingClientRect().width;
      const delta = ev.clientX - dragRef.current.startX;
      const newRatio = dragRef.current.startRatio + delta / containerWidth;
      setSplitRatio(newRatio);
    };

    const handleDragEnd = () => {
      dragRef.current.dragging = false;
      setIsDragging(false);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      document.removeEventListener('mousemove', handleDragMove);
      document.removeEventListener('mouseup', handleDragEnd);
    };

    document.addEventListener('mousemove', handleDragMove);
    document.addEventListener('mouseup', handleDragEnd);
  }, [splitRatio, setSplitRatio]);

  return (
    <div
      onMouseDown={handleDragStart}
      style={{
        width: 6,
        cursor: 'col-resize',
        background: 'transparent',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        position: 'relative',
        zIndex: 11,
      }}
    >
      <div
        style={{
          width: 3,
          height: 40,
          borderRadius: 2,
          background: isDragging ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.15)',
          transition: isDragging ? 'none' : 'background 0.15s',
        }}
        onMouseEnter={e => {
          if (!isDragging) e.currentTarget.style.background = 'rgba(255,255,255,0.35)';
        }}
        onMouseLeave={e => {
          if (!isDragging) e.currentTarget.style.background = 'rgba(255,255,255,0.15)';
        }}
      />
    </div>
  );
}
