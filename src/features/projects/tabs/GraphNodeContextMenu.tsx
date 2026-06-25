import { useCallback, useEffect, useRef, useState } from 'react';
import { FolderOpenOutlined, RobotOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { getThemeColors } from '../../../lib/themeColors';
import { useWorkspaceStore } from '../../../stores/workspaceStore';
import type { Project } from '../../../types';

interface GraphNodeContextMenuProps {
  filePath: string;
  project: Project | undefined;
  x: number;
  y: number;
  onClose: () => void;
}

export default function GraphNodeContextMenu({ filePath, project, x, y, onClose }: GraphNodeContextMenuProps) {
  const tc = getThemeColors();
  const navigate = useNavigate();
  const requestOpenFile = useWorkspaceStore(s => s.requestOpenFile);
  const setPendingAgentMsg = useWorkspaceStore(s => s.setPendingAgentMessage);
  const menuRef = useRef<HTMLDivElement>(null);
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  // Close on click outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  const fullPath = project?.localPath ? `${project.localPath}/${filePath}` : filePath;

  const handleOpenFile = useCallback(() => {
    requestOpenFile(fullPath);
    navigate('/');
    onClose();
  }, [fullPath, requestOpenFile, navigate, onClose]);

  const handleSendToAgent = useCallback(() => {
    const msg = `分析这个文件的代码，给出架构分析和改进建议：${filePath}`;
    setPendingAgentMsg(msg);
    navigate('/');
    onClose();
  }, [filePath, setPendingAgentMsg, navigate, onClose]);

  const menuItems = [
    { icon: <FolderOpenOutlined />, label: '在编辑器中打开', onClick: handleOpenFile },
    { icon: <RobotOutlined />, label: '交给 Agent 分析', onClick: handleSendToAgent },
  ];

  // Adjust position to stay within viewport
  const adjustedX = Math.min(x, window.innerWidth - 200);
  const adjustedY = Math.min(y, window.innerHeight - 120);

  return (
    <div
      ref={menuRef}
      style={{
        position: 'fixed',
        left: adjustedX,
        top: adjustedY,
        zIndex: 10000,
        background: tc.bgElevated,
        border: `1px solid ${tc.border}`,
        borderRadius: 8,
        boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
        padding: '4px 0',
        minWidth: 180,
      }}
    >
      {/* File path header */}
      <div style={{
        padding: '6px 12px',
        fontSize: 11,
        color: tc.textSecondary,
        borderBottom: `1px solid ${tc.border}`,
        fontFamily: "'Fira Code', monospace",
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        maxWidth: 240,
      }}>
        {filePath}
      </div>

      {/* Menu items */}
      {menuItems.map((item, idx) => (
        <div
          key={idx}
          onClick={item.onClick}
          onMouseEnter={() => setHoveredIdx(idx)}
          onMouseLeave={() => setHoveredIdx(null)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '8px 12px',
            cursor: 'pointer',
            fontSize: 13,
            color: tc.text,
            background: hoveredIdx === idx ? (tc.primaryBg || 'rgba(0,0,0,0.04)') : 'transparent',
            transition: 'background 0.15s',
          }}
        >
          <span style={{ fontSize: 14, color: tc.textSecondary }}>{item.icon}</span>
          {item.label}
        </div>
      ))}
    </div>
  );
}
