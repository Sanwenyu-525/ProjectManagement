export const queryKeys = {
  projects: {
    all: ['projects'] as const,
    filtered: (params: Record<string, string | undefined>) => ['projects', params] as const,
  },
  project: {
    one: (id: string) => ['project', id] as const,
    brain: (id: string) => ['project', id, 'brain'] as const,
    health: (id: string) => ['project', id, 'health'] as const,
    timeline: (id: string) => ['project', id, 'timeline'] as const,
  },
  tasks: {
    all: (projectId: string) => ['tasks', projectId] as const,
  },
  documents: {
    all: (projectId: string) => ['documents', projectId] as const,
    one: (id: string) => ['document', id] as const,
  },
  milestones: {
    all: (projectId: string) => ['milestones', projectId] as const,
  },
  repos: {
    all: (projectId: string) => ['repos', projectId] as const,
  },
  tags: {
    all: ['tags'] as const,
  },
  git: {
    status: (repoPath: string) => ['git', repoPath, 'status'] as const,
    log: (repoPath: string) => ['git', repoPath, 'log'] as const,
    branches: (repoPath: string) => ['git', repoPath, 'branches'] as const,
    stashList: (repoPath: string) => ['git', repoPath, 'stash'] as const,
    tagList: (repoPath: string) => ['git', repoPath, 'tags'] as const,
  },
  sessions: {
    all: ['sessions'] as const,
    messages: (sessionId: string) => ['sessions', sessionId, 'messages'] as const,
  },
  workspaces: {
    all: ['workspaces'] as const,
  },
  health: {
    all: ['health', 'all'] as const,
  },
  builds: {
    all: (projectId?: string) => ['builds', projectId] as const,
    logs: (buildId: string) => ['builds', buildId, 'logs'] as const,
  },
  templates: {
    all: (category?: string) => ['templates', category] as const,
  },
  integrations: {
    all: ['integrations'] as const,
  },
  timeline: {
    all: (params?: { limit?: number; offset?: number }) => ['timeline', params] as const,
    project: (projectId: string) => ['timeline', projectId] as const,
  },
  dependencies: {
    graph: (projectIds: string[]) => ['dependencies', projectIds] as const,
  },
  browser: {
    visits: (tabId?: string) => ['browser', 'visits', tabId] as const,
  },
  providers: {
    all: ['providers'] as const,
  },
  agentConfigs: {
    all: ['agent-configs'] as const,
  },
  agentTasks: {
    all: (sessionId: string) => ['agent-tasks', sessionId] as const,
  },
  files: {
    tree: (root: string, depth?: number) => ['files', 'tree', root, depth] as const,
    content: (path: string) => ['files', 'content', path] as const,
    directory: (path: string) => ['files', 'directory', path] as const,
  },
  search: {
    results: (query: string) => ['search', query] as const,
  },
} as const;
