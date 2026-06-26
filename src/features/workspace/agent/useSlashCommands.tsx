import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import type { SlashCommandDef } from '../../../api';
import { customCommandsApi } from '../../../api/customCommands';
import type { CustomCommand } from '../../../api/customCommands';

// ── Command list ─────────────────────────────────────────────────

export const SLASH_COMMANDS: SlashCommandDef[] = [
  // Claude Code built-in
  { name: '/clear', description: '清空当前会话', icon: 'delete_sweep', category: 'claude' },
  { name: '/compact', description: '压缩上下文', icon: 'compress', category: 'claude' },
  { name: '/config', description: '查看/修改配置', icon: 'settings', category: 'claude' },
  { name: '/cost', description: '查看 token 用量', icon: 'paid', category: 'claude' },
  { name: '/diff', description: '查看 git diff', icon: 'difference', category: 'claude' },
  { name: '/doctor', description: '诊断安装', icon: 'health_and_safety', category: 'claude' },
  { name: '/export', description: '导出会话', icon: 'download', category: 'claude' },
  { name: '/help', description: '帮助信息', icon: 'help', category: 'claude' },
  { name: '/init', description: '初始化 CLAUDE.md', icon: 'rocket_launch', category: 'claude' },
  { name: '/login', description: '登录账号', icon: 'login', category: 'claude' },
  { name: '/logout', description: '登出账号', icon: 'logout', category: 'claude' },
  { name: '/mcp', description: '管理 MCP 服务器', icon: 'dns', category: 'claude' },
  { name: '/memory', description: '查看/编辑记忆', icon: 'psychology', category: 'claude' },
  { name: '/model', description: '切换模型', icon: 'smart_toy', category: 'claude' },
  { name: '/permissions', description: '管理权限', icon: 'shield', category: 'claude' },
  { name: '/pr-review', description: '审查 PR', icon: 'rate_review', category: 'claude' },
  { name: '/resume', description: '恢复会话', icon: 'history', category: 'claude' },
  { name: '/status', description: '系统状态', icon: 'info', category: 'claude' },
  { name: '/vim', description: 'vim 模式', icon: 'keyboard', category: 'claude' },
  // Skills
  { name: '/review', description: '审查分支/PR', icon: 'grading', category: 'skill' },
  { name: '/code-review', description: '代码审查', icon: 'rate_review', category: 'skill' },
  { name: '/security-review', description: '安全审查', icon: 'security', category: 'skill' },
  { name: '/simplify', description: '简化代码', icon: 'compress', category: 'skill' },
  { name: '/diagnose', description: '诊断 bug', icon: 'bug_report', category: 'skill' },
  { name: '/verify', description: '验证变更', icon: 'verified', category: 'skill' },
  { name: '/run', description: '启动应用', icon: 'play_arrow', category: 'skill' },
  { name: '/receiving-code-review', description: '处理代码审查反馈', icon: 'grading', category: 'skill' },
  { name: '/requesting-code-review', description: '请求代码审查', icon: 'rate_review', category: 'skill' },
  { name: '/systematic-debugging', description: '系统化调试', icon: 'bug_report', category: 'skill' },
  { name: '/test-driven-development', description: 'TDD 开发', icon: 'science', category: 'skill' },
  { name: '/verification-before-completion', description: '完成前验证', icon: 'verified', category: 'skill' },
  { name: '/improve-codebase-architecture', description: '改进代码架构', icon: 'architecture', category: 'skill' },
  { name: '/request-refactor-plan', description: '重构计划', icon: 'plagiarism', category: 'skill' },
  { name: '/writing-plans', description: '制定实现计划', icon: 'checklist', category: 'skill' },
  { name: '/planning-with-files', description: '基于文件的计划', icon: 'description', category: 'skill' },
  { name: '/subagent-driven-development', description: '子代理驱动开发', icon: 'group_work', category: 'skill' },
  { name: '/dispatching-parallel-agents', description: '并行子代理', icon: 'call_split', category: 'skill' },
  { name: '/finishing-a-development-branch', description: '完成开发分支', icon: 'merge', category: 'skill' },
  { name: '/using-git-worktrees', description: 'Git worktree 隔离', icon: 'account_tree', category: 'skill' },
  { name: '/setup-pre-commit', description: '设置 pre-commit hooks', icon: 'task_alt', category: 'skill' },
  { name: '/to-issues', description: '拆分为 issue', icon: 'assignment', category: 'skill' },
  { name: '/to-prd', description: '生成 PRD', icon: 'summarize', category: 'skill' },
  { name: '/triage', description: '分类管理 issue', icon: 'sort', category: 'skill' },
  { name: '/design-engineer-3', description: '界面设计', icon: 'palette', category: 'skill' },
  { name: '/design-an-interface', description: '多方案接口设计', icon: 'dashboard_customize', category: 'skill' },
  { name: '/ui-ux-pro-max', description: 'UI/UX 设计', icon: 'design_services', category: 'skill' },
  { name: '/taste-skill', description: '前端设计优化', icon: 'auto_awesome', category: 'skill' },
  { name: '/gpt-tasteskill', description: '高级 UI/UX + 动效', icon: 'animation', category: 'skill' },
  { name: '/soft-skill', description: '高端设计标准', icon: 'diamond', category: 'skill' },
  { name: '/redesign-skill', description: '升级网站', icon: 'web', category: 'skill' },
  { name: '/stitch-skill', description: '设计系统生成', icon: 'grid_on', category: 'skill' },
  { name: '/prototype', description: '构建原型', icon: 'build_circle', category: 'skill' },
  { name: '/doc-coauthoring', description: '协作写文档', icon: 'edit_note', category: 'skill' },
  { name: '/edit-article', description: '编辑文章', icon: 'article', category: 'skill' },
  { name: '/writing-shape', description: '整理素材成文', icon: 'text_snippet', category: 'skill' },
  { name: '/writing-beats', description: '节拍式叙事', icon: 'music_note', category: 'skill' },
  { name: '/writing-fragments', description: '素材碎片收集', icon: 'burst_mode', category: 'skill' },
  { name: '/writing-skills', description: '创建/编辑 skills', icon: 'extension', category: 'skill' },
  { name: '/brainstorming', description: '头脑风暴', icon: 'lightbulb', category: 'skill' },
  { name: '/internal-comms', description: '内部沟通文档', icon: 'campaign', category: 'skill' },
  { name: '/grill-with-docs', description: '方案压力测试', icon: 'quiz', category: 'skill' },
  { name: '/pdf', description: '处理 PDF', icon: 'picture_as_pdf', category: 'skill' },
  { name: '/docx', description: '处理 Word', icon: 'description', category: 'skill' },
  { name: '/xlsx', description: '处理 Excel', icon: 'table_chart', category: 'skill' },
  { name: '/pptx', description: '处理 PPT', icon: 'slideshow', category: 'skill' },
  { name: '/paper-writer', description: '中文学术论文写作', icon: 'school', category: 'skill' },
  { name: '/deep-research', description: '深度研究', icon: 'manage_search', category: 'skill' },
  { name: '/handoff', description: '交接当前对话', icon: 'swap_horiz', category: 'skill' },
  { name: '/webapp-testing', description: 'Web 应用测试', icon: 'web_asset', category: 'skill' },
  { name: '/image-to-code-skill', description: '图片转代码', icon: 'image', category: 'skill' },
  { name: '/imagegen-frontend-mobile', description: '移动端 UI 设计图', icon: 'phone_iphone', category: 'skill' },
  { name: '/algorithmic-art', description: '生成艺术', icon: 'brush', category: 'skill' },
  { name: '/canvas-design', description: '视觉设计', icon: 'format_paint', category: 'skill' },
  { name: '/brandkit', description: '品牌设计', icon: 'branding_watermark', category: 'skill' },
  { name: '/remotion', description: 'React 视频制作', icon: 'videocam', category: 'skill' },
  { name: '/slack-gif-creator', description: 'Slack GIF 制作', icon: 'gif_box', category: 'skill' },
  { name: '/caveman', description: '极简沟通模式', icon: 'emoji_nature', category: 'skill' },
  { name: '/claude-api', description: 'Claude API 参考', icon: 'api', category: 'skill' },
  { name: '/fewer-permission-prompts', description: '减少权限提示', icon: 'do_not_disturb_on', category: 'skill' },
  { name: '/keybindings-help', description: '自定义快捷键', icon: 'keyboard_command_key', category: 'skill' },
  { name: '/loop', description: '定时循环任务', icon: 'loop', category: 'skill' },
  { name: '/obsidian-vault', description: 'Obsidian 笔记管理', icon: 'note', category: 'skill' },
  { name: '/output-skill', description: '完整输出模式', icon: 'output', category: 'skill' },
  { name: '/migrate-to-shoehorn', description: '迁移类型断言', icon: 'swap_horiz', category: 'skill' },
  { name: '/scaffold-exercises', description: '搭建练习目录', icon: 'folder_special', category: 'skill' },
  { name: '/update-config', description: '配置 settings.json', icon: 'tune', category: 'skill' },
  // Project flow
  { name: '/feature', description: '实现新功能', icon: 'add_circle', category: 'project' },
  { name: '/fix', description: '修 bug', icon: 'healing', category: 'project' },
  { name: '/plan', description: '制定技术方案', icon: 'map', category: 'project' },
  { name: '/refactor', description: '增量重构', icon: 'recycling', category: 'project' },
  { name: '/ship', description: '提交前质量门', icon: 'rocket_launch', category: 'project' },
  { name: '/test', description: '系统化测试', icon: 'fact_check', category: 'project' },
  // Knowledge
  { name: '/knowledge', description: '查询知识库', icon: 'menu_book', category: 'project' },
  // Graph
  { name: '/graph impact', description: '查询文件影响范围', icon: 'hub', category: 'project' },
  { name: '/graph deps', description: '查询文件依赖链', icon: 'account_tree', category: 'project' },
  { name: '/graph layers', description: '查询架构分层', icon: 'layers', category: 'project' },
  // Audit
  { name: '/audit', description: '执行项目巡检', icon: 'fact_check', category: 'project' },
];

