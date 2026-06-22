import { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { open } from '@tauri-apps/plugin-dialog';
import { gitApi } from '../../../api';
import { queryKeys } from '../../../api/queryKeys';
import { useTerminalStore } from '../../../stores/terminalStore';
import type { AgentSession } from '../../../types';
import { useSlashCommands, SlashMenu } from './useSlashCommands';
import { ModelPicker, QuickConfig, handleSlashCommand } from './AgentCommandPanels';

interface AgentIdleStateProps {
  onStartAndSend: (message: string, cwd?: string) => Promise<void>;
  onResumeSession: (session: AgentSession) => void;
  recentSessions: AgentSession[];
  onStartPlan?: (goal: string, cwd: string) => void;
  onCwdChange?: (cwd: string) => void;
}

interface CommandItem {
  label: string;
  prompt: string;
  tooltip: string;
}

const ALL_COMMANDS: CommandItem[] = [
  { label: '规划', tooltip: '把模糊想法变成可执行的技术方案', prompt: '请执行 /plan 命令：分析我的需求，探索相关代码，提出 2-3 个方案并比较优劣，等我选定后输出结构化技术方案到 docs/plans/。' },
  { label: '开发', tooltip: '按流程实现新功能：理解→计划→确认→实现→验证', prompt: '请执行 /feature 命令：理解需求→探索代码→制定分步计划→等我确认→逐步实现→每步运行 tsc + eslint 验证→汇报结果。' },
  { label: '修复', tooltip: '按流程修 bug：诊断→确认根因→最小 diff 修复→验证', prompt: '请执行 /fix 命令：复现问题→定位根因→提出最小改动方案→等我确认→修复→运行 tsc + eslint 验证→汇报根因和修复内容。' },
  { label: '审查', tooltip: '多维度代码审查，按严重程度分级', prompt: '请执行 /review 命令：从类型安全、UI 一致性、状态管理、API 契约、代码质量、性能六个维度审查未提交的改动，输出 Critical / Suggestions / Nits 分级报告。' },
  { label: '提交', tooltip: '提交前质量门：检查→审查→生成 commit message→提交', prompt: '请执行 /ship 命令：运行 tsc + eslint → 审查 diff → 生成 Conventional Commits 格式的 commit message → 等我确认后提交。' },
  { label: '调试', tooltip: '系统性排查问题，定位根因', prompt: '你是一位资深调试工程师。请描述你遇到的问题，我会帮你系统性地排查：首先复现问题并收集错误信息，然后分析调用链定位根因，接着评估影响范围，最后给出经过验证的修复方案和防止回归的建议。' },
];

// ── Shared sub-component ─────────────────────────────────────────

function AttachmentChips({ attachments, onRemove }: { attachments: string[]; onRemove: (index: number) => void }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, padding: '4px 10px' }}>
      {attachments.map((path, i) => {
        const parts = path.split(/[/\\]/);
        const name = parts.length > 1 ? parts.slice(-2).join('/') : path;
        return (
          <span key={i} style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            padding: '2px 8px', fontSize: 12, borderRadius: 6,
            background: 'var(--md-surface-container-highest)',
            color: 'var(--md-on-surface-variant)',
          }} title={path}>
            <span className="material-symbols-outlined" style={{ fontSize: 13 }}>description</span>
            <span style={{ maxWidth: 'min(240px, 55vw)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</span>
            <button onClick={() => onRemove(i)}
              style={{ display: 'flex', border: 'none', background: 'transparent', color: 'var(--md-on-surface-variant)', cursor: 'pointer', padding: 0 }}>
              <span className="material-symbols-outlined" style={{ fontSize: 12 }}>close</span>
            </button>
          </span>
        );
      })}
    </div>
  );
}

