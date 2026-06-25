import { formatShortcut } from './keyboard';
import { useThemeStore } from '../stores/themeStore';
import { useAgentWorkspaceStore } from '../stores/agentWorkspaceStore';
import { useAgentTabStore } from '../stores/agentTabStore';

// ── Types ───────────────────────────────────────────────────────────────────

export type CommandCategory = 'navigation' | 'workspace' | 'project' | 'theme' | 'agent';

export interface CommandDef {
  id: string;
  label: string;
  description?: string;
  icon: string;
  category: CommandCategory;
  shortcut?: string;       // display string, e.g. "Ctrl+K"
  keys?: { ctrl?: boolean; shift?: boolean; key: string };
  when?: (e: KeyboardEvent) => boolean;
  action: () => void;
}

// ── Navigate bridge ─────────────────────────────────────────────────────────

let _navigate: (to: string) => void = () => {};

/** Call once in MainLayout on mount. */
export function setCommandNavigate(fn: (to: string) => void): void {
  _navigate = fn;
}

// ── File-panel toggle bridge (for Ctrl+B) ───────────────────────────────────

let _toggleFilePanel: (() => void) | null = null;

export function setToggleFilePanel(fn: () => void): void {
  _toggleFilePanel = fn;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

const isInputEvent = (e: KeyboardEvent): boolean => {
  const tag = (e.target as HTMLElement).tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement).isContentEditable;
};

// ── Category labels (Chinese) ───────────────────────────────────────────────

export const CATEGORY_LABELS: Record<CommandCategory, string> = {
  navigation: '导航',
  workspace: '工作区',
  project: '项目',
  theme: '主题与显示',
  agent: 'Agent',
};

// ── Command definitions ─────────────────────────────────────────────────────

export const COMMANDS: CommandDef[] = [
  // ── Navigation ──
  {
    id: 'palette',
    label: '命令面板',
    description: '搜索命令、项目或文件',
    icon: 'search',
    category: 'navigation',
    shortcut: formatShortcut({ ctrl: true, key: 'k' }),
    keys: { ctrl: true, key: 'k' },
    when: () => true, // handled by SearchBox itself, just for display
    action: () => {},
  },
  {
    id: 'workspace',
    label: '前往工作区',
    description: '/',
    icon: 'smart_toy',
    category: 'navigation',
    action: () => _navigate('/'),
  },
  {
    id: 'projects',
    label: '前往项目管理',
    description: '/projects',
    icon: 'work',
    category: 'navigation',
    action: () => _navigate('/projects'),
  },
  {
    id: 'settings',
    label: '前往设置',
    description: '/settings',
    icon: 'settings',
    category: 'navigation',
    action: () => _navigate('/settings'),
  },
  {
    id: 'shortcuts',
    label: '查看快捷键',
    description: '?',
    icon: 'keyboard',
    category: 'navigation',
    action: () => {
      useThemeStore.getState().toggleShortcutsModal();
    },
  },

  // ── Workspace ──
  {
    id: 'toggle-file-explorer',
    label: '切换文件浏览器',
    icon: 'folder_open',
    category: 'workspace',
    shortcut: formatShortcut({ ctrl: true, key: 'b' }),
    keys: { ctrl: true, key: 'b' },
    action: () => _toggleFilePanel?.(),
  },
  {
    id: 'toggle-right-panel',
    label: '切换右侧面板',
    icon: 'vertical_split',
    category: 'workspace',
    shortcut: formatShortcut({ ctrl: true, key: '\\' }),
    keys: { ctrl: true, key: '\\' },
    action: () => {
      useAgentWorkspaceStore.getState().togglePanelCollapsed();
    },
  },

  // ── Project ──
  {
    id: 'new-project',
    label: '新建项目',
    description: '创建一个新项目',
    icon: 'add',
    category: 'project',
    shortcut: formatShortcut({ ctrl: true, key: 'n' }),
    keys: { ctrl: true, key: 'n' },
    action: () => _navigate('/projects?new=true'),
  },

  // ── Agent ──
  {
    id: 'new-agent-tab',
    label: '新建 Agent 标签页',
    icon: 'add_comment',
    category: 'agent',
    action: () => {
      useAgentTabStore.getState().addTab();
    },
  },

  // ── Theme ──
  {
    id: 'density',
    label: '切换密度',
    description: '宽松 / 紧凑 / 密集',
    icon: 'density_medium',
    category: 'theme',
    shortcut: formatShortcut({ ctrl: true, key: 'd' }),
    keys: { ctrl: true, key: 'd' },
    when: e => !isInputEvent(e),
    action: () => {
      const order = ['comfortable', 'compact', 'dense'] as const;
      const current = useThemeStore.getState().density;
      const next = order[(order.indexOf(current) + 1) % 3];
      useThemeStore.getState().setDensity(next);
    },
  },
  {
    id: 'theme',
    label: '切换主题',
    description: '暗色 / 亮色',
    icon: 'dark_mode',
    category: 'theme',
    shortcut: formatShortcut({ ctrl: true, shift: true, key: 'D' }),
    keys: { ctrl: true, shift: true, key: 'D' },
    when: e => !isInputEvent(e),
    action: () => {
      useThemeStore.getState().toggle();
    },
  },
];

// ── Derived data ────────────────────────────────────────────────────────────

/** Commands that have keyboard shortcuts (for ShortcutsModal). */
export const COMMANDS_WITH_SHORTCUTS = COMMANDS.filter(c => c.shortcut && c.id !== 'palette');

/** Commands grouped by category, preserving definition order. */
export function getCommandsByCategory(): Map<CommandCategory, CommandDef[]> {
  const map = new Map<CommandCategory, CommandDef[]>();
  for (const cmd of COMMANDS) {
    if (cmd.id === 'palette') continue; // not shown in palette
    const list = map.get(cmd.category) ?? [];
    list.push(cmd);
    map.set(cmd.category, list);
  }
  return map;
}

/** Find a command by ID. */
export function findCommandById(id: string): CommandDef | undefined {
  return COMMANDS.find(c => c.id === id);
}

/** Check if a keyboard event matches a command's key definition + when guard. */
export function matchesShortcut(e: KeyboardEvent, def: CommandDef): boolean {
  if (!def.keys) return false;
  if (def.when && !def.when(e)) return false;
  return (
    !!def.keys.ctrl === (e.ctrlKey || e.metaKey) &&
    !!def.keys.shift === e.shiftKey &&
    e.key.toLowerCase() === def.keys.key.toLowerCase()
  );
}
