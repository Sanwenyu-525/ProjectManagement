import { useState, useEffect, useRef } from 'react';
import { ReloadOutlined, PlusOutlined, CheckOutlined, CloseOutlined } from '@ant-design/icons';
import { useWorkspaceStore } from '../../stores/workspaceStore';
import { workspacesApi } from '../../api';

interface Workspace {
  id: string;
  name: string;
  description?: string;
  color?: string;
  projectCount?: number;
}

// ── Workspace tag with hover delete ──

function WorkspaceTag({ workspace, isActive, color, onSelect, onDelete }: {
  workspace: Workspace;
  isActive: boolean;
  color: string;
  onSelect: () => void;
  onDelete: () => void;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <button
      onClick={onSelect}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        ...styles.tag,
        ...(isActive ? styles.tagActive : {}),
        borderColor: isActive ? color : 'rgba(255, 255, 255, 0.1)',
        background: isActive ? `${color}22` : 'transparent',
        color: isActive ? `${color}cc` : '#94a3b8',
      }}
    >
      <span style={{ ...styles.tagDot, background: color }} />
      {workspace.name}
      {isActive && <CheckOutlined style={styles.tagCheck} />}
      {hovered && (
        <span
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          style={styles.tagDelete}
          title="删除工作区"
        >
          <CloseOutlined style={{ fontSize: 7 }} />
        </span>
      )}
    </button>
  );
}

