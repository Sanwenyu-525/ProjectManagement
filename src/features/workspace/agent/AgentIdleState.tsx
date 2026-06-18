import { useState, useRef, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { gitApi } from '../../../api';
import { queryKeys } from '../../../api/queryKeys';
import { useTerminalStore } from '../../../stores/terminalStore';
import type { AgentSession } from '../../../types';

interface AgentIdleStateProps {
  onStartAndSend: (message: string) => Promise<void>;
  recentSessions: AgentSession[];
}

export default function AgentIdleState({ onStartAndSend, recentSessions }: AgentIdleStateProps) {
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
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
    ...commits.slice(0, 1).map(c => `Continue: ${c.message?.split('\n')[0] || 'recent work'}`),
    ...recentSessions.slice(0, 1).map(s => `Resume session from ${formatTime(s.startedAt)}`),
    'Analyze project health',
    'Review recent changes',
  ].slice(0, 4);

  return (
    <div style={styles.container}>
      <div style={styles.content}>
        {/* Recent tasks */}
        {recentSessions.length > 0 && (
          <div style={styles.section}>
            <div style={styles.sectionLabel}>RECENT TASKS</div>
            <div style={styles.sessionList}>
              {recentSessions.map(session => (
                <div key={session.id} style={styles.sessionCard}>
                  <span className="material-symbols-outlined" style={{ fontSize: 14, color: 'var(--md-on-surface-variant)' }}>
                    history
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={styles.sessionTitle}>
                      Session {formatTime(session.startedAt)}
                    </div>
                    <div style={styles.sessionMeta}>
                      {session.status === 'running' ? 'Running' : 'Ended'}
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
          <div style={styles.sectionLabel}>SUGGESTED ACTIONS</div>
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
          <div style={styles.sectionLabel}>QUICK COMMANDS</div>
          <div style={styles.chipGroup}>
            {['/plan', '/review', '/refactor', '/debug'].map(cmd => (
              <button
                key={cmd}
                onClick={() => fillInput(cmd)}
                style={styles.cmdChip}
                onMouseEnter={e => { e.currentTarget.style.background = 'var(--md-surface-container-highest)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'var(--md-surface-container-high)'; }}
              >
                {cmd}
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
        <div style={styles.inputWrapper}>
          <textarea
            ref={textareaRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="输入消息或 / 命令..."
            rows={1}
            style={styles.textarea}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || sending}
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

function formatTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
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
    background: 'var(--md-surface-container-low)',
    borderRadius: 10,
    border: '1px solid var(--md-outline-variant)',
    padding: '6px 8px 6px 12px',
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
