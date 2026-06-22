import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { listen } from '@tauri-apps/api/event';
import Markdown from 'react-markdown';
import { terminalApi } from '../../../api';
import { useThemeStore } from '../../../stores/themeStore';
import { useTerminalStore } from '../../../stores/terminalStore';
import { extractJsonObjects, type StreamJsonEvent } from '../../../lib/parseStreamJson';
import type { TerminalOutputEvent, TerminalExitEvent } from '../../../shared/terminalTypes';

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
}

export default function AgentGUIPanel({ cwd: propCwd }: AgentGUIPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const terminalIdRef = useRef(`gui-${Date.now().toString(36)}`);
  const jsonBufferRef = useRef('');
  const pendingPartialRef = useRef('');
  const emittedTextLengthsRef = useRef(new Map<number, number>());
  const activeTerminalIdRef = useRef<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const unlistenOutputRef = useRef<(() => void) | null>(null);
  const unlistenExitRef = useRef<(() => void) | null>(null);

  const isDark = useThemeStore(s => s.mode === 'dark');
  const defaultCwd = useTerminalStore(s => s.defaultCwd);
  const effectiveCwd = propCwd || defaultCwd || '';

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const cleanupListeners = useCallback(() => {
    unlistenOutputRef.current?.();
    unlistenOutputRef.current = null;
    unlistenExitRef.current?.();
    unlistenExitRef.current = null;
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanupListeners();
      const tid = activeTerminalIdRef.current;
      if (tid) {
        terminalApi.stop(tid).catch(() => {});
      }
    };
  }, [cleanupListeners]);

  const processStreamEvent = useCallback((event: StreamJsonEvent) => {
    switch (event.type) {
      case 'assistant': {
        const blocks = event.message?.content || [];
        for (let i = 0; i < blocks.length; i++) {
          const block = blocks[i];
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
        setMessages(prev => prev.map(m =>
          m.streaming ? { ...m, streaming: false } : m
        ));
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

    setError(null);
    setInput('');
    setStreaming(true);
    emittedTextLengthsRef.current.clear();
    jsonBufferRef.current = '';
    pendingPartialRef.current = '';

    // Add user message
    const userMsg: ChatMessage = {
      id: generateId(),
      role: 'user',
      content: text,
      streaming: false,
      timestamp: Date.now(),
    };
    setMessages(prev => [...prev, userMsg]);

    const terminalId = `gui-${Date.now().toString(36)}`;
    terminalIdRef.current = terminalId;

    const args = ['-p', '--output-format', 'stream-json', '--verbose'];

    try {
      // Register listeners before spawning
      unlistenOutputRef.current = await listen<TerminalOutputEvent>('terminal-output', (event) => {
        if (event.payload.terminalId !== terminalId) return;
        if (event.payload.stream === 'stderr') return;
        parseChunk(event.payload.data);
      });

      unlistenExitRef.current = await listen<TerminalExitEvent>('terminal-exit', (event) => {
        if (event.payload.terminalId !== terminalId) return;
        // Flush any remaining buffer
        jsonBufferRef.current += '\n';
        parseChunk('');
        // Finalize
        setMessages(prev => prev.map(m =>
          m.streaming ? { ...m, streaming: false } : m
        ));
        setStreaming(false);
        activeTerminalIdRef.current = null;
        cleanupListeners();
      });

      activeTerminalIdRef.current = terminalId;
      await terminalApi.startAgentPipedPty(terminalId, 'claude', args, effectiveCwd, text);
    } catch (err) {
      setError(String(err));
      setStreaming(false);
      cleanupListeners();
      activeTerminalIdRef.current = null;
    }
  }, [input, streaming, parseChunk, effectiveCwd, cleanupListeners]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }, [sendMessage]);

  const handleStop = useCallback(() => {
    const tid = activeTerminalIdRef.current;
    if (tid) {
      terminalApi.stop(tid).catch(() => {});
    }
    cleanupListeners();
    activeTerminalIdRef.current = null;
    setStreaming(false);
    setMessages(prev => prev.map(m =>
      m.streaming ? { ...m, streaming: false } : m
    ));
  }, [cleanupListeners]);

  const styles = useMemo(() => buildStyles(isDark), [isDark]);

  return (
    <div style={styles.container}>
      {/* Messages area */}
      <div style={styles.messagesArea}>
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

        {messages.map(msg => (
          <div key={msg.id} style={msg.role === 'user' ? styles.userRow : styles.assistantRow}>
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

        {error && (
          <div style={styles.errorRow}>
            <div style={styles.errorBubble}>
              <span className="material-symbols-outlined" style={{ fontSize: 14, color: 'var(--md-error)' }}>
                error
              </span>
              <span style={styles.errorText}>{error}</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div style={styles.inputArea}>
        <textarea
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={streaming ? 'Claude 正在回复...' : '输入消息... (Enter 发送, Shift+Enter 换行)'}
          disabled={streaming}
          rows={1}
          style={styles.textarea}
        />
        {streaming ? (
          <button onClick={handleStop} style={styles.stopBtn} title="停止">
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>stop</span>
          </button>
        ) : (
          <button
            onClick={sendMessage}
            disabled={!input.trim()}
            style={styles.sendBtn}
            title="发送"
          >
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>send</span>
          </button>
        )}
      </div>
    </div>
  );
}

function buildStyles(isDark: boolean): Record<string, React.CSSProperties> {
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
      padding: '12px 16px',
      display: 'flex',
      flexDirection: 'column',
      gap: 12,
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
    userRow: {
      display: 'flex',
      justifyContent: 'flex-end',
    },
    assistantRow: {
      display: 'flex',
      justifyContent: 'flex-start',
    },
    userBubble: {
      maxWidth: '80%',
      padding: '8px 14px',
      borderRadius: '16px 16px 4px 16px',
      background: isDark
        ? 'var(--md-primary, #4f8cff)'
        : 'var(--md-primary, #1a73e8)',
      color: isDark
        ? 'var(--md-on-primary, #ffffff)'
        : 'var(--md-on-primary, #ffffff)',
      fontFamily: 'var(--font-sans, "Fira Sans", sans-serif)',
      fontSize: 13,
      lineHeight: 1.5,
      wordBreak: 'break-word',
    },
    userText: {
      whiteSpace: 'pre-wrap',
    },
    assistantBubble: {
      maxWidth: '85%',
      padding: '8px 14px',
      borderRadius: '16px 16px 16px 4px',
      background: isDark
        ? 'var(--md-surface-container-high, rgba(255,255,255,0.08))'
        : 'var(--md-surface-container-low, rgba(0,0,0,0.04))',
      color: 'var(--md-on-surface)',
      fontFamily: 'var(--font-sans, "Fira Sans", sans-serif)',
      fontSize: 13,
      lineHeight: 1.6,
      wordBreak: 'break-word',
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
      background: isDark
        ? 'rgba(220, 38, 38, 0.15)'
        : 'rgba(220, 38, 38, 0.08)',
      border: '1px solid var(--md-error, #dc2626)',
    },
    errorText: {
      fontSize: 12,
      color: 'var(--md-error, #dc2626)',
      fontFamily: 'var(--font-sans, "Fira Sans", sans-serif)',
    },
    inputArea: {
      display: 'flex',
      alignItems: 'flex-end',
      gap: 8,
      padding: '8px 12px',
      borderTop: '1px solid var(--md-outline-variant)',
      background: isDark
        ? 'var(--md-surface-container, rgba(255,255,255,0.05))'
        : 'var(--md-surface-container-low, rgba(0,0,0,0.02))',
    },
    textarea: {
      flex: 1,
      resize: 'none',
      border: '1px solid var(--md-outline-variant)',
      borderRadius: 12,
      padding: '8px 12px',
      fontSize: 13,
      fontFamily: 'var(--font-sans, "Fira Sans", sans-serif)',
      lineHeight: 1.4,
      color: 'var(--md-on-surface)',
      background: isDark
        ? 'var(--md-surface-container-high, rgba(255,255,255,0.08))'
        : 'var(--md-surface, #ffffff)',
      outline: 'none',
      maxHeight: 120,
      minHeight: 36,
    },
    sendBtn: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: 36,
      height: 36,
      borderRadius: '50%',
      border: 'none',
      background: 'var(--md-primary)',
      color: 'var(--md-on-primary)',
      cursor: 'pointer',
      flexShrink: 0,
      transition: 'opacity 0.15s',
    },
    stopBtn: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: 36,
      height: 36,
      borderRadius: '50%',
      border: 'none',
      background: 'var(--md-error, #dc2626)',
      color: 'var(--md-on-primary, #ffffff)',
      cursor: 'pointer',
      flexShrink: 0,
      transition: 'opacity 0.15s',
    },
  };
}
