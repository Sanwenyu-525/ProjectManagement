import { useState, useRef, useEffect, useCallback } from 'react';
import Markdown from 'react-markdown';
import { sessionsApi } from '../../../api';
import type { AgentMessage } from '../../../types';
import { useAgentStore } from '../../../stores/agentStore';
import type { AgentProvider, AgentStreamEvent } from './AgentProvider';

interface AgentChatProps {
  provider: AgentProvider | null;
  activeSessionId: string | null;
}

export default function AgentChat({ activeSessionId, provider }: AgentChatProps) {
  const streamingText = useAgentStore(s => s.streamingText);
  const streamingSessionId = useAgentStore(s => s.streamingSessionId);
  const appendToken = useAgentStore(s => s.appendToken);
  const startStreaming = useAgentStore(s => s.startStreaming);
  const finishStreaming = useAgentStore(s => s.finishStreaming);

  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load messages when active session changes
  useEffect(() => {
    if (!activeSessionId) {
      setMessages([]);
      return;
    }
    sessionsApi.messages(activeSessionId).then(setMessages).catch(() => {});
  }, [activeSessionId]);

  // Listen for provider stream events
  useEffect(() => {
    if (!provider || !activeSessionId) return;

    const unsub = provider.onStream((event: AgentStreamEvent) => {
      if (event.type === 'token') {
        appendToken(activeSessionId, event.text);
      } else if (event.type === 'done') {
        const text = useAgentStore.getState().streamingText[activeSessionId] || '';
        if (text.trim()) {
          sessionsApi.appendMessage(activeSessionId, 'assistant', text);
        }
        finishStreaming(activeSessionId);
        setSending(false);
      } else if (event.type === 'error') {
        finishStreaming(activeSessionId);
        setSending(false);
      }
    });

    return () => { unsub(); };
  }, [provider, activeSessionId, appendToken, finishStreaming]);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingText]);

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (el) {
      el.style.height = 'auto';
      el.style.height = Math.min(el.scrollHeight, 120) + 'px';
    }
  }, [input]);

  // Focus textarea
  useEffect(() => {
    if (activeSessionId && provider) {
      requestAnimationFrame(() => textareaRef.current?.focus());
    }
  }, [activeSessionId, provider]);

  const handleSend = useCallback(async () => {
    const content = input.trim();
    if (!content || !activeSessionId || !provider || sending) return;
    setInput('');
    setSending(true);

    const userMsg: AgentMessage = {
      id: Date.now(),
      sessionId: activeSessionId,
      role: 'user',
      content,
      timestamp: new Date().toISOString(),
    };
    setMessages(prev => [...prev, userMsg]);
    await sessionsApi.appendMessage(activeSessionId, 'user', content);
    startStreaming(activeSessionId);

    try {
      await provider.send(content);
    } catch {
      finishStreaming(activeSessionId);
      setSending(false);
    }
  }, [input, activeSessionId, provider, sending, startStreaming, finishStreaming]);

  const handleAbort = useCallback(async () => {
    if (!provider || !activeSessionId) return;
    await provider.abort();
    const text = useAgentStore.getState().streamingText[activeSessionId] || '';
    if (text.trim()) {
      await sessionsApi.appendMessage(activeSessionId, 'assistant', text);
    }
    finishStreaming(activeSessionId);
    setSending(false);
  }, [provider, activeSessionId, finishStreaming]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const isStreaming = streamingSessionId !== null;
  const currentStreamingText = activeSessionId ? streamingText[activeSessionId] || '' : '';

  // Empty state — no session
  if (!activeSessionId) {
    return (
      <div style={styles.emptyState}>
        <span className="material-symbols-outlined" style={{ fontSize: 48, color: 'var(--md-outline-variant)', marginBottom: 12 }}>
          code
        </span>
        <h2 style={styles.emptyTitle}>Agent Workspace</h2>
        <p style={styles.emptySubtitle}>
          {provider
            ? 'Agent is starting...'
            : 'Click "Start" to launch an agent.'}
        </p>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      {/* Messages */}
      <div style={styles.messages}>
        {messages.length === 0 && !isStreaming && (
          <div style={styles.emptyHint}>
            <span className="material-symbols-outlined" style={{ fontSize: 32, color: 'var(--md-outline-variant)', marginBottom: 8 }}>
              chat
            </span>
            <p style={{ margin: 0, fontSize: 13, color: 'var(--md-on-surface-variant)' }}>
              {provider
                ? 'Agent is ready. Send a message to begin.'
                : 'Waiting for an agent to start...'}
            </p>
          </div>
        )}

        {messages.map(msg => {
          const isUser = msg.role === 'user' || msg.role === 'input';
          return (
            <div key={msg.id} style={{
              ...styles.messageRow,
              justifyContent: isUser ? 'flex-end' : 'flex-start',
            }}>
              {!isUser && (
                <div style={styles.avatar}>
                  <span className="material-symbols-outlined" style={{ fontSize: 16, color: '#ffffff' }}>
                    code
                  </span>
                </div>
              )}
              <div style={{
                ...styles.bubble,
                ...(isUser ? styles.userBubble : styles.aiBubble),
              }}>
                {isUser ? (
                  <span style={styles.userText}>{msg.content}</span>
                ) : (
                  <div style={styles.markdownBody}>
                    <Markdown>{msg.content}</Markdown>
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {/* Streaming response */}
        {isStreaming && currentStreamingText && (
          <div style={styles.messageRow}>
            <div style={styles.avatar}>
              <span className="material-symbols-outlined" style={{ fontSize: 16, color: '#ffffff' }}>
                code
              </span>
            </div>
            <div style={{ ...styles.bubble, ...styles.aiBubble }}>
              <div style={styles.markdownBody}>
                <Markdown>{currentStreamingText}</Markdown>
                <span style={styles.cursor}>|</span>
              </div>
            </div>
          </div>
        )}

        {/* Thinking indicator */}
        {isStreaming && !currentStreamingText && (
          <div style={styles.messageRow}>
            <div style={styles.avatar}>
              <span className="material-symbols-outlined" style={{ fontSize: 16, color: '#ffffff' }}>
                code
              </span>
            </div>
            <div style={{ ...styles.bubble, ...styles.aiBubble, ...styles.thinkingBubble }}>
              <span style={styles.thinkingDots}>Thinking</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div style={styles.inputSection}>
        <div style={styles.inputWrapper}>
          <textarea
            ref={textareaRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={!provider ? 'Start an agent first...' : 'Type your message...'}
            rows={2}
            disabled={!provider}
            style={styles.textarea}
          />
          <div style={styles.inputActions}>
            <div style={styles.attachBtns}>
              <button style={styles.attachBtn} title="Attach file">
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>attach_file</span>
              </button>
              <button style={styles.attachBtn} title="Code snippet">
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>code</span>
              </button>
            </div>
            {isStreaming ? (
              <button onClick={handleAbort} style={styles.stopBtn} title="Stop (Ctrl+C)">
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>stop</span>
              </button>
            ) : (
              <button
                onClick={handleSend}
                disabled={!input.trim() || sending || !provider}
                style={{
                  ...styles.sendBtn,
                  opacity: input.trim() && !sending && provider ? 1 : 0.4,
                }}
                title="Send"
              >
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>send</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    flex: 1,
    minHeight: 0,
    overflow: 'hidden',
  },
  emptyState: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    margin: 0,
    fontSize: 20,
    fontWeight: 600,
    fontFamily: 'var(--font-sans)',
    color: 'var(--md-on-surface)',
  },
  emptySubtitle: {
    margin: '4px 0 0',
    fontSize: 13,
    color: 'var(--md-on-surface-variant)',
    fontFamily: 'var(--font-sans)',
  },
  messages: {
    flex: 1,
    overflowY: 'auto',
    padding: '16px 20px',
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
    minHeight: 0,
  },
  emptyHint: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '32px 0',
    textAlign: 'center',
  },
  messageRow: {
    display: 'flex',
    gap: 10,
    alignItems: 'flex-start',
  },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: '50%',
    background: 'var(--md-primary)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    marginTop: 2,
  },
  bubble: {
    maxWidth: '75%',
    padding: '8px 12px',
    borderRadius: 12,
    fontSize: 13,
    lineHeight: '1.5',
    wordBreak: 'break-word',
  },
  userBubble: {
    background: 'var(--md-primary-container)',
    color: 'var(--md-on-primary-container)',
    borderRadius: '12px 12px 4px 12px',
    marginLeft: 'auto',
  },
  aiBubble: {
    background: 'var(--md-surface-container-low)',
    color: 'var(--md-on-surface)',
    borderRadius: '12px 12px 12px 4px',
  },
  userText: {
    fontFamily: 'var(--font-sans)',
  },
  markdownBody: {
    fontFamily: 'var(--font-sans)',
    fontSize: 13,
    lineHeight: '1.5',
  },
  cursor: {
    display: 'inline-block',
    animation: 'blink 1s step-end infinite',
    fontWeight: 'bold',
    color: 'var(--md-primary)',
    marginLeft: 1,
  },
  thinkingBubble: {
    color: 'var(--md-on-surface-variant)',
  },
  thinkingDots: {
    fontSize: 12,
    fontStyle: 'italic',
    animation: 'blink 1.5s ease-in-out infinite',
  },
  inputSection: {
    padding: '8px 16px 12px',
    borderTop: '1px solid var(--md-outline-variant)',
    flexShrink: 0,
    background: 'var(--md-surface-container-lowest)',
  },
  inputWrapper: {
    borderRadius: 12,
    border: '1px solid var(--md-outline-variant)',
    background: 'var(--md-surface-container-low)',
    overflow: 'hidden',
    transition: 'border-color 0.15s',
  },
  textarea: {
    width: '100%',
    fontSize: 13,
    fontFamily: 'var(--font-sans)',
    background: 'transparent',
    border: 'none',
    padding: '10px 12px 6px',
    resize: 'none',
    outline: 'none',
    color: 'var(--md-on-surface)',
    lineHeight: '1.5',
    boxSizing: 'border-box',
    minHeight: 40,
  },
  inputActions: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '4px 8px 6px',
  },
  attachBtns: {
    display: 'flex',
    gap: 2,
  },
  attachBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 28,
    height: 28,
    borderRadius: 6,
    border: 'none',
    background: 'transparent',
    color: 'var(--md-outline)',
    cursor: 'pointer',
  },
  sendBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 32,
    height: 32,
    borderRadius: 8,
    border: 'none',
    background: 'var(--md-primary)',
    color: 'var(--md-on-primary)',
    cursor: 'pointer',
    transition: 'opacity 0.15s',
  },
  stopBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 32,
    height: 32,
    borderRadius: 8,
    border: 'none',
    background: 'var(--md-error)',
    color: '#ffffff',
    cursor: 'pointer',
  },
};
