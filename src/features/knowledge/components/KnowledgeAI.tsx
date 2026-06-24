import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button, Input, message } from 'antd';
import { knowledgeApi, memoryApi } from '../../../api';
import { queryKeys } from '../../../api/queryKeys';
import { useKnowledgeStore } from '../../../stores/knowledgeStore';
import type { KnowledgeItem, ContextItem } from '../../../types';

// ── Helpers ──

const SOURCE_ICONS: Record<string, string> = {
  memory: 'smart_toy',
  decision: 'gavel',
  document: 'description',
  note: 'edit_note',
};

// ── Component ──

interface KnowledgeAIProps {
  item: KnowledgeItem | null;
  allItems: KnowledgeItem[];
}

export default function KnowledgeAI({ item, allItems }: KnowledgeAIProps) {
  const setSelectedId = useKnowledgeStore(s => s.setSelectedId);
  const setSelectedCategory = useKnowledgeStore(s => s.setSelectedCategory);

  const queryClient = useQueryClient();
  const [extractText, setExtractText] = useState('');

  const extractMutation = useMutation({
    mutationFn: () => knowledgeApi.extract(extractText, 'knowledge-page'),
    onSuccess: (result) => {
      if (result.length > 0) {
        queryClient.invalidateQueries({ queryKey: ['knowledge'] });
        message.success(`已提炼 ${result.length} 条经验`);
        setExtractText('');
      } else {
        message.info('内容未提炼出经验');
      }
    },
    onError: () => message.error('AI 提炼失败'),
  });

  // Fetch related recommendations
  const { data: recommendations = [] } = useQuery({
    queryKey: queryKeys.memories.context(item?.content ?? ''),
    queryFn: () => item ? memoryApi.contextRetrieve(item.content, undefined, 3) : Promise.resolve([]),
    enabled: !!item?.content,
    staleTime: 30_000,
  });

  const handleRecommendClick = (ctxItem: ContextItem) => {
    // Find the matching KnowledgeItem by id
    const match = allItems.find(ki => ki.id === ctxItem.id);
    if (match) {
      setSelectedCategory(match.category);
      setSelectedId(match.id);
    }
  };

  return (
    <div style={styles.panel}>
      <div style={styles.scrollArea}>
        {/* AI Summary */}
        <div style={styles.section}>
          <div style={styles.sectionHeader}>
            <span className="material-symbols-outlined" style={{ fontSize: 16, color: 'var(--color-secondary)' }}>
              auto_awesome
            </span>
            <span style={styles.sectionTitle}>AI 摘要</span>
          </div>
          {item ? (
            <div style={styles.summaryContent}>
              <p style={styles.summaryText}>
                {item.content.length > 300
                  ? item.content.slice(0, 300) + '...'
                  : item.content}
              </p>
              <span style={styles.generatedLabel}>由知识库生成</span>
            </div>
          ) : (
            <p style={styles.placeholderText}>选择一项知识以查看摘要</p>
          )}
        </div>

        <div style={styles.divider} />

        {/* Related Recommendations */}
        <div style={styles.section}>
          <div style={styles.sectionHeader}>
            <span className="material-symbols-outlined" style={{ fontSize: 16, color: 'var(--color-info)' }}>
              link
            </span>
            <span style={styles.sectionTitle}>相关推荐</span>
          </div>
          {recommendations.length > 0 ? (
            <div style={styles.recList}>
              {recommendations.map(rec => (
                <div
                  key={rec.id}
                  style={styles.recCard}
                  onClick={() => handleRecommendClick(rec)}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 18, color: 'var(--md-outline)', flexShrink: 0 }}>
                    {SOURCE_ICONS[rec.source] ?? 'article'}
                  </span>
                  <div style={styles.recContent}>
                    <span style={styles.recTitle}>{rec.title}</span>
                    <span style={styles.recPreview}>
                      {rec.content.length > 60 ? rec.content.slice(0, 60) + '...' : rec.content}
                    </span>
                  </div>
                  <span style={styles.recScore}>{Math.round(rec.score * 100)}%</span>
                </div>
              ))}
            </div>
          ) : (
            <p style={styles.placeholderText}>
              {item ? '暂无相关推荐' : '选择一项知识以查看推荐'}
            </p>
          )}
        </div>

        <div style={styles.divider} />

        {/* AI Extract */}
        <div style={styles.section}>
          <div style={styles.sectionHeader}>
            <span className="material-symbols-outlined" style={{ fontSize: 16, color: 'var(--md-primary)' }}>
              auto_fix_high
            </span>
            <span style={styles.sectionTitle}>AI 提炼</span>
          </div>
          <Input.TextArea
            value={extractText}
            onChange={e => setExtractText(e.target.value)}
            placeholder="粘贴内容，AI 自动提炼为经验条目..."
            rows={4}
            style={{ fontFamily: 'var(--font-sans)' }}
          />
          <Button
            type="primary"
            icon={<span className="material-symbols-outlined" style={{ fontSize: 15 }}>
              {extractMutation.isPending ? 'hourglass_top' : 'auto_fix_high'}
            </span>}
            loading={extractMutation.isPending}
            block
            onClick={() => { if (extractText.trim()) extractMutation.mutate(); }}
            style={{ marginTop: 8, transition: 'filter 0.15s, transform 0.1s' }}
            onMouseEnter={e => { e.currentTarget.style.filter = 'brightness(1.15)'; }}
            onMouseLeave={e => { e.currentTarget.style.filter = ''; }}
            onMouseDown={e => { e.currentTarget.style.transform = 'scale(0.98)'; }}
            onMouseUp={e => { e.currentTarget.style.transform = ''; }}
          >
            {extractMutation.isPending ? '提炼中...' : '提炼经验'}
          </Button>
        </div>

        <div style={styles.divider} />
        <div style={styles.section}>
          <div style={styles.sectionHeader}>
            <span className="material-symbols-outlined" style={{ fontSize: 16, color: 'var(--color-amber)' }}>
              help
            </span>
            <span style={styles.sectionTitle}>知识问答</span>
          </div>
          <Input
            placeholder="向知识库提问..."
            disabled
            style={{ marginTop: 8 }}
          />
          <div style={styles.qaPlaceholder}>
            <span className="material-symbols-outlined" style={{ fontSize: 24, color: 'var(--md-outline-variant)', opacity: 0.4 }}>
              construction
            </span>
            <p style={styles.qaText}>AI 问答功能即将上线</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Styles ──

