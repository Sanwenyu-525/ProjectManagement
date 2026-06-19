import { useState, useRef, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { gitApi } from '../../../api';
import { queryKeys } from '../../../api/queryKeys';
import { useTerminalStore } from '../../../stores/terminalStore';
import type { AgentSession } from '../../../types';

interface AgentIdleStateProps {
  onStartAndSend: (message: string) => Promise<void>;
  onResumeSession: (session: AgentSession) => void;
  recentSessions: AgentSession[];
}

export default function AgentIdleState({ onStartAndSend, onResumeSession, recentSessions }: AgentIdleStateProps) {
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inputFocused, setInputFocused] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const defaultCwd = useTerminalStore(s => s.defaultCwd);

  // Git log for suggested actions
  const { data: gitLog } = useQuery({
    queryKey: queryKeys.git.log(defaultCwd),
    queryFn: () => gitApi.log(defaultCwd, 3),
    staleTime: 60_000,
  });

  const commits = (gitLog as { message?: string; date?: string }[] | null) || [];

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || sending) return;
    setSending(true);
    setError(null);
    try {
      await onStartAndSend(text);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSending(false);
    }
  }, [input, sending, onStartAndSend]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }, [handleSend]);

  const fillInput = useCallback((text: string) => {
    setInput(text);
    textareaRef.current?.focus();
  }, []);

  // Suggested actions from git + sessions
  const suggestions = [
    ...commits.slice(0, 1).map(c => `继续: ${c.message?.split('\n')[0] || '最近的工作'}`),
    ...recentSessions.slice(0, 1).map(s => `恢复 ${formatTime(s.startedAt)} 的会话`),
    '分析项目健康度',
    '审查最近的更改',
  ].slice(0, 4);

  return (
    <div style={styles.container}>
      <div style={styles.content}>
        {/* Welcome */}
        <div style={styles.welcome}>
          <div style={styles.welcomeIcon}>
            <span className="material-symbols-outlined" style={{ fontSize: 28, color: 'var(--md-primary)' }}>smart_toy</span>
          </div>
          <div>
            <div style={styles.welcomeTitle}>有什么可以帮你的？</div>
            <div style={styles.welcomeSub}>Claude Code 已就绪，描述你的任务或从下方选择建议。</div>
          </div>
        </div>

        {/* Recent tasks */}
        {recentSessions.length > 0 && (
          <div style={styles.section}>
            <div style={styles.sectionLabel}>最近任务</div>
            <div style={styles.sessionList}>
              {recentSessions.map(session => (
                <div
                  key={session.id}
                  style={styles.sessionCard}
                  onClick={() => onResumeSession(session)}
                  onMouseEnter={e => {
                    e.currentTarget.style.background = 'var(--md-surface-container)';
                    e.currentTarget.style.borderColor = 'var(--md-primary-container)';
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.background = 'var(--md-surface-container-low)';
                    e.currentTarget.style.borderColor = 'var(--md-outline-variant)';
                  }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 14, color: 'var(--md-on-surface-variant)' }}>
                    history
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={styles.sessionTitle}>
                      会话 {formatTime(session.startedAt)}
                    </div>
                    <div style={styles.sessionMeta}>
                      {session.status === 'running' ? '运行中' : '已结束'}
                    </div>
                  </div>
                  <span className="material-symbols-outlined" style={{ fontSize: 14, color: 'var(--md-outline)' }}>
                    arrow_forward
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Suggested actions */}
        <div style={styles.section}>
          <div style={styles.sectionLabel}>建议操作</div>
          <div style={styles.chipGroup}>
            {suggestions.map((text, i) => (
              <button
                key={i}
                onClick={() => fillInput(text)}
                style={styles.chip}
                onMouseEnter={e => { e.currentTarget.style.background = 'var(--md-surface-container-highest)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'var(--md-surface-container-high)'; }}
              >
                {text}
              </button>
            ))}
          </div>
        </div>

        {/* Quick commands */}
        <div style={styles.section}>
          <div style={styles.sectionLabel}>快捷命令</div>
          <div style={styles.chipGroup}>
            {QUICK_COMMANDS.map(({ label, prompt }) => (
              <button
                key={label}
                onClick={() => fillInput(prompt)}
                style={styles.cmdChip}
                onMouseEnter={e => { e.currentTarget.style.background = 'var(--md-surface-container-highest)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'var(--md-surface-container-high)'; }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Error message */}
      {error && (
        <div style={{ padding: '4px 16px', fontSize: 11, color: 'var(--md-error)', fontFamily: 'var(--font-sans)', flexShrink: 0 }}>
          {error}
        </div>
      )}

      {/* Message input */}
      <div style={styles.inputArea}>
        <div style={{
          ...styles.inputWrapper,
          borderColor: inputFocused ? 'var(--md-primary)' : undefined,
          boxShadow: inputFocused ? '0 0 0 2px var(--md-primary-container)' : undefined,
        }}>
          <textarea
            ref={textareaRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => setInputFocused(true)}
            onBlur={() => setInputFocused(false)}
            placeholder="输入消息或 / 命令..."
            rows={1}
            style={styles.textarea}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || sending}
            onMouseEnter={e => { if (input.trim() && !sending) e.currentTarget.style.background = 'var(--md-primary-dark)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'var(--md-primary)'; }}
            style={{
              ...styles.sendBtn,
              opacity: input.trim() && !sending ? 1 : 0.4,
              cursor: input.trim() && !sending ? 'pointer' : 'default',
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>arrow_upward</span>
          </button>
        </div>
      </div>
    </div>
  );
}

const QUICK_COMMANDS: Array<{ label: string; prompt: string }> = [
  { label: '/plan', prompt: '分析当前项目并创建详细的实施计划。考虑项目结构、技术栈和最近的更改。' },
  { label: '/review', prompt: '审查项目最近的代码更改。检查 bug、性能问题和代码质量。提供可操作的反馈。' },
  { label: '/refactor', prompt: '分析代码库寻找重构机会。查找代码异味、重复逻辑，并提出具体的改进建议。' },
  { label: '/debug', prompt: '帮我调试一个问题。我需要协助诊断和修复代码库中的问题。' },
];

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
  sessionList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  sessionCard: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '10px 12px',
    background: 'var(--md-surface-container-low)',
    borderRadius: 8,
    border: '1px solid var(--md-outline-variant)',
    cursor: 'pointer',
    transition: 'background 0.15s',
  },
  sessionTitle: {
    fontSize: 12,
    fontWeight: 500,
    color: 'var(--md-on-surface)',
    fontFamily: 'var(--font-sans)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap' as const,
  },
  sessionMeta: {
    fontSize: 10,
    color: 'var(--md-on-surface-variant)',
    fontFamily: 'var(--font-sans)',
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
    fontFamily: 'var(--font-sans)',
    cursor: 'pointer',
    transition: 'background 0.15s',
  },
  cmdChip: {
    padding: '5px 12px',
    borderRadius: 6,
    background: 'var(--md-surface-container-high)',
    border: '1px solid var(--md-outline-variant)',
    fontSize: 11,
    color: 'var(--md-on-surface-variant)',
    fontFamily: "'Fira Code', monospace",
    cursor: 'pointer',
    transition: 'background 0.15s',
  },
  inputArea: {
    flexShrink: 0,
    padding: '8px 16px 12px',
    borderTop: '1px solid var(--md-outline-variant)',
  },
  inputWrapper: {
    display: 'flex',
    gap: 8,
    alignItems: 'flex-end',
    background: 'var(--md-surface-container)',
    borderRadius: 12,
    border: '1.5px solid var(--md-outline-variant)',
    padding: '8px 10px 8px 14px',
    transition: 'border-color 0.2s, box-shadow 0.2s',
  },
  textarea: {
    flex: 1,
    border: 'none',
    outline: 'none',
    background: 'transparent',
    color: 'var(--md-on-surface)',
    fontSize: 13,
    fontFamily: 'var(--font-sans)',
    resize: 'none' as const,
    lineHeight: '20px',
    minHeight: 20,
    maxHeight: 120,
    padding: '2px 0',
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
};
