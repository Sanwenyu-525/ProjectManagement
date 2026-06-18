import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '../api/queryKeys';
import { timelineApi } from '../api';

export function useTimeline(params?: { limit?: number; offset?: number }) {
  return useQuery({
    queryKey: queryKeys.timeline.all(params),
    queryFn: () => timelineApi.list(params),
  });
}

export function useProjectTimeline(projectId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.timeline.project(projectId!),
    queryFn: () => timelineApi.byProject(projectId!),
    enabled: !!projectId,
  });
}
