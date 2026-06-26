import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useAgentTasks, useCreateAgentTask, useUpdateAgentTask, useDeleteAgentTask, groupAgentTasks } from '../../../hooks/useAgentTasks';
import { message } from 'antd';
import type { AgentTask } from '../../../types';

/** Well-known session id shared across all agent tabs; row inserted by migration 023. */
const GLOBAL_PLAN_SESSION_ID = '__global_plan__';

const PRIORITY_BADGES: Record<string, { label: string; color: string; bg: string }> = {
  high: { label: 'High', color: 'var(--color-error)', bg: 'var(--color-error-light)' },
  medium: { label: 'Medium', color: 'var(--color-amber)', bg: 'var(--color-amber-light)' },
  low: { label: 'Low', color: 'var(--color-tertiary)', bg: 'var(--color-tertiary-light)' },
};

const STATUS_CONFIG: Record<string, { icon: string; color: string; label: string }> = {
  pending: { icon: 'radio_button_unchecked', color: 'var(--md-outline)', label: 'Pending' },
  running: { icon: 'progress_activity', color: 'var(--md-primary)', label: 'Running' },
  in_progress: { icon: 'progress_activity', color: 'var(--md-primary)', label: 'In Progress' },
  completed: { icon: 'check_circle', color: 'var(--md-tertiary)', label: 'Completed' },
};

function nextStatus(s: AgentTask['status']): AgentTask['status'] {
  if (s === 'pending') return 'in_progress';
  if (s === 'in_progress') return 'completed';
  return 'pending';
}