// ── Hook ─────────────────────────────────────────────────────────

export function useSlashCommands() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [index, setIndex] = useState(0);
  const [customCmds, setCustomCmds] = useState<CustomCommand[]>([]);
  const anchorRef = useRef<HTMLDivElement>(null);

  // 加载自定义命令
  useEffect(() => {
    customCommandsApi.list().then(setCustomCmds).catch(() => {});
  }, []);

  const allCommands = useMemo(() => {
    const builtIn: SlashCommandDef[] = SLASH_COMMANDS;
    const custom: SlashCommandDef[] = customCmds.map(c => ({
      name: c.name,
      description: c.description || c.content.slice(0, 40),
      icon: c.icon,
      category: 'custom' as const,
    }));
    return [...builtIn, ...custom];
  }, [customCmds]);

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    return allCommands.filter(c =>
      c.name.toLowerCase().includes(q) || c.description.toLowerCase().includes(q)
    );
  }, [query, allCommands]);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    const match = val.match(/^\/([\w -]*)$/);
    if (match) { setOpen(true); setQuery(match[1]); setIndex(0); }
    else { setOpen(false); }
    return val;
  }, []);

  const handleSelect = useCallback((name: string) => {
    setOpen(false);
    setQuery('');
    return name + ' ';
  }, []);

  // 自定义命令内容查找（按名称匹配）
  const getCustomContent = useCallback((name: string): string | null => {
    const cmd = customCmds.find(c => c.name === name);
    return cmd?.content ?? null;
  }, [customCmds]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (open && filtered.length > 0) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setIndex(i => (i + 1) % filtered.length); return true; }
      if (e.key === 'ArrowUp') { e.preventDefault(); setIndex(i => (i - 1 + filtered.length) % filtered.length); return true; }
      if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); return filtered[index].name + ' '; }
      if (e.key === 'Escape') { e.preventDefault(); setOpen(false); return true; }
    }
    return false;
  }, [open, filtered, index]);

  return { open, filtered, index, setIndex, anchorRef, handleInputChange, handleSelect, handleKeyDown, getCustomContent };
}

