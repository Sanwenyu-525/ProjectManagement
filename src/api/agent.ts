import { cmd } from './client';
import type { AgentSession, AgentMessage, AgentTask, ModelProvider, AgentConfig, McpServer } from '../types';

// ==================== Agent Sessions ====================

export const sessionsApi = {
  start: (agentTabId: string, runtimeId: string, projectId?: string, cwd?: string, permissionMode?: string) =>
    cmd<string>('sessions_start', { agentTabId, runtimeId, projectId: projectId ?? null, cwd: cwd ?? null, permissionMode: permissionMode ?? null }),
  appendMessage: (sessionId: string, role: string, content: string) =>
    cmd('sessions_append_message', { sessionId, role, content }),
  end: (sessionId: string) =>
    cmd('sessions_end', { sessionId }),
  update: (sessionId: string, data: { providerSessionId?: string; lastError?: string; exitCode?: number }) =>
    cmd('sessions_update', { sessionId, providerSessionId: data.providerSessionId ?? null, lastError: data.lastError ?? null, exitCode: data.exitCode ?? null }),
  list: (limit?: number) =>
    cmd<AgentSession[]>('sessions_list', { limit: limit ?? null }),
  messages: (sessionId: string) =>
    cmd<AgentMessage[]>('sessions_messages', { sessionId }),
  truncateMessages: (sessionId: string, keep: number) =>
    cmd('sessions_truncate_messages', { sessionId, keep }),
  cleanupStale: (maxMinutes?: number, idleMinutes?: number) =>
    cmd<number>('sessions_cleanup_stale', { maxMinutes: maxMinutes ?? null, idleMinutes: idleMinutes ?? null }),
};

// ==================== Agent Tasks ====================

export interface CreateAgentTaskInput {
  title: string;
  parentId?: string | null;
  priority?: string;
  sortOrder?: number;
}

export const agentTasksApi = {
  list: (sessionId: string) =>
    cmd<AgentTask[]>('agent_tasks_list', { sessionId }),
  create: (sessionId: string, data: CreateAgentTaskInput) =>
    cmd<AgentTask>('agent_tasks_create', { sessionId, data }),
  update: (id: string, data: { title?: string; status?: string; priority?: string; sortOrder?: number }) =>
    cmd<AgentTask>('agent_tasks_update', { id, data }),
  delete: (id: string) =>
    cmd('agent_tasks_delete', { id }),
  bulkCreate: (sessionId: string, tasks: CreateAgentTaskInput[]) =>
    cmd<AgentTask[]>('agent_tasks_bulk_create', { sessionId, tasks }),
};

// ==================== Model Providers ====================

export const providersApi = {
  list: () =>
    cmd<ModelProvider[]>('providers_list'),
  create: (data: { name: string; type: string; apiKey: string; baseUrl?: string }) =>
    cmd<ModelProvider>('providers_create', { data }),
  update: (id: string, data: { name?: string; apiKey?: string; baseUrl?: string | null }) =>
    cmd<ModelProvider>('providers_update', { id, data }),
  delete: (id: string) =>
    cmd<void>('providers_delete', { id }),
};

// ==================== Agent Configs ====================

export const agentConfigsApi = {
  list: () =>
    cmd<AgentConfig[]>('agent_configs_list'),
  listByProvider: (providerId: string) =>
    cmd<AgentConfig[]>('agent_configs_list_by_provider', { providerId }),
  create: (data: { name: string; icon?: string; providerId: string; model: string; systemPrompt?: string; temperature?: number; maxTokens?: number }) =>
    cmd<AgentConfig>('agent_configs_create', { data }),
  update: (id: string, data: { name?: string; icon?: string; model?: string; systemPrompt?: string; temperature?: number; maxTokens?: number }) =>
    cmd<AgentConfig>('agent_configs_update', { id, data }),
  delete: (id: string) =>
    cmd<void>('agent_configs_delete', { id }),
};

// ==================== MCP Servers ====================

export const mcpServersApi = {
  list: () =>
    cmd<McpServer[]>('mcp_servers_list'),
  create: (data: { name: string; transport: string; command?: string; args?: string; url?: string; env?: string; autoConnect?: boolean; enabled?: boolean }) =>
    cmd<McpServer>('mcp_servers_create', { data }),
  update: (id: string, data: { name?: string; transport?: string; command?: string; args?: string | null; url?: string | null; env?: string | null; autoConnect?: boolean; enabled?: boolean }) =>
    cmd<McpServer>('mcp_servers_update', { id, data }),
  delete: (id: string) =>
    cmd<void>('mcp_servers_delete', { id }),
};
