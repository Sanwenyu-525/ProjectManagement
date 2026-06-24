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
  graphApi,
} from '../api';
import type { CreateProjectInput, UpdateProjectInput, CreateTaskInput, UpdateTaskInput, CreateDocumentInput, UpdateDocumentInput, CreateGroupInput } from '../types';

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

export function useProjectGraph(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.project.graph(id!),
    queryFn: () => graphApi.get(id!),
    enabled: !!id,
    staleTime: 5 * 60_000,
  });
}

export function useProjectGraphStats(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.project.graphStats(id!),
    queryFn: () => graphApi.getStats(id!),
    enabled: !!id,
    staleTime: 5 * 60_000,
  });
}

export function useScanProjectGraph(id: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => graphApi.scan(id!),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.project.graph(id!) });
      qc.invalidateQueries({ queryKey: queryKeys.project.graphStats(id!) });
      qc.invalidateQueries({ queryKey: queryKeys.project.featureGroups(id!) });
      qc.invalidateQueries({ queryKey: queryKeys.project.groupMemberships(id!) });
    },
  });
}

// ==================== Feature Groups ====================

export function useFeatureGroups(projectId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.project.featureGroups(projectId!),
    queryFn: () => graphApi.listGroups(projectId!),
    enabled: !!projectId,
    staleTime: 60_000,
  });
}

export function useGroupMemberships(projectId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.project.groupMemberships(projectId!),
    queryFn: () => graphApi.getGroupMemberships(projectId!),
    enabled: !!projectId,
    staleTime: 60_000,
  });
}

export function useCreateFeatureGroup(projectId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateGroupInput) => graphApi.createGroup(projectId!, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.project.featureGroups(projectId!) });
    },
  });
}

export function useDeleteFeatureGroup(projectId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (groupId: string) => graphApi.deleteGroup(groupId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.project.featureGroups(projectId!) });
      qc.invalidateQueries({ queryKey: queryKeys.project.groupMemberships(projectId!) });
    },
  });
}

export function useAddFilesToGroup(projectId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ groupId, nodeIds }: { groupId: string; nodeIds: string[] }) =>
      graphApi.addFilesToGroup(groupId, nodeIds),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.project.featureGroups(projectId!) });
      qc.invalidateQueries({ queryKey: queryKeys.project.groupMemberships(projectId!) });
    },
  });
}

export function useRemoveFileFromGroup(projectId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ groupId, nodeId }: { groupId: string; nodeId: string }) =>
      graphApi.removeFileFromGroup(groupId, nodeId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.project.featureGroups(projectId!) });
      qc.invalidateQueries({ queryKey: queryKeys.project.groupMemberships(projectId!) });
    },
  });
}

export function useSuggestGroups(projectId: string | undefined) {
  return useMutation({
    mutationFn: () => graphApi.suggestGroups(projectId!),
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

export function useRestoreProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => projectsApi.restore(id),
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
