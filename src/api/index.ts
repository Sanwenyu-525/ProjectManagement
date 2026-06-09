import { invoke as tauriInvoke } from '@tauri-apps/api/core';

// Type-safe wrapper — components already use `any` for API data
const cmd = <T = any>(name: string, args?: Record<string, unknown>): Promise<T> =>
  tauriInvoke(name, args) as Promise<T>;

// ==================== Projects ====================

export const projectsApi = {
  list: (params?: Record<string, string | undefined>) =>
    cmd('projects_list', { params: params ?? null }),
  getById: (id: string) =>
    cmd('projects_get_by_id', { id }),
  create: (data: Record<string, unknown>) =>
    cmd('projects_create', { data }),
  update: (id: string, data: Record<string, unknown>) =>
    cmd('projects_update', { id, data }),
  delete: (id: string) =>
    cmd('projects_delete', { id }),
  updateStatus: (id: string, status: string) =>
    cmd('projects_update_status', { id, status }),
  getStats: (id: string) =>
    cmd('projects_get_stats', { id }),
  open: (id: string) =>
    cmd('projects_open', { id }),
};

// ==================== Tasks ====================

export const tasksApi = {
  list: (projectId: string, params?: Record<string, string | undefined>) =>
    cmd('tasks_list', { projectId, params: params ?? null }),
  create: (projectId: string, data: Record<string, unknown>) =>
    cmd('tasks_create', { projectId, data }),
  update: (id: string, data: Record<string, unknown>) =>
    cmd('tasks_update', { id, data }),
  delete: (id: string) =>
    cmd('tasks_delete', { id }),
  updateStatus: (id: string, status: string) =>
    cmd('tasks_update_status', { id, status }),
};

// ==================== Repos ====================

export const reposApi = {
  list: (projectId: string) =>
    cmd('repos_list', { projectId }),
  add: (projectId: string, data: Record<string, unknown>) =>
    cmd('repos_add', { projectId, data }),
  update: (id: string, data: Record<string, unknown>) =>
    cmd('repos_update', { id, data }),
  remove: (id: string) =>
    cmd('repos_remove', { id }),
  sync: (id: string) =>
    cmd('repos_sync', { id }),
};

// ==================== Timeline ====================

export const timelineApi = {
  list: (params?: { limit?: number; offset?: number }) =>
    cmd('get_timeline', { params: params ?? null }),
  byProject: (projectId: string, params?: { limit?: number; offset?: number }) =>
    cmd('get_project_timeline', { projectId, params: params ?? null }),
};

// ==================== Search ====================

export const searchApi = {
  search: (q: string) =>
    cmd('global_search', { q }),
};

// ==================== Tags ====================

export const tagsApi = {
  list: () =>
    cmd('tags_list'),
  create: (data: { name: string; color?: string }) =>
    cmd('tags_create', { data }),
  update: (id: string, data: Record<string, unknown>) =>
    cmd('tags_update', { id, data }),
  delete: (id: string) =>
    cmd('tags_delete', { id }),
  assignToProject: (projectId: string, tagId: string) =>
    cmd('tags_assign_to_project', { projectId, tagId }),
  removeFromProject: (projectId: string, tagId: string) =>
    cmd('tags_remove_from_project', { projectId, tagId }),
};

// ==================== Milestones ====================

export const milestonesApi = {
  list: (projectId: string) =>
    cmd('milestones_list', { projectId }),
  create: (projectId: string, data: Record<string, unknown>) =>
    cmd('milestones_create', { projectId, data }),
  update: (id: string, data: Record<string, unknown>) =>
    cmd('milestones_update', { id, data }),
  delete: (id: string) =>
    cmd('milestones_delete', { id }),
};

// ==================== Documents ====================

export const documentsApi = {
  list: (projectId: string) =>
    cmd('documents_list', { projectId }),
  create: (projectId: string, data: Record<string, unknown>) =>
    cmd('documents_create', { projectId, data }),
  getById: (id: string) =>
    cmd('documents_get_by_id', { id }),
  update: (id: string, data: Record<string, unknown>) =>
    cmd('documents_update', { id, data }),
  delete: (id: string) =>
    cmd('documents_delete', { id }),
};
