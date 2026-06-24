import { useState, useCallback, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Modal } from 'antd';
import { open } from '@tauri-apps/plugin-dialog';
import { useAgentTabStore } from '../../../stores/agentTabStore';
import { useAgentStore } from '../../../stores/agentStore';
import { useTerminalStore } from '../../../stores/terminalStore';
import { folderName } from '../components/terminalFactory';
import StatusDot from '../components/StatusDot';
import { PROMPT_TEMPLATES, PHASE_META } from './promptTemplates';

/** Quick command categories */
export interface QuickCommand {
  label: string;
  text: string;
  icon: string;
  tip: string;
  group?: string;
}

export interface QuickCommandCategory {
  name: string;
  icon: string;
  commands: QuickCommand[];
}

// Generate quick commands from prompt templates (only no-variable templates)
const promptQuickCommands: QuickCommand[] = PROMPT_TEMPLATES
  .filter(t => !(t.variables ?? []).length && !t.template.includes('{{'))
  .map(t => ({
    label: t.label,
    text: t.template,
    icon: t.icon,
    tip: t.description,
    group: PHASE_META[t.phase].label,
  }));

export const QUICK_COMMAND_CATEGORIES: QuickCommandCategory[] = [
  {
    name: 'Claude',
    icon: 'smart_toy',
    commands: [
      { label: 'clear', text: '/clear', icon: 'delete_sweep', tip: '清空当前会话' },
      { label: 'compact', text: '/compact', icon: 'compress', tip: '压缩上下文，节省 token' },
      { label: 'cost', text: '/cost', icon: 'paid', tip: '查看当前 token 用量和费用' },
      { label: 'model', text: '/model', icon: 'smart_toy', tip: '切换模型（Opus/Sonnet/Haiku）' },
      { label: 'help', text: '/help', icon: 'help', tip: '查看帮助信息' },
      { label: 'status', text: '/status', icon: 'info', tip: '查看系统状态' },
    ],
  },
  {
    name: '开发',
    icon: 'code',
    commands: [
      { label: '新功能', text: '/feature ', icon: 'add_circle', tip: '按流程实现新功能：理解→计划→确认→实现→验证' },
      { label: '修 Bug', text: '/fix ', icon: 'healing', tip: '按流程修复 bug：诊断→确认根因→最小 diff 修复→验证' },
      { label: '技术方案', text: '/plan ', icon: 'map', tip: '制定可执行的技术方案' },
      { label: '重构', text: '/refactor ', icon: 'recycling', tip: '增量重构：理解依赖→分步计划→逐步执行→验证' },
      { label: '提交检查', text: '/ship', icon: 'rocket_launch', tip: '提交前质量门：检查→审查→生成 commit message→提交' },
    ],
  },
  {
    name: '分析',
    icon: 'analytics',
    commands: [
      { label: '审查变更', text: '/review', icon: 'grading', tip: '审查当前分支变更' },
      { label: '代码审查', text: '/code-review', icon: 'rate_review', tip: '深度代码审查' },
      { label: '诊断 Bug', text: '/diagnose ', icon: 'bug_report', tip: '系统化诊断 bug 根因' },
      { label: '验证', text: '/verify', icon: 'verified', tip: '验证变更是否生效' },
    ],
  },
  {
    name: '提示词',
    icon: 'record_voice_over',
    commands: promptQuickCommands,
  },
];

interface AgentTabBarProps {
  onCloseTab?: (tabId: string) => void;
}

