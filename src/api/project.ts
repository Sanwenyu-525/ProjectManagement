import { normalizeProject, normalizeProjects } from '../lib/normalize';
import { cmd } from './client';
import type {
  Project,
  ProjectWithStats,
  ProjectDetail,
  Task,
  RemoteRepo,
  Milestone,
  Document,
  Tag,
  ActivityLog,
  SearchResults,
  CreateProjectInput,
  UpdateProjectInput,
  CreateTaskInput,
  UpdateTaskInput,
  CreateDocumentInput,
  UpdateDocumentInput,
  CreateMilestoneInput,
  UpdateMilestoneInput,
  CreateTagInput,
  UpdateTagInput,
  AddRepoInput,
  UpdateRepoInput,
  DetectedProject,
  ScanResult,
  ProjectHealthResult,
  HealthCheckResult,
  OutdatedDep,
  ProjectBrain,
  GraphSummary,
  GraphData,
  GraphStats,
  FeatureGroup,
  GroupMembership,
  SuggestedGroup,
  CreateGroupInput,
  GitLogResult,
} from '../types';

// ==================== Projects ====================

export const projectsApi = {
  list: (params?: Record<string, string | undefined>): Promise<ProjectWithStats[]> =>
    cmd('projects_list', { params: params ?? null })
      .then((data) => normalizeProjects(data) as ProjectWithStats[]),
  getById: (id: string): Promise<ProjectDetail> =>
    cmd('projects_get_by_id', { id })
      .then((data) => normalizeProject(data) as ProjectDetail),
  create: (data: CreateProjectInput): Promise<Project> =>
    cmd('projects_create', { data })
      .then((data) => normalizeProject(data) as Project),
  update: (id: string, data: UpdateProjectInput): Promise<Project> =>
    cmd('projects_update', { id, data })
      .then((data) => normalizeProject(data) as Project),
  delete: (id: string): Promise<void> =>
    cmd('projects_delete', { id }),
  restore: (id: string): Promise<Project> =>
    cmd('projects_restore', { id })
      .then((data) => normalizeProject(data) as Project),
  updateStatus: (id: string, status: string): Promise<Project> =>
    cmd('projects_update_status', { id, status })
      .then((data) => normalizeProject(data) as Project),
  getStats: (id: string): Promise<ProjectWithStats> =>
    cmd('projects_get_stats', { id }),
  open: (id: string): Promise<void> =>
    cmd('projects_open', { id }),
  refresh: (id: string): Promise<Project> =>
    cmd('projects_refresh', { id })
      .then((data) => normalizeProject(data) as Project),
  detectCwd: (projectPath: string, command: string): Promise<string | null> =>
    cmd('detect_project_cwd', { projectPath, command }),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  debugRaw: (id: string): Promise<Record<string, any>> =>
    cmd('debug_project_raw', { id }),
  launch: (id: string, components?: string[]): Promise<{ projectId: string; launched: string[] }> =>
    cmd('projects_launch', { id, components: components ?? null }),
  stop: (id: string, components?: string[]): Promise<{ projectId: string; stopped: string[] }> =>
    cmd('projects_stop', { id, components: components ?? null }),
  checkEnvironment: (id: string): Promise<{ projectId: string; checks: OutdatedDep[]; overallStatus: string }> =>
    cmd('projects_check_environment', { id }),
  batchImport: (projects: Record<string, unknown>[]): Promise<{ imported: number; skipped: number; errors: string[] }> =>
    cmd('projects_batch_import', { projects }),
};

// ==================== Tasks ====================

export const tasksApi = {
  list: (projectId: string, params?: Record<string, string | undefined>): Promise<Task[]> =>
    cmd('tasks_list', { projectId, params: params ?? null }),
  create: (projectId: string, data: CreateTaskInput): Promise<Task> =>
    cmd('tasks_create', { projectId, data }),
  update: (id: string, data: UpdateTaskInput): Promise<Task> =>
    cmd('tasks_update', { id, data }),
  delete: (id: string): Promise<void> =>
    cmd('tasks_delete', { id }),
  updateStatus: (id: string, status: string): Promise<Task> =>
    cmd('tasks_update_status', { id, status }),
};

// ==================== Repos ====================

export const reposApi = {
  list: (projectId: string): Promise<RemoteRepo[]> =>
    cmd('repos_list', { projectId }),
  add: (projectId: string, data: AddRepoInput): Promise<RemoteRepo> =>
    cmd('repos_add', { projectId, data }),
  update: (id: string, data: UpdateRepoInput): Promise<RemoteRepo> =>
    cmd('repos_update', { id, data }),
  remove: (id: string): Promise<void> =>
    cmd('repos_remove', { id }),
  sync: (id: string): Promise<RemoteRepo> =>
    cmd('repos_sync', { id }),
};

// ==================== Documents ====================

export const documentsApi = {
  list: (projectId: string): Promise<Document[]> =>
    cmd('documents_list', { projectId }),
  create: (projectId: string, data: CreateDocumentInput): Promise<Document> =>
    cmd('documents_create', { projectId, data }),
  getById: (id: string): Promise<Document> =>
    cmd('documents_get_by_id', { id }),
  update: (id: string, data: UpdateDocumentInput): Promise<Document> =>
    cmd('documents_update', { id, data }),
  delete: (id: string): Promise<void> =>
    cmd('documents_delete', { id }),
};

// ==================== Milestones ====================

export const milestonesApi = {
  list: (projectId: string): Promise<Milestone[]> =>
    cmd('milestones_list', { projectId }),
  create: (projectId: string, data: CreateMilestoneInput): Promise<Milestone> =>
    cmd('milestones_create', { projectId, data }),
  update: (id: string, data: UpdateMilestoneInput): Promise<Milestone> =>
    cmd('milestones_update', { id, data }),
  delete: (id: string): Promise<void> =>
    cmd('milestones_delete', { id }),
};

