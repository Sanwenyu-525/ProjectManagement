import { cmd } from './client';

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
  stats: (): Promise<{ tasks: number; issues: number; docs: number }> =>
    cmd('workspaces_stats'),
  loadExplorerState: (): Promise<{ paths: string[]; expandedPaths: string[] }> =>
    cmd('explorer_load_state'),
  saveExplorerState: (paths: string[], expandedPaths: string[]): Promise<void> =>
    cmd('explorer_save_state', { paths, expandedPaths }),
};