export default function AgentTabBar({ onCloseTab }: AgentTabBarProps) {
  const tabs = useAgentTabStore(s => s.tabs);
  const activeTabId = useAgentTabStore(s => s.activeTabId);
  const switchTab = useAgentTabStore(s => s.switchTab);
  const addTab = useAgentTabStore(s => s.addTab);
  const streamingSessionId = useAgentStore(s => s.streamingSessionId);
  const endedSessionIds = useAgentStore(s => s.endedSessionIds);
  const errorSessionIds = useAgentStore(s => s.errorSessionIds);
  const setAgentMode = useAgentTabStore(s => s.setAgentMode);
  const defaultCwd = useTerminalStore(s => s.defaultCwd);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [confirmTabId, setConfirmTabId] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [dropdownPos, setDropdownPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const categoryRefs = useRef<Map<string, HTMLButtonElement>>(new Map());

  // New conversation default path
  const newCwd = localStorage.getItem('agent_lastCwd') || defaultCwd;
  const newCwdName = newCwd ? folderName(newCwd) : '未设置';

  const handleBrowse = useCallback(async () => {
    const selected = await open({ directory: true, title: '选择新对话目录' });
    if (selected && typeof selected === 'string') {
      localStorage.setItem('agent_lastCwd', selected);
      const newId = useAgentTabStore.getState().addTab();
      useAgentTabStore.getState().setCwd(newId, selected);
    }
  }, []);

  const handleCommandClick = useCallback((text: string) => {
    window.dispatchEvent(new CustomEvent('agentQuickCommand', { detail: text }));
  }, []);

  // Close category dropdown when clicking outside
  useEffect(() => {
    if (!activeCategory) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('[data-cmd-bar]') && !target.closest('[data-cmd-dropdown]')) {
        setActiveCategory(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [activeCategory]);

  // Determine active tab mode for category visibility
  const activeTab = tabs.find(t => t.id === activeTabId);
  const isGuiMode = activeTab?.agentMode === 'gui';

  return (
    <div style={styles.tabBar}>
      {/* Row 1: Tabs */}
      <div style={styles.tabsRow}>
        {tabs.map(tab => {
          const isActive = tab.id === activeTabId;
          const isStreaming = tab.sessionId != null && streamingSessionId === tab.sessionId;
          const tabStatus: 'running' | 'ended' | 'error' | 'none' =
            tab.sessionId == null ? 'none'
            : isStreaming ? 'running'
            : tab.sessionId in errorSessionIds ? 'error'
            : tab.sessionId in endedSessionIds ? 'ended'
            : 'none';
          const showClose = true;
          return (
            <div
              key={tab.id}
              onClick={() => switchTab(tab.id)}
              onMouseEnter={() => setHoveredId(tab.id)}
              onMouseLeave={() => setHoveredId(null)}
              title={`${tab.label}\n${tab.cwd || localStorage.getItem('agent_lastCwd') || defaultCwd || '未设置路径'}`}
              style={{
                ...styles.tab,
                ...(isActive ? styles.tabActive : {}),
                opacity: isActive ? 1 : 0.7,
              }}
            >
              <span className="material-symbols-outlined" style={{
                fontSize: 16,
                color: isActive ? 'var(--md-primary)' : 'var(--md-tertiary-container)',
              }}>
                {tab.agentMode === 'gui' ? 'chat' : 'terminal'}
              </span>
              <StatusDot status={tabStatus} />
              <span style={styles.tabLabel}>{tab.label}</span>
              {isActive && (
                <span style={styles.tabCwd} title={tab.cwd || localStorage.getItem('agent_lastCwd') || defaultCwd}>
                  · {folderName(tab.cwd || localStorage.getItem('agent_lastCwd') || defaultCwd)}
                </span>
              )}
              {showClose && (
                <span
                  className="material-symbols-outlined"
                  role="button"
                  aria-label="切换标签模式"
                  title="切换模式"
                  style={{
                    ...styles.closeIcon,
                    opacity: isActive || hoveredId === tab.id ? 1 : 0,
                    pointerEvents: isActive || hoveredId === tab.id ? 'auto' : 'none',
                  }}
                  tabIndex={isActive || hoveredId === tab.id ? 0 : -1}
                  onClick={e => { e.stopPropagation(); setConfirmTabId(tab.id); }}
                >swap_horiz</span>
              )}
              {showClose && (
                <span
                  className="material-symbols-outlined"
                  role="button"
                  aria-label="关闭标签"
                  style={{
                    ...styles.closeIcon,
                    opacity: isActive || hoveredId === tab.id ? 1 : 0,
                    pointerEvents: isActive || hoveredId === tab.id ? 'auto' : 'none',
                  }}
                  tabIndex={isActive || hoveredId === tab.id ? 0 : -1}
                  onClick={e => { e.stopPropagation(); onCloseTab?.(tab.id); }}
                >close</span>
              )}
            </div>
          );
        })}
      </div>

      {/* Right side buttons */}
      <div style={styles.rightActions}>
        <div
          role="button"
          aria-label={`选择新对话目录: ${newCwdName}`}
          tabIndex={0}
          onClick={handleBrowse}
          onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleBrowse(); } }}
          style={styles.folderBtn}
          title={`新对话目录：${newCwd}`}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 18, color: 'var(--md-on-surface-variant)' }}>
            folder
          </span>
          <span style={styles.folderLabel}>{newCwdName}</span>
        </div>
        <div
          role="button"
          aria-label="新建对话"
          tabIndex={0}
          onClick={addTab}
          onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); addTab(); } }}
          style={styles.addTabBtn}
          title="新对话"
        >
          <span className="material-symbols-outlined" style={{ fontSize: 18, color: 'var(--md-on-surface-variant)' }}>
            add
          </span>
        </div>
      </div>

      {/* Row 2: Quick commands */}
      <div style={styles.commandRow} data-cmd-bar>
        {QUICK_COMMAND_CATEGORIES.map(cat => {
          const isActive = activeCategory === cat.name;
          return (
            <div key={cat.name} style={styles.categoryWrapper}>
              <button
                ref={el => { if (el) categoryRefs.current.set(cat.name, el); }}
                onClick={() => {
                  if (activeCategory === cat.name) {
                    setActiveCategory(null);
                  } else {
                    const btn = categoryRefs.current.get(cat.name);
                    if (btn) {
                      const rect = btn.getBoundingClientRect();
                      const DROPDOWN_WIDTH = 360;
                      const MARGIN = 8;
                      const center = rect.left + rect.width / 2;
                      const vw = window.innerWidth;
                      let left: number;
                      if (center - DROPDOWN_WIDTH / 2 < MARGIN) {
                        left = MARGIN;
                      } else if (center + DROPDOWN_WIDTH / 2 > vw - MARGIN) {
                        left = vw - MARGIN - DROPDOWN_WIDTH;
                      } else {
                        left = center - DROPDOWN_WIDTH / 2;
                      }
                      setDropdownPos({ top: rect.bottom + 4, left });
                    }
                    setActiveCategory(cat.name);
                  }
                }}
                style={{
                  ...styles.categoryBtn,
                  ...(isActive ? styles.categoryBtnActive : {}),
                }}
                title={cat.name}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>{cat.icon}</span>
                <span>{cat.name}</span>
                <span className="material-symbols-outlined" style={{
                  fontSize: 14,
                  transition: 'transform 0.15s',
                  transform: isActive ? 'rotate(180deg)' : 'rotate(0deg)',
                }}>expand_more</span>
              </button>
              {isActive && createPortal(
                <div data-cmd-dropdown style={{
                  ...styles.dropdown,
                  position: 'fixed',
                  top: dropdownPos.top,
                  left: dropdownPos.left,
                }}>
                  {(() => {
                    // Group commands by `group` field, preserving order
                    const sections: { group: string | null; items: QuickCommand[] }[] = [];
                    let current: { group: string | null; items: QuickCommand[] } | null = null;
                    for (const cmd of cat.commands) {
                      const g = cmd.group ?? null;
                      if (!current || current.group !== g) {
                        current = { group: g, items: [] };
                        sections.push(current);
                      }
                      current.items.push(cmd);
                    }
                    return sections.map((section, si) => (
                      <div key={section.group ?? si}>
                        {section.group && (
                          <div style={styles.groupHeader}>{section.group}</div>
                        )}
                        {section.items.map(cmd => (
                          <button
                            key={cmd.label}
                            onClick={() => {
                              handleCommandClick(cmd.text);
                              setActiveCategory(null);
                            }}
                            onMouseEnter={e => { e.currentTarget.style.background = 'var(--md-surface-container-high)'; }}
                            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                            style={styles.dropdownItem}
                            title={cmd.tip}
                          >
                            <span className="material-symbols-outlined" style={{ fontSize: 16, color: 'var(--md-primary)', flexShrink: 0 }}>
                              {cmd.icon}
                            </span>
                            <div style={styles.dropdownText}>
                              <span style={styles.dropdownLabel}>{cmd.label}</span>
                              <span style={styles.dropdownTip}>{cmd.tip}</span>
                            </div>
                          </button>
                        ))}
                      </div>
                    ));
                  })()}
                </div>,
                document.body,
              )}
            </div>
          );
        })}

        {/* Quick inline pills for most-used commands */}
        <div style={styles.divider} />
        {[
          { text: '/compact', label: 'compact', tip: '压缩上下文' },
          { text: '/cost', label: 'cost', tip: 'Token 用量' },
        ].map(q => (
          <button
            key={q.text}
            onClick={() => handleCommandClick(q.text)}
            onMouseEnter={e => {
              e.currentTarget.style.background = 'var(--md-surface-container-high)';
              e.currentTarget.style.borderColor = 'var(--md-primary)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = 'var(--md-surface-container-lowest)';
              e.currentTarget.style.borderColor = 'var(--border)';
            }}
            style={styles.pill}
            title={q.tip}
          >
            {q.label}
          </button>
        ))}

        {isGuiMode && (
          <>
            <div style={styles.divider} />
            <span style={styles.modeHint}>
              <span className="material-symbols-outlined" style={{ fontSize: 14 }}>info</span>
              点击命令将填入输入框
            </span>
          </>
        )}
      </div>

      <Modal
        open={!!confirmTabId}
        onOk={() => {
          if (confirmTabId) {
            const tab = tabs.find(t => t.id === confirmTabId);
            if (tab) {
              setAgentMode(confirmTabId, tab.agentMode === 'xterm' ? 'gui' : 'xterm');
            }
          }
          setConfirmTabId(null);
        }}
        onCancel={() => setConfirmTabId(null)}
        title="切换模式"
        okText="切换"
        cancelText="取消"
        styles={{ body: { fontSize: 13 } }}
      >
        切换模式将结束当前会话，是否继续？
      </Modal>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  tabBar: {
    display: 'flex',
    flexDirection: 'column',
    borderBottom: '1px solid var(--border)',
    background: 'var(--md-surface-container-lowest)',
    flexShrink: 0,
    position: 'relative',
  },
  tabsRow: {
    display: 'flex',
    alignItems: 'stretch',
    overflowX: 'auto',
    flex: 1,
    gap: 0,
    minHeight: 40,
    paddingRight: 120,
  },
  rightActions: {
    position: 'absolute',
    right: 0,
    top: 0,
    display: 'flex',
    alignItems: 'center',
    gap: 2,
    height: 40,
    paddingRight: 4,
    background: 'linear-gradient(to left, var(--md-surface-container-lowest) 70%, transparent)',
    zIndex: 3,
  },
  tab: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '8px 12px',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    transition: 'all 0.15s',
    borderBottom: '2px solid transparent',
    flexShrink: 0,
    maxWidth: 280,
  },
  tabActive: {
    background: 'var(--md-surface-container)',
    borderBottom: '2px solid var(--md-primary)',
    opacity: 1,
  },
  tabLabel: {
    fontSize: 'var(--text-sm)',
    fontFamily: 'var(--font-sans)',
    color: 'var(--md-on-surface)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  tabCwd: {
    fontSize: 'var(--text-xs)',
    fontFamily: 'var(--font-mono, monospace)',
    color: 'var(--md-on-surface-variant)',
    flexShrink: 0,
    maxWidth: 120,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  closeIcon: {
    fontSize: 14,
    color: 'var(--md-outline-variant)',
    cursor: 'pointer',
    marginLeft: 2,
    padding: 6,
    borderRadius: 'var(--radius-xs)',
    transition: 'opacity 0.15s, background 0.15s',
    flexShrink: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 28,
    minHeight: 28,
  },
  addTabBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 36,
    height: 36,
    margin: '0 4px',
    borderRadius: 'var(--radius-sm)',
    cursor: 'pointer',
    flexShrink: 0,
    transition: 'background 0.15s',
  },
  folderBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    padding: '0 10px',
    height: 32,
    borderRadius: 'var(--radius-sm)',
    cursor: 'pointer',
    flexShrink: 0,
    transition: 'background 0.15s',
  },
  folderLabel: {
    fontSize: 'var(--text-xs)',
    fontFamily: 'var(--font-mono, monospace)',
    color: 'var(--md-on-surface-variant)',
    maxWidth: 120,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  // Row 2: Command bar
  commandRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 2,
    padding: '4px 8px',
    borderTop: '1px solid var(--border)',
    background: 'var(--md-surface-container-low)',
    minHeight: 36,
    overflowX: 'auto',
    overflowY: 'visible',
    position: 'relative',
    zIndex: 2,
  },
  categoryWrapper: {},
  categoryBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 3,
    padding: '4px 8px',
    border: '1px solid var(--border)',
    borderRadius: 6,
    background: 'var(--md-surface-container-lowest)',
    color: 'var(--md-on-surface)',
    cursor: 'pointer',
    fontSize: 12,
    fontFamily: 'var(--font-sans)',
    whiteSpace: 'nowrap',
    flexShrink: 0,
    transition: 'all 0.15s',
  },
  categoryBtnActive: {
    background: 'var(--md-primary-container)',
    borderColor: 'var(--md-primary)',
    color: 'var(--md-on-primary-container)',
  },
  dropdown: {
    minWidth: 300,
    maxWidth: 'calc(100vw - 16px)',
    maxHeight: 480,
    overflowY: 'auto',
    background: 'var(--md-surface-container-lowest)',
    border: '1px solid var(--border)',
    borderRadius: 8,
    boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
    zIndex: 100,
    padding: 4,
  },
  groupHeader: {
    padding: '6px 10px 2px',
    fontSize: 10,
    fontWeight: 600,
    color: 'var(--md-primary)',
    fontFamily: 'var(--font-sans)',
    letterSpacing: 0.5,
    textTransform: 'uppercase' as const,
    userSelect: 'none' as const,
  },
  dropdownItem: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 8,
    width: '100%',
    padding: '7px 10px',
    border: 'none',
    borderRadius: 6,
    background: 'transparent',
    cursor: 'pointer',
    textAlign: 'left',
    transition: 'background 0.12s',
  },
  dropdownText: {
    display: 'flex',
    flexDirection: 'column',
    gap: 1,
    minWidth: 0,
  },
  dropdownLabel: {
    fontSize: 12,
    fontWeight: 500,
    color: 'var(--md-on-surface)',
    fontFamily: 'var(--font-sans)',
    lineHeight: '18px',
  },
  dropdownTip: {
    fontSize: 11,
    color: 'var(--md-on-surface-variant)',
    fontFamily: 'var(--font-sans)',
    lineHeight: '16px',
  },
  divider: {
    width: 1,
    height: 20,
    background: 'var(--md-outline-variant)',
    flexShrink: 0,
    margin: '0 4px',
  },
  pill: {
    padding: '3px 10px',
    border: '1px solid var(--border)',
    borderRadius: 12,
    background: 'var(--md-surface-container-lowest)',
    color: 'var(--md-on-surface-variant)',
    cursor: 'pointer',
    fontSize: 11,
    fontFamily: 'var(--font-mono, monospace)',
    whiteSpace: 'nowrap',
    flexShrink: 0,
    transition: 'all 0.15s',
  },
  modeHint: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    fontSize: 11,
    color: 'var(--md-on-surface-variant)',
    fontFamily: 'var(--font-sans)',
    whiteSpace: 'nowrap',
    flexShrink: 0,
  },
};
