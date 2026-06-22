import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Input, message, Popconfirm } from 'antd';
import { knowledgeApi, notesApi, memoryApi, decisionsApi } from '../../../api';
import { queryKeys } from '../../../api/queryKeys';
import { useKnowledgeStore } from '../../../stores/knowledgeStore';
import type { KnowledgeItem } from '../../../types';

// ── Helpers ──

function formatTime(iso: string): string {
  const d = new Date(iso);
  const now = Date.now();
  const diff = now - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return '刚刚';
  if (mins < 60) return `${mins}分钟前`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}小时前`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}天前`;
  return d.toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

const DECISION_STATUS_LABELS: Record<string, string> = {
  proposed: '提议中',
  accepted: '已采纳',
  deprecated: '已废弃',
  superseded: '已替代',
};

const DECISION_STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  proposed: { bg: 'var(--color-info-light)', color: 'var(--color-info)' },
  accepted: { bg: 'var(--color-primary-light)', color: 'var(--md-primary)' },
  deprecated: { bg: 'var(--color-error-light)', color: 'var(--color-error)' },
  superseded: { bg: 'var(--color-amber-light)', color: 'var(--color-amber)' },
};

// ── Component ──

export default function KnowledgeContent() {
  const queryClient = useQueryClient();
  const selectedId = useKnowledgeStore(s => s.selectedId);
  const selectedCategory = useKnowledgeStore(s => s.selectedCategory);
  const searchQuery = useKnowledgeStore(s => s.searchQuery);
  const editingNoteId = useKnowledgeStore(s => s.editingNoteId);
  const setEditingNoteId = useKnowledgeStore(s => s.setEditingNoteId);

  // Determine API category param
  const pinnedOnly = selectedCategory === '_pinned';
  const categoryParam = pinnedOnly ? undefined : selectedCategory ?? undefined;

  // Fetch items
  const { data: allItems = [], isLoading } = useQuery({
    queryKey: queryKeys.knowledge.list(categoryParam),
    queryFn: () => knowledgeApi.list(categoryParam),
    staleTime: 10_000,
  });

  // Apply client-side filtering
  let items = allItems;
  if (pinnedOnly) {
    items = items.filter(i => i.isPinned);
  }
  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    items = items.filter(i => i.title.toLowerCase().includes(q) || i.content.toLowerCase().includes(q));
  }

  const item = selectedId ? items.find(i => i.id === selectedId) ?? null : null;

  // Pin mutation
  const pinMutation = useMutation({
    mutationFn: async (kItem: KnowledgeItem) => {
      if (kItem.source === 'memory') return memoryApi.pin(kItem.id);
      if (kItem.source === 'note') return notesApi.pin(kItem.id);
      throw new Error('Unsupported source');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['knowledge'] });
      message.success('操作成功');
    },
    onError: () => message.error('操作失败'),
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (kItem: KnowledgeItem) => {
      if (kItem.source === 'memory') return memoryApi.delete(kItem.id);
      if (kItem.source === 'decision') return decisionsApi.delete(kItem.id);
      if (kItem.source === 'note') return notesApi.delete(kItem.id);
      throw new Error('Unsupported source');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['knowledge'] });
      useKnowledgeStore.getState().setSelectedId(null);
      message.success('已删除');
    },
    onError: () => message.error('删除失败'),
  });

  if (!item) {
    return (
      <div style={styles.empty}>
        {isLoading ? (
          <p style={styles.emptyHint}>加载中...</p>
        ) : (
          <>
            <span className="material-symbols-outlined" style={{ fontSize: 48, color: 'var(--md-outline-variant)', opacity: 0.4 }}>
              menu_book
            </span>
            <p style={styles.emptyTitle}>选择一项知识查看详情</p>
            <p style={styles.emptyHint}>从左侧导航选择分类和条目</p>
          </>
        )}
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.scrollArea}>
        {item.source === 'memory' && <MemoryView item={item} />}
        {item.source === 'decision' && <DecisionView item={item} />}
        {item.source === 'document' && <DocumentView item={item} />}
        {item.source === 'note' && (
          <NoteView
            item={item}
            isEditing={editingNoteId === item.id}
            onCancelEdit={() => setEditingNoteId(null)}
          />
        )}
      </div>

      {/* Action bar */}
      <div style={styles.actionBar}>
        {item.source === 'note' && (
          <button
            style={styles.actionBtnSecondary}
            onClick={() => {
              if (editingNoteId === item.id) {
                setEditingNoteId(null);
              } else {
                setEditingNoteId(item.id);
              }
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 15 }}>
              {editingNoteId === item.id ? 'close' : 'edit'}
            </span>
            {editingNoteId === item.id ? '取消编辑' : '编辑'}
          </button>
        )}
        <Popconfirm
          title="确定删除？"
          onConfirm={() => deleteMutation.mutate(item)}
          okText="删除"
          cancelText="取消"
        >
          <button style={styles.actionBtnDanger}>
            <span className="material-symbols-outlined" style={{ fontSize: 15 }}>delete_outline</span>
            删除
          </button>
        </Popconfirm>
        {(item.source === 'memory' || item.source === 'note') && (
          <button
            style={styles.actionBtnPrimary}
            onClick={() => pinMutation.mutate(item)}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 15 }}>push_pin</span>
            {item.isPinned ? '取消收藏' : '收藏'}
          </button>
        )}
      </div>
    </div>
  );
}

