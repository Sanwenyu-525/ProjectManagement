import { useState, useRef, useEffect, useCallback } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useQuery } from '@tanstack/react-query';
import { knowledgeApi } from '../../../api';
import { queryKeys } from '../../../api/queryKeys';
import type { KnowledgeContextItem, KnowledgeQueryResult } from '../../../api/knowledge';

// ── Constants ──

const SOURCE_LABELS: Record<string, string> = {
  memory: '记忆',
  decision: '决策',
  document: '文档',
  note: '笔记',
};

const SOURCE_ICONS: Record<string, string> = {
  memory: 'smart_toy',
  decision: 'gavel',
  document: 'description',
  note: 'edit_note',
};

// ── Types ──

interface QAMessage {
  role: 'user' | 'assistant';
  content: string;
  sources?: KnowledgeQueryResult['sources'];
}

// ── Component ──

export default function AgentKnowledgePanel() {
  const queryClient = useQueryClient();

  // ── Search state ──
  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<KnowledgeContextItem[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);

  // ── Q&A state ──
  const [question, setQuestion] = useState('');
  const [qaHistory, setQaHistory] = useState<QAMessage[]>([]);
  const qaEndRef = useRef<HTMLDivElement>(null);

  // ── Extract state ──
  const [extractText, setExtractText] = useState('');
  const [extractResult, setExtractResult] = useState<string | null>(null);

  useEffect(() => {
    qaEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [qaHistory]);

  // ── Overview stats ──
  const { data: counts = [] } = useQuery({
    queryKey: queryKeys.knowledge.counts(),
    queryFn: () => knowledgeApi.counts(),
    staleTime: 30_000,
  });

  const totalCount = counts.reduce((sum, c) => sum + c.count, 0);

  // ── Search handler ──
  const handleSearch = useCallback(async () => {
    const q = searchInput.trim();
    if (!q) return;
    setSearchQuery(q);
    setSearchLoading(true);
    try {
      const results = await knowledgeApi.searchContext(q, undefined, 10);
      setSearchResults(results);
    } catch {
      setSearchResults([]);
    } finally {
      setSearchLoading(false);
    }
  }, [searchInput]);

  const handleSendToAgent = useCallback((item: KnowledgeContextItem) => {
    const text = `[知识库检索 "${searchQuery}"]\n[${item.title}] (${item.category}): ${item.contentSnippet}\n---\n请基于以上知识库内容分析 ${item.title}`;
    window.dispatchEvent(new CustomEvent('agentQuickCommand', { detail: text }));
  }, [searchQuery]);

  // ── Q&A mutation ──
  const queryMutation = useMutation({
    mutationFn: (q: string) => knowledgeApi.query(q),
    onSuccess: (result) => {
      setQaHistory(prev => [
        ...prev,
        { role: 'assistant', content: result.answer, sources: result.sources },
      ]);
    },
    onError: (err) => {
      setQaHistory(prev => [
        ...prev,
        { role: 'assistant', content: `查询失败: ${String(err)}` },
      ]);
    },
  });

  const handleQuery = useCallback(() => {
    const q = question.trim();
    if (!q || queryMutation.isPending) return;
    setQaHistory(prev => [...prev, { role: 'user', content: q }]);
    setQuestion('');
    queryMutation.mutate(q);
  }, [question, queryMutation]);

  // ── Extract mutation ──
  const extractMutation = useMutation({
    mutationFn: () => knowledgeApi.extract(extractText, 'agent-panel'),
    onSuccess: (result) => {
      if (result.length > 0) {
        queryClient.invalidateQueries({ queryKey: ['knowledge'] });
        setExtractResult(`已提炼 ${result.length} 条经验`);
        setExtractText('');
      } else {
        setExtractResult('内容未提炼出经验');
      }
    },
    onError: () => {
      setExtractResult('AI 提炼失败');
    },
  });

  return (
    <div style={styles.container}>
      {/* Section 1: Overview */}
      <div style={styles.section}>
        <div style={styles.sectionHeader}>
          <span className="material-symbols-outlined" style={{ fontSize: 13, color: 'var(--md-primary)' }}>
            menu_book
          </span>
          <span style={styles.sectionLabel}>知识库概览</span>
          <span style={styles.count}>{totalCount}</span>
        </div>

        <div style={styles.statsRow}>
          {counts.map(c => (
            <div key={c.category} style={styles.statChip}>
              <span className="material-symbols-outlined" style={{ fontSize: 12, color: 'var(--md-primary)' }}>
                {SOURCE_ICONS[c.category] ?? 'article'}
              </span>
              <span style={styles.statLabel}>{SOURCE_LABELS[c.category] ?? c.category}</span>
              <span style={styles.statValue}>{c.count}</span>
            </div>
          ))}
          {counts.length === 0 && (
            <span style={styles.emptyHint}>暂无数据</span>
          )}
        </div>
      </div>

      {/* Section 2: Search */}
      <div style={styles.section}>
        <div style={styles.sectionHeader}>
          <span className="material-symbols-outlined" style={{ fontSize: 13, color: 'var(--md-secondary)' }}>
            search
          </span>
          <span style={styles.sectionLabel}>知识搜索</span>
        </div>

        <div style={styles.inputRow}>
          <span className="material-symbols-outlined" style={{ fontSize: 13, color: 'var(--md-outline)' }}>
            search
          </span>
          <input
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleSearch(); }}
            placeholder="搜索知识库..."
            style={styles.input}
          />
          {searchInput && (
            <span
              className="material-symbols-outlined"
              role="button"
              tabIndex={0}
              onClick={() => { setSearchInput(''); setSearchResults([]); setSearchQuery(''); }}
              style={{ fontSize: 14, color: 'var(--md-outline)', cursor: 'pointer', padding: 2 }}
            >close</span>
          )}
        </div>

        {searchLoading && (
          <div style={styles.loadingText}>搜索中...</div>
        )}

        {searchResults.length > 0 && (
          <div style={styles.resultList}>
            {searchResults.map(item => (
              <div key={item.id} style={styles.resultCard}>
                <div style={styles.resultHeader}>
                  <span className="material-symbols-outlined" style={{ fontSize: 13, color: 'var(--md-primary)', flexShrink: 0 }}>
                    {SOURCE_ICONS[item.category] ?? 'article'}
                  </span>
                  <span style={styles.resultTitle}>{item.title}</span>
                  <span style={styles.resultCategory}>{SOURCE_LABELS[item.category] ?? item.category}</span>
                </div>
                <p style={styles.resultSnippet}>{item.contentSnippet}</p>
                <button
                  onClick={() => handleSendToAgent(item)}
                  style={styles.sendBtn}
                  title="发送到 Agent"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 12 }}>send</span>
                  发送到 Agent
                </button>
              </div>
            ))}
          </div>
        )}

        {searchQuery && !searchLoading && searchResults.length === 0 && (
          <div style={styles.emptySmall}>未找到匹配结果</div>
        )}
      </div>

      {/* Section 3: Q&A */}
      <div style={styles.section}>
        <div style={styles.sectionHeader}>
          <span className="material-symbols-outlined" style={{ fontSize: 13, color: 'var(--md-tertiary)' }}>
            question_answer
          </span>
          <span style={styles.sectionLabel}>知识问答</span>
        </div>

        {qaHistory.length > 0 && (
          <div style={styles.qaConversation}>
            {qaHistory.map((msg, i) => (
              <div key={i} style={msg.role === 'user' ? styles.qaUserMsg : styles.qaAssistantMsg}>
                <span style={styles.qaRoleLabel}>
                  {msg.role === 'user' ? '你' : 'AI'}
                </span>
                <p style={styles.qaMsgText}>{msg.content}</p>
                {msg.sources && msg.sources.length > 0 && (
                  <div style={styles.qaSources}>
                    {msg.sources.map(src => (
                      <span key={src.id} style={styles.qaSourceChip}>
                        <span className="material-symbols-outlined" style={{ fontSize: 10, color: 'var(--md-primary)' }}>
                          {SOURCE_ICONS[src.category] ?? 'article'}
                        </span>
                        {src.title}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
            <div ref={qaEndRef} />
          </div>
        )}

        <div style={styles.inputRow}>
          <span className="material-symbols-outlined" style={{ fontSize: 13, color: 'var(--md-outline)' }}>
            help
          </span>
          <input
            value={question}
            onChange={e => setQuestion(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleQuery(); }}
            placeholder="向知识库提问..."
            disabled={queryMutation.isPending}
            style={styles.input}
          />
          <button
            onClick={handleQuery}
            disabled={!question.trim() || queryMutation.isPending}
            style={styles.goBtn}
            title="提问"
          >
            <span className="material-symbols-outlined" style={{ fontSize: 13 }}>
              {queryMutation.isPending ? 'hourglass_top' : 'send'}
            </span>
          </button>
        </div>
      </div>

      {/* Section 4: AI Extract */}
      <div style={styles.section}>
        <div style={styles.sectionHeader}>
          <span className="material-symbols-outlined" style={{ fontSize: 13, color: 'var(--md-error)' }}>
            auto_fix_high
          </span>
          <span style={styles.sectionLabel}>AI 提炼</span>
        </div>

        <textarea
          value={extractText}
          onChange={e => setExtractText(e.target.value)}
          placeholder="粘贴内容，AI 自动提炼为经验条目..."
          rows={3}
          style={styles.textarea}
        />

        <button
          onClick={() => { if (extractText.trim()) extractMutation.mutate(); }}
          disabled={!extractText.trim() || extractMutation.isPending}
          style={styles.extractBtn}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 13 }}>
            {extractMutation.isPending ? 'hourglass_top' : 'auto_fix_high'}
          </span>
          {extractMutation.isPending ? '提炼中...' : '提炼经验'}
        </button>

        {extractResult && (
          <div style={styles.extractResult}>{extractResult}</div>
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
    overflowY: 'auto',
  },
  section: {
    padding: '8px 12px',
    borderBottom: '1px solid var(--border)',
  },
  sectionHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 5,
    marginBottom: 8,
  },
  sectionLabel: {
    fontSize: 10,
    fontWeight: 700,
    color: 'var(--md-on-surface-variant)',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.04em',
    fontFamily: 'var(--font-sans)',
    flex: 1,
  },
  count: {
    fontSize: 10,
    color: 'var(--md-on-surface-variant)',
    fontFamily: 'var(--font-mono)',
  },
  // Overview stats
  statsRow: {
    display: 'flex',
    flexWrap: 'wrap' as const,
    gap: 4,
  },
  statChip: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    padding: '3px 8px',
    borderRadius: 6,
    background: 'var(--md-surface-container-low)',
    border: '1px solid var(--border)',
  },
  statLabel: {
    fontSize: 10,
    color: 'var(--md-on-surface-variant)',
    fontFamily: 'var(--font-sans)',
  },
  statValue: {
    fontSize: 10,
    fontWeight: 700,
    color: 'var(--md-on-surface)',
    fontFamily: 'var(--font-mono)',
  },
  emptyHint: {
    fontSize: 10,
    color: 'var(--md-outline)',
    fontFamily: 'var(--font-sans)',
  },
  // Input row
  inputRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '4px 8px',
    borderRadius: 6,
    border: '1px solid var(--border)',
    background: 'var(--md-surface-container-low)',
  },
  input: {
    flex: 1,
    border: 'none',
    background: 'transparent',
    outline: 'none',
    fontSize: 11,
    fontFamily: 'var(--font-sans)',
    color: 'var(--md-on-surface)',
    padding: '2px 0',
  },
  goBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 24,
    height: 24,
    borderRadius: 4,
    border: 'none',
    background: 'var(--md-primary)',
    color: 'var(--md-on-primary)',
    cursor: 'pointer',
    flexShrink: 0,
  },
  // Search results
  resultList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    marginTop: 8,
  },
  resultCard: {
    padding: '6px 8px',
    borderRadius: 6,
    border: '1px solid var(--border)',
    background: 'var(--md-surface-container-low)',
  },
  resultHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 5,
  },
  resultTitle: {
    fontSize: 11,
    fontWeight: 500,
    color: 'var(--md-on-surface)',
    flex: 1,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    fontFamily: 'var(--font-sans)',
  },
  resultCategory: {
    fontSize: 9,
    color: 'var(--md-on-surface-variant)',
    fontFamily: 'var(--font-sans)',
    flexShrink: 0,
  },
  resultSnippet: {
    margin: '4px 0 0',
    fontSize: 10,
    color: 'var(--md-on-surface-variant)',
    lineHeight: '15px',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    display: '-webkit-box',
    WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical',
  } as React.CSSProperties,
  sendBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 3,
    marginTop: 4,
    padding: '2px 6px',
    fontSize: 10,
    fontWeight: 500,
    color: 'var(--md-primary)',
    background: 'transparent',
    border: '1px solid var(--md-primary)',
    borderRadius: 4,
    cursor: 'pointer',
    fontFamily: 'var(--font-sans)',
  },
  loadingText: {
    fontSize: 10,
    color: 'var(--md-outline)',
    padding: '6px 0',
    fontFamily: 'var(--font-sans)',
  },
  emptySmall: {
    fontSize: 10,
    color: 'var(--md-outline)',
    padding: '6px 0',
    textAlign: 'center' as const,
    fontFamily: 'var(--font-sans)',
  },
  // Q&A
  qaConversation: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    maxHeight: 200,
    overflowY: 'auto',
    padding: '4px 0',
    marginBottom: 6,
  },
  qaUserMsg: {
    display: 'flex',
    flexDirection: 'column',
    gap: 3,
    padding: '6px 8px',
    borderRadius: 6,
    background: 'var(--md-surface-container)',
    border: '1px solid var(--border)',
  },
  qaAssistantMsg: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    padding: '6px 8px',
    borderRadius: 6,
    background: 'color-mix(in srgb, var(--md-primary) 6%, transparent)',
    border: '1px solid color-mix(in srgb, var(--md-primary) 15%, transparent)',
  },
  qaRoleLabel: {
    fontSize: 9,
    fontWeight: 700,
    color: 'var(--md-on-surface-variant)',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.05em',
    fontFamily: 'var(--font-label)',
  },
  qaMsgText: {
    margin: 0,
    fontSize: 11,
    lineHeight: '16px',
    color: 'var(--md-on-surface)',
    whiteSpace: 'pre-wrap',
  },
  qaSources: {
    display: 'flex',
    flexWrap: 'wrap' as const,
    gap: 4,
    marginTop: 4,
  },
  qaSourceChip: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 3,
    padding: '1px 5px',
    fontSize: 9,
    color: 'var(--md-primary)',
    background: 'var(--md-surface-container-low)',
    border: '1px solid var(--border)',
    borderRadius: 3,
    fontFamily: 'var(--font-sans)',
  },
  // AI Extract
  textarea: {
    width: '100%',
    padding: '6px 8px',
    borderRadius: 6,
    border: '1px solid var(--border)',
    background: 'var(--md-surface-container-low)',
    outline: 'none',
    fontSize: 11,
    fontFamily: 'var(--font-sans)',
    color: 'var(--md-on-surface)',
    resize: 'vertical' as const,
    lineHeight: '16px',
    minHeight: 56,
  },
  extractBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    width: '100%',
    height: 28,
    marginTop: 6,
    fontSize: 11,
    fontWeight: 600,
    color: 'var(--md-on-primary)',
    background: 'var(--md-primary)',
    border: 'none',
    borderRadius: 6,
    cursor: 'pointer',
    fontFamily: 'var(--font-sans)',
    transition: 'filter 0.15s',
  },
  extractResult: {
    fontSize: 10,
    color: 'var(--md-on-surface-variant)',
    padding: '4px 0',
    textAlign: 'center' as const,
    fontFamily: 'var(--font-sans)',
  },
};