export default function AgentIdleState({ onStartAndSend, onResumeSession, recentSessions, onStartPlan, onCwdChange }: AgentIdleStateProps) {
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inputFocused, setInputFocused] = useState(false);
  const [selectedCwd, setSelectedCwd] = useState<string | null>(() => localStorage.getItem('agent_lastCwd'));
  const [idleMode, setIdleMode] = useState<'chat' | 'plan'>('chat');
  const [attachments, setAttachments] = useState<string[]>([]);
  const [showModelPicker, setShowModelPicker] = useState(false);
  const [showConfigPanel, setShowConfigPanel] = useState(false);
  const pendingCommandRef = useRef<string | null>(null);
  const slash = useSlashCommands();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const defaultCwd = useTerminalStore(s => s.defaultCwd);
  const cwd = selectedCwd || defaultCwd;

  // Sync cwd to parent for right panel
  useEffect(() => { onCwdChange?.(cwd); }, [cwd, onCwdChange]);

  const handleSelectFolder = useCallback(async () => {
    const folder = await open({ directory: true, title: '选择工作目录' });
    if (folder && typeof folder === 'string') {
      setSelectedCwd(folder);
      localStorage.setItem('agent_lastCwd', folder);
    }
  }, []);

  const handleAttachFile = useCallback(async () => {
    try {
      const selected = await open({ multiple: true, title: '选择文件' });
      if (!selected) return;
      const paths = Array.isArray(selected) ? selected : [selected];
      setAttachments(prev => [...prev, ...paths]);
    } catch { /* ignore */ }
  }, []);

  const { data: gitLog } = useQuery({
    queryKey: queryKeys.git.log(defaultCwd),
    queryFn: () => gitApi.log(defaultCwd, 3),
    staleTime: 60_000,
  });

  const handleModelSelect = useCallback((modelId: string) => {
    localStorage.setItem('agent_model', modelId);
    setShowModelPicker(false);
    setShowConfigPanel(false);
  }, []);

  const handleSend = useCallback(async () => {
    // Priority: process pending command selected from slash menu
    const pending = pendingCommandRef.current;
    if (pending) {
      pendingCommandRef.current = null;
      if (handleSlashCommand(pending, setShowModelPicker, setShowConfigPanel)) {
        setInput('');
        return;
      }
    }

    const text = (pending ?? input).trim();
    if ((!text && attachments.length === 0) || sending) return;

    // Intercept interactive slash commands (typed manually, not from menu)
    if (handleSlashCommand(text, setShowModelPicker, setShowConfigPanel)) {
      setInput('');
      return;
    }

    const content = attachments.length > 0
      ? [...attachments.map(p => `@${p}`), text].filter(Boolean).join('\n')
      : text;

    setSending(true);
    setError(null);
    setInput('');
    setAttachments([]);
    try {
      if (idleMode === 'plan' && onStartPlan) {
        onStartPlan(content, cwd);
      } else {
        await onStartAndSend(content, cwd);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSending(false);
    }
  }, [input, attachments, sending, onStartAndSend, onStartPlan, idleMode, cwd]);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(slash.handleInputChange(e));
  }, [slash.handleInputChange]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    // Slash menu is open — let it handle navigation, auto-submit on selection
    if (slash.open && slash.filtered.length > 0) {
      const result = slash.handleKeyDown(e);
      if (typeof result === 'string') {
        const cmd = result.trim();
        setInput(result);
        if (cmd.startsWith('/')) {
          pendingCommandRef.current = cmd;
          requestAnimationFrame(() => handleSend());
        }
        requestAnimationFrame(() => textareaRef.current?.focus());
        return;
      }
      if (result) return;
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }, [handleSend, slash.handleKeyDown, slash.open, slash.filtered]);

  const fillInput = useCallback((text: string) => {
    setInput(text);
    textareaRef.current?.focus();
  }, []);

  // Dynamic commands from git + sessions
  const allItems = useMemo(() => {
    const commits = (gitLog as { message?: string; date?: string }[] | null) || [];
    const dynamicCommands: CommandItem[] = [
      ...commits.slice(0, 1).map(c => ({
        label: `继续: ${c.message?.split('\n')[0] || '最近的工作'}`,
        name: '',
        tooltip: '回顾最近提交并继续推进',
        prompt: `继续上次的工作。最近一次提交是: "${c.message?.split('\n')[0] || '无信息'}"，请先回顾相关代码变更，然后继续推进。`,
      })),
      ...recentSessions.slice(0, 1).map(s => ({
        label: `恢复 ${formatTime(s.startedAt)} 的会话`,
        name: '',
        tooltip: '恢复之前的对话上下文',
        prompt: `恢复之前 ${formatTime(s.startedAt)} 的会话，请先回顾之前的对话上下文和进展，然后继续。`,
      })),
    ];
    return [...dynamicCommands, ...ALL_COMMANDS];
  }, [gitLog, recentSessions]);

  return (
    <div style={styles.container}>
      <div style={styles.content}>
        {/* Welcome */}
        <div style={styles.welcome}>
          <div style={styles.welcomeIcon}>
            <span className="material-symbols-outlined" aria-hidden="true" style={{ fontSize: 28, color: 'var(--md-primary)' }}>smart_toy</span>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={styles.welcomeTitle}>有什么可以帮你的？</div>
            <div style={styles.welcomeSub}>Claude Code 已就绪，输入 / 查看可用命令，或直接描述你的任务。</div>
          </div>
          <div style={styles.cwdBar} onClick={handleSelectFolder} title="点击更换工作目录">
            <span className="material-symbols-outlined" aria-hidden="true" style={{ fontSize: 14, color: 'var(--md-on-surface-variant)', flexShrink: 0 }}>folder_open</span>
            <span style={styles.cwdPath} title={cwd}>{cwd}</span>
          </div>
        </div>

        {/* Recent tasks */}
        {recentSessions.length > 0 && (
          <div style={styles.section}>
            <div style={styles.sectionLabel}>最近任务</div>
            <div style={styles.sessionGrid}>
              {recentSessions.map(session => {
                const preview = session.firstMessage
                  ? session.firstMessage.replace(/\n/g, ' ').slice(0, 60)
                  : undefined;
                const pathLabel = session.cwd
                  ? session.cwd.replace(/\\/g, '/').split('/').slice(-2).join('/')
                  : undefined;
                return (
                  <div
                    key={session.id}
                    className="hover-card"
                    style={styles.sessionCard}
                    onClick={() => onResumeSession(session)}
                  >
                    <div style={styles.sessionCardHeader}>
                      <span className="material-symbols-outlined" aria-hidden="true" style={{ fontSize: 12, color: 'var(--md-on-surface-variant)' }}>
                        history
                      </span>
                      <span style={styles.sessionTime}>{formatTime(session.startedAt)}</span>
                      <span style={{
                        ...styles.sessionStatus,
                        color: session.status === 'running' ? 'var(--md-primary)' : 'var(--md-on-surface-variant)',
                      }}>
                        {session.status === 'running' ? '运行中' : '已结束'}
                      </span>
                    </div>
                    {preview && (
                      <div style={styles.sessionPreview}>{preview}{session.firstMessage && session.firstMessage.length > 60 ? '…' : ''}</div>
                    )}
                    {pathLabel && (
                      <div style={styles.sessionPath} title={session.cwd}>
                        <span className="material-symbols-outlined" aria-hidden="true" style={{ fontSize: 10 }}>folder</span>
                        {pathLabel}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Commands */}
        <div style={styles.section}>
          <div style={styles.sectionLabel}>快捷命令</div>
          <div style={styles.chipGroup}>
            {allItems.map((item, i) => (
              <button
                key={i}
                className="hover-chip"
                title={item.tooltip}
                onClick={() => fillInput(item.prompt)}
                style={styles.chip}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Interactive panels */}
      {showModelPicker && (
        <div style={{ padding: '8px 16px', flexShrink: 0 }}>
          <ModelPicker onSelect={handleModelSelect} />
        </div>
      )}
      {showConfigPanel && (
        <div style={{ padding: '8px 16px', flexShrink: 0 }}>
          <QuickConfig onSelectModel={() => { setShowConfigPanel(false); setShowModelPicker(true); }} />
        </div>
      )}

      {/* Error message */}
      {error && (
        <div style={{ padding: '4px 16px', fontSize: 11, color: 'var(--md-error)', fontFamily: 'var(--font-sans)', flexShrink: 0 }}>
          {error}
        </div>
      )}

      {/* Message input */}
      <div style={styles.inputArea}>
        {/* Mode toggle */}
        <div style={styles.modeToggle}>
          <button
            onClick={() => setIdleMode('chat')}
            style={{
              ...styles.modeBtn,
              ...(idleMode === 'chat' ? styles.modeBtnActive : {}),
            }}
          >
            <span className="material-symbols-outlined" aria-hidden="true" style={{ fontSize: 14 }}>chat</span>
            对话
          </button>
          <button
            onClick={() => setIdleMode('plan')}
            style={{
              ...styles.modeBtn,
              ...(idleMode === 'plan' ? styles.modeBtnActive : {}),
            }}
          >
            <span className="material-symbols-outlined" aria-hidden="true" style={{ fontSize: 14 }}>description</span>
            计划
          </button>
        </div>

        {idleMode === 'plan' && onStartPlan ? (
          <div ref={slash.anchorRef} style={{
            ...styles.inputWrapper,
            borderColor: inputFocused ? 'var(--md-primary)' : undefined,
            boxShadow: inputFocused ? '0 0 0 2px var(--md-primary-container)' : undefined,
          }}>
            <textarea
              ref={textareaRef}
              value={input}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              onFocus={() => setInputFocused(true)}
              onBlur={() => setInputFocused(false)}
              placeholder="描述你想要实现的目标，例如：实现用户登录功能..."
              rows={2}
              style={styles.textarea}
            />
            {attachments.length > 0 && (
              <AttachmentChips attachments={attachments} onRemove={(i) => setAttachments(prev => prev.filter((_, j) => j !== i))} />
            )}
            <div style={styles.inputActions}>
              <button style={styles.attachBtn} title="添加文件" aria-label="添加文件" onClick={handleAttachFile}>
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>attach_file</span>
              </button>
              <button
                onClick={handleSend}
                disabled={(!input.trim() && attachments.length === 0) || sending}
                style={{
                  ...styles.sendBtn,
                  opacity: (input.trim() || attachments.length > 0) && !sending ? 1 : 0.4,
                  cursor: (input.trim() || attachments.length > 0) && !sending ? 'pointer' : 'default',
                }}
                title="开始计划"
                aria-label="开始计划"
              >
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
                  {sending ? 'hourglass_top' : 'play_arrow'}
                </span>
              </button>
            </div>
          </div>
        ) : (
          <div ref={slash.anchorRef} style={{
            ...styles.inputWrapper,
            borderColor: inputFocused ? 'var(--md-primary)' : undefined,
            boxShadow: inputFocused ? '0 0 0 2px var(--md-primary-container)' : undefined,
          }}>
            {slash.open && (
              <SlashMenu
                filtered={slash.filtered}
                onSelect={(name) => { setInput(slash.handleSelect(name)); requestAnimationFrame(() => textareaRef.current?.focus()); }}
                selectedIndex={slash.index}
                onSelectedIndexChange={slash.setIndex}
                anchorRef={slash.anchorRef}
              />
            )}
            <textarea
              ref={textareaRef}
              value={input}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              onFocus={() => setInputFocused(true)}
              onBlur={() => setInputFocused(false)}
              placeholder="输入消息或 / 查看命令..."
              rows={2}
              style={styles.textarea}
            />
            {attachments.length > 0 && (
              <AttachmentChips attachments={attachments} onRemove={(i) => setAttachments(prev => prev.filter((_, j) => j !== i))} />
            )}
            <div style={styles.inputActions}>
              <button
                style={styles.attachBtn}
                title="添加文件"
                aria-label="添加文件"
                onClick={handleAttachFile}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>attach_file</span>
              </button>
              <button
                onClick={handleSend}
                disabled={(!input.trim() && attachments.length === 0) || sending}
                className={(!input.trim() && attachments.length === 0) || sending ? '' : 'hover-send'}
                aria-label="发送"
                style={{
                  ...styles.sendBtn,
                  opacity: (input.trim() || attachments.length > 0) && !sending ? 1 : 0.4,
                  cursor: (input.trim() || attachments.length > 0) && !sending ? 'pointer' : 'default',
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>arrow_upward</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function formatTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return '刚刚';
  if (mins < 60) return `${mins} 分钟前`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} 小时前`;
  const days = Math.floor(hrs / 24);
  return `${days} 天前`;
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    flex: 1,
    minHeight: 0,
  },
  content: {
    flex: 1,
    overflowY: 'auto',
    padding: '16px 20px',
    display: 'flex',
    flexDirection: 'column',
    gap: 20,
  },
  section: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  sectionLabel: {
    fontSize: 10,
    fontWeight: 600,
    color: 'var(--md-on-surface-variant)',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.5px',
    fontFamily: 'var(--font-sans)',
  },
  welcome: {
    display: 'flex',
    alignItems: 'center',
    gap: 14,
    padding: '16px 18px',
    background: 'var(--md-surface-container)',
    borderRadius: 12,
    border: '1px solid var(--md-outline-variant)',
  },
  welcomeIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    background: 'var(--md-primary-container)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  welcomeTitle: {
    fontSize: 15,
    fontWeight: 600,
    color: 'var(--md-on-surface)',
    fontFamily: 'var(--font-sans)',
    marginBottom: 2,
  },
  welcomeSub: {
    fontSize: 12,
    color: 'var(--md-on-surface-variant)',
    fontFamily: 'var(--font-sans)',
  },
  sessionGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
    gap: 6,
  },
  sessionCard: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    padding: '8px 10px',
    background: 'var(--md-surface-container-low)',
    borderRadius: 8,
    border: '1px solid var(--md-outline-variant)',
    cursor: 'pointer',
    transition: 'background 0.15s',
    overflow: 'hidden',
  },
  sessionCardHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
  },
  sessionTime: {
    fontSize: 11,
    fontWeight: 500,
    color: 'var(--md-on-surface)',
    fontFamily: 'var(--font-sans)',
  },
  sessionStatus: {
    fontSize: 9,
    fontFamily: 'var(--font-sans)',
    marginLeft: 'auto',
  },
  sessionPreview: {
    fontSize: 11,
    color: 'var(--md-on-surface-variant)',
    fontFamily: 'var(--font-sans)',
    lineHeight: '15px',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap' as const,
  },
  sessionPath: {
    display: 'flex',
    alignItems: 'center',
    gap: 3,
    fontSize: 10,
    color: 'var(--md-on-surface-variant)',
    fontFamily: 'var(--font-mono)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap' as const,
  },
  chipGroup: {
    display: 'flex',
    flexWrap: 'wrap' as const,
    gap: 6,
  },
  chip: {
    padding: '6px 14px',
    borderRadius: 16,
    background: 'var(--md-surface-container-high)',
    border: '1px solid var(--md-outline-variant)',
    fontSize: 11,
    color: 'var(--md-on-surface-variant)',
    fontFamily: 'var(--font-mono)',
    cursor: 'pointer',
    transition: 'background 0.15s',
  },
  inputArea: {
    flexShrink: 0,
    padding: '8px 16px 12px',
    borderTop: '1px solid var(--md-outline-variant)',
    position: 'relative',
  },
  cwdBar: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '6px 10px',
    background: 'var(--md-surface-container-lowest)',
    borderRadius: 8,
    border: '1px solid var(--md-outline-variant)',
    flexShrink: 0,
    cursor: 'pointer',
    overflow: 'hidden',
    maxWidth: '100%',
  },
  cwdPath: {
    flex: 1,
    minWidth: 0,
    fontSize: 11,
    fontFamily: 'var(--font-mono)',
    color: 'var(--md-on-surface-variant)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap' as const,
  },
  inputWrapper: {
    position: 'relative' as const,
    borderRadius: 12,
    border: '1px solid var(--md-outline-variant)',
    background: 'var(--md-surface-container-low)',
    overflow: 'hidden' as const,
    transition: 'border-color 0.15s, box-shadow 0.15s',
  },
  textarea: {
    flex: 1,
    width: '100%',
    border: 'none',
    outline: 'none',
    background: 'transparent',
    color: 'var(--md-on-surface)',
    fontSize: 13,
    fontFamily: 'var(--font-sans)',
    resize: 'none' as const,
    lineHeight: '1.5',
    minHeight: 36,
    maxHeight: 120,
    padding: '8px 12px',
    boxSizing: 'border-box' as const,
  },
  sendBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    border: 'none',
    background: 'var(--md-primary)',
    color: 'var(--md-on-primary)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    transition: 'opacity 0.15s',
  },
  inputActions: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '4px 8px 6px',
  },
  attachBtn: {
    width: 28,
    height: 28,
    borderRadius: 6,
    border: 'none',
    background: 'transparent',
    color: 'var(--md-on-surface-variant)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    cursor: 'pointer',
    transition: 'background 0.15s',
  },
  modeToggle: {
    display: 'flex',
    gap: 2,
    padding: 2,
    background: 'var(--md-surface-container)',
    borderRadius: 8,
    marginBottom: 4,
  },
  modeBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    padding: '5px 12px',
    fontSize: 12,
    fontWeight: 500,
    fontFamily: 'var(--font-sans)',
    color: 'var(--md-on-surface-variant)',
    background: 'transparent',
    border: 'none',
    borderRadius: 6,
    cursor: 'pointer',
    transition: 'all 0.15s',
  },
  modeBtnActive: {
    color: 'var(--md-on-primary)',
    background: 'var(--md-primary)',
    fontWeight: 600,
  },
};
