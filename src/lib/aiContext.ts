/**
 * AI Context Manager — provides project awareness to agents.
 *
 * Tracks workspace state and generates context summaries that agents
 * can use to understand the project structure, recent changes, and
 * available tools.
 *
 * This is the foundation for MCP integration and multi-agent coordination.
 */

import { projectsApi, gitApi } from '../api';

export interface ProjectContext {
  id: string;
  name: string;
  path: string;
  techStack: string[];
  status: string;
  recentChanges?: string[];
  gitBranch?: string;
  dirtyFiles?: number;
}

export interface WorkspaceContext {
  projects: ProjectContext[];
  openTabs: Array<{ id: string; label: string; type: string }>;
  activeProject?: string;
  generatedAt: number;
}

/**
 * Generate a context summary for agents.
 * This is a lightweight snapshot — not a full MCP server.
 */
export async function generateWorkspaceContext(
  openTabs: Array<{ id: string; label: string; type: string }>,
  activeProjectId?: string,
): Promise<WorkspaceContext> {
  const projects = await projectsApi.list();
  const projectContexts: ProjectContext[] = [];

  for (const p of projects.slice(0, 20)) { // Limit to 20 for performance
    const ctx: ProjectContext = {
      id: p.id,
      name: p.name,
      path: p.localPath || '',
      techStack: p.techStack || [],
      status: p.status,
    };

    // Add git info for active project
    if (p.localPath && p.id === activeProjectId) {
      try {
        const [status, branches] = await Promise.all([
          gitApi.status(p.localPath).catch(() => []),
          gitApi.branches(p.localPath).catch(() => ({ current: null })),
        ]);
        ctx.dirtyFiles = Array.isArray(status) ? status.length : 0;
        ctx.gitBranch = (branches as { current?: string })?.current || undefined;
      } catch { /* ignore */ }
    }

    projectContexts.push(ctx);
  }

  return {
    projects: projectContexts,
    openTabs,
    activeProject: activeProjectId,
    generatedAt: Date.now(),
  };
}

/**
 * Format context as a text prompt for agents.
 * This is what gets injected into the agent's system prompt or context window.
 */
export function formatContextForAgent(ctx: WorkspaceContext): string {
  const lines: string[] = ['# Workspace Context', ''];

  // Active project
  if (ctx.activeProject) {
    const active = ctx.projects.find(p => p.id === ctx.activeProject);
    if (active) {
      lines.push(`## Active Project: ${active.name}`);
      lines.push(`- Path: ${active.path}`);
      lines.push(`- Tech: ${active.techStack.join(', ')}`);
      lines.push(`- Status: ${active.status}`);
      if (active.gitBranch) lines.push(`- Branch: ${active.gitBranch}`);
      if (active.dirtyFiles !== undefined) lines.push(`- Dirty files: ${active.dirtyFiles}`);
      lines.push('');
    }
  }

  // Open tabs
  if (ctx.openTabs.length > 0) {
    lines.push('## Open Tabs');
    for (const tab of ctx.openTabs) {
      lines.push(`- [${tab.type}] ${tab.label}`);
    }
    lines.push('');
  }

  // All projects (summary)
  if (ctx.projects.length > 1) {
    lines.push(`## Projects (${ctx.projects.length})`);
    for (const p of ctx.projects.slice(0, 10)) {
      lines.push(`- ${p.name} (${p.status}) — ${p.techStack.slice(0, 3).join(', ')}`);
    }
    if (ctx.projects.length > 10) {
      lines.push(`- ... and ${ctx.projects.length - 10} more`);
    }
    lines.push('');
  }

  return lines.join('\n');
}
