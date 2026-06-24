import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { listen } from '@tauri-apps/api/event';
import Markdown from 'react-markdown';
import { terminalApi, sessionsApi } from '../../../api';
import { useThemeStore } from '../../../stores/themeStore';
import { useAgentStore } from '../../../stores/agentStore';
import { useTerminalStore } from '../../../stores/terminalStore';
import { useAgentTabStore } from '../../../stores/agentTabStore';
import { extractJsonObjects, type StreamJsonEvent } from '../../../lib/parseStreamJson';
import { trackToolFileAccess } from '../../../lib/trackAgentFileAccess';
import type { TerminalOutputEvent, TerminalExitEvent } from '../../../shared/terminalTypes';
import { folderName } from '../components/terminalFactory';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  streaming: boolean;
  timestamp: number;
}

function generateId(): string {
  return `msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

interface AgentGUIPanelProps {
  cwd?: string;
  tabId: string;
  style?: React.CSSProperties;
}

export default function AgentGUIPanel({ cwd: propCwd, tabId, style: extraStyle }: AgentGUIPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const terminalIdRef = useRef(`gui-${Date.now().toString(36)}`);
  const jsonBufferRef = useRef('');
  const pendingPartialRef = useRef('');
  const emittedTextLengthsRef = useRef(new Map<number, number>());
  const activeTerminalIdRef = useRef<string | null>(null);
  const sessionCreatedRef = useRef(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const prevCountRef = useRef(0);
  const unlistenOutputRef = useRef<(() => void) | null>(null);
  const unlistenExitRef = useRef<(() => void) | null>(null);
  const rawOutputRef = useRef('');      // non-JSON output for error surfacing
  const gotValidEventRef = useRef(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const lastSentTextRef = useRef('');

  const isDark = useThemeStore(s => s.mode === 'dark');
  const density = useThemeStore(s => s.density);
  const isCompact = density === 'compact' || density === 'dense';
  const defaultCwd = useTerminalStore(s => s.defaultCwd);
  const effectiveCwd = propCwd || localStorage.getItem('agent_lastCwd') || defaultCwd || '';

  const formatTime = (ts: number) => {
    const d = new Date(ts);
    return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
  };

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Track previous message count for entry animations
  useEffect(() => {
    prevCountRef.current = messages.length;
  }, [messages]);

  // Auto-resize textarea to fit content
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    const pos = ta.selectionStart;
    ta.style.height = 'auto';
    ta.style.height = `${ta.scrollHeight}px`;
    ta.setSelectionRange(pos, pos);
  }, [input]);

  // Listen for quick commands from AgentTabBar — inject text into textarea
  const quickCommandRef = useRef(false);
  useEffect(() => {
    const handler = (e: Event) => {
      const text = (e as CustomEvent).detail;
      if (typeof text === 'string' && !streaming) {
        quickCommandRef.current = true;
        setInput(prev => prev ? prev + text : text);
      }
    };
    window.addEventListener('agentQuickCommand', handler);
    return () => window.removeEventListener('agentQuickCommand', handler);
  }, [streaming]);

  // Focus textarea after quick-command input is committed
  useEffect(() => {
    if (!quickCommandRef.current) return;
    quickCommandRef.current = false;
    textareaRef.current?.focus();
  }, [input]);

  const cleanupListeners = useCallback(() => {
    unlistenOutputRef.current?.();
    unlistenOutputRef.current = null;
    unlistenExitRef.current?.();
    unlistenExitRef.current = null;
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) { clearTimeout(timeoutRef.current); timeoutRef.current = null; }
      cleanupListeners();
      const tid = activeTerminalIdRef.current;
      if (tid) {
        terminalApi.stop(tid).catch(() => {});
      }
    };
  }, [cleanupListeners]);

  // Load messages from DB for restored tabs (sessionId exists but no messages loaded)
  useEffect(() => {
    const sid = useAgentTabStore.getState().tabs.find(t => t.id === tabId)?.sessionId;
    if (!sid) return;
    sessionsApi.messages(sid).then(dbMessages => {
      if (dbMessages.length === 0) return;
      const loaded: ChatMessage[] = dbMessages.map(m => {
        const role = (m.role === 'output' ? 'assistant' : m.role === 'input' ? 'user' : m.role) as 'user' | 'assistant';
        let content = m.content;
        // Assistant messages may be stored as v2 JSON blocks — extract text
        if (role === 'assistant') {
          try {
            const parsed = JSON.parse(content);
            if (parsed.v === 2 && Array.isArray(parsed.blocks)) {
              content = parsed.blocks
                .filter((b: { type: string }) => b.type === 'text')
                .map((b: { text: string }) => b.text)
                .join('');
            }
          } catch { /* plain text */ }
        }
        return {
          id: `db-${m.timestamp}-${Math.random().toString(36).slice(2, 6)}`,
          role,
          content,
          streaming: false,
          timestamp: new Date(m.timestamp).getTime(),
        };
      });
      setMessages(loaded);
      sessionCreatedRef.current = true; // mark as restored — don't create new session
    }).catch(() => {});
  }, [tabId]);

  const processStreamEvent = useCallback((event: StreamJsonEvent) => {
    gotValidEventRef.current = true;
    switch (event.type) {
      case 'assistant': {
        const blocks = event.message?.content || [];
        for (let i = 0; i < blocks.length; i++) {
          const block = blocks[i];
          if (block.type === 'tool_use' && block.name) {
            // 记录文件操作到上下文面板
            const sid = useAgentTabStore.getState().tabs.find(t => t.id === tabId)?.sessionId;
            if (sid) trackToolFileAccess(sid, block.name, block.input || {});
            continue;
          }
          if (block.type !== 'text' || !block.text) continue;

          // Cumulative text: only emit the new portion
          const prevLen = emittedTextLengthsRef.current.get(i) || 0;
          if (block.text.length > prevLen) {
            const delta = block.text.slice(prevLen);
            emittedTextLengthsRef.current.set(i, block.text.length);

            setMessages(prev => {
              const next = [...prev];
              const last = next[next.length - 1];
              if (last && last.role === 'assistant' && last.streaming) {
                next[next.length - 1] = { ...last, content: last.content + delta };
              } else {
                next.push({
                  id: generateId(),
                  role: 'assistant',
                  content: delta,
                  streaming: true,
                  timestamp: Date.now(),
                });
              }
              return next;
            });
          }
        }
        break;
      }

      case 'result': {
        // Finalize streaming
        setMessages(prev => {
          const finalized = prev.map(m => m.streaming ? { ...m, streaming: false } : m);
          // Persist last assistant response to DB
          const lastAssistant = [...finalized].reverse().find(m => m.role === 'assistant');
          if (lastAssistant?.content) {
            const sid = useAgentTabStore.getState().tabs.find(t => t.id === tabId)?.sessionId;
            if (sid) {
              sessionsApi.appendMessage(sid, 'output', lastAssistant.content).catch(() => {});
            }
          }
          return finalized;
        });
        if (event.is_error) {
          setError(event.result || 'Unknown error');
        }
        break;
      }

      case 'error': {
        setError(event.error || event.result || 'CLI error');
        setMessages(prev => prev.map(m =>
          m.streaming ? { ...m, streaming: false } : m
        ));
        break;
      }

      // system, user — silently ignored in GUI panel
    }
  }, []);

  const parseChunk = useCallback((data: string) => {
    jsonBufferRef.current += data.replace(/\r/g, '');
    const result = extractJsonObjects(jsonBufferRef.current, pendingPartialRef.current);
    jsonBufferRef.current = result.buffer;
    pendingPartialRef.current = result.pending;
    for (const event of result.events) {
      processStreamEvent(event);
    }
  }, [processStreamEvent]);

  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || streaming) return;

    lastSentTextRef.current = text;
    setError(null);
    setInput('');
    setStreaming(true);
    emittedTextLengthsRef.current.clear();
    jsonBufferRef.current = '';
    pendingPartialRef.current = '';
    rawOutputRef.current = '';
    gotValidEventRef.current = false;

    // Add user message
    const userMsg: ChatMessage = {
      id: generateId(),
      role: 'user',
      content: text,
      streaming: false,
      timestamp: Date.now(),
    };
    setMessages(prev => [...prev, userMsg]);

    // Persist user message to DB
    const existingSid = useAgentTabStore.getState().tabs.find(t => t.id === tabId)?.sessionId;
    if (existingSid) {
      sessionsApi.appendMessage(existingSid, 'input', text).catch(() => {});
    }

    const terminalId = `gui-${Date.now().toString(36)}`;
    terminalIdRef.current = terminalId;

    const args = ['-p', '--output-format', 'stream-json', '--verbose', '--dangerously-skip-permissions'];

    // Timeout: 2 min with no valid event → surface error
    timeoutRef.current = setTimeout(() => {
      if (!gotValidEventRef.current) {
        const raw = rawOutputRef.current.trim();
        setError(raw || 'Claude 未响应（2 分钟超时）。请检查 API Key 和网络连接。');
        setStreaming(false);
        useAgentStore.getState().finishStreaming(
          useAgentTabStore.getState().tabs.find(t => t.id === tabId)?.sessionId ?? '__gui__',
        );
        const tid = activeTerminalIdRef.current;
        if (tid) terminalApi.stop(tid).catch(() => {});
        activeTerminalIdRef.current = null;
        cleanupListeners();
      }
    }, 120_000);

    try {
      // Register listeners before spawning
      unlistenOutputRef.current = await listen<TerminalOutputEvent>('terminal-output', (event) => {
        if (event.payload.terminalId !== terminalId) return;
        // PTY merges stdout+stderr into one stream ("stdout") — track all output
        rawOutputRef.current += event.payload.data;
        parseChunk(event.payload.data);
      });

      unlistenExitRef.current = await listen<TerminalExitEvent>('terminal-exit', (event) => {
        if (event.payload.terminalId !== terminalId) return;
        if (timeoutRef.current) { clearTimeout(timeoutRef.current); timeoutRef.current = null; }
        // Flush any remaining buffer
        jsonBufferRef.current += '\n';
        parseChunk('');
        // If no valid JSON events were received, show raw CLI output as error
        if (!gotValidEventRef.current) {
          const raw = rawOutputRef.current.trim();
          setError(raw || 'Claude 未返回有效响应');
        }
        // Finalize and persist
        setMessages(prev => {
          const finalized = prev.map(m => m.streaming ? { ...m, streaming: false } : m);
          const lastAssistant = [...finalized].reverse().find(m => m.role === 'assistant');
          if (lastAssistant?.content) {
            const sid = useAgentTabStore.getState().tabs.find(t => t.id === tabId)?.sessionId;
            if (sid) {
              sessionsApi.appendMessage(sid, 'output', lastAssistant.content).catch(() => {});
            }
          }
          return finalized;
        });
        setStreaming(false);
        useAgentStore.getState().finishStreaming(
          useAgentTabStore.getState().tabs.find(t => t.id === tabId)?.sessionId ?? '__gui__',
        );
        // Don't null activeTerminalIdRef — unmount cleanup needs it to stop the process
        cleanupListeners();
      });

      activeTerminalIdRef.current = terminalId;
      await terminalApi.startAgentPipedPty(terminalId, 'claude', args, effectiveCwd, text);

      // Create session record on first message and name tab
      if (!sessionCreatedRef.current) {
        sessionCreatedRef.current = true;
        const label = text.length > 20 ? text.slice(0, 20) + '…' : text;
        useAgentTabStore.getState().setLabel(tabId, label);
        sessionsApi.start(tabId, 'claude', undefined, effectiveCwd)
          .then(sid => {
            useAgentTabStore.getState().setSessionId(tabId, sid);
            useAgentStore.getState().startStreaming(sid);
          })
          .catch(() => {});
      } else {
        const sid = useAgentTabStore.getState().tabs.find(t => t.id === tabId)?.sessionId;
        if (sid) useAgentStore.getState().startStreaming(sid);
      }
    } catch (err) {
      setError(String(err));
      setStreaming(false);
      cleanupListeners();
      activeTerminalIdRef.current = null;
    }
  }, [input, streaming, parseChunk, effectiveCwd, cleanupListeners, tabId]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }, [sendMessage]);

  const handleStop = useCallback(() => {
    if (timeoutRef.current) { clearTimeout(timeoutRef.current); timeoutRef.current = null; }
    const tid = activeTerminalIdRef.current;
    if (tid) {
      terminalApi.stop(tid).catch(() => {});
    }
    cleanupListeners();
    activeTerminalIdRef.current = null;
    setStreaming(false);
    const sid = useAgentTabStore.getState().tabs.find(t => t.id === tabId)?.sessionId;
    if (sid) useAgentStore.getState().finishStreaming(sid);
    setMessages(prev => prev.map(m =>
      m.streaming ? { ...m, streaming: false } : m
    ));
  }, [cleanupListeners, tabId]);

  const handleRetry = useCallback(() => {
    if (lastSentTextRef.current) {
      setInput(lastSentTextRef.current);
      setError(null);
    }
  }, []);

  const styles = useMemo(() => buildStyles(isDark, isCompact, density), [isDark, isCompact, density]);

  return (
    <div style={{ ...styles.container, ...extraStyle }}>
      {/* Messages area */}
      <div style={styles.messagesArea} role="log" aria-live="polite" aria-label="对话消息">
        {messages.length === 0 && (
          <div style={styles.emptyState}>
            <span className="material-symbols-outlined" style={{ fontSize: 40, color: 'var(--md-outline-variant)' }}>
              chat
            </span>
            <p style={{ margin: '8px 0 0', fontSize: 13, color: 'var(--md-on-surface-variant)' }}>
              向 Claude 发送消息以开始对话
            </p>
          </div>
        )}

        {messages.map((msg, index) => (
          <div key={msg.id} style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start',
            ...(index >= prevCountRef.current ? { animation: 'slideUpFade 0.2s ease both' } : {}),
          }}>
            {isCompact && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                marginBottom: 2,
                fontSize: 10,
                color: 'var(--md-on-surface-variant)',
                opacity: 0.7,
                justifyContent: msg.role === 'user' ? 'flex-end' : undefined,
              }}>
                <span>{formatTime(msg.timestamp)}</span>
                {msg.role === 'assistant' && <span>Claude</span>}
              </div>
            )}
            <div style={msg.role === 'user' ? styles.userBubble : styles.assistantBubble}>
              {msg.role === 'assistant' ? (
                <div style={styles.markdownBody}>
                  <Markdown>{msg.content}</Markdown>
                  {msg.streaming && <span style={styles.cursor} />}
                </div>
              ) : (
                <span style={styles.userText}>{msg.content}</span>
              )}
            </div>
          </div>
        ))}

        {streaming && (messages.length === 0 || messages[messages.length - 1].role === 'user') && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
            <div style={styles.assistantBubble}>
              <span className="thinking-dots" style={styles.thinkingDots}>
                <span className="dot" /><span className="dot" /><span className="dot" />
              </span>
            </div>
          </div>
        )}

        {error && (
          <div style={styles.errorRow} role="alert">
            <div style={styles.errorBubble}>
              <span className="material-symbols-outlined" style={{ fontSize: 14, color: 'var(--md-error)', flexShrink: 0 }}>
                error
              </span>
              <span style={styles.errorText}>{error}</span>
              {lastSentTextRef.current && (
                <span
                  className="material-symbols-outlined"
                  role="button"
                  aria-label="重试"
                  onClick={handleRetry}
                  style={{ fontSize: 14, color: 'var(--md-primary)', cursor: 'pointer', flexShrink: 0, padding: 2, borderRadius: 'var(--radius-xs)' }}
                  title="重试"
                >refresh</span>
              )}
              <span
                className="material-symbols-outlined"
                role="button"
                aria-label="关闭错误提示"
                onClick={() => setError(null)}
                style={{ fontSize: 14, color: 'var(--md-on-surface-variant)', cursor: 'pointer', flexShrink: 0, padding: 2, borderRadius: 'var(--radius-xs)' }}
              >close</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div style={styles.inputArea}>
        <span
          style={styles.cwdTag}
          title={effectiveCwd}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 13 }}>folder</span>
          {folderName(effectiveCwd)}
        </span>
        <textarea
          ref={textareaRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={streaming ? 'Claude 正在回复...' : '输入消息... (Enter 发送, Shift+Enter 换行)'}
          disabled={streaming}
          rows={1}
          aria-label="输入消息"
          style={styles.textarea}
        />
        {streaming ? (
          <button onClick={handleStop} style={styles.stopBtn} aria-label="停止生成" title="停止">
            <span className="material-symbols-outlined" style={{ fontSize: styles.stopBtn.fontSize ?? 18 }}>stop</span>
          </button>
        ) : (
          <button
            onClick={sendMessage}
            disabled={!input.trim()}
            style={styles.sendBtn}
            aria-label="发送消息"
            title="发送"
          >
            <span className="material-symbols-outlined" style={{ fontSize: styles.sendBtn.fontSize ?? 18 }}>send</span>
          </button>
        )}
      </div>
    </div>
  );
}

function buildStyles(isDark: boolean, isCompact: boolean, density: string): Record<string, React.CSSProperties> {
  const isDense = density === 'dense';
  return {
    container: {
      display: 'flex',
      flexDirection: 'column',
      flex: 1,
      minHeight: 0,
      height: '100%',
    },
    messagesArea: {
      flex: 1,
      overflowY: 'auto',
      padding: isCompact ? (isDense ? '8px 10px' : '10px 12px') : '12px 16px',
      display: 'flex',
      flexDirection: 'column',
      gap: isCompact ? (isDense ? 4 : 8) : 12,
      minHeight: 0,
    },
    emptyState: {
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 4,
    },
    userBubble: {
      maxWidth: '80%',
      padding: isCompact ? (isDense ? '5px 10px' : '6px 12px') : '8px 14px',
      borderRadius: isCompact ? '12px 12px 3px 12px' : '16px 16px 4px 16px',
      background: 'var(--md-primary)',
      color: 'var(--md-on-primary)',
      fontFamily: 'var(--font-sans, "Fira Sans", sans-serif)',
      fontSize: isCompact ? (isDense ? 11 : 12) : 13,
      lineHeight: isCompact ? 1.4 : 1.5,
      wordBreak: 'break-word' as const,
    },
    userText: {
      whiteSpace: 'pre-wrap' as const,
    },
    assistantBubble: {
      maxWidth: '85%',
      padding: isCompact ? (isDense ? '5px 10px' : '6px 12px') : '8px 14px',
      borderRadius: isCompact ? '12px 12px 12px 3px' : '16px 16px 16px 4px',
      background: 'var(--md-surface-container-high)',
      color: 'var(--md-on-surface)',
      fontFamily: 'var(--font-sans, "Fira Sans", sans-serif)',
      fontSize: isCompact ? (isDense ? 11 : 12) : 13,
      lineHeight: isCompact ? 1.45 : 1.6,
      wordBreak: 'break-word' as const,
    },
    markdownBody: {
      // Markdown content styling
    },
    cursor: {
      display: 'inline-block',
      width: 6,
      height: 16,
      background: 'var(--md-primary)',
      marginLeft: 2,
      verticalAlign: 'text-bottom',
      animation: 'blink 1s step-end infinite',
    },
    thinkingDots: {
      display: 'flex',
      alignItems: 'center',
      padding: '4px 0',
    },
    errorRow: {
      display: 'flex',
      justifyContent: 'center',
    },
    errorBubble: {
      display: 'flex',
      alignItems: 'center',
      gap: 6,
      padding: '6px 12px',
      borderRadius: 8,
      background: 'var(--md-error-container)',
      border: '1px solid var(--md-error)',
      maxHeight: 200,
      overflow: 'auto',
    },
    errorText: {
      fontSize: 12,
      color: 'var(--md-error)',
      fontFamily: 'var(--font-sans, "Fira Sans", sans-serif)',
    },
    inputArea: {
      display: 'flex',
      alignItems: 'flex-end',
      gap: 8,
      padding: isCompact ? (isDense ? '6px 8px' : '7px 10px') : '8px 12px',
      borderTop: '1px solid var(--border)',
      background: 'var(--md-surface-container-low)',
    },
    cwdTag: {
      display: 'flex',
      alignItems: 'center',
      gap: 3,
      padding: '4px 7px',
      borderRadius: 6,
      fontSize: 11,
      fontFamily: 'var(--font-mono, monospace)',
      color: 'var(--md-on-surface-variant)',
      background: isDark ? 'rgba(148,163,184,0.08)' : 'rgba(0,0,0,0.04)',
      flexShrink: 0,
      cursor: 'default',
      alignSelf: 'center',
    },
    textarea: {
      flex: 1,
      resize: 'none',
      border: '1px solid var(--border)',
      borderRadius: 12,
      padding: isCompact ? (isDense ? '5px 8px' : '6px 10px') : '8px 12px',
      fontSize: isCompact ? (isDense ? 11 : 12) : 13,
      fontFamily: 'var(--font-sans, "Fira Sans", sans-serif)',
      lineHeight: 1.4,
      color: 'var(--md-on-surface)',
      background: isDark
        ? 'var(--md-surface-container-high, rgba(255,255,255,0.08))'
        : 'var(--md-surface, #ffffff)',
      outline: 'none',
      maxHeight: 120,
      minHeight: isCompact ? (isDense ? 28 : 32) : 36,
    },
    sendBtn: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: isCompact ? (isDense ? 24 : 28) : 40,
      height: isCompact ? (isDense ? 24 : 28) : 40,
      borderRadius: '50%',
      border: 'none',
      background: 'var(--md-primary)',
      color: 'var(--md-on-primary)',
      cursor: 'pointer',
      flexShrink: 0,
      transition: 'opacity 0.15s',
      fontSize: isCompact ? (isDense ? 12 : 14) : 18,
    },
    stopBtn: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: isCompact ? (isDense ? 24 : 28) : 40,
      height: isCompact ? (isDense ? 24 : 28) : 40,
      borderRadius: '50%',
      border: 'none',
      background: 'var(--md-error)',
      color: 'var(--md-on-error)',
      cursor: 'pointer',
      flexShrink: 0,
      transition: 'opacity 0.15s',
      fontSize: isCompact ? (isDense ? 12 : 14) : 18,
    },
  };
}
