import type { AgentProvider } from './AgentProvider';
import { ClaudeProvider } from './ClaudeProvider';

/**
 * Adapter factory: create an AgentProvider instance for a given type.
 * Currently only 'claude' is supported.
 */
export function createProvider(type: string): AgentProvider {
  if (type === 'claude') return new ClaudeProvider();
  throw new Error(`Unknown provider type: ${type}`);
}
