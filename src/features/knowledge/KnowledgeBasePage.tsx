import { useQuery } from '@tanstack/react-query';
import { knowledgeApi } from '../../api';
import { queryKeys } from '../../api/queryKeys';
import { useKnowledgeStore } from '../../stores/knowledgeStore';
import KnowledgeSidebar from './components/KnowledgeSidebar';
import KnowledgeContent from './components/KnowledgeContent';
import KnowledgeAI from './components/KnowledgeAI';
import type { KnowledgeItem } from '../../types';

export default function KnowledgeBasePage() {
  const selectedId = useKnowledgeStore(s => s.selectedId);
  const selectedCategory = useKnowledgeStore(s => s.selectedCategory);
  const searchQuery = useKnowledgeStore(s => s.searchQuery);

  // Fetch all items (sidebar handles category grouping via counts)
  const pinnedOnly = selectedCategory === '_pinned';
  const categoryParam = pinnedOnly ? undefined : selectedCategory ?? undefined;

  const { data: allItems = [] } = useQuery({
    queryKey: queryKeys.knowledge.list(categoryParam),
    queryFn: () => knowledgeApi.list(categoryParam),
    staleTime: 10_000,
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

  return (
    <div style={styles.page}>
      <KnowledgeSidebar />
      <KnowledgeContent />
      <KnowledgeAI item={selectedItem} allItems={filteredItems} />
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    display: 'flex',
    flex: 1,
    height: '100%',
    overflow: 'hidden',
  },
};