// ── Sub-views ──

function MemoryView({ item }: { item: KnowledgeItem }) {
  const tags = item.tags ? item.tags.split(',').map(t => t.trim()).filter(Boolean) : [];

  return (
    <div style={styles.contentView}>
      <h2 style={styles.title}>{item.title}</h2>
      {tags.length > 0 && (
        <div style={styles.tagRow}>
          {tags.map(tag => (
            <span key={tag} style={styles.tag}>{tag}</span>
          ))}
        </div>
      )}
      <div style={styles.contentBody}>{item.content}</div>
      <div style={styles.metaRow}>
        <span style={styles.metaTime}>{formatTime(item.createdAt)}</span>
        <span style={styles.sourceBadge}>agent 记忆</span>
        {item.isPinned && (
          <span className="material-symbols-outlined" style={{ fontSize: 14, color: 'var(--md-primary)' }}>push_pin</span>
        )}
      </div>
    </div>
  );
}

function DecisionView({ item }: { item: KnowledgeItem }) {
  const tagsKey = item.tags ?? '';
  const statusColor = DECISION_STATUS_COLORS[tagsKey] ?? DECISION_STATUS_COLORS.accepted;
  const statusLabel = DECISION_STATUS_LABELS[tagsKey] ?? item.tags ?? '未知';

  return (
    <div style={styles.contentView}>
      <h2 style={styles.title}>{item.title}</h2>
      <span style={{
        ...styles.statusBadge,
        background: statusColor.bg,
        color: statusColor.color,
      }}>{statusLabel}</span>
      <div style={styles.adrSection}>
        <span style={styles.adrLabel}>决策原因</span>
        <div style={styles.adrContent}>{item.content}</div>
      </div>
    </div>
  );
}

function DocumentView({ item }: { item: KnowledgeItem }) {
  return (
    <div style={styles.contentView}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <h2 style={styles.title}>{item.title}</h2>
        <span style={styles.docTypeBadge}>文档</span>
      </div>
      <div style={styles.contentBody}>{item.content}</div>
      <div style={styles.metaRow}>
        <span style={styles.metaTime}>{formatTime(item.createdAt)}</span>
        {item.isPinned && (
          <span className="material-symbols-outlined" style={{ fontSize: 14, color: 'var(--md-primary)' }}>push_pin</span>
        )}
      </div>
    </div>
  );
}

function NoteView({ item, isEditing, onCancelEdit }: {
  item: KnowledgeItem;
  isEditing: boolean;
  onCancelEdit: () => void;
}) {
  const queryClient = useQueryClient();
  const [editTitle, setEditTitle] = useState(item.title);
  const [editContent, setEditContent] = useState(item.content);

  useEffect(() => {
    setEditTitle(item.title);
    setEditContent(item.content);
  }, [item.title, item.content, item.id]);

  const saveMutation = useMutation({
    mutationFn: () => notesApi.update({ id: item.id, title: editTitle, content: editContent }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['knowledge'] });
      onCancelEdit();
      message.success('已保存');
    },
    onError: () => message.error('保存失败'),
  });

  if (isEditing) {
    return (
      <div style={styles.contentView}>
        <Input
          value={editTitle}
          onChange={e => setEditTitle(e.target.value)}
          style={{ fontSize: 18, fontWeight: 600, fontFamily: 'var(--font-display)' }}
          placeholder="标题"
        />
        <Input.TextArea
          value={editContent}
          onChange={e => setEditContent(e.target.value)}
          rows={12}
          style={{ marginTop: 12, fontFamily: 'var(--font-sans)', fontSize: 14 }}
          placeholder="内容..."
        />
        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          <button
            style={styles.actionBtnPrimary}
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 15 }}>save</span>
            {saveMutation.isPending ? '保存中...' : '保存'}
          </button>
          <button style={styles.actionBtnSecondary} onClick={onCancelEdit}>
            取消
          </button>
        </div>
      </div>
    );
  }

  const tags = item.tags ? item.tags.split(',').map(t => t.trim()).filter(Boolean) : [];

  return (
    <div style={styles.contentView}>
      <h2 style={styles.title}>{item.title}</h2>
      {tags.length > 0 && (
        <div style={styles.tagRow}>
          {tags.map(tag => (
            <span key={tag} style={styles.tag}>{tag}</span>
          ))}
        </div>
      )}
      <div style={styles.contentBody}>{item.content}</div>
      <div style={styles.metaRow}>
        <span style={styles.metaTime}>{formatTime(item.createdAt)}</span>
        {item.isPinned && (
          <span className="material-symbols-outlined" style={{ fontSize: 14, color: 'var(--md-primary)' }}>push_pin</span>
        )}
      </div>
    </div>
  );
}

