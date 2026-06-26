import { formatShortcut } from './keyboard';
import { useThemeStore } from '../stores/themeStore';
import { useAgentUIStore } from '../stores/agentUIStore';
import { useAgentTabStore } from '../stores/agentTabStore';
import { useWorkspaceStore } from '../stores/workspaceStore';

// ── Types ───────────────────────────────────────────────────────────────────

export type CommandCategory = 'navigation' | 'workspace' | 'project' | 'theme' | 'agent' | 'git';

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
  keywords?: string[];     // 额外搜索词（中英文别名）
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
  git: 'Git',
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
      useAgentUIStore.getState().togglePanelCollapsed();
    },
  },
  {
    id: 'toggle-editor-drawer',
    label: '切换全局编辑器',
    icon: 'code',
    category: 'workspace',
    shortcut: formatShortcut({ ctrl: true, key: 'e' }),
    keys: { ctrl: true, key: 'e' },
    action: () => {
      useWorkspaceStore.getState().toggleDrawer();
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
    keywords: ['新建', 'new', 'agent', '标签'],
    action: () => {
      useAgentTabStore.getState().addTab();
    },
  },
  {
    id: 'clear-agent-history',
    label: '清除 Agent 历史',
    icon: 'delete_sweep',
    category: 'agent',
    keywords: ['clear', '清除', '历史', 'history'],
    action: () => {
      const store = useAgentTabStore.getState();
      for (const tab of store.tabs) store.closeTab(tab.id);
      store.addTab();
    },
  },

  // ── Git ──
  {
    id: 'git-status',
    label: '查看 Git 状态',
    description: '打开工作区 Git 面板',
    icon: 'source',
    category: 'git',
    keywords: ['git', 'status', '状态', 'git status'],
    action: () => _navigate('/workspace'),
  },
  {
    id: 'git-commit',
    label: 'Git 提交',
    description: '在 Git 面板创建提交',
    icon: 'commit',
    category: 'git',
    keywords: ['git', 'commit', '提交', '保存'],
    action: () => _navigate('/workspace'),
  },
  {
    id: 'git-push',
    label: 'Git 推送',
    description: '推送到远程仓库',
    icon: 'upload',
    category: 'git',
    keywords: ['git', 'push', '推送', '上传'],
    action: () => _navigate('/workspace'),
  },
  {
    id: 'git-pull',
    label: 'Git 拉取',
    description: '从远程仓库拉取',
    icon: 'download',
    category: 'git',
    keywords: ['git', 'pull', '拉取', '同步'],
    action: () => _navigate('/workspace'),
  },
  {
    id: 'git-branches',
    label: '分支管理',
    description: '查看和切换分支',
    icon: 'account_tree',
    category: 'git',
    keywords: ['git', 'branch', '分支', '切换'],
    action: () => _navigate('/workspace'),
  },

  // ── Project actions ──
  {
    id: 'run-health-check',
    label: '运行健康检查',
    description: '检查所有项目健康状态',
    icon: 'health_and_safety',
    category: 'project',
    keywords: ['health', '健康', '检查', '诊断'],
    action: () => _navigate('/projects'),
  },
  {
    id: 'run-audit',
    label: '运行项目审计',
    description: '多维度项目评估',
    icon: 'assessment',
    category: 'project',
    keywords: ['audit', '审计', '评估', '报告'],
    action: () => _navigate('/projects'),
  },
  {
    id: 'open-knowledge',
    label: '打开知识库',
    description: '/knowledge',
    icon: 'menu_book',
    category: 'navigation',
    keywords: ['knowledge', '知识', '知识库', '笔记'],
    action: () => _navigate('/knowledge'),
  },
  {
    id: 'open-timeline',
    label: '打开时间线',
    description: '/timeline',
    icon: 'timeline',
    category: 'navigation',
    keywords: ['timeline', '时间线', '历史', '活动'],
    action: () => _navigate('/timeline'),
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
