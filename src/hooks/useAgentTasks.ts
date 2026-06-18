import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { agentTasksApi } from '../api';
import { queryKeys } from '../api/queryKeys';
import type { CreateAgentTaskInput } from '../api/agent';
import type { AgentTask } from '../types';

export function useAgentTasks(sessionId: string | null) {
  return useQuery({
    queryKey: queryKeys.agentTasks.all(sessionId ?? ''),
    queryFn: () => agentTasksApi.list(sessionId!),
    enabled: !!sessionId,
  });
}

export function useCreateAgentTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ sessionId, data }: { sessionId: string; data: CreateAgentTaskInput }) =>
      agentTasksApi.create(sessionId, data),
    onSuccess: (_result, vars) => {
      qc.invalidateQueries({ queryKey: queryKeys.agentTasks.all(vars.sessionId) });
    },
  });
}

export function useUpdateAgentTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ sessionId: _sid, id, data }: {
      sessionId: string;
      id: string;
      data: { title?: string; status?: string; priority?: string; sortOrder?: number };
    }) => agentTasksApi.update(id, data),
    onSuccess: (_result, vars) => {
      qc.invalidateQueries({ queryKey: queryKeys.agentTasks.all(vars.sessionId) });
    },
  });
}

export function useDeleteAgentTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ sessionId: _sid, id }: { sessionId: string; id: string }) =>
      agentTasksApi.delete(id),
    onSuccess: (_result, vars) => {
      qc.invalidateQueries({ queryKey: queryKeys.agentTasks.all(vars.sessionId) });
    },
  });
}

export function useBulkCreateAgentTasks() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ sessionId, tasks }: { sessionId: string; tasks: CreateAgentTaskInput[] }) =>
      agentTasksApi.bulkCreate(sessionId, tasks),
    onSuccess: (_result, vars) => {
      qc.invalidateQueries({ queryKey: queryKeys.agentTasks.all(vars.sessionId) });
    },
  });
}

/** Group tasks by parentId for display: root groups + their children */
export function groupAgentTasks(tasks: AgentTask[]): {
  groups: AgentTask[];
  childrenOf: (parentId: string) => AgentTask[];
  topLevel: AgentTask[];
} {
  const groups = tasks.filter(t => t.parentId === null);
  const orphans = tasks.filter(t => t.parentId !== null && !tasks.some(g => g.id === t.parentId));

  return {
    groups,
    childrenOf: (parentId: string) =>
      tasks.filter(t => t.parentId === parentId).sort((a, b) => a.sortOrder - b.sortOrder),
    topLevel: [...groups, ...orphans].sort((a, b) => a.sortOrder - b.sortOrder),
  };
}
