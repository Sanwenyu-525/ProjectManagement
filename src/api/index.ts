import { invoke as tauriInvoke } from '@tauri-apps/api/core';
import { normalizeProject, normalizeProjects } from '../lib/normalize';
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
  AgentSession,
  AgentMessage,
  BrowserVisit,
} from '../types';

// Type-safe wrapper — components already use `any` for API data
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const cmd = <T = any>(name: string, args?: Record<string, unknown>): Promise<T> =>
  tauriInvoke(name, args) as Promise<T>;

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
  pull: (repoPath: string, remote?: string, branch?: string) =>
    cmd('git_pull', { repoPath, remote: remote ?? null, branch: branch ?? null }),
  tagList: (repoPath: string) =>
    cmd('git_tag_list', { repoPath }),
  tagCreate: (repoPath: string, name: string, message?: string) =>
    cmd('git_tag_create', { repoPath, name, message: message ?? null }),
  tagDelete: (repoPath: string, name: string) =>
    cmd('git_tag_delete', { repoPath, name }),
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

// ==================== Terminal ====================

interface TerminalApi {
  start: (projectId: string, commandStr: string, cwd: string) => Promise<string>;
  startShell: (terminalId: string, shell: string, cwd: string, args?: string[]) => Promise<string>;
  startAgent: (terminalId: string, command: string, args: string[], cwd: string) => Promise<string>;
  setupAgentLauncher: () => Promise<string>;
  stop: (terminalId: string) => Promise<void>;
  input: (terminalId: string, data: string) => Promise<void>;
  resize: (terminalId: string, cols: number, rows: number) => Promise<void>;
}

export const terminalApi: TerminalApi = {
  start: (projectId: string, commandStr: string, cwd: string) =>
    cmd<string>('terminal_start', { projectId, commandStr, cwd }),
  startShell: (terminalId: string, shell: string, cwd: string, args?: string[]) =>
    cmd<string>('terminal_start_shell', { terminalId, shell, args: args ?? null, cwd }),
  startAgent: (terminalId: string, command: string, args: string[], cwd: string) =>
    cmd<string>('terminal_start_agent', { terminalId, command, args, cwd }),
  setupAgentLauncher: () =>
    cmd<string>('terminal_setup_agent_launcher'),
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
    cmd<{ results: ProjectHealthResult[]; changedProjects: string[] }>('run_all_health_checks'),
  runForProject: (projectId: string) =>
    cmd<ProjectHealthResult>('run_health_check_for_project', { projectId }),
  getProjectHistory: (projectId: string, limit?: number) =>
    cmd<HealthCheckResult[]>('get_project_health_history', { projectId, limit: limit ?? null }),
  getAllLatest: () =>
    cmd<ProjectHealthResult[]>('get_all_latest_health'),
};

// ==================== Workspaces ====================

export const workspacesApi = {
  list: () =>
    cmd('workspaces_list'),
  create: (data: { name: string; description?: string; color?: string }) =>
    cmd('workspaces_create', { data }),
  update: (id: string, data: Record<string, unknown>) =>
    cmd('workspaces_update', { id, data }),
  delete: (id: string) =>
    cmd('workspaces_delete', { id }),
  assignProject: (projectId: string, workspaceId: string | null) =>
    cmd('workspaces_assign_project', { projectId, workspaceId }),
  saveLayout: (id: string, layout: string) =>
    cmd('workspaces_save_layout', { id, layout }),
  loadLayout: (id: string): Promise<string | null> =>
    cmd('workspaces_load_layout', { id }),
};

// ==================== Screenshots ====================

export interface ScreenshotableWindow {
  id: number;
  name: string;
  title: string;
  appName: string;
}

export const screenshotApi = {
  /** List all screenshotable windows */
  listWindows: (): Promise<ScreenshotableWindow[]> =>
    cmd('plugin:screenshots|get_screenshotable_windows'),

  /** Capture a window by ID, returns path to saved PNG */
  captureWindow: (windowId: number): Promise<string> =>
    cmd('plugin:screenshots|get_window_screenshot', { id: windowId }),

  /** Find the main DevHub window and capture it */
  captureMain: async (): Promise<{ path: string; windowName: string } | null> => {
    const windows = await screenshotApi.listWindows();
    const main = windows.find(w =>
      w.appName.toLowerCase().includes('devhub') ||
      w.title.toLowerCase().includes('devhub')
    );
    if (!main) return null;
    const path = await screenshotApi.captureWindow(main.id);
    return { path, windowName: main.name };
  },
};

// ==================== Project Brain ====================

export const brainApi = {
  analyze: (projectId: string) =>
    cmd<ProjectBrain>('brain_analyze_project', { projectId }),
};

// ==================== Agent Sessions ====================

export const sessionsApi = {
  start: (agentTabId: string, runtimeId: string, projectId?: string, cwd?: string) =>
    cmd<string>('sessions_start', { agentTabId, runtimeId, projectId: projectId ?? null, cwd: cwd ?? null }),
  appendMessage: (sessionId: string, role: string, content: string) =>
    cmd('sessions_append_message', { sessionId, role, content }),
  end: (sessionId: string) =>
    cmd('sessions_end', { sessionId }),
  list: (limit?: number) =>
    cmd<AgentSession[]>('sessions_list', { limit: limit ?? null }),
  messages: (sessionId: string) =>
    cmd<AgentMessage[]>('sessions_messages', { sessionId }),
};

// ==================== Browser Memory ====================

export const browserMemoryApi = {
  recordVisit: (data: { tabId: string; url: string; title?: string; domAnalysis?: string; projectId?: string }) =>
    cmd('browser_record_visit', data),
  listVisits: (tabId?: string, limit?: number) =>
    cmd<BrowserVisit[]>('browser_list_visits', { tabId: tabId ?? null, limit: limit ?? null }),
  findByUrl: (url: string) =>
    cmd<BrowserVisit[]>('browser_find_visits_by_url', { url }),
};
