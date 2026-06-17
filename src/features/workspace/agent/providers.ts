import type { AgentProvider } from './AgentProvider';
import { ClaudeProvider } from './ClaudeProvider';

const providers: AgentProvider[] = [
  new ClaudeProvider(),
];

export function getProviders(): AgentProvider[] {
  return providers;
}

export function getProvider(id: string): AgentProvider | undefined {
  return providers.find(p => p.id === id);
}
