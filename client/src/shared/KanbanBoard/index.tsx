import { useState, useMemo } from 'react';
import { DndContext, DragOverlay, closestCorners, PointerSensor, useSensor, useSensors, DragStartEvent, DragEndEvent, DragOverEvent } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Typography } from 'antd';
import { HolderOutlined } from '@ant-design/icons';
import { tasksApi } from '../../api';

const { Text } = Typography;

const COLUMNS = [
  { key: 'Todo', label: '待办', color: '#64748b', bg: 'rgba(100, 116, 139, 0.08)', dot: '#64748b' },
  { key: 'InProgress', label: '进行中', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.08)', dot: '#f59e0b' },
  { key: 'Done', label: '已完成', color: '#22c55e', bg: 'rgba(34, 197, 94, 0.08)', dot: '#22c55e' },
  { key: 'Cancelled', label: '已取消', color: '#ef4444', bg: 'rgba(239, 68, 68, 0.08)', dot: '#ef4444' },
];

const PRIORITY_STYLES: Record<string, { color: string; bg: string }> = {
  Low: { color: '#94a3b8', bg: '#1e293b' },
  Medium: { color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.12)' },
  High: { color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.12)' },
  Critical: { color: '#ef4444', bg: 'rgba(239, 68, 68, 0.12)' },
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
          background: '#151d2e',
          borderRadius: 8,
          padding: '12px 14px',
          marginBottom: 8,
          cursor: 'grab',
          border: '1px solid #1e293b',
          transition: 'all 0.15s ease',
        }}
        onMouseEnter={e => {
          e.currentTarget.style.borderColor = 'rgba(34, 197, 94, 0.2)';
          e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.3)';
        }}
        onMouseLeave={e => {
          e.currentTarget.style.borderColor = '#1e293b';
          e.currentTarget.style.boxShadow = 'none';
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
          <Text strong style={{ flex: 1, marginRight: 8, fontSize: 13, lineHeight: 1.5, color: '#f1f5f9' }}>{task.title}</Text>
          <HolderOutlined style={{ color: '#475569', flexShrink: 0, marginTop: 2 }} />
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
            <span style={{ fontSize: 11, color: '#94a3b8', background: '#1e293b', padding: '2px 8px', borderRadius: 4 }}>
              {task.scopedRepo.platform}
            </span>
          )}
          {task.dueDate && (
            <span style={{ fontSize: 11, color: '#64748b', fontFamily: "'Fira Code', monospace" }}>
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
      background: '#1a2235',
      borderRadius: 8,
      padding: '12px 14px',
      boxShadow: '0 16px 48px rgba(0, 0, 0, 0.6)',
      border: '1px solid rgba(34, 197, 94, 0.3)',
      transform: 'rotate(1.5deg)',
    }}>
      <Text strong style={{ fontSize: 13, color: '#f1f5f9' }}>{task.title}</Text>
      <div style={{ marginTop: 6 }}>
        <span style={{ fontSize: 11, color: '#f59e0b', background: 'rgba(245, 158, 11, 0.12)', padding: '2px 8px', borderRadius: 4 }}>
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
        border: '1px solid rgba(255, 255, 255, 0.04)',
      }}>
        <div style={{ width: 7, height: 7, borderRadius: '50%', background: column.dot, boxShadow: `0 0 6px ${column.dot}40` }} />
        <Text strong style={{ fontSize: 12, color: '#f1f5f9', letterSpacing: '0.3px' }}>{column.label}</Text>
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
            color: '#334155',
            fontSize: 12,
            border: '1px dashed #1e293b',
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
