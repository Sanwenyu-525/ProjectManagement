import { getRuntime, isWindows } from './agent-runtimes';
import { terminalApi } from '../../api';
import { useWorkspaceStore } from '../../stores/workspaceStore';

/**
 * Create an agent tab. Returns tab data for the caller to bind to a pane
 * via workspaceStore.addTab(), or null if creation failed.
 */
export async function createAgent(runtimeId: string = 'claude'): Promise<{
  id: string;
  label: string;
  runtimeId: string;
} | null> {
  const runtime = getRuntime(runtimeId);
  if (!runtime) return null;

  // On Windows, ensure the launcher is ready before spawning.
  if (isWindows() && !localStorage.getItem('devhub_claude_launcher')) {
    try {
      const path = await terminalApi.setupAgentLauncher();
      localStorage.setItem('devhub_claude_launcher', path);
    } catch { /* ignore — will use fallback */ }
  }

  const wsState = useWorkspaceStore.getState();
  const agentCount = Object.values(wsState.tabs).filter(t => t.contentType === 'agent').length;
  const id = `agent-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const resolvedRuntime = getRuntime(runtimeId) || runtime;
  const label = `${resolvedRuntime.name} ${agentCount + 1}`;

  return { id, label, runtimeId };
}
