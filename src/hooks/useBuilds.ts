import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../api/queryKeys';
import { buildsApi, templatesApi, integrationsApi } from '../api';
import type { CreateBuildInput, UpdateBuildInput, CreateIntegrationInput, UpdateIntegrationInput } from '../types';

// ==================== Builds ====================

export function useBuilds(projectId?: string) {
  return useQuery({
    queryKey: queryKeys.builds.all(projectId),
    queryFn: () => buildsApi.list(projectId),
  });
}

export function useBuildLogs(buildId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.builds.logs(buildId!),
    queryFn: () => buildsApi.getLogs(buildId!),
    enabled: !!buildId,
  });
}

export function useCreateBuild() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateBuildInput) => buildsApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.builds.all() });
    },
  });
}

export function useUpdateBuild() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateBuildInput }) =>
      buildsApi.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.builds.all() });
    },
  });
}

export function useDeleteBuild() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => buildsApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.builds.all() });
    },
  });
}

// ==================== Templates ====================

export function useTemplates(category?: string) {
  return useQuery({
    queryKey: queryKeys.templates.all(category),
    queryFn: () => templatesApi.list(category),
  });
}

// ==================== Integrations ====================

export function useIntegrations() {
  return useQuery({
    queryKey: queryKeys.integrations.all,
    queryFn: () => integrationsApi.list(),
  });
}

export function useCreateIntegration() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateIntegrationInput) => integrationsApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.integrations.all });
    },
  });
}

export function useUpdateIntegration() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateIntegrationInput }) =>
      integrationsApi.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.integrations.all });
    },
  });
}

export function useDeleteIntegration() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => integrationsApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.integrations.all });
    },
  });
}
