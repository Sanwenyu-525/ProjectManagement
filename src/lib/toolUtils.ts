/** Shared tool display utilities used by AgentChat, AgentActivityBar, and AgentContextPanel. */

/** Get the Material Symbols icon name for a tool. */
export function getToolIcon(toolName: string): string {
  const n = toolName.toLowerCase();
  if (n === 'bash' || n === 'bashcommand') return 'terminal';
  if (n === 'read' || n === 'read_file') return 'description';
  if (n === 'edit' || n === 'edit_file') return 'edit_note';
  if (n === 'write' || n === 'write_file') return 'save';
  if (n === 'glob') return 'search';
  if (n === 'grep') return 'find_in_page';
  if (n === 'todowrite' || n === 'task') return 'checklist';
  if (n === 'webfetch' || n === 'websearch') return 'language';
  return 'build';
}

/** Get the theme color variable for a tool. */
export function getToolColor(toolName: string): string {
  const n = toolName.toLowerCase();
  if (n === 'bash' || n === 'bashcommand') return 'var(--md-tertiary)';
  if (n === 'read' || n === 'read_file') return 'var(--md-primary)';
  if (n === 'edit' || n === 'edit_file') return 'var(--md-secondary)';
  if (n === 'write' || n === 'write_file') return 'var(--md-secondary)';
  if (n === 'glob') return 'var(--md-primary)';
  if (n === 'grep') return 'var(--md-primary)';
  if (n === 'todowrite' || n === 'task') return 'var(--md-tertiary)';
  if (n === 'webfetch' || n === 'websearch') return 'var(--md-primary)';
  return 'var(--md-outline)';
}

/** Get a human-readable summary from a tool's input parameters. */
export function getToolSummary(toolName: string, input: Record<string, unknown>, maxLen = 80): string {
  const n = toolName.toLowerCase();
  if ((n === 'bash' || n === 'bashcommand') && typeof input.command === 'string') {
    return input.command.length > maxLen ? input.command.slice(0, maxLen) + '...' : input.command;
  }
  if (typeof input.file_path === 'string') return input.file_path.split(/[/\\]/).pop() || input.file_path;
  if (typeof input.pattern === 'string') return input.pattern;
  if (typeof input.description === 'string') return input.description;
  for (const v of Object.values(input)) {
    if (typeof v === 'string' && v.length < maxLen + 40) return v;
  }
  return '';
}
