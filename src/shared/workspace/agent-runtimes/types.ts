/**
 * Agent Runtime — defines how an AI agent CLI is spawned and managed.
 *
 * An agent is fundamentally a terminal running a specific command.
 * The runtime knows: command, args, display name, and status parsing.
 */

export interface AgentRuntime {
  /** Unique identifier (e.g., 'claude', 'gemini', 'codex') */
  id: string;

  /** Display name (e.g., 'Claude', 'Gemini CLI') */
  name: string;

  /** Command to spawn (e.g., 'claude') */
  command: string;

  /** Default arguments */
  args: string[];

  /** Color for the agent indicator */
  color: string;

  /** Icon (antd icon name) */
  icon: string;
}

/**
 * Registry of available agent runtimes.
 * To add a new agent: just add an entry here.
 */
export const AGENT_RUNTIMES: Record<string, AgentRuntime> = {
  claude: {
    id: 'claude',
    name: 'Claude',
    command: 'claude',
    args: [],
    color: '#d97706',
    icon: 'ThunderboltOutlined',
  },
  // Future runtimes:
  // gemini: {
  //   id: 'gemini',
  //   name: 'Gemini',
  //   command: 'gemini',
  //   args: [],
  //   color: '#4285f4',
  //   icon: 'GlobalOutlined',
  // },
  // codex: {
  //   id: 'codex',
  //   name: 'Codex',
  //   command: 'codex',
  //   args: [],
  //   color: '#10a37f',
  //   icon: 'CodeOutlined',
  // },
};

export function getRuntime(id: string): AgentRuntime | undefined {
  return AGENT_RUNTIMES[id];
}

export function getAllRuntimes(): AgentRuntime[] {
  return Object.values(AGENT_RUNTIMES);
}
