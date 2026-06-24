import { useState, useCallback, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Modal, Input, Select, message } from 'antd';
import { useQuery as useRqQuery } from '@tanstack/react-query';
import { memoryApi, decisionsApi } from '../../../api';
import { queryKeys } from '../../../api/queryKeys';
import { useMemoryStore } from '../../../stores/memoryStore';
import type { ProjectMemory, MemoryType, CreateMemoryInput, CreateDecisionInput } from '../../../types';

interface AgentMemoryPanelProps {
  sessionId: string | null;
}

const MEMORY_TYPE_LABELS: Record<MemoryType, string> = {
  architecture: '架构',
  code: '代码知识',
  bugfix: 'Bug 修复',
  rule: 'AI 规则',
  session: '会话摘要',
  decision: '决策',
  solution: '解决方案',
  pattern: '代码模式',
  prompt: '高价值提示词',
  workflow: '开发流程',
  experience: '经验沉淀',
};

const MEMORY_TYPE_ICONS: Record<MemoryType, string> = {
  architecture: 'account_tree',
  code: 'code',
  bugfix: 'bug_report',
  rule: 'rule',
  session: 'smart_toy',
  decision: 'gavel',
  solution: 'build',
  pattern: 'pattern',
  prompt: 'psychology',
  workflow: 'route',
  experience: 'school',
};

const DECISION_STATUS_LABELS: Record<string, string> = {
  proposed: '提议中',
  accepted: '已采纳',
  deprecated: '已废弃',
  superseded: '已替代',
};

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

