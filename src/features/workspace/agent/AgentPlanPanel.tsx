import { useState, useRef, useEffect, useCallback } from 'react';
import { useAgentTasks, useCreateAgentTask, useUpdateAgentTask, useDeleteAgentTask, groupAgentTasks } from '../../../hooks/useAgentTasks';
import type { AgentTask } from '../../../types';

interface AgentPlanPanelProps {
  sessionId: string | null;
}

const PRIORITY_BADGES: Record<string, { label: string; color: string; bg: string }> = {
  high: { label: 'High', color: '#c0392b', bg: '#fdecea' },
  medium: { label: 'Medium', color: '#7f6c00', bg: '#fef7e0' },
  low: { label: 'Low', color: '#1e6e3a', bg: '#e8f5e9' },
};

const STATUS_CONFIG: Record<string, { icon: string; color: string; label: string }> = {
  pending: { icon: 'radio_button_unchecked', color: 'var(--md-outline)', label: 'Pending' },
  in_progress: { icon: 'progress_activity', color: 'var(--md-primary)', label: 'In Progress' },
  completed: { icon: 'check_circle', color: 'var(--md-tertiary)', label: 'Completed' },
};

function nextStatus(s: AgentTask['status']): AgentTask['status'] {
  if (s === 'pending') return 'in_progress';
  if (s === 'in_progress') return 'completed';
  return 'pending';
}

export default function AgentPlanPanel({ sessionId }: AgentPlanPanelProps) {
  const { data: tasks = [] } = useAgentTasks(sessionId);
  const createTask = useCreateAgentTask();
  const updateTask = useUpdateAgentTask();
  const deleteTask = useDeleteAgentTask();

  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [addingToGroup, setAddingToGroup] = useState<string | null>(null);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [showNewGroup, setShowNewGroup] = useState(false);
  const [newGroupTitle, setNewGroupTitle] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const { groups, childrenOf } = groupAgentTasks(tasks);

  // Focus input when adding
  useEffect(() => {
    if (addingToGroup || showNewGroup) {
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [addingToGroup, showNewGroup]);

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
    if (!newTaskTitle.trim() || !sessionId) return;
    await createTask.mutateAsync({
      sessionId,
      data: { title: newTaskTitle.trim(), parentId },
    });
    setNewTaskTitle('');
    setAddingToGroup(null);
  }, [newTaskTitle, sessionId, createTask]);

  const handleAddGroup = useCallback(async () => {
    if (!newGroupTitle.trim() || !sessionId) return;
    await createTask.mutateAsync({
      sessionId,
      data: { title: newGroupTitle.trim(), sortOrder: groups.length },
    });
    setNewGroupTitle('');
    setShowNewGroup(false);
  }, [newGroupTitle, sessionId, createTask, groups.length]);

  const handleToggleStatus = useCallback(async (task: AgentTask) => {
    if (!sessionId) return;
    await updateTask.mutateAsync({
      sessionId,
      id: task.id,
      data: { status: nextStatus(task.status) },
    });
  }, [sessionId, updateTask]);

  const handleDelete = useCallback(async (taskId: string) => {
    if (!sessionId) return;
    await deleteTask.mutateAsync({ sessionId, id: taskId });
  }, [sessionId, deleteTask]);

  if (!sessionId) {
    return (
      <div style={styles.empty}>
        <span className="material-symbols-outlined" style={{ fontSize: 32, color: 'var(--md-outline-variant)' }}>
          description
        </span>
        <p style={{ margin: '8px 0 0', fontSize: 12, color: 'var(--md-on-surface-variant)' }}>
          Start a chat session to manage tasks.
        </p>
      </div>
    );
  }

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
          <div style={styles.progressContainer}>
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
                style={styles.groupHeader}
                onClick={() => toggleGroup(group.id)}
              >
                <span className="material-symbols-outlined" style={{
                  fontSize: 18,
                  color: allDone ? 'var(--md-tertiary)' : 'var(--md-primary)',
                  cursor: 'pointer',
                  transition: 'transform 0.2s',
                  transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)',
                }}>
                  expand_more
                </span>
                <span style={styles.groupName}>{group.title}</span>
                <span style={styles.groupCount}>{doneCount}/{children.length}</span>
              </div>

              {/* Children */}
              {!isCollapsed && (
                <div style={styles.childrenList}>
                  {children.map(child => (
                    <div key={child.id} style={styles.childItem}>
                      <button
                        style={styles.statusBtn}
                        onClick={() => handleToggleStatus(child)}
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
                        style={styles.deleteBtn}
                        onClick={() => handleDelete(child.id)}
                        title="Delete"
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
                        onKeyDown={e => {
                          if (e.key === 'Enter') handleAddTask(group.id);
                          if (e.key === 'Escape') { setAddingToGroup(null); setNewTaskTitle(''); }
                        }}
                        placeholder="Subtask title..."
                        style={styles.addInput}
                      />
                      <button
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
              onKeyDown={e => {
                if (e.key === 'Enter') handleAddGroup();
                if (e.key === 'Escape') { setShowNewGroup(false); setNewGroupTitle(''); }
              }}
              placeholder="Group name..."
              style={styles.addInput}
            />
            <button
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
    gap: 4,
  },
  currentTaskCard: {
    margin: '8px 12px',
    padding: '12px',
    background: 'var(--md-surface-container-low)',
    borderRadius: 10,
    border: '1px solid var(--md-outline-variant)',
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
    height: 4,
    background: 'var(--md-outline-variant)',
    borderRadius: 2,
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
    padding: '6px 4px',
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
  groupCount: {
    fontSize: 11,
    fontWeight: 500,
    color: 'var(--md-on-surface-variant)',
    fontFamily: 'var(--font-mono)',
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
    padding: '4px 0',
  },
  statusBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: 1,
    flexShrink: 0,
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
  deleteBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: 2,
    color: 'var(--md-outline)',
    opacity: 0,
    flexShrink: 0,
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
    border: '1px solid var(--md-outline-variant)',
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
    width: 24,
    height: 24,
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
    borderTop: '1px solid var(--md-outline-variant)',
    marginTop: 4,
  },
};
