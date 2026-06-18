import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../api/queryKeys';
import { workspacesApi } from '../api';

export function useWorkspaces() {
  return useQuery({
    queryKey: queryKeys.workspaces.all,
    queryFn: () => workspacesApi.list(),
  });
}

export function useCreateWorkspace() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { name: string; description?: string; color?: string }) =>
      workspacesApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.workspaces.all });
    },
  });
}

export function useUpdateWorkspace() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      workspacesApi.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.workspaces.all });
    },
  });
}

export function useDeleteWorkspace() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => workspacesApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.workspaces.all });
    },
  });
}
