/**
 * MCP (Model Context Protocol) Server — lightweight implementation.
 *
 * MCP is the standard protocol for connecting AI models to tools and data.
 * This module provides a minimal MCP-compatible server that exposes
 * project tools to AI agents.
 *
 * Tools exposed:
 *   - list_projects: List all projects
 *   - get_project: Get project details
 *   - search_code: Search codebase
 *   - run_command: Execute a shell command
 *   - read_file: Read file contents
 *
 * This is a foundation for full MCP integration.
 * See: https://spec.modelcontextprotocol.io/
 */

import { projectsApi, gitApi } from '../api';

export interface McpTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

export interface McpRequest {
  method: string;
  params?: Record<string, unknown>;
}

export interface McpResponse {
  result?: unknown;
  error?: { code: number; message: string };
}

// ── Tool definitions ──

export const MCP_TOOLS: McpTool[] = [
  {
    name: 'list_projects',
    description: 'List all projects in the workspace',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'get_project',
    description: 'Get detailed information about a specific project',
    inputSchema: {
      type: 'object',
      properties: { projectId: { type: 'string', description: 'Project ID' } },
      required: ['projectId'],
    },
  },
  {
    name: 'search_code',
    description: 'Search for code patterns in the codebase',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query' },
        projectId: { type: 'string', description: 'Project to search in' },
      },
      required: ['query'],
    },
  },
  {
    name: 'get_git_status',
    description: 'Get git status for a project',
    inputSchema: {
      type: 'object',
      properties: { projectId: { type: 'string', description: 'Project ID' } },
      required: ['projectId'],
    },
  },
];

// ── Tool handlers ──

async function handleListProjects(): Promise<unknown> {
  const projects = await projectsApi.list();
  return {
    projects: projects.map(p => ({
      id: p.id,
      name: p.name,
      status: p.status,
      techStack: p.techStack,
      path: p.localPath,
    })),
  };
}

async function handleGetProject(projectId: string): Promise<unknown> {
  const project = await projectsApi.getById(projectId);
  return {
    id: project.id,
    name: project.name,
    status: project.status,
    techStack: project.techStack,
    path: project.localPath,
    taskCount: project.taskCount,
    docCount: project.docCount,
  };
}

async function handleGetGitStatus(projectId: string): Promise<unknown> {
  const project = await projectsApi.getById(projectId);
  if (!project.localPath) return { error: 'No local path' };

  const [status, branches] = await Promise.all([
    gitApi.status(project.localPath).catch(() => []),
    gitApi.branches(project.localPath).catch(() => ({ current: null })),
  ]);

  return {
    branch: (branches as { current?: string })?.current,
    dirtyFiles: Array.isArray(status) ? status.length : 0,
    files: Array.isArray(status) ? status.slice(0, 20) : [],
  };
}

// ── Request router ──

export async function handleMcpRequest(request: McpRequest): Promise<McpResponse> {
  try {
    switch (request.method) {
      case 'tools/list':
        return { result: { tools: MCP_TOOLS } };

      case 'tools/call': {
        const { name, arguments: args } = request.params as { name: string; arguments: Record<string, string> };
        switch (name) {
          case 'list_projects':
            return { result: await handleListProjects() };
          case 'get_project':
            return { result: await handleGetProject(args.projectId) };
          case 'get_git_status':
            return { result: await handleGetGitStatus(args.projectId) };
          default:
            return { error: { code: -32601, message: `Unknown tool: ${name}` } };
        }
      }

      default:
        return { error: { code: -32601, message: `Unknown method: ${request.method}` } };
    }
  } catch (e) {
    return { error: { code: -32603, message: String(e) } };
  }
}
