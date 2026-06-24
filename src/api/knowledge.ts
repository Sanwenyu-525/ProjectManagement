import { cmd } from './client';
import type { KnowledgeItem } from '../types';

export const knowledgeApi = {
  list: (category?: string, projectId?: string, limit?: number): Promise<KnowledgeItem[]> =>
    cmd('knowledge_list', { category: category ?? null, projectId: projectId ?? null, limit: limit ?? 100 }),
  counts: (projectId?: string): Promise<Array<{ category: string; count: number }>> =>
    cmd('knowledge_counts', { projectId: projectId ?? null }),
  importFiles: (filePaths: string[], projectId?: string): Promise<Array<{ id: string; title: string; filePath: string }>> =>
    cmd('knowledge_import_files', { filePaths, projectId: projectId ?? null }),
  createNote: (title: string, content: string, projectId?: string, tags?: string): Promise<import('../types').PersonalNote> =>
    cmd('knowledge_create_note', { data: { title, content, projectId: projectId ?? null, tags: tags ?? null } }),
  extract: (content: string, sourceContext?: string, projectId?: string): Promise<KnowledgeItem[]> =>
    cmd('knowledge_extract', { data: { content, sourceContext: sourceContext ?? null, projectId: projectId ?? null } }),
  seed: (): Promise<{ inserted: number }> =>
    cmd('knowledge_seed', {}),
};
