import { useRef, useCallback } from 'react';
import { useWorkspaceStore } from '../../stores/workspaceStore';

export default function SplitDivider() {
  const splitRatio = useWorkspaceStore(s => s.splitRatio);
  const setSplitRatio = useWorkspaceStore(s => s.setSplitRatio);
  const dragRef = useRef({ dragging: false, startX: 0, startRatio: 0 });

  const handleDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    dragRef.current = { dragging: true, startX: e.clientX, startRatio: splitRatio };
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
        width: 1,
        cursor: 'col-resize',
        flexShrink: 0,
        position: 'relative',
        zIndex: 11,
      }}
    />
  );
}
