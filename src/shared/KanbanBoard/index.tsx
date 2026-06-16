import { useState, useMemo } from 'react';
import { DndContext, DragOverlay, closestCorners, PointerSensor, useSensor, useSensors, DragStartEvent, DragEndEvent, DragOverEvent } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Typography } from 'antd';
import { HolderOutlined } from '@ant-design/icons';
import { tasksApi } from '../../api';

const { Text } = Typography;

const COLUMNS = [
  { key: 'Todo', label: '待办', color: 'var(--color-text-secondary)', bg: 'var(--color-border-subtle)', dot: 'var(--color-text-secondary)' },
  { key: 'InProgress', label: '进行中', color: 'var(--color-amber)', bg: 'var(--color-amber-light)', dot: 'var(--color-amber)' },
  { key: 'Done', label: '已完成', color: 'var(--color-status-done)', bg: 'color-mix(in srgb, var(--color-status-done) 8%, transparent)', dot: 'var(--color-status-done)' },
  { key: 'Cancelled', label: '已取消', color: 'var(--color-status-cancel)', bg: 'color-mix(in srgb, var(--color-status-cancel) 8%, transparent)', dot: 'var(--color-status-cancel)' },
];

const PRIORITY_STYLES: Record<string, { color: string; bg: string }> = {
  Low: { color: 'var(--color-text-light)', bg: 'color-mix(in srgb, var(--color-text-light) 12%, transparent)' },
  Medium: { color: 'var(--color-info)', bg: 'var(--color-info-light)' },
  High: { color: 'var(--color-amber)', bg: 'var(--color-amber-light)' },
  Critical: { color: 'var(--color-status-cancel)', bg: 'color-mix(in srgb, var(--color-status-cancel) 10%, transparent)' },
};

interface Task {
  id: string;
  title: string;
  status: string;
  priority: string;
  dueDate?: string;
  repoScope?: string;
  scopedRepo?: { id: string; platform: string; repoFullName: string } | null;
}

interface KanbanBoardProps {
  tasks: Task[];
  onTaskUpdated: () => void;
}

