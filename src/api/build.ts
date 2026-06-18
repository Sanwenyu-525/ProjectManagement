import { cmd } from './client';
import type {
  Build,
  BuildLog,
  CreateBuildInput,
  UpdateBuildInput,
  Template,
  CreateTemplateInput,
  Integration,
  CreateIntegrationInput,
  UpdateIntegrationInput,
} from '../types';

// ==================== Builds ====================

export const buildsApi = {
  list: (projectId?: string): Promise<Build[]> =>
    cmd('builds_list', { projectId: projectId ?? null }),
  getById: (id: string): Promise<Build> =>
    cmd('builds_get_by_id', { id }),
  create: (data: CreateBuildInput): Promise<Build> =>
    cmd('builds_create', { data }),
  update: (id: string, data: UpdateBuildInput): Promise<Build> =>
    cmd('builds_update', { id, data }),
  delete: (id: string): Promise<void> =>
    cmd('builds_delete', { id }),
  addLog: (buildId: string, data: { message: string; level?: string }): Promise<BuildLog> =>
    cmd('builds_add_log', { buildId, data }),
  getLogs: (buildId: string): Promise<BuildLog[]> =>
    cmd('builds_get_logs', { buildId }),
};

// ==================== Templates ====================

export const templatesApi = {
  list: (category?: string): Promise<Template[]> =>
    cmd('templates_list', { category: category ?? null }),
  getById: (id: string): Promise<Template> =>
    cmd('templates_get_by_id', { id }),
  create: (data: CreateTemplateInput): Promise<Template> =>
    cmd('templates_create', { data }),
  delete: (id: string): Promise<void> =>
    cmd('templates_delete', { id }),
};

// ==================== Integrations ====================

export const integrationsApi = {
  list: (): Promise<Integration[]> =>
    cmd('integrations_list'),
  getById: (id: string): Promise<Integration> =>
    cmd('integrations_get_by_id', { id }),
  create: (data: CreateIntegrationInput): Promise<Integration> =>
    cmd('integrations_create', { data }),
  update: (id: string, data: UpdateIntegrationInput): Promise<Integration> =>
    cmd('integrations_update', { id, data }),
  delete: (id: string): Promise<void> =>
    cmd('integrations_delete', { id }),
};