export default function AgentMemoryPanel({ sessionId }: AgentMemoryPanelProps) {
  const queryClient = useQueryClient();
  const searchQuery = useMemoryStore(s => s.searchQuery);
  const setSearchQuery = useMemoryStore(s => s.setSearchQuery);
  const showCreateModal = useMemoryStore(s => s.showCreateModal);
  const setShowCreateModal = useMemoryStore(s => s.setShowCreateModal);
  const showDecisionModal = useMemoryStore(s => s.showDecisionModal);
  const setShowDecisionModal = useMemoryStore(s => s.setShowDecisionModal);
  const [showBuildContextModal, setShowBuildContextModal] = useState(false);
  const [hoveredMemory, setHoveredMemory] = useState<string | null>(null);
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());

  // Fetch memories
  const { data: memories = [] } = useRqQuery({
    queryKey: searchQuery ? queryKeys.memories.search(searchQuery) : queryKeys.memories.all(),
    queryFn: () => searchQuery ? memoryApi.search(searchQuery) : memoryApi.list(),
    staleTime: 10_000,
  });

  // Fetch decisions
  const { data: allDecisions = [] } = useRqQuery({
    queryKey: queryKeys.decisions.all(),
    queryFn: () => decisionsApi.list(),
    staleTime: 10_000,
  });

  // Filter decisions by search query
  const decisions = searchQuery
    ? allDecisions.filter(d =>
        d.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        d.reason.toLowerCase().includes(searchQuery.toLowerCase()))
    : allDecisions;

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => memoryApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['memories'] });
      message.success('已删除');
    },
    onError: () => message.error('删除失败'),
  });

  // Pin mutation
  const pinMutation = useMutation({
    mutationFn: (id: string) => memoryApi.pin(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['memories'] });
    },
    onError: () => message.error('置顶失败'),
  });

  // Group memories by type, pinned first within each group
  const grouped = memories.reduce<Record<string, ProjectMemory[]>>((acc, m) => {
    (acc[m.type] ??= []).push(m);
    return acc;
  }, {});
  for (const key of Object.keys(grouped)) {
    grouped[key].sort((a, b) => (b.isPinned ? 1 : 0) - (a.isPinned ? 1 : 0));
  }

  const toggleSection = useCallback((key: string) => {
    setCollapsedSections(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }, []);

  return (
    <div style={styles.container}>
      {/* Search */}
      <div style={styles.searchBox}>
        <span className="material-symbols-outlined" style={{ fontSize: 16, color: 'var(--md-outline)' }}>
          search
        </span>
        <input
          type="text"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder="搜索项目记忆..."
          aria-label="搜索项目记忆"
          style={styles.searchInput}
        />
        {searchQuery && (
          <span
            className="material-symbols-outlined"
            role="button"
            aria-label="清除搜索"
            tabIndex={0}
            onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSearchQuery(''); } }}
            style={{ fontSize: 14, color: 'var(--md-outline)', cursor: 'pointer', padding: 4, borderRadius: 'var(--radius-xs)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            onClick={() => setSearchQuery('')}
          >close</span>
        )}
      </div>

      {/* Memories */}
      <div style={styles.scrollArea}>
        {memories.length === 0 && !searchQuery && (
          <div style={styles.empty}>
            <span className="material-symbols-outlined" style={{ fontSize: 28, color: 'var(--md-outline-variant)', opacity: 0.6 }}>
              neurology
            </span>
            <p style={styles.emptyText}>暂无记忆</p>
            <p style={styles.emptyHint}>Agent 对话结束后会自动沉淀关键结论</p>
          </div>
        )}

        {searchQuery && memories.length === 0 && (
          <div style={styles.empty}>
            <span className="material-symbols-outlined" style={{ fontSize: 28, color: 'var(--md-outline-variant)', opacity: 0.6 }}>
              search_off
            </span>
            <p style={styles.emptyText}>未找到匹配的记忆</p>
          </div>
        )}

        {/* Grouped memories */}
        {(Object.keys(grouped) as MemoryType[]).map(type => {
          const collapsed = collapsedSections.has(type);
          return (
          <div key={type} style={styles.section}>
            <div
              style={{
                ...styles.sectionHeader,
                cursor: 'pointer',
                background: collapsed ? 'transparent' : 'var(--md-surface-container-low)',
                borderRadius: 6,
                margin: collapsed ? 0 : '0 4px',
                padding: collapsed ? '0 12px 6px' : '4px 8px 6px',
                opacity: collapsed ? 0.7 : 1,
              }}
              onClick={() => toggleSection(type)}
              role="button"
              tabIndex={0}
              onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleSection(type); } }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 14, color: 'var(--md-primary)' }}>
                {MEMORY_TYPE_ICONS[type]}
              </span>
              <span style={styles.sectionTitle}>{MEMORY_TYPE_LABELS[type]}</span>
              <span style={styles.sectionCount}>{grouped[type].length}</span>
              <span
                className="material-symbols-outlined"
                style={{
                  fontSize: 14,
                  color: collapsed ? 'var(--md-outline)' : 'var(--md-primary)',
                  transition: 'transform 0.15s, color 0.15s',
                  transform: collapsed ? 'rotate(-90deg)' : 'rotate(0deg)',
                }}
              >expand_more</span>
            </div>
            {!collapsed && grouped[type].map(memory => (
              <div
                key={memory.id}
                style={{
                  ...styles.memoryCard,
                  borderLeft: memory.isPinned ? '2px solid var(--md-primary)' : undefined,
                  background: hoveredMemory === memory.id ? 'var(--md-surface-container-low)' : 'transparent',
                  paddingLeft: memory.isPinned ? '10px' : '12px',
                }}
                onMouseEnter={() => setHoveredMemory(memory.id)}
                onMouseLeave={() => setHoveredMemory(null)}
              >
                <div style={styles.memoryHeader}>
                  <span style={styles.memoryTitle}>{memory.title}</span>
                  <span
                    className="material-symbols-outlined"
                    role="button"
                    aria-label={memory.isPinned ? '取消置顶' : '置顶'}
                    tabIndex={0}
                    onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pinMutation.mutate(memory.id); } }}
                    style={{
                      fontSize: 14,
                      color: memory.isPinned ? 'var(--md-primary)' : 'var(--md-outline)',
                      cursor: 'pointer',
                      flexShrink: 0,
                      padding: 4,
                      borderRadius: 'var(--radius-xs)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                    onClick={() => pinMutation.mutate(memory.id)}
                    title={memory.isPinned ? '取消置顶' : '置顶'}
                  >push_pin</span>
                  <span
                    className="material-symbols-outlined"
                    role="button"
                    aria-label="删除记忆"
                    tabIndex={0}
                    onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); deleteMutation.mutate(memory.id); } }}
                    style={{ fontSize: 14, color: 'var(--md-outline)', cursor: 'pointer', flexShrink: 0, padding: 4, borderRadius: 'var(--radius-xs)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    onClick={() => deleteMutation.mutate(memory.id)}
                    title="删除"
                  >delete_outline</span>
                </div>
                <p style={styles.memoryContent}>
                  {memory.content.length > 120 ? memory.content.slice(0, 120) + '...' : memory.content}
                </p>
                <div style={styles.memoryMeta}>
                  <span style={styles.memoryTime}>{formatTime(memory.createdAt)}</span>
                  {memory.tags && (
                    <span style={styles.memoryTag}>{memory.tags.split(',')[0]}</span>
                  )}
                  {memory.source !== 'manual' && (
                    <span style={styles.memorySource}>{memory.source}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
          );
        })}

        {/* Decision Log */}
        {decisions.length > 0 && (() => {
          const collapsed = collapsedSections.has('decisions');
          return (
          <div style={styles.section}>
            <div
              style={{
                ...styles.sectionHeader,
                cursor: 'pointer',
                background: collapsed ? 'transparent' : 'var(--md-surface-container-low)',
                borderRadius: 6,
                margin: collapsed ? 0 : '0 4px',
                padding: collapsed ? '0 12px 6px' : '4px 8px 6px',
                opacity: collapsed ? 0.7 : 1,
              }}
              onClick={() => toggleSection('decisions')}
              role="button"
              tabIndex={0}
              onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleSection('decisions'); } }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 14, color: 'var(--md-secondary)' }}>
                gavel
              </span>
              <span style={styles.sectionTitle}>Decision Log</span>
              <span style={styles.sectionCount}>{decisions.length}</span>
              <span
                className="material-symbols-outlined"
                style={{
                  fontSize: 14,
                  color: collapsed ? 'var(--md-outline)' : 'var(--md-secondary)',
                  transition: 'transform 0.15s, color 0.15s',
                  transform: collapsed ? 'rotate(-90deg)' : 'rotate(0deg)',
                }}
              >expand_more</span>
            </div>
            {!collapsed && decisions.map(d => (
              <div key={d.id} style={styles.decisionItem}>
                <div style={styles.decisionDot} />
                <div style={styles.decisionContent}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={styles.decisionTitle}>{d.title}</span>
                    {d.status && d.status !== 'accepted' && (
                      <span style={styles.decisionStatus}>{DECISION_STATUS_LABELS[d.status] ?? d.status}</span>
                    )}
                  </div>
                  <span style={styles.decisionReason}>{d.reason}</span>
                  {d.context && (
                    <span style={styles.decisionReason}>Context: {d.context.length > 80 ? d.context.slice(0, 80) + '...' : d.context}</span>
                  )}
                  <span style={styles.decisionTime}>{formatTime(d.createdAt)}</span>
                </div>
              </div>
            ))}
          </div>
          );
        })()}
      </div>

      {/* Action buttons */}
      <div style={styles.actions}>
        <button
          style={styles.actionBtn}
          onClick={() => setShowCreateModal(true)}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 14 }}>add</span>
          新建记忆
        </button>
        <button
          style={{ ...styles.actionBtn, ...styles.actionBtnSecondary }}
          onClick={() => setShowDecisionModal(true)}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 14 }}>gavel</span>
          记录决策
        </button>
        <button
          style={{ ...styles.actionBtn, ...styles.actionBtnAccent }}
          onClick={() => setShowBuildContextModal(true)}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 14 }}>inventory_2</span>
          构建上下文
        </button>
      </div>

      {/* Create Memory Modal */}
      <CreateMemoryModal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        sessionId={sessionId}
      />

      {/* Create Decision Modal */}
      <CreateDecisionModal
        open={showDecisionModal}
        onClose={() => setShowDecisionModal(false)}
        sessionId={sessionId}
      />

      {/* Build Context Modal */}
      <BuildContextModal
        open={showBuildContextModal}
        onClose={() => setShowBuildContextModal(false)}
      />
    </div>
  );
}