// ==================== Tags ====================

export const tagsApi = {
  list: (): Promise<Tag[]> =>
    cmd('tags_list'),
  create: (data: CreateTagInput): Promise<Tag> =>
    cmd('tags_create', { data }),
  update: (id: string, data: UpdateTagInput): Promise<Tag> =>
    cmd('tags_update', { id, data }),
  delete: (id: string): Promise<void> =>
    cmd('tags_delete', { id }),
  assignToProject: (projectId: string, tagId: string): Promise<void> =>
    cmd('tags_assign_to_project', { projectId, tagId }),
  removeFromProject: (projectId: string, tagId: string): Promise<void> =>
    cmd('tags_remove_from_project', { projectId, tagId }),
};

// ==================== Timeline ====================

export const timelineApi = {
  list: (params?: { limit?: number; offset?: number }): Promise<ActivityLog[]> =>
    cmd('get_timeline', { params: params ?? null }),
  byProject: (projectId: string, params?: { limit?: number; offset?: number }): Promise<ActivityLog[]> =>
    cmd('get_project_timeline', { projectId, params: params ?? null }),
};

// ==================== Search ====================

export const searchApi = {
  search: (q: string): Promise<SearchResults> =>
    cmd('global_search', { q }),
};

// ==================== Detect ====================

export const detectApi = {
  local: (path: string): Promise<DetectedProject> =>
    cmd('detect_local_project', { path }),
  gitRepo: (repoUrl: string): Promise<DetectedProject> =>
    cmd('detect_git_repo', { repoUrl }),
  scanDirectory: (path: string, maxDepth?: number): Promise<ScanResult> =>
    cmd('detect_scan_directory', { path, maxDepth: maxDepth ?? null }),
  installedAgents: (commands: string[]): Promise<Record<string, boolean>> =>
    cmd('detect_installed_agents', { commands }),
};

// ==================== Health ====================

export const healthApi = {
  runAll: () =>
    cmd<{ results: ProjectHealthResult[]; changedProjects: string[] }>('run_all_health_checks'),
  runForProject: (projectId: string) =>
    cmd<ProjectHealthResult>('run_health_check_for_project', { projectId }),
  getProjectHistory: (projectId: string, limit?: number) =>
    cmd<HealthCheckResult[]>('get_project_health_history', { projectId, limit: limit ?? null }),
  getAllLatest: () =>
    cmd<ProjectHealthResult[]>('get_all_latest_health'),
};


// ==================== Git ====================

export const gitApi = {
  status: (repoPath: string) =>
    cmd('git_status', { repoPath }),
  log: (repoPath: string, limit?: number): Promise<GitLogResult> =>
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
  pull: (repoPath: string, remote?: string, branch?: string) =>
    cmd('git_pull', { repoPath, remote: remote ?? null, branch: branch ?? null }),
  tagList: (repoPath: string) =>
    cmd('git_tag_list', { repoPath }),
  tagCreate: (repoPath: string, name: string, message?: string) =>
    cmd('git_tag_create', { repoPath, name, message: message ?? null }),
  tagDelete: (repoPath: string, name: string) =>
    cmd('git_tag_delete', { repoPath, name }),
  restore: (repoPath: string, files: string[]) =>
    cmd<string>('git_restore', { repoPath, files }),
  showFile: (repoPath: string, file: string) =>
    cmd<string>('git_show_file', { repoPath, file }),
  fetch: (repoPath: string) =>
    cmd('git_fetch', { repoPath }),
  branchCreate: (repoPath: string, branchName: string) =>
    cmd('git_branch_create', { repoPath, branchName }),
  revert: (repoPath: string, hash: string) =>
    cmd('git_revert', { repoPath, hash }),
};

// ==================== Project Brain ====================

export const brainApi = {
  analyze: (projectId: string) =>
    cmd<ProjectBrain>('brain_analyze_project', { projectId }),
};

// ==================== Project Graph ====================

export const graphApi = {
  scan: (projectId: string) =>
    cmd<GraphSummary>('graph_scan_project', { projectId }),
  get: (projectId: string) =>
    cmd<GraphData>('graph_get', { projectId }),
  getStats: (projectId: string) =>
    cmd<GraphStats>('graph_get_stats', { projectId }),
  // Feature Groups
  listGroups: (projectId: string) =>
    cmd<FeatureGroup[]>('graph_list_groups', { projectId }),
  createGroup: (projectId: string, data: CreateGroupInput) =>
    cmd<FeatureGroup>('graph_create_group', { projectId, data }),
  deleteGroup: (groupId: string) =>
    cmd<void>('graph_delete_group', { groupId }),
  addFilesToGroup: (groupId: string, nodeIds: string[]) =>
    cmd<number>('graph_add_files_to_group', { groupId, nodeIds }),
  removeFileFromGroup: (groupId: string, nodeId: string) =>
    cmd<void>('graph_remove_file_from_group', { groupId, nodeId }),
  getGroupMemberships: (projectId: string) =>
    cmd<GroupMembership[]>('graph_get_group_memberships', { projectId }),
  suggestGroups: (projectId: string) =>
    cmd<SuggestedGroup[]>('graph_suggest_groups', { projectId }),
  // AI Cache
  getAiCache: (projectId: string, cacheKey: string) =>
    cmd<string | null>('graph_get_ai_cache', { projectId, cacheKey }),
  setAiCache: (projectId: string, cacheKey: string, resultJson: string) =>
    cmd<void>('graph_set_ai_cache', { projectId, cacheKey, resultJson }),
};
