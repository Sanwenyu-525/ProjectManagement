import type { AgentProvider } from './AgentProvider';
import { ClaudeProvider } from './ClaudeProvider';

/**
 * Adapter factory: create an AgentProvider instance for a given type.
 * Currently only 'claude' is supported; other types return undefined.
 */
export function createProvider(_type: string): AgentProvider | undefined {
  return new ClaudeProvider();
}
