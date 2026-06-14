import { useState, useEffect, useRef } from 'react';
import { ReloadOutlined, PlusOutlined, CheckOutlined, CloseOutlined, QuestionCircleOutlined } from '@ant-design/icons';
import { Popover } from 'antd';
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

function WorkspaceTag({ workspace, isActive, color, onSelect, onDelete, onRename }: {
  workspace: Workspace;
  isActive: boolean;
  color: string;
  onSelect: () => void;
  onDelete: () => void;
  onRename: (name: string) => void;
}) {
  const [hovered, setHovered] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const startEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditing(true);
    setEditValue(workspace.name);
    setTimeout(() => inputRef.current?.select(), 0);
  };

  const commitEdit = () => {
    const trimmed = editValue.trim();
    if (trimmed && trimmed !== workspace.name) onRename(trimmed);
    setEditing(false);
  };

  return (
    <button
      onClick={editing ? undefined : onSelect}
      onDoubleClick={startEdit}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        ...styles.tag,
        ...(isActive ? styles.tagActive : {}),
        borderColor: isActive ? 'transparent' : 'var(--ws-border)',
        borderBottomColor: isActive ? color : 'transparent',
        background: isActive ? `${color}18` : 'transparent',
        color: isActive ? `${color}dd` : 'var(--ws-text-secondary)',
      }}
    >
      <span style={{ ...styles.tagDot, background: color }} />
      {editing ? (
        <input
          ref={inputRef}
          autoFocus
          value={editValue}
          onChange={e => setEditValue(e.target.value)}
          onBlur={commitEdit}
          onKeyDown={e => {
            if (e.key === 'Enter') commitEdit();
            if (e.key === 'Escape') setEditing(false);
          }}
          onClick={e => e.stopPropagation()}
          style={{
            background: 'transparent',
            border: '1px solid #007acc',
            color: 'inherit',
            padding: '0 4px',
            fontSize: 11,
            width: 80,
            outline: 'none',
            borderRadius: 2,
          }}
        />
      ) : (
        workspace.name
      )}
      {isActive && !editing && <CheckOutlined style={styles.tagCheck} />}
      {hovered && !editing && (
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

  const handleRename = async (ws: Workspace, newName: string) => {
    try {
      await workspacesApi.update(ws.id, { name: newName });
      setWorkspaces(prev => prev.map(w => w.id === ws.id ? { ...w, name: newName } : w));
      if (activeWs?.id === ws.id) {
        setActiveWs(prev => prev ? { ...prev, name: newName } : null);
      }
    } catch (e) {
      console.error('Failed to rename workspace:', e);
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
            borderColor: activeWs === null ? 'transparent' : 'var(--ws-border)',
            borderBottomColor: activeWs === null ? '#6366f1' : 'transparent',
            background: activeWs === null ? 'rgba(99, 102, 241, 0.12)' : 'transparent',
            color: activeWs === null ? '#6366f1' : 'var(--ws-text-secondary)',
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
              onRename={(name) => handleRename(ws, name)}
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
        <Popover
          content={
            <div style={{ fontSize: 12, lineHeight: 2, whiteSpace: 'nowrap' }}>
              <div style={{ fontWeight: 600, marginBottom: 4 }}>快捷键</div>
              <div><kbd style={kbdStyle}>Ctrl+1~9</kbd> 切换面板</div>
              <div><kbd style={kbdStyle}>Ctrl+方向键</kbd> 分屏</div>
              <div><kbd style={kbdStyle}>Ctrl+Shift+C</kbd> 新建终端</div>
              <div><kbd style={kbdStyle}>Ctrl+Shift+A</kbd> 新建 Agent</div>
              <div><kbd style={kbdStyle}>Ctrl+Shift+B</kbd> 新建浏览器</div>
              <div><kbd style={kbdStyle}>Ctrl+Shift+W</kbd> 关闭面板</div>
              <div style={{ marginTop: 6, color: 'var(--ws-text-tertiary)', fontSize: 11 }}>双击终端名 / 工作区标签可重命名</div>
              <div style={{ color: 'var(--ws-text-tertiary)', fontSize: 11 }}>右键 + 按钮可复制当前终端路径</div>
            </div>
          }
          trigger="click"
          placement="bottomRight"
        >
          <button style={styles.toolBtn} title="快捷键帮助">
            <QuestionCircleOutlined style={{ fontSize: 11 }} />
          </button>
        </Popover>
      </div>
    </div>
  );
}

const kbdStyle: React.CSSProperties = {
  display: 'inline-block',
  padding: '1px 5px',
  fontSize: 11,
  fontFamily: "'Fira Code', monospace",
  background: 'var(--ws-badge-bg)',
  borderRadius: 3,
  border: '1px solid var(--ws-border)',
  marginRight: 6,
};

const styles: Record<string, React.CSSProperties> = {
  toolbar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 38,
    padding: '0 14px',
    background: 'var(--ws-toolbar-bg)',
    backdropFilter: 'var(--ws-glass-blur)',
    WebkitBackdropFilter: 'var(--ws-glass-blur)',
    borderBottom: '1px solid var(--ws-border)',
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
    padding: '4px 12px',
    borderRadius: 6,
    border: '1px solid transparent',
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
    borderBottom: '2px solid currentColor',
    paddingBottom: 3,
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
    border: '1px dashed var(--ws-border)',
    background: 'transparent',
    color: 'var(--ws-text-secondary)',
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
    border: '1px solid var(--ws-border)',
    background: 'var(--ws-content-bg)',
    color: 'var(--ws-text)',
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
    color: 'var(--ws-text-secondary)',
    cursor: 'pointer',
    padding: 0,
  },
};