const styles: Record<string, React.CSSProperties> = {
  panel: {
    width: 320,
    flexShrink: 0,
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    borderLeft: '1px solid var(--color-border)',
    background: 'var(--color-bg-surface)',
  },
  scrollArea: {
    flex: 1,
    overflowY: 'auto',
    padding: 16,
  },
  section: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  sectionHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: 600,
    color: 'var(--color-text-primary)',
  },
  divider: {
    height: 1,
    background: 'var(--color-divider)',
    margin: '12px 0',
  },
  summaryContent: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  summaryText: {
    margin: 0,
    fontSize: 12,
    lineHeight: 1.6,
    color: 'var(--color-text-secondary)',
  },
  generatedLabel: {
    fontSize: 10,
    color: 'var(--color-text-tertiary)',
    fontStyle: 'italic',
  },
  placeholderText: {
    margin: 0,
    fontSize: 12,
    color: 'var(--color-text-tertiary)',
  },
  recList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  recCard: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 8,
    padding: '8px 10px',
    borderRadius: 'var(--radius-sm)',
    cursor: 'pointer',
    transition: 'background 0.15s',
    border: '1px solid var(--color-border-subtle)',
  },
  recContent: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
    minWidth: 0,
  },
  recTitle: {
    fontSize: 12,
    fontWeight: 500,
    color: 'var(--color-text-primary)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  recPreview: {
    fontSize: 11,
    color: 'var(--color-text-tertiary)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  recScore: {
    fontSize: 10,
    color: 'var(--color-text-tertiary)',
    fontFamily: 'var(--font-label)',
    flexShrink: 0,
  },
  qaPlaceholder: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 4,
    padding: '16px 0',
  },
  qaText: {
    margin: 0,
    fontSize: 12,
    color: 'var(--color-text-tertiary)',
  },
};
