import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button, message } from 'antd';
import { knowledgeApi } from '../../api';
import { queryKeys } from '../../api/queryKeys';
import { useKnowledgeStore } from '../../stores/knowledgeStore';
import KnowledgeSidebar from './components/KnowledgeSidebar';
import KnowledgeContent from './components/KnowledgeContent';
import KnowledgeAI from './components/KnowledgeAI';
import type { KnowledgeItem } from '../../types';

export default function KnowledgeBasePage() {
  const queryClient = useQueryClient();
  const selectedId = useKnowledgeStore(s => s.selectedId);
  const selectedCategory = useKnowledgeStore(s => s.selectedCategory);
  const searchQuery = useKnowledgeStore(s => s.searchQuery);

  // Fetch all items (sidebar handles category grouping via counts)
  const pinnedOnly = selectedCategory === '_pinned';
  const categoryParam = pinnedOnly ? undefined : selectedCategory ?? undefined;

  const { data: allItems = [], isLoading } = useQuery({
    queryKey: queryKeys.knowledge.list(categoryParam),
    queryFn: () => knowledgeApi.list(categoryParam),
    staleTime: 10_000,
  });

  const seedMutation = useMutation({
    mutationFn: () => knowledgeApi.seed(),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['knowledge'] });
      message.success(`已插入 ${result.inserted} 条演示数据`);
    },
    onError: () => message.error('插入失败'),
  });

  // Apply client-side filtering for pinned/search
  let filteredItems = allItems;
  if (pinnedOnly) {
    filteredItems = filteredItems.filter((i: KnowledgeItem) => i.isPinned);
  }
  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    filteredItems = filteredItems.filter((i: KnowledgeItem) =>
      i.title.toLowerCase().includes(q) || i.content.toLowerCase().includes(q)
    );
  }

  const selectedItem = selectedId ? filteredItems.find((i: KnowledgeItem) => i.id === selectedId) ?? null : null;
  const isEmpty = !isLoading && allItems.length === 0;

  return (
    <div style={styles.page}>
      <KnowledgeSidebar />
      <KnowledgeContent />
      <KnowledgeAI item={selectedItem} allItems={filteredItems} />

      {/* Seed overlay — shown when list is empty */}
      {isEmpty && (
        <div style={styles.emptyOverlay}>
          <span className="material-symbols-outlined" style={{ fontSize: 48, color: 'var(--md-outline-variant)', opacity: 0.4 }}>
            menu_book
          </span>
          <p style={{ margin: 0, fontSize: 15, color: 'var(--color-text-secondary)', fontWeight: 500 }}>
            知识库暂无数据
          </p>
          <Button
            type="primary"
            icon={<span className="material-symbols-outlined" style={{ fontSize: 16 }}>
              {seedMutation.isPending ? 'hourglass_top' : 'science'}
            </span>}
            loading={seedMutation.isPending}
            onClick={() => seedMutation.mutate()}
            style={{ fontFamily: 'var(--font-sans)' }}
          >
            {seedMutation.isPending ? '插入中...' : '加载演示数据'}
          </Button>
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    display: 'flex',
    flex: 1,
    height: '100%',
    overflow: 'hidden',
    position: 'relative',
  },
  emptyOverlay: {
    position: 'absolute',
    inset: 0,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    background: 'var(--md-surface)',
    zIndex: 10,
  },
};
