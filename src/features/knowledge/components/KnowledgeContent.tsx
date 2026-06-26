import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Input, Checkbox, message, Popconfirm } from 'antd';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import CodeMirror from '@uiw/react-codemirror';
import { markdown as markdownLang } from '@codemirror/lang-markdown';
import { EditorView } from '@codemirror/view';
import { makeDevhubTheme, devhubHighlight } from '@/features/workspace/components/cmTheme';
import { knowledgeApi, notesApi, memoryApi, decisionsApi } from '../../../api';
import { queryKeys } from '../../../api/queryKeys';
import { useKnowledgeStore } from '../../../stores/knowledgeStore';
import { useThemeStore } from '../../../stores/themeStore';
import type { KnowledgeItem } from '../../../types';

// ── Helpers ──

import { formatRelativeTime } from '@/lib/format';

const formatTime = formatRelativeTime;

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

// ── Markdown rendering ──

function MarkdownContent({ content }: { content: string }) {
  const isDark = useThemeStore(s => s.mode === 'dark');
  return (
    <div className="knowledgeProse">
      <ReactMarkdown
        components={{
          code(props) {
            const { children, className, ...rest } = props;
            const match = /language-(\w+)/.exec(className || '');
            const codeStr = String(children).replace(/\n$/, '');
            if (match) {
              return (
                <div style={{ position: 'relative' }}>
                  <button
                    style={{
                      position: 'absolute', top: 8, right: 8,
                      padding: 4, background: 'rgba(255,255,255,0.08)',
                      border: 'none', borderRadius: 4, cursor: 'pointer',
                      color: 'rgba(255,255,255,0.6)', display: 'flex',
                      alignItems: 'center', justifyContent: 'center', zIndex: 1,
                    }}
                    onClick={() => navigator.clipboard.writeText(codeStr)}
                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.16)'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: 16 }}>content_copy</span>
                  </button>
                  <SyntaxHighlighter
                    style={oneDark}
                    language={match[1]}
                    PreTag="div"
                    customStyle={{ margin: 0, borderRadius: 8, fontSize: 13 }}
                  >
                    {codeStr}
                  </SyntaxHighlighter>
                </div>
              );
            }
            return <code className={className} {...rest}>{children}</code>;
          },
          blockquote({ children }) {
            return (
              <div style={{
                background: isDark ? 'rgba(20,184,166,0.06)' : 'var(--md-surface-container-low)',
                borderLeft: '3px solid var(--md-primary)',
                borderRadius: '0 8px 8px 0',
                padding: '12px 14px',
              }}>
                {children}
              </div>
            );
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

// ── Source Icon ──

const SOURCE_CONFIG: Record<string, { icon: string; color: string }> = {
  memory: { icon: 'smart_toy', color: 'var(--md-primary)' },
  decision: { icon: 'gavel', color: 'var(--color-amber)' },
  document: { icon: 'description', color: 'var(--color-info)' },
  note: { icon: 'edit_note', color: 'var(--color-success)' },
};

function SourceIcon({ source }: { source: string }) {
  const cfg = SOURCE_CONFIG[source] ?? { icon: 'article', color: 'var(--md-outline)' };
  return (
    <span className="material-symbols-outlined" style={{ fontSize: 16, color: cfg.color, flexShrink: 0 }}>
      {cfg.icon}
    </span>
  );
}

// ── Component ──

export default function KnowledgeContent() {
  const queryClient = useQueryClient();
  const selectedId = useKnowledgeStore(s => s.selectedId);
  const setSelectedId = useKnowledgeStore(s => s.setSelectedId);
  const selectedCategory = useKnowledgeStore(s => s.selectedCategory);
  const searchQuery = useKnowledgeStore(s => s.searchQuery);
  const editingNoteId = useKnowledgeStore(s => s.editingNoteId);
  const setEditingNoteId = useKnowledgeStore(s => s.setEditingNoteId);

  // Batch selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const toggleSelected = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

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
    onSuccess: (_data, kItem) => {
      queryClient.invalidateQueries({ queryKey: ['knowledge'] });
      message.success(kItem.isPinned ? '取消收藏成功' : '收藏成功');
    },
    onError: () => message.error('操作失败'),
  });

  // List pin toggle (needs event stopPropagation to avoid navigating to detail)
  const handleListPin = (e: React.MouseEvent, kItem: KnowledgeItem) => {
    e.stopPropagation();
    pinMutation.mutate(kItem);
  };

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

  const selectAll = useCallback(() => {
    setSelectedIds(prev => prev.size === items.length ? new Set() : new Set(items.map(i => i.id)));
  }, [items]);

  const batchDeleteMutation = useMutation({
    mutationFn: async () => {
      const targets = items.filter(i => selectedIds.has(i.id));
      await Promise.all(targets.map(kItem => {
        if (kItem.source === 'memory') return memoryApi.delete(kItem.id);
        if (kItem.source === 'decision') return decisionsApi.delete(kItem.id);
        if (kItem.source === 'note') return notesApi.delete(kItem.id);
        return Promise.resolve();
      }));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['knowledge'] });
      setSelectedIds(new Set());
      message.success('批量删除成功');
    },
    onError: () => message.error('批量删除失败'),
  });

  const handleBatchCopy = useCallback(() => {
    const targets = items.filter(i => selectedIds.has(i.id));
    const text = targets.map(i => `# ${i.title}\n${i.content}`).join('\n\n---\n\n');
    navigator.clipboard.writeText(text).then(() => message.success(`已复制 ${targets.length} 项`));
  }, [items, selectedIds]);

  if (!item) {
    if (isLoading) {
      return (
        <div style={styles.empty}>
          <p style={styles.emptyHint}>加载中...</p>
        </div>
      );
    }
    if (items.length === 0) {
      return (
        <div style={styles.empty}>
          <span className="material-symbols-outlined" style={{ fontSize: 48, color: 'var(--md-outline-variant)', opacity: 0.4 }}>
            menu_book
          </span>
          <p style={styles.emptyTitle}>暂无数据</p>
          <p style={styles.emptyHint}>该分类下暂无知识条目</p>
        </div>
      );
    }
    const anySelected = selectedIds.size > 0;
    return (
      <div style={styles.container}>
        {anySelected && (
          <div style={styles.batchBar}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <Checkbox
                indeterminate={selectedIds.size > 0 && selectedIds.size < items.length}
                checked={selectedIds.size === items.length && items.length > 0}
                onChange={selectAll}
              />
              <span style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>
                已选 {selectedIds.size} 项
              </span>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <Popconfirm
                title={`确定删除选中的 ${selectedIds.size} 项？`}
                onConfirm={() => batchDeleteMutation.mutate()}
                okText="删除"
                cancelText="取消"
              >
                <button
                  style={styles.batchActionBtnDanger}
                  onMouseEnter={e => { e.currentTarget.style.background = 'var(--color-error-light)'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 16 }}>delete_outline</span>
                  删除
                </button>
              </Popconfirm>
              <button
                style={styles.batchActionBtn}
                onClick={handleBatchCopy}
                onMouseEnter={e => { e.currentTarget.style.background = 'var(--md-surface-container-high)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>content_copy</span>
                复制
              </button>
            </div>
          </div>
        )}
        <div style={styles.scrollArea}>
          <div style={styles.listContainer}>
            {items.map(kItem => (
              <button
                key={kItem.id}
                style={{
                  ...styles.listItem,
                  paddingLeft: 42,
                  ...(selectedIds.has(kItem.id) ? { background: 'var(--color-primary-light)' } : {}),
                }}
                onClick={() => setSelectedId(kItem.id)}
                onMouseEnter={e => {
                  setHoveredId(kItem.id);
                  if (!selectedIds.has(kItem.id)) e.currentTarget.style.background = 'var(--color-primary-light)';
                }}
                onMouseLeave={e => {
                  setHoveredId(null);
                  if (!selectedIds.has(kItem.id)) e.currentTarget.style.background = 'transparent';
                }}
              >
                <div
                  style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', display: 'flex' }}
                  onClick={e => e.stopPropagation()}
                >
                  <Checkbox
                    checked={selectedIds.has(kItem.id)}
                    onClick={e => e.stopPropagation()}
                    onChange={() => toggleSelected(kItem.id)}
                  />
                </div>
                <div style={styles.listItemHeader}>
                  <SourceIcon source={kItem.source} />
                  <span style={styles.listItemTitle}>{kItem.title}</span>
                </div>
                {hoveredId === kItem.id && (
                  <>
                    {(kItem.source === 'memory' || kItem.source === 'note') && (
                      <button
                        style={styles.listPinBtn}
                        onClick={e => handleListPin(e, kItem)}
                        title={kItem.isPinned ? '取消收藏' : '收藏'}
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: 16, color: kItem.isPinned ? 'var(--md-primary)' : undefined, fontVariationSettings: kItem.isPinned ? "'FILL' 1" : undefined }}>
                          {kItem.isPinned ? 'star' : 'star_border'}
                        </span>
                      </button>
                    )}
                    <button style={styles.listEditBtn} onClick={e => { e.stopPropagation(); setSelectedId(kItem.id); if (kItem.source === 'note') setEditingNoteId(kItem.id); }} title="编辑">
                      <span className="material-symbols-outlined" style={{ fontSize: 16 }}>edit</span>
                    </button>
                    <Popconfirm title="确定删除？" onConfirm={() => deleteMutation.mutate(kItem)} okText="删除" cancelText="取消">
                      <button style={styles.listDeleteBtn} onClick={e => e.stopPropagation()} title="删除">
                        <span className="material-symbols-outlined" style={{ fontSize: 16, color: 'var(--md-error)' }}>delete_outline</span>
                      </button>
                    </Popconfirm>
                    <button style={styles.listCopyBtn} onClick={e => { e.stopPropagation(); navigator.clipboard.writeText(kItem.content).then(() => message.success('已复制')); }} title="复制内容">
                      <span className="material-symbols-outlined" style={{ fontSize: 16 }}>content_copy</span>
                    </button>
                  </>
                )}
                
                <p style={styles.listItemPreview}>
                  {kItem.content.length > 120 ? kItem.content.slice(0, 120) + '...' : kItem.content}
                </p>
                <div style={styles.listItemMeta}>
                  <span style={styles.metaTime}>{formatTime(kItem.createdAt)}</span>
                  {kItem.tags && kItem.tags.split(',').slice(0, 3).map(tag => (
                    <span key={tag.trim()} style={styles.tag}>{tag.trim()}</span>
                  ))}
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      {/* Header: back + actions */}
      <div style={styles.detailHeader}>
        <button
          style={styles.backBtn}
          onClick={() => setSelectedId(null)}
          onMouseEnter={e => { e.currentTarget.style.background = 'var(--md-surface-container-high)'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 18 }}>arrow_back</span>
        </button>
        <div style={styles.headerActions}>
          <button
            style={styles.iconBtn}
            onClick={() => {
              if (item.source === 'note') {
                setEditingNoteId(editingNoteId === item.id ? null : item.id);
              } else {
                message.info('仅笔记支持编辑');
              }
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--md-surface-container-high)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
            title={editingNoteId === item.id ? '取消编辑' : '编辑'}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
              {editingNoteId === item.id ? 'close' : 'edit'}
            </span>
          </button>
          {(item.source === 'memory' || item.source === 'note') && (
            <button
              style={styles.iconBtn}
              onClick={() => pinMutation.mutate(item)}
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--md-surface-container-high)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
              title={item.isPinned ? '取消收藏' : '收藏'}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 18, color: item.isPinned ? 'var(--md-primary)' : undefined, fontVariationSettings: item.isPinned ? "'FILL' 1" : undefined }}>
                {item.isPinned ? 'star' : 'star_border'}
              </span>
            </button>
          )}
          <Popconfirm
            title="确定删除？"
            onConfirm={() => deleteMutation.mutate(item)}
            okText="删除"
            cancelText="取消"
          >
            <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32 }}>
              <button
                style={styles.iconBtnDanger}
                title="删除"
                onMouseEnter={e => { e.currentTarget.style.background = 'var(--md-surface-container-high)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>delete_outline</span>
              </button>
            </span>
          </Popconfirm>
          <button
            style={styles.iconBtn}
            onClick={() => navigator.clipboard.writeText(item.content).then(() => message.success('已复制'))}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--md-surface-container-high)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
            title="复制内容"
          >
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>content_copy</span>
          </button>
        </div>
      </div>
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
      <MarkdownContent content={item.content} />
      <div style={styles.metaRow}>
        <span style={styles.metaTime}>{formatTime(item.createdAt)}</span>
        <span style={styles.sourceBadge}>agent 记忆</span>
        {item.isPinned && (
          <span className="material-symbols-outlined" style={{ fontSize: 16, color: 'var(--md-primary)', fontVariationSettings: "'FILL' 1" }}>star</span>
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
      <MarkdownContent content={item.content} />
      <div style={styles.metaRow}>
        <span style={styles.metaTime}>{formatTime(item.createdAt)}</span>
        {item.isPinned && (
          <span className="material-symbols-outlined" style={{ fontSize: 16, color: 'var(--md-primary)', fontVariationSettings: "'FILL' 1" }}>star</span>
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

  const isDark = useThemeStore(s => s.mode === 'dark');
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
        <div style={{ marginTop: 12, border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', overflow: 'hidden' }}>
          <CodeMirror
            value={editContent}
            onChange={v => setEditContent(v)}
            height="400px"
            extensions={[markdownLang(), EditorView.lineWrapping, makeDevhubTheme(isDark), devhubHighlight]}
          />
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          <button
            style={styles.actionBtnPrimary}
            onClick={() => saveMutation.mutate()}
            onMouseEnter={e => { e.currentTarget.style.opacity = '0.85'; }}
            onMouseLeave={e => { e.currentTarget.style.opacity = '1'; }}
            disabled={saveMutation.isPending}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 15 }}>save</span>
            {saveMutation.isPending ? '保存中...' : '保存'}
          </button>
          <button
            style={styles.actionBtnSecondary}
            onClick={onCancelEdit}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--md-surface-container-high)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'var(--md-surface-container-low)'; }}
          >
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
      <MarkdownContent content={item.content} />
      <div style={styles.metaRow}>
        <span style={styles.metaTime}>{formatTime(item.createdAt)}</span>
        {item.isPinned && (
          <span className="material-symbols-outlined" style={{ fontSize: 16, color: 'var(--md-primary)', fontVariationSettings: "'FILL' 1" }}>star</span>
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
  detailHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '6px 8px',
    borderBottom: '1px solid var(--color-border-subtle)',
    flexShrink: 0,
  },
  backBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 32,
    height: 32,
    border: 'none',
    borderRadius: 'var(--radius-sm)',
    background: 'transparent',
    cursor: 'pointer',
    color: 'var(--color-text-secondary)',
    transition: 'background 0.15s',
  },
  headerActions: {
    display: 'flex',
    alignItems: 'center',
    gap: 2,
  },
  iconBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 32,
    height: 32,
    border: 'none',
    borderRadius: 'var(--radius-sm)',
    background: 'transparent',
    cursor: 'pointer',
    color: 'var(--color-text-secondary)',
    transition: 'background 0.15s',
  },
  iconBtnDanger: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 32,
    height: 32,
    border: 'none',
    borderRadius: 'var(--radius-sm)',
    background: 'transparent',
    cursor: 'pointer',
    color: 'var(--color-error)',
    transition: 'background 0.15s',
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
  listContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
  },
  listItem: {
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    width: '100%',
    padding: '14px 16px',
    paddingRight: 132,
    border: 'none',
    borderRadius: 'var(--radius-sm)',
    background: 'transparent',
    cursor: 'pointer',
    textAlign: 'left',
    fontFamily: 'var(--font-sans)',
    transition: 'background 0.15s',
  },
  listItemHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  listItemTitle: {
    flex: 1,
    fontSize: 14,
    fontWeight: 500,
    color: 'var(--color-text-primary)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  listItemPreview: {
    margin: 0,
    fontSize: 12,
    lineHeight: '18px',
    color: 'var(--color-text-tertiary)',
    overflow: 'hidden',
    display: '-webkit-box',
    WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical',
  },
  listItemMeta: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  listPinBtn: {
    position: 'absolute',
    right: 96,
    top: '50%',
    transform: 'translateY(-50%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 28,
    height: 28,
    border: 'none',
    borderRadius: 'var(--radius-xs)',
    background: 'transparent',
    cursor: 'pointer',
    flexShrink: 0,
    padding: 0,
    transition: 'background 0.15s',
  },
  listDeleteBtn: {
    position: 'absolute',
    right: 40,
    top: '50%',
    transform: 'translateY(-50%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 28,
    height: 28,
    border: 'none',
    borderRadius: 'var(--radius-xs)',
    background: 'transparent',
    cursor: 'pointer',
    flexShrink: 0,
    padding: 0,
    transition: 'background 0.15s',
  },
  listEditBtn: {
    position: 'absolute',
    right: 68,
    top: '50%',
    transform: 'translateY(-50%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 28,
    height: 28,
    border: 'none',
    borderRadius: 'var(--radius-xs)',
    background: 'transparent',
    cursor: 'pointer',
    flexShrink: 0,
    padding: 0,
    transition: 'background 0.15s',
  },
  listCopyBtn: {
    position: 'absolute',
    right: 12,
    top: '50%',
    transform: 'translateY(-50%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 28,
    height: 28,
    border: 'none',
    borderRadius: 'var(--radius-xs)',
    background: 'transparent',
    cursor: 'pointer',
    flexShrink: 0,
    padding: 0,
    transition: 'background 0.15s',
  },
  batchBar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '8px 16px',
    borderBottom: '1px solid var(--color-divider)',
    background: 'var(--md-surface-container)',
    flexShrink: 0,
  },
  batchActionBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    padding: '4px 10px',
    border: 'none',
    borderRadius: 'var(--radius-xs)',
    background: 'transparent',
    cursor: 'pointer',
    fontSize: 12,
    fontFamily: 'var(--font-sans)',
    color: 'var(--color-text-primary)',
    transition: 'background 0.15s',
  },
  batchActionBtnDanger: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    padding: '4px 10px',
    border: 'none',
    borderRadius: 'var(--radius-xs)',
    background: 'transparent',
    cursor: 'pointer',
    fontSize: 12,
    fontFamily: 'var(--font-sans)',
    color: 'var(--color-error)',
    transition: 'background 0.15s',
  },
};
