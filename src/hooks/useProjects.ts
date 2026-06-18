import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../api/queryKeys';
import {
  projectsApi,
  tasksApi,
  reposApi,
  documentsApi,
  milestonesApi,
  tagsApi,
  detectApi,
  brainApi,
} from '../api';
import type { CreateProjectInput, UpdateProjectInput, CreateTaskInput, UpdateTaskInput, CreateDocumentInput, UpdateDocumentInput } from '../types';

// ==================== Queries ====================

export function useProjects(params?: Record<string, string | undefined>) {
  return useQuery({
    queryKey: params ? queryKeys.projects.filtered(params) : queryKeys.projects.all,
    queryFn: () => projectsApi.list(params),
  });
}

export function useProject(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.project.one(id!),
    queryFn: () => projectsApi.getById(id!),
    enabled: !!id,
  });
}

export function useProjectBrain(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.project.brain(id!),
    queryFn: () => brainApi.analyze(id!),
    enabled: !!id,
    staleTime: 5 * 60_000,
  });
}

// ==================== Tasks ====================

export function useTasks(projectId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.tasks.all(projectId!),
    queryFn: () => tasksApi.list(projectId!),
    enabled: !!projectId,
  });
}

// ==================== Repos ====================

export function useRepos(projectId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.repos.all(projectId!),
    queryFn: () => reposApi.list(projectId!),
    enabled: !!projectId,
  });
}

// ==================== Documents ====================

export function useDocuments(projectId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.documents.all(projectId!),
    queryFn: () => documentsApi.list(projectId!),
    enabled: !!projectId,
  });
}

// ==================== Milestones ====================

export function useMilestones(projectId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.milestones.all(projectId!),
    queryFn: () => milestonesApi.list(projectId!),
    enabled: !!projectId,
  });
}

// ==================== Tags ====================

export function useTags() {
  return useQuery({
    queryKey: queryKeys.tags.all,
    queryFn: () => tagsApi.list(),
  });
}

// ==================== Project Mutations ====================

export function useCreateProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateProjectInput) => projectsApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.projects.all });
    },
  });
}

export function useUpdateProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateProjectInput }) =>
      projectsApi.update(id, data),
    onSuccess: (_, variables) => {
      qc.invalidateQueries({ queryKey: queryKeys.projects.all });
      qc.invalidateQueries({ queryKey: queryKeys.project.one(variables.id) });
    },
  });
}

export function useDeleteProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => projectsApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.projects.all });
    },
  });
}

export function useRefreshProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => projectsApi.refresh(id),
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: queryKeys.project.one(id) });
      qc.invalidateQueries({ queryKey: queryKeys.projects.all });
    },
  });
}

export function useDetectLocal() {
  return useMutation({
    mutationFn: ({ path }: { path: string }) => detectApi.local(path),
  });
}

export function useDetectGit() {
  return useMutation({
    mutationFn: ({ repoUrl }: { repoUrl: string }) => detectApi.gitRepo(repoUrl),
  });
}

// ==================== Task Mutations ====================

export function useCreateTask(projectId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateTaskInput) => tasksApi.create(projectId!, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.tasks.all(projectId!) });
    },
  });
}

export function useUpdateTask(projectId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateTaskInput }) =>
      tasksApi.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.tasks.all(projectId!) });
    },
  });
}

export function useDeleteTask(projectId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => tasksApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.tasks.all(projectId!) });
    },
  });
}

// ==================== Document Mutations ====================

export function useCreateDocument(projectId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateDocumentInput) => documentsApi.create(projectId!, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.documents.all(projectId!) });
    },
  });
}

export function useUpdateDocument(projectId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateDocumentInput }) =>
      documentsApi.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.documents.all(projectId!) });
    },
  });
}

export function useDeleteDocument(projectId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => documentsApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.documents.all(projectId!) });
    },
  });
}
