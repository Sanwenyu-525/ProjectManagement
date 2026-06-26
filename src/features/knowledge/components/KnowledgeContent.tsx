import { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Input, message, Popconfirm } from 'antd';
import { knowledgeApi, notesApi, memoryApi, decisionsApi } from '../../../api';
import { queryKeys } from '../../../api/queryKeys';
import { useKnowledgeStore } from '../../../stores/knowledgeStore';
import { useThemeStore } from '../../../stores/themeStore';
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

// ── Rich content parsing ──

type DocSection =
  | { type: 'paragraph'; text: string }
  | { type: 'heading'; text: string }
  | { type: 'code'; code: string }
  | { type: 'callout'; title: string; text: string };

function parseContent(content: string): DocSection[] {
  const sections: DocSection[] = [];
  const lines = content.split('\n');
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (/^```/.test(line)) {
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !/^```/.test(lines[i])) {
        codeLines.push(lines[i]);
        i++;
      }
      sections.push({ type: 'code', code: codeLines.join('\n') });
      i++;
    } else if (/^> /.test(line)) {
      const quoteLines: string[] = [];
      while (i < lines.length && /^> /.test(lines[i])) {
        quoteLines.push(lines[i].replace(/^> /, ''));
        i++;
      }
      sections.push({ type: 'callout', title: '提示', text: quoteLines.join('\n') });
    } else if (/^#{1,3} /.test(line)) {
      sections.push({ type: 'heading', text: line.replace(/^#{1,3} /, '') });
      i++;
    } else if (line.trim()) {
      sections.push({ type: 'paragraph', text: line });
      i++;
    } else {
      i++;
    }
  }
  return sections;
}

function CodeBlock({ code }: { code: string }) {
  const isDark = useThemeStore(s => s.mode === 'dark');
  return (
    <div style={{
      position: 'relative',
      background: isDark ? '#1a2332' : '#0d1b2a',
      borderRadius: 8,
      padding: 16,
      border: '1px solid var(--color-border)',
      overflow: 'hidden',
    }}>
      <button
        style={{
          position: 'absolute', top: 8, right: 8,
          padding: 4, background: 'rgba(255,255,255,0.08)',
          border: 'none', borderRadius: 4, cursor: 'pointer',
          color: 'rgba(255,255,255,0.6)', display: 'flex',
          alignItems: 'center', justifyContent: 'center',
        }}
        onClick={() => navigator.clipboard.writeText(code)}
        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.16)'; }}
        onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; }}
      >
        <span className="material-symbols-outlined" style={{ fontSize: 16 }}>content_copy</span>
      </button>
      <pre style={{
        fontFamily: 'var(--font-mono)',
        fontSize: 12,
        lineHeight: '18px',
        color: '#e2e8f0',
        margin: 0,
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-all',
      }}>
        <code>{code}</code>
      </pre>
    </div>
  );
}

function RenderSections({ content }: { content: string }) {
  const isDark = useThemeStore(s => s.mode === 'dark');
  const sections = useMemo(() => parseContent(content), [content]);
  if (sections.length === 0) {
    return <span style={{ color: 'var(--color-text-tertiary)' }}>暂无内容</span>;
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {sections.map((section, i) => {
        if (section.type === 'paragraph') {
          return (
            <p key={i} style={{
              fontSize: 14, lineHeight: '22px', color: 'var(--color-text-primary)', margin: 0,
            }}>
              {section.text}
            </p>
          );
        }
        if (section.type === 'heading') {
          return (
            <h3 key={i} style={{
              fontSize: 16, fontWeight: 600, color: 'var(--color-text-primary)',
              lineHeight: '22px', margin: '8px 0 0',
              paddingBottom: 8,
              borderBottom: '1px solid var(--color-divider)',
            }}>
              {section.text}
            </h3>
          );
        }
        if (section.type === 'code') {
          return <CodeBlock key={i} code={section.code} />;
        }
        if (section.type === 'callout') {
          return (
            <div key={i} style={{
              background: isDark ? 'rgba(20,184,166,0.06)' : 'var(--md-surface-container-low)',
              borderLeft: '3px solid var(--md-primary)',
              borderRadius: '0 8px 8px 0',
              padding: '12px 14px',
              display: 'flex', gap: 10, alignItems: 'flex-start',
            }}>
              <span className="material-symbols-outlined" style={{
                fontSize: 18, color: 'var(--md-primary)', flexShrink: 0, marginTop: 1,
              }}>info</span>
              <div>
                <div style={{
                  fontSize: 11, fontFamily: 'var(--font-label)', fontWeight: 500,
                  color: 'var(--color-text-primary)', marginBottom: 4, letterSpacing: '0.02em',
                }}>
                  {section.title}
                </div>
                <p style={{ fontSize: 13, lineHeight: '20px', color: 'var(--color-text-secondary)', margin: 0 }}>
                  {section.text}
                </p>
              </div>
            </div>
          );
        }
        return null;
      })}
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
    return (
      <div style={styles.container}>
        <div style={styles.scrollArea}>
          <div style={styles.listContainer}>
            {items.map(kItem => (
              <button
                key={kItem.id}
                style={styles.listItem}
                onClick={() => setSelectedId(kItem.id)}
                onMouseEnter={e => { e.currentTarget.style.background = 'var(--color-primary-light)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
              >
                <div style={styles.listItemHeader}>
                  <SourceIcon source={kItem.source} />
                  <span style={styles.listItemTitle}>{kItem.title}</span>
                </div>
                {(kItem.source === 'memory' || kItem.source === 'note') && (
                  <button
                    style={styles.listPinBtn}
                    onClick={e => handleListPin(e, kItem)}
                    onMouseEnter={e => { e.currentTarget.style.background = 'var(--md-surface-container-high)'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                    title={kItem.isPinned ? '取消收藏' : '收藏'}
                  >
                    <span
                      className="material-symbols-outlined"
                      style={{
                        fontSize: 16,
                        color: kItem.isPinned ? 'var(--md-primary)' : undefined,
                        fontVariationSettings: kItem.isPinned ? "'FILL' 1" : undefined,
                      }}
                    >
                      {kItem.isPinned ? 'star' : 'star_border'}
                    </span>
                  </button>
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
          {item.source === 'note' && (
            <button
              style={styles.iconBtn}
              onClick={() => {
                if (editingNoteId === item.id) {
                  setEditingNoteId(null);
                } else {
                  setEditingNoteId(item.id);
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
          )}
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
      <RenderSections content={item.content} />
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
      <RenderSections content={item.content} />
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
      <RenderSections content={item.content} />
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
    paddingRight: 44,
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
};