// ── Create Memory Modal ──

function CreateMemoryModal({ open, onClose, sessionId }: {
  open: boolean;
  onClose: () => void;
  sessionId: string | null;
}) {
  const queryClient = useQueryClient();
  const [memoryType, setMemoryType] = useState<MemoryType>('session');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [tags, setTags] = useState('');

  const createMutation = useMutation({
    mutationFn: (data: CreateMemoryInput) => memoryApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['memories'] });
      message.success('记忆已创建');
      setTitle('');
      setContent('');
      setTags('');
      onClose();
    },
  });

  const handleCreate = useCallback(() => {
    if (!title.trim() || !content.trim()) {
      message.warning('请填写标题和内容');
      return;
    }
    createMutation.mutate({
      memoryType,
      title: title.trim(),
      content: content.trim(),
      tags: tags.trim() || undefined,
      source: 'manual',
      sessionId: sessionId ?? undefined,
    });
  }, [memoryType, title, content, tags, sessionId, createMutation]);

  return (
    <Modal
      title="新建记忆"
      open={open}
      onOk={handleCreate}
      onCancel={onClose}
      okText="创建"
      cancelText="取消"
      width={480}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 16 }}>
        <div>
          <label style={styles.modalLabel}>类型</label>
          <Select
            value={memoryType}
            onChange={setMemoryType}
            style={{ width: '100%' }}
            options={Object.entries(MEMORY_TYPE_LABELS).map(([k, v]) => ({ value: k, label: v }))}
          />
        </div>
        <div>
          <label style={styles.modalLabel}>标题</label>
          <Input
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="简短描述"
            onPressEnter={handleCreate}
          />
        </div>
        <div>
          <label style={styles.modalLabel}>内容</label>
          <Input.TextArea
            value={content}
            onChange={e => setContent(e.target.value)}
            placeholder="详细描述、代码片段、解决方案..."
            rows={4}
          />
        </div>
        <div>
          <label style={styles.modalLabel}>标签（可选）</label>
          <Input
            value={tags}
            onChange={e => setTags(e.target.value)}
            placeholder="frontend, tauri, bug-fix"
          />
        </div>
      </div>
    </Modal>
  );
}

