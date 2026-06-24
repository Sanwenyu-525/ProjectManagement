// Barrel re-export — all existing imports from '../../api' continue to work
export { cmd } from './client';
export type { FileEntry, FileTreeNode, FileChangedEvent } from './types';

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
  brainApi,
  graphApi,
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
export type { SlashCommandDef } from './terminal';

// Builds + Templates + Integrations
export { buildsApi, templatesApi, integrationsApi } from './build';

// Memory (knowledge base)
export { memoryApi, decisionsApi } from './memory';

// Notes + Knowledge
export { notesApi } from './notes';
export { knowledgeApi } from './knowledge';