export default function AgentPlanPanel() {
  const { data: tasks = [] } = useAgentTasks(GLOBAL_PLAN_SESSION_ID);
  const createTask = useCreateAgentTask();
  const updateTask = useUpdateAgentTask();
  const deleteTask = useDeleteAgentTask();

  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [addingToGroup, setAddingToGroup] = useState<string | null>(null);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [showNewGroup, setShowNewGroup] = useState(false);
  const [newGroupTitle, setNewGroupTitle] = useState('');
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [hoveredChild, setHoveredChild] = useState<string | null>(null);
  const [hoveredGroup, setHoveredGroup] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { groups, childrenOf } = useMemo(() => groupAgentTasks(tasks), [tasks]);

  // Focus input when adding
  useEffect(() => {
    if (addingToGroup || showNewGroup || editingGroupId) {
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [addingToGroup, showNewGroup, editingGroupId]);

  // Compute overall progress
  const totalTasks = tasks.filter(t => t.parentId !== null).length;
  const completedTasks = tasks.filter(t => t.parentId !== null && t.status === 'completed').length;
  const progressPercent = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  // Find the "current" task (first in_progress task)
  const currentTask = tasks.find(t => t.status === 'in_progress' && t.parentId !== null);

  const toggleGroup = useCallback((groupId: string) => {
    setCollapsedGroups(prev => {
      const next = new Set(prev);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
  }, []);

  const handleAddTask = useCallback(async (parentId: string) => {
    if (!newTaskTitle.trim()) return;
    try {
      await createTask.mutateAsync({
        sessionId: GLOBAL_PLAN_SESSION_ID,
        data: { title: newTaskTitle.trim(), parentId },
      });
      setNewTaskTitle('');
      setAddingToGroup(null);
    } catch {
      message.error('添加子任务失败');
    }
  }, [newTaskTitle, createTask]);

  const handleAddGroup = useCallback(async () => {
    if (!newGroupTitle.trim()) return;
    try {
      await createTask.mutateAsync({
        sessionId: GLOBAL_PLAN_SESSION_ID,
        data: { title: newGroupTitle.trim(), sortOrder: groups.length },
      });
      setNewGroupTitle('');
      setShowNewGroup(false);
    } catch {
      message.error('添加分组失败');
    }
  }, [newGroupTitle, createTask, groups.length]);

  const handleToggleStatus = useCallback(async (task: AgentTask) => {
    try {
      await updateTask.mutateAsync({
        sessionId: GLOBAL_PLAN_SESSION_ID,
        id: task.id,
        data: { status: nextStatus(task.status) },
      });
    } catch {
      message.error('更新状态失败');
    }
  }, [updateTask]);

  const handleDelete = useCallback(async (taskId: string) => {
    try {
      await deleteTask.mutateAsync({ sessionId: GLOBAL_PLAN_SESSION_ID, id: taskId });
    } catch {
      message.error('删除失败');
    }
  }, [deleteTask]);

  const handleRenameGroup = useCallback(async (group: AgentTask) => {
    if (!editingTitle.trim()) {
      setEditingGroupId(null);
      return;
    }
    if (editingTitle.trim() !== group.title) {
      try {
        await updateTask.mutateAsync({
          sessionId: GLOBAL_PLAN_SESSION_ID,
          id: group.id,
          data: { title: editingTitle.trim() },
        });
      } catch {
        message.error('重命名失败');
      }
    }
    setEditingGroupId(null);
  }, [editingTitle, updateTask]);

  const handleCopyTitle = useCallback(async (title: string) => {
    try {
      await navigator.clipboard.writeText(title);
      message.success('已复制');
    } catch {
      message.error('复制失败');
    }
  }, []);

  const handleRunInTerminal = useCallback((title: string) => {
    window.dispatchEvent(new CustomEvent('agentQuickCommand', { detail: title }));
    message.success('已发送到 Agent');
  }, []);

  return (
    <div style={styles.container}>
      {/* Current Task Card */}
      {currentTask && (
        <div style={styles.currentTaskCard}>
          <div style={styles.currentTaskHeader}>
            <h3 style={styles.currentTaskTitle}>Current Task</h3>
          </div>
          <p style={styles.currentTaskName}>{currentTask.title}</p>
          <div style={styles.badgeRow}>
            <span style={{
              ...styles.badge,
              background: PRIORITY_BADGES[currentTask.priority]?.bg ?? PRIORITY_BADGES.medium.bg,
              color: PRIORITY_BADGES[currentTask.priority]?.color ?? PRIORITY_BADGES.medium.color,
            }}>
              {PRIORITY_BADGES[currentTask.priority]?.label ?? 'Medium'}
            </span>
            <span style={{
              ...styles.badge,
              background: 'var(--md-primary-container)',
              color: 'var(--md-on-primary-container)',
            }}>
              {STATUS_CONFIG[currentTask.status]?.label ?? 'In Progress'}
            </span>
          </div>
          {/* Progress bar */}
          <div style={styles.progressContainer} role="progressbar" aria-valuenow={progressPercent} aria-valuemin={0} aria-valuemax={100} aria-label={`任务进度 ${progressPercent}%`}>
            <div style={styles.progressTrack}>
              <div style={{ ...styles.progressFill, width: `${progressPercent}%` }} />
            </div>
            <span style={styles.progressText}>{progressPercent}%</span>
          </div>
        </div>
      )}

      {/* Task Breakdown */}
      <div style={styles.breakdownHeader}>
        <h3 style={styles.breakdownTitle}>Task Breakdown</h3>
      </div>

      <div style={styles.groupList}>
        {groups.length === 0 && (
          <div style={styles.emptyGroups}>
            <p style={{ margin: 0, fontSize: 12, color: 'var(--md-on-surface-variant)', textAlign: 'center' }}>
              No task groups yet. Add one below.
            </p>
          </div>
        )}

        {groups.map(group => {
          const children = childrenOf(group.id);
          const doneCount = children.filter(c => c.status === 'completed').length;
          const isCollapsed = collapsedGroups.has(group.id);
          const allDone = children.length > 0 && doneCount === children.length;

          return (
            <div key={group.id} style={styles.group}>
              {/* Group header */}
              <div
                style={{
                  ...styles.groupHeader,
                  background: hoveredGroup === group.id ? 'var(--md-surface-container-low)' : 'transparent',
                }}
                onMouseEnter={() => setHoveredGroup(group.id)}
                onMouseLeave={() => setHoveredGroup(null)}
              >
                <span
                  className="material-symbols-outlined"
                  role="button"
                  aria-label={isCollapsed ? '展开分组' : '折叠分组'}
                  tabIndex={0}
                  onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleGroup(group.id); } }}
                  style={{
                    fontSize: 18,
                    color: allDone ? 'var(--md-tertiary)' : 'var(--md-primary)',
                    cursor: 'pointer',
                    transition: 'transform 0.2s',
                    transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)',
                    flexShrink: 0,
                    padding: 4,
                    borderRadius: 'var(--radius-xs)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                  onClick={() => toggleGroup(group.id)}
                >
                  expand_more
                </span>
                {editingGroupId === group.id ? (
                  <input
                    ref={inputRef}
                    value={editingTitle}
                    onChange={e => setEditingTitle(e.target.value)}
                    onBlur={() => handleRenameGroup(group)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') handleRenameGroup(group);
                      if (e.key === 'Escape') setEditingGroupId(null);
                    }}
                    style={styles.groupNameInput}
                    onClick={e => e.stopPropagation()}
                  />
                ) : (
                  <span
                    style={styles.groupName}
                    onClick={() => toggleGroup(group.id)}
                    onDoubleClick={e => {
                      e.stopPropagation();
                      setEditingGroupId(group.id);
                      setEditingTitle(group.title);
                    }}
                  >
                    {group.title}
                  </span>
                )}
                <span style={styles.groupCount}>{doneCount}/{children.length}</span>
                <button
                  style={{ ...styles.groupActionBtn, opacity: hoveredGroup === group.id ? 0.7 : 0.35 }}
                  onClick={e => {
                    e.stopPropagation();
                    setEditingGroupId(group.id);
                    setEditingTitle(group.title);
                  }}
                  aria-label="重命名分组"
                  title="Rename"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 14 }}>edit</span>
                </button>
                <button
                  style={{ ...styles.groupActionBtn, opacity: hoveredGroup === group.id ? 0.7 : 0.35 }}
                  onClick={e => {
                    e.stopPropagation();
                    handleDelete(group.id);
                  }}
                  aria-label="删除分组"
                  title="Delete group"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 14, color: 'var(--md-error)' }}>delete</span>
                </button>
              </div>

              {/* Children */}
              {!isCollapsed && (
                <div style={styles.childrenList}>
                  {children.map(child => (
                    <div
                      key={child.id}
                      style={{
                        ...styles.childItem,
                        borderRadius: 4,
                        background: hoveredChild === child.id ? 'var(--md-surface-container-low)' : 'transparent',
                        transition: 'background 0.1s',
                      }}
                      onMouseEnter={() => setHoveredChild(child.id)}
                      onMouseLeave={() => setHoveredChild(null)}
                    >
                      <button
                        style={styles.statusBtn}
                        onClick={() => handleToggleStatus(child)}
                        aria-label={`切换状态: ${STATUS_CONFIG[child.status]?.label}`}
                        title={STATUS_CONFIG[child.status]?.label}
                      >
                        <span className="material-symbols-outlined" style={{
                          fontSize: 16,
                          color: STATUS_CONFIG[child.status]?.color,
                        }}>
                          {STATUS_CONFIG[child.status]?.icon}
                        </span>
                      </button>
                      <span style={{
                        ...styles.childTitle,
                        textDecoration: child.status === 'completed' ? 'line-through' : 'none',
                        opacity: child.status === 'completed' ? 0.5 : 1,
                      }}>
                        {child.title}
                      </span>
                      <button
                        style={{
                          ...styles.actionBtn,
                          opacity: hoveredChild === child.id ? 0.7 : 0,
                        }}
                        onClick={e => { e.stopPropagation(); handleCopyTitle(child.title); }}
                        aria-label="复制标题"
                        title="复制"
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: 12 }}>content_copy</span>
                      </button>
                      <button
                        style={{
                          ...styles.actionBtn,
                          opacity: hoveredChild === child.id ? 0.7 : 0,
                        }}
                        onClick={e => { e.stopPropagation(); handleRunInTerminal(child.title); }}
                        aria-label="在终端中执行"
                        title="在终端中执行"
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: 12 }}>terminal</span>
                      </button>
                      <button
                        style={{
                          ...styles.actionBtn,
                          opacity: hoveredChild === child.id ? 0.7 : 0,
                        }}
                        onClick={() => handleDelete(child.id)}
                        aria-label="删除子任务"
                        title="删除"
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: 12 }}>close</span>
                      </button>
                    </div>
                  ))}

                  {/* Add subtask inline */}
                  {addingToGroup === group.id ? (
                    <div style={styles.addRow}>
                      <input
                        ref={inputRef}
                        value={newTaskTitle}
                        onChange={e => setNewTaskTitle(e.target.value)}
                        onBlur={() => { setAddingToGroup(null); setNewTaskTitle(''); }}
                        onKeyDown={e => {
                          if (e.key === 'Enter') handleAddTask(group.id);
                          if (e.key === 'Escape') { setAddingToGroup(null); setNewTaskTitle(''); }
                        }}
                        placeholder="Subtask title..."
                        style={styles.addInput}
                      />
                      <button
                        onMouseDown={e => e.preventDefault()}
                        onClick={() => handleAddTask(group.id)}
                        disabled={!newTaskTitle.trim()}
                        style={styles.addConfirmBtn}
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: 14 }}>check</span>
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setAddingToGroup(group.id)}
                      style={styles.addSubtaskBtn}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: 14 }}>add</span>
                      Add subtask
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {/* New group creation */}
        {showNewGroup ? (
          <div style={styles.newGroupForm}>
            <input
              ref={inputRef}
              value={newGroupTitle}
              onChange={e => setNewGroupTitle(e.target.value)}
              onBlur={() => { setShowNewGroup(false); setNewGroupTitle(''); }}
              onKeyDown={e => {
                if (e.key === 'Enter') handleAddGroup();
                if (e.key === 'Escape') { setShowNewGroup(false); setNewGroupTitle(''); }
              }}
              placeholder="Group name..."
              style={styles.addInput}
            />
            <button
              onMouseDown={e => e.preventDefault()}
              onClick={handleAddGroup}
              disabled={!newGroupTitle.trim()}
              style={styles.addConfirmBtn}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 14 }}>check</span>
            </button>
          </div>
        ) : (
          <button
            onClick={() => setShowNewGroup(true)}
            style={styles.addGroupBtn}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>add</span>
            Add Group
          </button>
        )}
      </div>

    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    flex: 1,
    minHeight: 0,
    overflow: 'hidden',
  },
  empty: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    padding: '32px 16px',
  },
  currentTaskCard: {
    margin: '8px 12px',
    padding: '12px',
    background: 'var(--md-surface-container-low)',
    borderRadius: 10,
    border: '1px solid var(--border)',
  },
  currentTaskHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  currentTaskTitle: {
    margin: 0,
    fontSize: 11,
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    color: 'var(--md-on-surface-variant)',
    fontFamily: 'var(--font-sans)',
  },
  currentTaskName: {
    margin: '0 0 8px',
    fontSize: 14,
    fontWeight: 600,
    color: 'var(--md-on-surface)',
    fontFamily: 'var(--font-sans)',
  },
  badgeRow: {
    display: 'flex',
    gap: 6,
    marginBottom: 10,
  },
  badge: {
    padding: '2px 8px',
    borderRadius: 4,
    fontSize: 11,
    fontWeight: 500,
    fontFamily: 'var(--font-sans)',
  },
  progressContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  progressTrack: {
    flex: 1,
    height: 5,
    background: 'var(--md-outline-variant)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    background: 'var(--md-primary)',
    borderRadius: 2,
    transition: 'width 0.3s ease',
  },
  progressText: {
    fontSize: 11,
    fontWeight: 600,
    color: 'var(--md-on-surface-variant)',
    fontFamily: 'var(--font-mono)',
    minWidth: 32,
    textAlign: 'right',
  },
  breakdownHeader: {
    padding: '12px 12px 6px',
    flexShrink: 0,
  },
  breakdownTitle: {
    margin: 0,
    fontSize: 14,
    fontWeight: 600,
    color: 'var(--md-on-surface)',
    fontFamily: 'var(--font-sans)',
  },
  groupList: {
    flex: 1,
    overflowY: 'auto',
    padding: '0 12px 12px',
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    minHeight: 0,
  },
  emptyGroups: {
    padding: '16px 0',
  },
  group: {
    display: 'flex',
    flexDirection: 'column',
  },
  groupHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    padding: '6px 8px',
    borderRadius: 6,
    cursor: 'pointer',
    userSelect: 'none',
    transition: 'background 0.15s',
  },
  groupName: {
    flex: 1,
    fontSize: 13,
    fontWeight: 600,
    fontFamily: 'var(--font-sans)',
    color: 'var(--md-on-surface)',
  },
  groupNameInput: {
    flex: 1,
    fontSize: 13,
    fontWeight: 600,
    fontFamily: 'var(--font-sans)',
    color: 'var(--md-on-surface)',
    background: 'var(--md-surface-container-low)',
    border: '1px solid var(--border)',
    borderRadius: 4,
    padding: '1px 4px',
    outline: 'none',
    lineHeight: '18px',
    minWidth: 0,
  },
  groupCount: {
    fontSize: 11,
    fontWeight: 500,
    color: 'var(--md-on-surface-variant)',
    fontFamily: 'var(--font-mono)',
  },
  groupActionBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 28,
    height: 28,
    borderRadius: 4,
    border: 'none',
    background: 'transparent',
    cursor: 'pointer',
    padding: 0,
    flexShrink: 0,
    transition: 'opacity 0.15s, background 0.15s',
  },
  childrenList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 1,
    paddingLeft: 22,
  },
  childItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    padding: '5px 6px',
  },
  statusBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: 4,
    flexShrink: 0,
    minWidth: 28,
    minHeight: 28,
    borderRadius: 'var(--radius-xs)',
  },
  childTitle: {
    flex: 1,
    fontSize: 12,
    fontFamily: 'var(--font-sans)',
    color: 'var(--md-on-surface)',
    lineHeight: '16px',
    minWidth: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  actionBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: 4,
    color: 'var(--md-outline)',
    opacity: 0,
    flexShrink: 0,
    minWidth: 24,
    minHeight: 24,
    borderRadius: 'var(--radius-xs)',
  },
  addRow: {
    display: 'flex',
    gap: 4,
    padding: '4px 0',
  },
  addInput: {
    flex: 1,
    fontSize: 12,
    fontFamily: 'var(--font-sans)',
    background: 'var(--md-surface-container-low)',
    border: '1px solid var(--border)',
    borderRadius: 6,
    padding: '4px 8px',
    outline: 'none',
    color: 'var(--md-on-surface)',
    lineHeight: '16px',
  },
  addConfirmBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 28,
    height: 28,
    borderRadius: 6,
    border: 'none',
    background: 'var(--md-primary)',
    color: 'var(--md-on-primary)',
    cursor: 'pointer',
  },
  addSubtaskBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    padding: '4px 0',
    fontSize: 11,
    fontFamily: 'var(--font-sans)',
    color: 'var(--md-primary)',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
  },
  newGroupForm: {
    display: 'flex',
    gap: 4,
    padding: '6px 0',
  },
  addGroupBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    padding: '8px 0',
    fontSize: 12,
    fontFamily: 'var(--font-sans)',
    color: 'var(--md-primary)',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    borderTop: '1px solid var(--border)',
    marginTop: 4,
  },
};