// ── Create Decision Modal (ADR) ──

function CreateDecisionModal({ open, onClose, sessionId }: {
  open: boolean;
  onClose: () => void;
  sessionId: string | null;
}) {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState('');
  const [reason, setReason] = useState('');
  const [alternatives, setAlternatives] = useState('');
  const [context, setContext] = useState('');
  const [options, setOptions] = useState('');
  const [consequences, setConsequences] = useState('');
  const [status, setStatus] = useState<'proposed' | 'accepted' | 'deprecated' | 'superseded'>('accepted');

  const createMutation = useMutation({
    mutationFn: (data: CreateDecisionInput) => decisionsApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['decisions'] });
      message.success('决策已记录');
      setTitle('');
      setReason('');
      setAlternatives('');
      setContext('');
      setOptions('');
      setConsequences('');
      setStatus('accepted');
      onClose();
    },
  });

  const handleCreate = useCallback(() => {
    if (!title.trim() || !reason.trim()) {
      message.warning('请填写决策标题和原因');
      return;
    }
    createMutation.mutate({
      title: title.trim(),
      reason: reason.trim(),
      alternatives: alternatives.trim() || undefined,
      context: context.trim() || undefined,
      options: options.trim() || undefined,
      consequences: consequences.trim() || undefined,
      status,
      sessionId: sessionId ?? undefined,
    });
  }, [title, reason, alternatives, context, options, consequences, status, sessionId, createMutation]);

  return (
    <Modal
      title="记录决策 (ADR)"
      open={open}
      onOk={handleCreate}
      onCancel={onClose}
      okText="记录"
      cancelText="取消"
      width={520}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 16 }}>
        <div>
          <label style={styles.modalLabel}>状态</label>
          <Select
            value={status}
            onChange={setStatus}
            style={{ width: '100%' }}
            options={Object.entries(DECISION_STATUS_LABELS).map(([k, v]) => ({ value: k, label: v }))}
          />
        </div>
        <div>
          <label style={styles.modalLabel}>决策</label>
          <Input
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="做了什么决策"
            onPressEnter={handleCreate}
          />
        </div>
        <div>
          <label style={styles.modalLabel}>上下文 (Context)</label>
          <Input.TextArea
            value={context}
            onChange={e => setContext(e.target.value)}
            placeholder="为什么需要做这个决策？背景是什么？"
            rows={2}
          />
        </div>
        <div>
          <label style={styles.modalLabel}>原因 (Decision)</label>
          <Input.TextArea
            value={reason}
            onChange={e => setReason(e.target.value)}
            placeholder="为什么选择这个方案"
            rows={2}
          />
        </div>
        <div>
          <label style={styles.modalLabel}>备选方案 (Options)</label>
          <Input
            value={options}
            onChange={e => setOptions(e.target.value)}
            placeholder="考虑过但否决的方案（每行一个）"
          />
        </div>
        <div>
          <label style={styles.modalLabel}>替代方案 (Alternatives)</label>
          <Input
            value={alternatives}
            onChange={e => setAlternatives(e.target.value)}
            placeholder="被否决的替代方案"
          />
        </div>
        <div>
          <label style={styles.modalLabel}>后果 (Consequences)</label>
          <Input.TextArea
            value={consequences}
            onChange={e => setConsequences(e.target.value)}
            placeholder="这个决策带来的影响和后果"
            rows={2}
          />
        </div>
      </div>
    </Modal>
  );
}