// ── Menu component (portal) ──────────────────────────────────────

const CATEGORY_LABELS: Record<string, string> = {
  claude: 'Claude Code', skill: 'Skills', project: 'Project', custom: 'Custom',
};

interface SlashMenuProps {
  filtered: SlashCommandDef[];
  selectedIndex: number;
  onSelectedIndexChange: (idx: number) => void;
  onSelect: (name: string) => void;
  anchorRef: React.RefObject<HTMLDivElement | null>;
}

export function SlashMenu({ filtered, selectedIndex, onSelectedIndexChange, onSelect, anchorRef }: SlashMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; width: number; bottom: number } | null>(null);

  const grouped = useMemo(() => {
    const map = new Map<string, SlashCommandDef[]>();
    for (const cmd of filtered) {
      const cat = cmd.category || 'other';
      const arr = map.get(cat);
      if (arr) arr.push(cmd); else map.set(cat, [cmd]);
    }
    return map;
  }, [filtered]);

  useEffect(() => {
    const anchor = anchorRef.current;
    if (!anchor) return;
    const rect = anchor.getBoundingClientRect();
    setPos({ left: rect.left, width: rect.width, bottom: rect.top - 4 });
  }, [anchorRef, filtered]);

  useEffect(() => {
    if (selectedIndex >= filtered.length) onSelectedIndexChange(Math.max(0, filtered.length - 1));
  }, [filtered.length, selectedIndex, onSelectedIndexChange]);

  useEffect(() => {
    const el = menuRef.current?.querySelector(`[data-idx="${selectedIndex}"]`) as HTMLElement | undefined;
    el?.scrollIntoView({ block: 'nearest' });
  }, [selectedIndex]);

  if (filtered.length === 0 || !pos) return null;

  let globalIdx = 0;

  return createPortal(
    <div ref={menuRef} style={{
      position: 'fixed', left: pos.left, width: pos.width,
      bottom: window.innerHeight - pos.bottom,
      maxHeight: 240, overflowY: 'auto',
      background: 'var(--md-surface-container-low)',
      border: '1px solid var(--border)',
      borderRadius: 10, boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
      padding: 4, zIndex: 9999,
    }}>
      {Array.from(grouped.entries()).map(([cat, cmds]) => (
        <div key={cat}>
          <div style={{
            fontSize: 10, fontWeight: 700,
            color: 'var(--md-on-surface-variant)',
            textTransform: 'uppercase' as const, letterSpacing: '0.06em',
            padding: '8px 10px 3px', fontFamily: 'var(--font-sans)',
          }}>
            {CATEGORY_LABELS[cat] || cat}
          </div>
          {cmds.map(cmd => {
            const idx = globalIdx++;
            const selected = idx === selectedIndex;
            return (
              <div key={cmd.name} data-idx={idx} style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '6px 8px', borderRadius: 7, cursor: 'pointer',
                fontSize: 13, fontFamily: 'var(--font-sans)',
                background: selected ? 'var(--md-primary-container)' : 'transparent',
                color: selected ? 'var(--md-on-primary-container)' : 'var(--md-on-surface)',
              }}
                onMouseDown={e => { e.preventDefault(); onSelect(cmd.name); }}
                onMouseEnter={() => onSelectedIndexChange(idx)}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 16, color: 'var(--md-primary)', flexShrink: 0 }}>{cmd.icon}</span>
                <span style={{ fontWeight: 600, fontFamily: 'var(--font-mono)', fontSize: 12, flexShrink: 0 }}>{cmd.name}</span>
                <span style={{ fontSize: 12, color: 'var(--md-on-surface-variant)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cmd.description}</span>
              </div>
            );
          })}
        </div>
      ))}
    </div>,
    document.body
  );
}