function SortableTaskCard({ task }: { task: Task }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id });
  const pStyle = PRIORITY_STYLES[task.priority] || PRIORITY_STYLES.Medium;

  return (
    <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.3 : 1 }}>
      <div
        {...attributes}
        {...listeners}
        style={{
          background: 'var(--color-bg-card)',
          borderRadius: 8,
          padding: '12px 14px',
          marginBottom: 8,
          cursor: 'grab',
          border: '1px solid var(--color-border)',
          transition: 'all 0.15s ease',
          backdropFilter: 'blur(16px) saturate(1.2)',
          WebkitBackdropFilter: 'blur(16px) saturate(1.2)',
          boxShadow: '0 2px 8px var(--shadow-sm), inset 0 1px 0 var(--color-bg-card-hover)',
        }}
        onMouseEnter={e => {
          e.currentTarget.style.borderColor = 'var(--color-status-done)';
          e.currentTarget.style.boxShadow = '0 6px 20px var(--shadow-sm), inset 0 1px 0 var(--color-bg-card-hover)';
        }}
        onMouseLeave={e => {
          e.currentTarget.style.borderColor = 'var(--color-border)';
          e.currentTarget.style.boxShadow = 'none';
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
          <Text strong style={{ flex: 1, marginRight: 8, fontSize: 13, lineHeight: 1.5, color: 'var(--color-text-primary)' }}>{task.title}</Text>
          <HolderOutlined style={{ color: 'var(--color-text-light)', flexShrink: 0, marginTop: 2 }} />
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{
            fontSize: 11,
            fontWeight: 500,
            color: pStyle.color,
            background: pStyle.bg,
            padding: '2px 8px',
            borderRadius: 4,
          }}>
            {task.priority}
          </span>
          {task.scopedRepo && (
            <span style={{ fontSize: 11, color: 'var(--color-text-description)', background: 'var(--color-border-subtle)', padding: '2px 8px', borderRadius: 4 }}>
              {task.scopedRepo.platform}
            </span>
          )}
          {task.dueDate && (
            <span style={{ fontSize: 11, color: 'var(--color-text-light)', fontFamily: "'Fira Code', monospace" }}>
              {new Date(task.dueDate).toLocaleDateString('zh-CN')}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function TaskOverlayCard({ task }: { task: Task }) {
  return (
    <div style={{
      width: 260,
      background: 'var(--color-bg-card)',
      borderRadius: 8,
      padding: '12px 14px',
      boxShadow: '0 20px 60px var(--shadow-md), inset 0 1px 0 var(--color-bg-card-hover)',
      border: '1px solid var(--color-status-done)',
      transform: 'rotate(1.5deg)',
      backdropFilter: 'blur(32px) saturate(1.3)',
      WebkitBackdropFilter: 'blur(32px) saturate(1.3)',
    }}>
      <Text strong style={{ fontSize: 13, color: 'var(--color-text-primary)' }}>{task.title}</Text>
      <div style={{ marginTop: 6 }}>
        <span style={{ fontSize: 11, color: 'var(--color-amber)', background: 'var(--color-amber-light)', padding: '2px 8px', borderRadius: 4 }}>
          {task.priority}
        </span>
      </div>
    </div>
  );
}

function KanbanColumn({ column, tasks }: { column: typeof COLUMNS[0]; tasks: Task[] }) {
  return (
    <div style={{ flex: 1, minWidth: 230 }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        marginBottom: 12,
        padding: '8px 12px',
        background: column.bg,
        borderRadius: 8,
        border: '1px solid var(--color-border-subtle)',
      }}>
        <div style={{ width: 7, height: 7, borderRadius: '50%', background: column.dot, boxShadow: `0 0 6px ${column.dot}40` }} />
        <Text strong style={{ fontSize: 12, color: 'var(--color-text-primary)', letterSpacing: '0.3px' }}>{column.label}</Text>
        <span style={{
          marginLeft: 'auto',
          fontSize: 11,
          fontWeight: 600,
          color: column.color,
          fontFamily: "'Fira Code', monospace",
        }}>
          {tasks.length}
        </span>
      </div>
      <div style={{ minHeight: 200 }}>
        <SortableContext items={tasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
          {tasks.map(task => (
            <SortableTaskCard key={task.id} task={task} />
          ))}
        </SortableContext>
        {tasks.length === 0 && (
          <div style={{
            textAlign: 'center',
            padding: '28px 16px',
            color: 'var(--color-text-light)',
            fontSize: 12,
            border: '1px dashed var(--color-border-subtle)',
            borderRadius: 8,
          }}>
            拖拽任务到此处
          </div>
        )}
      </div>
    </div>
  );
}

export default function KanbanBoard({ tasks, onTaskUpdated }: KanbanBoardProps) {
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  const tasksByStatus = useMemo(() => {
    const grouped: Record<string, Task[]> = {};
    COLUMNS.forEach(col => { grouped[col.key] = []; });
    tasks.forEach(task => {
      if (grouped[task.status]) grouped[task.status].push(task);
    });
    return grouped;
  }, [tasks]);

  const activeTask = useMemo(() => tasks.find(t => t.id === activeId) || null, [tasks, activeId]);

  function findColumnByTaskId(taskId: string): string | undefined {
    for (const [status, columnTasks] of Object.entries(tasksByStatus)) {
      if (columnTasks.some(t => t.id === taskId)) return status;
    }
    return undefined;
  }

  function handleDragStart(event: DragStartEvent) {
    setActiveId(event.active.id as string);
  }

  function handleDragOver(event: DragOverEvent) {
    const { active, over } = event;
    if (!over) return;

    const activeTaskId = active.id as string;
    const overId = over.id as string;

    const activeColumn = findColumnByTaskId(activeTaskId);
    const overColumn = findColumnByTaskId(overId);

    if (!activeColumn || !overColumn || activeColumn === overColumn) return;

    const task = tasksByStatus[activeColumn].find(t => t.id === activeTaskId);
    if (!task) return;

    tasksByStatus[activeColumn] = tasksByStatus[activeColumn].filter(t => t.id !== activeTaskId);
    task.status = overColumn;
    tasksByStatus[overColumn].push(task);
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveId(null);

    if (!over) return;

    const activeTaskId = active.id as string;
    const task = tasks.find(t => t.id === activeTaskId);
    if (!task) return;

    let newStatus: string | undefined;
    for (const [status, columnTasks] of Object.entries(tasksByStatus)) {
      if (columnTasks.some(t => t.id === activeTaskId)) {
        newStatus = status;
        break;
      }
    }

    if (!newStatus || newStatus === task.status) return;

    try {
      await tasksApi.updateStatus(activeTaskId, newStatus);
      onTaskUpdated();
    } catch {
      onTaskUpdated();
    }
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 8 }}>
        {COLUMNS.map(col => (
          <KanbanColumn key={col.key} column={col} tasks={tasksByStatus[col.key] || []} />
        ))}
      </div>

      <DragOverlay>
        {activeTask ? <TaskOverlayCard task={activeTask} /> : null}
      </DragOverlay>
    </DndContext>
  );
}
