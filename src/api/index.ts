import { invoke as tauriInvoke } from '@tauri-apps/api/core';
import { normalizeProject, normalizeProjects } from '../lib/normalize';

// Type-safe wrapper — components already use `any` for API data
const cmd = <T = any>(name: string, args?: Record<string, unknown>): Promise<T> =>
  tauriInvoke(name, args) as Promise<T>;

// ==================== Projects ====================

export const projectsApi = {
  list: (params?: Record<string, string | undefined>) =>
    cmd<any[]>('projects_list', { params: params ?? null }).then(normalizeProjects),
  getById: (id: string) =>
    cmd<Record<string, any>>('projects_get_by_id', { id }).then(normalizeProject),
  create: (data: Record<string, unknown>) =>
    cmd<Record<string, any>>('projects_create', { data }).then(normalizeProject),
  update: (id: string, data: Record<string, unknown>) =>
    cmd<Record<string, any>>('projects_update', { id, data }).then(normalizeProject),
  delete: (id: string) =>
    cmd('projects_delete', { id }),
  updateStatus: (id: string, status: string) =>
    cmd<Record<string, any>>('projects_update_status', { id, status }).then(normalizeProject),
  getStats: (id: string) =>
    cmd('projects_get_stats', { id }),
  open: (id: string) =>
    cmd('projects_open', { id }),
  refresh: (id: string) =>
    cmd<Record<string, any>>('projects_refresh', { id }).then(normalizeProject),
  detectCwd: (projectPath: string, command: string) =>
    cmd<string | null>('detect_project_cwd', { projectPath, command }),
  debugRaw: (id: string) =>
    cmd<Record<string, any>>('debug_project_raw', { id }),
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

// ==================== Detect ====================

export const detectApi = {
  local: (path: string) =>
    cmd('detect_local_project', { path }),
  gitRepo: (repoUrl: string) =>
    cmd('detect_git_repo', { repoUrl }),
  scanDirectory: (path: string, maxDepth?: number) =>
    cmd('detect_scan_directory', { path, maxDepth: maxDepth ?? null }),
};

// ==================== Git ====================

export const gitApi = {
  status: (repoPath: string) =>
    cmd('git_status', { repoPath }),
  log: (repoPath: string, limit?: number) =>
    cmd('git_log', { repoPath, limit: limit ?? null }),
  branches: (repoPath: string) =>
    cmd('git_branches', { repoPath }),
  diff: (repoPath: string, file?: string, staged?: boolean) =>
    cmd('git_diff', { repoPath, file: file ?? null, staged: staged ?? null }),
  branchSwitch: (repoPath: string, branch: string) =>
    cmd('git_branch_switch', { repoPath, branch }),
  stashList: (repoPath: string) =>
    cmd('git_stash_list', { repoPath }),
  add: (repoPath: string, files: string[]) =>
    cmd('git_add', { repoPath, files }),
  commit: (repoPath: string, message: string) =>
    cmd('git_commit', { repoPath, message }),
  push: (repoPath: string, remote?: string, branch?: string) =>
    cmd('git_push', { repoPath, remote: remote ?? null, branch: branch ?? null }),
  diffCommit: (repoPath: string, hash: string) =>
    cmd('git_diff_commit', { repoPath, hash }),
  unstage: (repoPath: string, files: string[]) =>
    cmd('git_reset_head', { repoPath, files }),
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

// ==================== Terminal ====================

interface TerminalApi {
  start: (projectId: string, commandStr: string, cwd: string) => Promise<string>;
  startShell: (terminalId: string, shell: string, cwd: string, args?: string[]) => Promise<string>;
  stop: (terminalId: string) => Promise<any>;
  input: (terminalId: string, data: string) => Promise<any>;
  resize: (terminalId: string, cols: number, rows: number) => Promise<any>;
}

export const terminalApi: TerminalApi = {
  start: (projectId: string, commandStr: string, cwd: string) =>
    cmd<string>('terminal_start', { projectId, commandStr, cwd }),
  startShell: (terminalId: string, shell: string, cwd: string, args?: string[]) =>
    cmd<string>('terminal_start_shell', { terminalId, shell, args: args ?? null, cwd }),
  stop: (terminalId: string) =>
    cmd('terminal_stop', { terminalId }),
  input: (terminalId: string, data: string) =>
    cmd('terminal_input', { terminalId, data }),
  resize: (terminalId: string, cols: number, rows: number) =>
    cmd('terminal_resize', { terminalId, cols, rows }),
};

// ==================== Dependencies ====================

export const dependenciesApi = {
  detect: (projectIds: string[]) =>
    cmd('detect_project_dependencies', { projectIds }),
  getLaunchOrder: (projectIds: string[], respectDependencies: boolean) =>
    cmd<string[]>('get_launch_order', { projectIds, respectDependencies }),
  analyzeDockerCompose: (path: string) =>
    cmd('analyze_docker_compose', { path }),
  detectMonorepo: (path: string) =>
    cmd('detect_monorepo_structure', { path }),
};

// ==================== Health ====================

export const healthApi = {
  runAll: () =>
    cmd<{ results: any[]; changedProjects: any[] }>('run_all_health_checks'),
  runForProject: (projectId: string) =>
    cmd<any>('run_health_check_for_project', { projectId }),
  getProjectHistory: (projectId: string, limit?: number) =>
    cmd<any[]>('get_project_health_history', { projectId, limit: limit ?? null }),
  getAllLatest: () =>
    cmd<any[]>('get_all_latest_health'),
};