export default function WorkspaceToolbar() {
  const resetLayout = useWorkspaceStore(s => s.resetLayout);
  const setActiveWorkspace = useWorkspaceStore(s => s.setActiveWorkspace);
  const loadWorkspaceLayout = useWorkspaceStore(s => s.loadWorkspaceLayout);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [activeWs, setActiveWs] = useState<Workspace | null>(null);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // Load workspaces
  useEffect(() => {
    workspacesApi.list().then((data: unknown) => {
      const list = Array.isArray(data) ? data : [];
      setWorkspaces(list);
      const lastId = localStorage.getItem('devhub_active_workspace');
      if (lastId) {
        const found = list.find((w: Workspace) => w.id === lastId);
        if (found) setActiveWs(found);
      }
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (creating) inputRef.current?.focus();
  }, [creating]);

  const handleSelect = (ws: Workspace | null) => {
    setActiveWs(ws);
    setCreating(false);
    if (ws) {
      setActiveWorkspace(ws.id);
      loadWorkspaceLayout(ws.id);
    } else {
      setActiveWorkspace(null);
      resetLayout();
    }
  };

  const handleCreate = async () => {
    if (!newName.trim()) return;
    try {
      const created = await workspacesApi.create({ name: newName.trim() }) as Workspace;
      setWorkspaces(prev => [...prev, created]);
      handleSelect(created);
      setNewName('');
      setCreating(false);
    } catch (e) {
      console.error('Failed to create workspace:', e);
    }
  };

  const handleDelete = async (ws: Workspace) => {
    // Check if workspace has active items
    try {
      const layoutJson = await workspacesApi.loadLayout(ws.id);
      if (layoutJson) {
        const layout = JSON.parse(layoutJson) as { tabs: Record<string, { contentType?: string }> };
        const tabs = Object.values(layout.tabs || {});
        const terminals = tabs.filter(t => t.contentType === 'terminal').length;
        const agents = tabs.filter(t => t.contentType === 'agent').length;
        const browsers = tabs.filter(t => t.contentType === 'browser').length;
        const parts: string[] = [];
        if (terminals) parts.push(`${terminals} 个终端`);
        if (agents) parts.push(`${agents} 个智能体`);
        if (browsers) parts.push(`${browsers} 个浏览器`);
        if (parts.length > 0) {
          if (!confirm(`工作区「${ws.name}」有 ${parts.join('、')}，确定删除？`)) return;
        }
      }
    } catch {
      // If we can't check, still allow delete with generic confirm
      if (!confirm(`确定删除工作区「${ws.name}」？`)) return;
    }

    try {
      await workspacesApi.delete(ws.id);
      setWorkspaces(prev => prev.filter(w => w.id !== ws.id));
      if (activeWs?.id === ws.id) {
        handleSelect(null);
      }
    } catch (e) {
      console.error('Failed to delete workspace:', e);
    }
  };

  return (
    <div style={styles.toolbar}>
      {/* Workspace tags */}
      <div style={styles.tagsRow}>
        {/* Default workspace tag */}
        <button
          onClick={() => handleSelect(null)}
          style={{
            ...styles.tag,
            ...(activeWs === null ? styles.tagActive : {}),
            borderColor: activeWs === null ? '#6366f1' : 'rgba(255, 255, 255, 0.1)',
            background: activeWs === null ? 'rgba(99, 102, 241, 0.15)' : 'transparent',
            color: activeWs === null ? '#a5b4fc' : '#94a3b8',
          }}
        >
          <span style={{ ...styles.tagDot, background: '#6366f1' }} />
          默认
          {activeWs === null && <CheckOutlined style={styles.tagCheck} />}
        </button>

        {/* Workspace tags */}
        {workspaces.map(ws => {
          const isActive = activeWs?.id === ws.id;
          const color = ws.color || '#6366f1';
          return (
            <WorkspaceTag
              key={ws.id}
              workspace={ws}
              isActive={isActive}
              color={color}
              onSelect={() => handleSelect(ws)}
              onDelete={() => handleDelete(ws)}
            />
          );
        })}

        {/* Add / Create */}
        {creating ? (
          <div style={styles.createInline}>
            <input
              ref={inputRef}
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') handleCreate();
                if (e.key === 'Escape') { setCreating(false); setNewName(''); }
              }}
              onBlur={() => { if (!newName.trim()) { setCreating(false); } }}
              placeholder="工作区名称"
              style={styles.createInput}
            />
            <button onClick={handleCreate} style={styles.createConfirmBtn}>
              <CheckOutlined style={{ fontSize: 9 }} />
            </button>
          </div>
        ) : (
          <button
            onClick={() => setCreating(true)}
            style={styles.addTag}
            title="新建工作区"
          >
            <PlusOutlined style={{ fontSize: 9 }} />
          </button>
        )}
      </div>

      {/* Right: actions */}
      <div style={styles.actions}>
        <button onClick={resetLayout} style={styles.toolBtn} title="重置布局">
          <ReloadOutlined style={{ fontSize: 11 }} />
        </button>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  toolbar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 36,
    padding: '0 12px',
    background: 'rgba(255, 255, 255, 0.03)',
    borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
    flexShrink: 0,
    gap: 8,
  },
  tagsRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    overflow: 'auto',
    flex: 1,
    minHeight: 0,
  },
  tag: {
    display: 'flex',
    alignItems: 'center',
    gap: 5,
    padding: '3px 10px',
    borderRadius: 12,
    border: '1px solid',
    background: 'transparent',
    cursor: 'pointer',
    fontSize: 11,
    fontFamily: "'Fira Sans', sans-serif",
    fontWeight: 500,
    whiteSpace: 'nowrap',
    flexShrink: 0,
    transition: 'all 0.15s',
    lineHeight: '16px',
  },
  tagActive: {
    fontWeight: 600,
  },
  tagDot: {
    width: 6,
    height: 6,
    borderRadius: '50%',
    flexShrink: 0,
  },
  tagCheck: {
    fontSize: 8,
    marginLeft: 2,
  },
  tagDelete: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 14,
    height: 14,
    borderRadius: 7,
    background: 'rgba(239, 68, 68, 0.2)',
    color: '#ef4444',
    marginLeft: 2,
    cursor: 'pointer',
    flexShrink: 0,
  },
  addTag: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 22,
    height: 22,
    borderRadius: 11,
    border: '1px dashed rgba(255, 255, 255, 0.15)',
    background: 'transparent',
    color: '#64748b',
    cursor: 'pointer',
    padding: 0,
    flexShrink: 0,
    transition: 'all 0.15s',
  },
  createInline: {
    display: 'flex',
    alignItems: 'center',
    gap: 3,
    flexShrink: 0,
  },
  createInput: {
    width: 100,
    padding: '3px 8px',
    borderRadius: 10,
    border: '1px solid rgba(255, 255, 255, 0.15)',
    background: 'rgba(255, 255, 255, 0.05)',
    color: '#e2e8f0',
    fontSize: 11,
    outline: 'none',
    fontFamily: "'Fira Sans', sans-serif",
  },
  createConfirmBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 20,
    height: 20,
    borderRadius: 10,
    border: 'none',
    background: 'rgba(34, 197, 94, 0.15)',
    color: '#22c55e',
    cursor: 'pointer',
    padding: 0,
  },
  actions: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    flexShrink: 0,
  },
  toolBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 24,
    height: 24,
    borderRadius: 4,
    border: 'none',
    background: 'transparent',
    color: '#64748b',
    cursor: 'pointer',
    padding: 0,
  },
};