// ── Build Context Modal ──

function BuildContextModal({ open, onClose }: {
  open: boolean;
  onClose: () => void;
}) {
  const [packedContext, setPackedContext] = useState('');
  const [counts, setCounts] = useState({ memoryCount: 0, decisionCount: 0 });
  const [loading, setLoading] = useState(false);

  const handleBuild = useCallback(async () => {
    setLoading(true);
    try {
      const result = await memoryApi.buildContext('default');
      setPackedContext(result.packedContext);
      setCounts({ memoryCount: result.memoryCount, decisionCount: result.decisionCount });
    } catch {
      message.error('构建上下文失败');
    } finally {
      setLoading(false);
    }
  }, []);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(packedContext).then(() => {
      message.success('已复制到剪贴板');
    });
  }, [packedContext]);

  // Auto-build on open
  useEffect(() => {
    if (open) handleBuild();
  }, [open, handleBuild]);

  return (
    <Modal
      title="Agent Memory Pack"
      open={open}
      onCancel={onClose}
      footer={[
        <button key="copy" style={styles.modalCopyBtn} onClick={handleCopy} disabled={!packedContext}>
          <span className="material-symbols-outlined" style={{ fontSize: 14 }}>content_copy</span>
          复制上下文
        </button>,
        <button key="close" style={styles.modalCloseBtn} onClick={onClose}>
          关闭
        </button>,
      ]}
      width={640}
    >
      <div style={{ marginTop: 12 }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 24, color: 'var(--md-outline)' }}>
            构建中...
          </div>
        ) : packedContext ? (
          <>
            <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
              <span style={styles.contextStat}>记忆: {counts.memoryCount}</span>
              <span style={styles.contextStat}>决策: {counts.decisionCount}</span>
            </div>
            <pre style={styles.contextPreview}>{packedContext}</pre>
          </>
        ) : (
          <div style={{ textAlign: 'center', padding: 24, color: 'var(--md-outline)' }}>
            暂无可用上下文
          </div>
        )}
      </div>
    </Modal>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    overflow: 'hidden',
  },
  searchBox: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '8px 12px',
    borderBottom: '1px solid var(--border)',
    flexShrink: 0,
  },
  searchInput: {
    flex: 1,
    border: 'none',
    outline: 'none',
    background: 'transparent',
    fontSize: 12,
    color: 'var(--md-on-surface)',
    fontFamily: 'var(--font-sans)',
  },
  scrollArea: {
    flex: 1,
    overflowY: 'auto',
    overflowX: 'hidden',
  },
  section: {
    padding: '8px 0',
    borderBottom: '1px solid var(--border)',
  },
  sectionHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '0 12px 6px',
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: 600,
    color: 'var(--md-on-surface-variant)',
    fontFamily: 'var(--font-label)',
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
    flex: 1,
  },
  sectionCount: {
    fontSize: 10,
    color: 'var(--md-outline)',
    background: 'var(--md-surface-container-low)',
    padding: '1px 6px',
    borderRadius: 8,
  },
  memoryCard: {
    padding: '6px 12px',
    cursor: 'default',
    transition: 'background 0.15s',
    borderRadius: 4,
  },
  memoryHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
  },
  memoryTitle: {
    fontSize: 12,
    fontWeight: 500,
    color: 'var(--md-on-surface)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    flex: 1,
  },
  memoryContent: {
    fontSize: 11,
    color: 'var(--md-on-surface-variant)',
    margin: '2px 0 0',
    lineHeight: '16px',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    display: '-webkit-box',
    WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical',
  } as React.CSSProperties,
  memoryMeta: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  memoryTime: {
    fontSize: 10,
    color: 'var(--md-outline)',
  },
  memoryTag: {
    fontSize: 10,
    color: 'var(--md-primary)',
    background: 'var(--color-primary-light)',
    padding: '1px 5px',
    borderRadius: 3,
  },
  memorySource: {
    fontSize: 9,
    color: 'var(--md-outline)',
    background: 'var(--md-surface-container-low)',
    padding: '1px 4px',
    borderRadius: 3,
  },
  decisionItem: {
    display: 'flex',
    gap: 8,
    padding: '6px 12px',
  },
  decisionDot: {
    width: 6,
    height: 6,
    borderRadius: '50%',
    background: 'var(--md-secondary)',
    flexShrink: 0,
    marginTop: 5,
  },
  decisionContent: {
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
    minWidth: 0,
  },
  decisionTitle: {
    fontSize: 12,
    fontWeight: 500,
    color: 'var(--md-on-surface)',
  },
  decisionReason: {
    fontSize: 11,
    color: 'var(--md-on-surface-variant)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  decisionTime: {
    fontSize: 10,
    color: 'var(--md-outline)',
  },
  decisionStatus: {
    fontSize: 9,
    color: 'var(--md-secondary)',
    background: 'var(--md-surface-container-low)',
    padding: '1px 4px',
    borderRadius: 3,
    flexShrink: 0,
  },
  actions: {
    display: 'flex',
    gap: 6,
    padding: '8px 12px',
    borderTop: '1px solid var(--border)',
    flexShrink: 0,
  },
  actionBtn: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    height: 30,
    fontSize: 12,
    fontWeight: 500,
    color: 'var(--md-on-primary)',
    background: 'var(--md-primary)',
    border: 'none',
    borderRadius: 6,
    cursor: 'pointer',
    fontFamily: 'var(--font-sans)',
  },
  actionBtnSecondary: {
    background: 'var(--md-surface-container-low)',
    color: 'var(--md-on-surface)',
    border: '1px solid var(--border)',
  },
  actionBtnAccent: {
    background: 'var(--md-tertiary)',
    color: 'var(--md-on-tertiary)',
    border: 'none',
  },
  empty: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '32px 16px',
    gap: 6,
  },
  emptyText: {
    margin: 0,
    fontSize: 12,
    color: 'var(--md-on-surface-variant)',
  },
  emptyHint: {
    margin: 0,
    fontSize: 11,
    color: 'var(--md-outline)',
  },
  modalLabel: {
    display: 'block',
    fontSize: 12,
    fontWeight: 500,
    color: 'var(--md-on-surface)',
    marginBottom: 4,
  },
  contextStat: {
    fontSize: 11,
    color: 'var(--md-on-surface-variant)',
    background: 'var(--md-surface-container-low)',
    padding: '2px 8px',
    borderRadius: 4,
  },
  contextPreview: {
    fontSize: 11,
    fontFamily: 'var(--font-mono)',
    color: 'var(--md-on-surface)',
    background: 'var(--md-surface-container-low)',
    padding: 12,
    borderRadius: 8,
    border: '1px solid var(--border)',
    overflow: 'auto',
    maxHeight: 400,
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
    margin: 0,
  },
  modalCopyBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    height: 32,
    padding: '0 16px',
    fontSize: 13,
    fontWeight: 500,
    color: 'var(--md-on-primary)',
    background: 'var(--md-primary)',
    border: 'none',
    borderRadius: 6,
    cursor: 'pointer',
    fontFamily: 'var(--font-sans)',
  },
  modalCloseBtn: {
    height: 32,
    padding: '0 16px',
    fontSize: 13,
    fontWeight: 500,
    color: 'var(--md-on-surface)',
    background: 'var(--md-surface-container-low)',
    border: '1px solid var(--border)',
    borderRadius: 6,
    cursor: 'pointer',
    fontFamily: 'var(--font-sans)',
  },
};
