import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../api/queryKeys';
import { healthApi } from '../api';

export function useAllHealth() {
  return useQuery({
    queryKey: queryKeys.health.all,
    queryFn: () => healthApi.getAllLatest(),
    staleTime: 60_000,
  });
}

export function useProjectHealth(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.project.health(id!),
    queryFn: () => healthApi.getProjectHistory(id!),
    enabled: !!id,
  });
}

export function useRunAllHealth() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => healthApi.runAll(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.health.all });
    },
  });
}

export function useRunProjectHealth() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (projectId: string) => healthApi.runForProject(projectId),
    onSuccess: (_, projectId) => {
      qc.invalidateQueries({ queryKey: queryKeys.project.health(projectId) });
      qc.invalidateQueries({ queryKey: queryKeys.health.all });
    },
  });
}
