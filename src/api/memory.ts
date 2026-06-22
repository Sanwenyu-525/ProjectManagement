import { cmd } from './client';
import type { ProjectMemory, Decision, CreateMemoryInput, CreateDecisionInput, UpdateDecisionInput, BuildContextResult, ContextItem } from '../types';

export const memoryApi = {
  list: (projectId?: string): Promise<ProjectMemory[]> =>
    cmd('memories_list', { projectId: projectId ?? null }),

  search: (query: string, projectId?: string): Promise<ProjectMemory[]> =>
    cmd('memories_search', { query, projectId: projectId ?? null }),

  create: (data: CreateMemoryInput): Promise<ProjectMemory> =>
    cmd('memories_create', { data }),

  delete: (id: string): Promise<void> =>
    cmd('memories_delete', { id }),

  pin: (id: string): Promise<ProjectMemory> =>
    cmd('memories_pin', { id }),

  update: (data: { id: string; title?: string; content?: string; tags?: string }): Promise<ProjectMemory> =>
    cmd('memories_update', { data }),

  contextRetrieve: (query: string, projectId?: string, limit?: number): Promise<ContextItem[]> =>
    cmd('context_retrieve', { query, projectId: projectId ?? null, limit: limit ?? 10 }),

  buildContext: (projectId?: string): Promise<BuildContextResult> =>
    cmd('build_context', { projectId: projectId ?? null }),
};

export const decisionsApi = {
  list: (projectId?: string): Promise<Decision[]> =>
    cmd('decisions_list', { projectId: projectId ?? null }),

  create: (data: CreateDecisionInput): Promise<Decision> =>
    cmd('decisions_create', { data }),

  update: (data: UpdateDecisionInput): Promise<Decision> =>
    cmd('decisions_update', { data }),

  delete: (id: string): Promise<void> =>
    cmd('decisions_delete', { id }),
};

export const memoryRelationsApi = {
  add: (data: { sourceId: string; targetId: string; relationType?: string }): Promise<{ id: string }> =>
    cmd('memory_relations_add', { data }),

  list: (memoryId: string): Promise<Array<{ id: string; sourceId: string; targetId: string; relationType: string; title: string; type: string; content: string }>> =>
    cmd('memory_relations_list', { memoryId }),
};
