import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import Markdown from 'react-markdown';
import { sessionsApi } from '../../../api';
import { useAgentStore } from '../../../stores/agentStore';
import { open } from '@tauri-apps/plugin-dialog';
import type { AgentProvider, AgentStreamEvent } from './AgentProvider';

/** Detect terminal-formatted content (box drawing, ASCII art, CLI tables) */
function isTerminalFormatted(text: string): boolean {
  if (text.indexOf('\n') === -1) return false;
  if (/[╭╮╰╯┌┐└┘╔╗╚╝║═]/.test(text)) return true;
  if (/^.*─{4,}.*$/m.test(text) && /\|.*\|/.test(text)) return true;
  if (/^.*──{4,}.*$/m.test(text)) return true;
  return false;
}

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
  const messages = useAgentStore(s => s.messages);
  const appendMessage = useAgentStore(s => s.appendMessage);
  const loadMessages = useAgentStore(s => s.loadMessages);
  const toolEvents = useAgentStore(s => s.toolEvents);

  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [attachments, setAttachments] = useState<string[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const currentMessages = useMemo(
    () => activeSessionId ? messages[activeSessionId] || [] : [],
    [activeSessionId, messages]
  );
  const currentStreamingText = activeSessionId ? streamingText[activeSessionId] || '' : '';
  const isStreaming = streamingSessionId === activeSessionId;
  const currentToolEvents = useMemo(
    () => activeSessionId ? toolEvents[activeSessionId] || [] : [],
    [activeSessionId, toolEvents]
  );

  // Hydrate messages from DB when session changes
  useEffect(() => {
    if (!activeSessionId) return;
    // Only hydrate if store is empty for this session (avoid overwriting streaming state)
    if (messages[activeSessionId] && messages[activeSessionId].length > 0) return;
    sessionsApi.messages(activeSessionId).then(dbMsgs => {
      if (dbMsgs.length > 0) loadMessages(activeSessionId, dbMsgs);
    }).catch(() => {});
  }, [activeSessionId, messages, loadMessages]);

  // Listen for provider stream events
  useEffect(() => {
    if (!provider || !activeSessionId) return;

    const unsub = provider.onStream((event: AgentStreamEvent) => {
      if (event.type === 'token') {
        appendToken(activeSessionId, event.text);
      } else if (event.type === 'tool_use') {
        useAgentStore.getState().appendToolEvent(activeSessionId, {
          id: `tool-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          toolName: event.toolName,
          description: event.description,
          timestamp: Date.now(),
        });
      } else if (event.type === 'done') {
        const text = useAgentStore.getState().streamingText[activeSessionId] || '';
        if (text.trim()) {
          appendMessage(activeSessionId, 'assistant', text);
          sessionsApi.appendMessage(activeSessionId, 'assistant', text).catch(() => {});
        }
        finishStreaming(activeSessionId);
        setSending(false);
      } else if (event.type === 'error') {
        // Show error in chat flow as a system message
        appendMessage(activeSessionId, 'error', `⚠ ${event.error}`);
        const text = useAgentStore.getState().streamingText[activeSessionId] || '';
        if (text.trim()) {
          appendMessage(activeSessionId, 'assistant', text);
        }
        finishStreaming(activeSessionId);
        setSending(false);
      }
    });

    return () => { unsub(); };
  }, [provider, activeSessionId, appendToken, finishStreaming, appendMessage]);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [currentMessages, currentStreamingText, currentToolEvents]);

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
    const text = input.trim();
    if ((!text && attachments.length === 0) || !activeSessionId || !provider || sending) return;
    const content = attachments.length > 0
      ? [...attachments.map(p => `@${p}`), text].filter(Boolean).join('\n')
      : text;
    setInput('');
    setAttachments([]);
    setSending(true);

    // Add user message to store and persist
    appendMessage(activeSessionId, 'user', content);
    sessionsApi.appendMessage(activeSessionId, 'user', content).catch(() => {});

    // Start streaming and send to provider
    startStreaming(activeSessionId);
    try {
      await provider.send(content);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      appendMessage(activeSessionId, 'error', `⚠ Failed to send: ${msg}`);
      finishStreaming(activeSessionId);
      setSending(false);
    }
  }, [input, attachments, activeSessionId, provider, sending, startStreaming, finishStreaming, appendMessage]);

  const handleAbort = useCallback(async () => {
    if (!provider || !activeSessionId) return;
    try {
      await provider.abort();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      appendMessage(activeSessionId, 'error', `⚠ Abort failed: ${msg}`);
    }
    const text = useAgentStore.getState().streamingText[activeSessionId] || '';
    if (text.trim()) {
      appendMessage(activeSessionId, 'assistant', text);
      sessionsApi.appendMessage(activeSessionId, 'assistant', text).catch(() => {});
    }
    finishStreaming(activeSessionId);
    setSending(false);
  }, [provider, activeSessionId, finishStreaming, appendMessage]);

  const handleAttachFile = useCallback(async () => {
    try {
      const selected = await open({ multiple: true, title: '选择文件' });
      if (!selected) return;
      const paths = Array.isArray(selected) ? selected : [selected];
      setAttachments(prev => [...prev, ...paths]);
    } catch { /* ignore */ }
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

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
        {currentMessages.length === 0 && !isStreaming && (
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

        {/* Rendered conversation messages */}
        {currentMessages.map((msg, idx) => {
          if (msg.role === 'error') {
            return (
              <div key={idx} style={styles.errorRow}>
                <span className="material-symbols-outlined" style={{ fontSize: 14, color: 'var(--md-error)' }}>
                  error
                </span>
                <span style={styles.errorText}>{msg.content}</span>
              </div>
            );
          }
          const isUser = msg.role === 'user';
          return (
            <div key={idx} style={{
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
                ) : isTerminalFormatted(msg.content) ? (
                  <pre style={styles.terminalContent}>{msg.content}</pre>
                ) : (
                  <div style={styles.markdownBody}>
                    <Markdown>{msg.content}</Markdown>
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {/* Tool events during current streaming */}
        {isStreaming && currentToolEvents.slice(-5).map(tool => (
          <div key={tool.id} style={styles.toolEventRow}>
            <span className="material-symbols-outlined" style={{ fontSize: 14, color: 'var(--md-primary)' }}>
              build
            </span>
            <span style={styles.toolEventText}>
              {tool.toolName}: {tool.description}
            </span>
          </div>
        ))}

        {/* Streaming response */}
        {isStreaming && currentStreamingText && (
          <div style={styles.messageRow}>
            <div style={styles.avatar}>
              <span className="material-symbols-outlined" style={{ fontSize: 16, color: '#ffffff' }}>
                code
              </span>
            </div>
            <div style={{ ...styles.bubble, ...styles.aiBubble }}>
              {isTerminalFormatted(currentStreamingText) ? (
                <pre style={styles.terminalContent}>{currentStreamingText}<span style={styles.cursor}>|</span></pre>
              ) : (
                <div style={styles.markdownBody}>
                  <Markdown>{currentStreamingText}</Markdown>
                  <span style={styles.cursor}>|</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Thinking indicator (streaming started but no text yet) */}
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
          {attachments.length > 0 && (
            <div style={styles.attachmentList}>
              {attachments.map((path, i) => {
                const name = path.split(/[/\\]/).pop() || path;
                return (
                  <span key={i} style={styles.attachmentChip}>
                    <span className="material-symbols-outlined" style={{ fontSize: 13 }}>description</span>
                    <span style={{ maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</span>
                    <button
                      onClick={() => setAttachments(prev => prev.filter((_, j) => j !== i))}
                      style={styles.attachmentRemove}
                      title="移除"
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: 12 }}>close</span>
                    </button>
                  </span>
                );
              })}
            </div>
          )}
          <div style={styles.inputActions}>
            <div style={styles.attachBtns}>
              <button style={styles.attachBtn} title="Attach file" onClick={handleAttachFile}>
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
                disabled={(!input.trim() && attachments.length === 0) || sending || !provider}
                style={{
                  ...styles.sendBtn,
                  opacity: (input.trim() || attachments.length > 0) && !sending && provider ? 1 : 0.4,
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
  terminalContent: {
    fontFamily: 'var(--font-mono)',
    fontSize: 12,
    lineHeight: '1.5',
    whiteSpace: 'pre',
    overflowX: 'auto',
    margin: 0,
    padding: 0,
    background: 'transparent',
    border: 'none',
    color: 'inherit',
    wordBreak: 'normal',
  } as React.CSSProperties,
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
  toolEventRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    paddingLeft: 38,
    fontSize: 12,
    color: 'var(--md-on-surface-variant)',
  },
  toolEventText: {
    fontFamily: 'var(--font-mono)',
    fontSize: 11,
    opacity: 0.8,
  },
  errorRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    paddingLeft: 38,
    fontSize: 12,
    color: 'var(--md-error)',
    fontFamily: 'var(--font-mono)',
  },
  errorText: {
    fontFamily: 'var(--font-mono)',
    fontSize: 12,
    lineHeight: '1.5',
    wordBreak: 'break-word',
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
  attachmentList: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 4,
    padding: '4px 10px',
  },
  attachmentChip: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    fontSize: 11,
    fontFamily: 'var(--font-mono)',
    color: 'var(--md-on-surface)',
    background: 'var(--md-surface-container-high)',
    border: '1px solid var(--md-outline-variant)',
    borderRadius: 6,
    padding: '2px 6px 2px 4px',
    lineHeight: '18px',
  },
  attachmentRemove: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 16,
    height: 16,
    borderRadius: '50%',
    border: 'none',
    background: 'transparent',
    color: 'var(--md-outline)',
    cursor: 'pointer',
    padding: 0,
  },
};
