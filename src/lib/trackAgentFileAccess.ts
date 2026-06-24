import type { FileOperation } from '../stores/agentContextStore';
import { useAgentContextStore } from '../stores/agentContextStore';

// 工具名（小写） → 操作类型
const TOOL_OP_MAP: Record<string, FileOperation> = {
  read:       'read',
  read_file:  'read',
  edit:       'edit',
  edit_file:  'edit',
  write:      'write',
  write_file: 'write',
  glob:       'search',
  grep:       'search',
};

/**
 * 从 tool_use block 的 input 中提取文件路径。
 * 返回 null 表示该工具不涉及文件或无法提取路径。
 */
export function extractFilePath(
  toolName: string,
  input: Record<string, unknown>,
): string | null {
  const n = toolName.toLowerCase();

  // Read/Edit/Write 系列：input.file_path
  if (typeof input.file_path === 'string') return input.file_path;

  // Bash：尝试从 command 中启发式提取
  if (n === 'bash' || n === 'bashcommand') {
    if (typeof input.command !== 'string') return null;
    const m = input.command.match(/(?:cat|less|head|tail|vi|vim|nano|code|subl)\s+([^\s;|&]+)/);
    return m?.[1] ?? null;
  }

  return null;
}

/**
 * 处理一个 tool_use block，将文件操作记录到 context store。
 * 在 ClaudeProvider 和 AgentGUIPanel 中共用。
 */
export function trackToolFileAccess(
  sessionId: string,
  toolName: string,
  input: Record<string, unknown>,
): void {
  const n = toolName.toLowerCase();
  const operation = TOOL_OP_MAP[n];
  if (!operation) return;

  const filePath = extractFilePath(toolName, input);
  if (!filePath) return;

  useAgentContextStore.getState().trackFileAccess(sessionId, filePath, operation);
}