// ── Styles ──

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    flex: 1,
    height: '100%',
    minWidth: 0,
  },
  scrollArea: {
    flex: 1,
    overflowY: 'auto',
    padding: 24,
  },
  empty: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    height: '100%',
    gap: 4,
  },
  emptyTitle: {
    margin: 0,
    fontSize: 15,
    fontWeight: 500,
    color: 'var(--color-text-secondary)',
  },
  emptyHint: {
    margin: 0,
    fontSize: 13,
    color: 'var(--color-text-tertiary)',
  },
  contentView: {
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
  title: {
    margin: 0,
    fontSize: 20,
    fontWeight: 600,
    color: 'var(--color-text-primary)',
    fontFamily: 'var(--font-display)',
    lineHeight: 1.3,
  },
  tagRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 6,
  },
  tag: {
    fontSize: 11,
    color: 'var(--md-primary)',
    background: 'var(--color-primary-light)',
    padding: '2px 8px',
    borderRadius: 'var(--radius-full)',
    fontFamily: 'var(--font-label)',
  },
  contentBody: {
    fontSize: 14,
    lineHeight: 1.7,
    color: 'var(--color-text-primary)',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
  },
  metaRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
  },
  metaTime: {
    fontSize: 12,
    color: 'var(--color-text-tertiary)',
  },
  sourceBadge: {
    fontSize: 10,
    color: 'var(--md-primary)',
    background: 'var(--color-primary-light)',
    padding: '2px 8px',
    borderRadius: 'var(--radius-full)',
  },
  statusBadge: {
    display: 'inline-flex',
    alignSelf: 'flex-start',
    fontSize: 11,
    fontWeight: 500,
    padding: '2px 10px',
    borderRadius: 'var(--radius-full)',
  },
  adrSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    padding: '12px 0',
    borderTop: '1px solid var(--color-divider)',
  },
  adrLabel: {
    fontSize: 12,
    fontWeight: 600,
    color: 'var(--color-text-tertiary)',
    fontFamily: 'var(--font-label)',
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
  },
  adrContent: {
    fontSize: 14,
    lineHeight: 1.7,
    color: 'var(--color-text-primary)',
    whiteSpace: 'pre-wrap',
  },
  docTypeBadge: {
    fontSize: 10,
    color: 'var(--color-text-tertiary)',
    background: 'var(--md-surface-container-low)',
    padding: '2px 8px',
    borderRadius: 'var(--radius-full)',
  },
  actionBar: {
    display: 'flex',
    gap: 8,
    padding: '10px 24px',
    borderTop: '1px solid var(--color-border-subtle)',
    flexShrink: 0,
  },
  actionBtnPrimary: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    height: 32,
    padding: '0 14px',
    fontSize: 12,
    fontWeight: 500,
    color: '#fff',
    background: 'var(--md-primary)',
    border: 'none',
    borderRadius: 'var(--radius-sm)',
    cursor: 'pointer',
    fontFamily: 'var(--font-sans)',
  },
  actionBtnSecondary: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    height: 32,
    padding: '0 14px',
    fontSize: 12,
    fontWeight: 500,
    color: 'var(--color-text-primary)',
    background: 'var(--md-surface-container-low)',
    border: '1px solid var(--color-border)',
    borderRadius: 'var(--radius-sm)',
    cursor: 'pointer',
    fontFamily: 'var(--font-sans)',
  },
  actionBtnDanger: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    height: 32,
    padding: '0 14px',
    fontSize: 12,
    fontWeight: 500,
    color: 'var(--color-error)',
    background: 'var(--color-error-light)',
    border: 'none',
    borderRadius: 'var(--radius-sm)',
    cursor: 'pointer',
    fontFamily: 'var(--font-sans)',
  },
};
