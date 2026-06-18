import { useQuery } from '@tanstack/react-query';
import { searchApi } from '../api';
import { queryKeys } from '../api/queryKeys';

export function useSearch(query: string) {
  return useQuery({
    queryKey: queryKeys.search.results(query),
    queryFn: () => searchApi.search(query),
    enabled: !!query && query.length >= 2,
    staleTime: 10_000,
  });
}
