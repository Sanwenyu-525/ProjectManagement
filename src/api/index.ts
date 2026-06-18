// Barrel re-export — all existing imports from '../../api' continue to work
export { cmd, screenshotApi } from './client';
export type { ScreenshotableWindow } from './types';
export type { FileEntry, FileTreeNode, FileContent, TerminalApi } from './types';

// Project domain (projects, tasks, repos, documents, milestones, tags, timeline, search, health, dependencies, detect, brain)
export {
  projectsApi,
  tasksApi,
  reposApi,
  documentsApi,
  milestonesApi,
  tagsApi,
  timelineApi,
  searchApi,
  detectApi,
  healthApi,
  dependenciesApi,
  brainApi,
  gitApi,
} from './project';

// Workspace
export { workspacesApi } from './workspace';

// Agent sessions + Agent tasks
export { sessionsApi, agentTasksApi, providersApi, agentConfigsApi } from './agent';
export type { CreateAgentTaskInput } from './agent';
export { browserMemoryApi } from './browser';

// Terminal + Files
export { terminalApi, filesApi } from './terminal';

// Builds + Templates + Integrations
export { buildsApi, templatesApi, integrationsApi } from './build';
