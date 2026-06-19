import { useState, useRef, useEffect, useCallback } from 'react';
import Markdown from 'react-markdown';
import { sessionsApi } from '../../../api';
import { useAgentStore } from '../../../stores/agentStore';
import type { AgentMessage } from '../../../stores/agentStore';
import { open } from '@tauri-apps/plugin-dialog';
import type { AgentProvider, AgentStreamEvent, MessageBlock } from './AgentProvider';

const EMPTY_BLOCKS: MessageBlock[] = [];
const EMPTY_MESSAGES: AgentMessage[] = [];

/** Detect terminal-formatted content (box drawing, ASCII art, CLI UI) */
function isTerminalFormatted(text: string): boolean {
  if (/[╭╮╰╯┌┐└┘╔╗╚╝║═]/.test(text)) return true;
  if (/──{4,}/.test(text)) return true;
  if (/\|.{4,}\|/.test(text)) return true;
  if (/[─]{2,}▸/.test(text)) return true;
  return false;
}

// ── Tool rendering helpers ────────────────────────────────────────

function getToolMeta(toolName: string): { icon: string; color: string } {
  const n = toolName.toLowerCase();
  if (n === 'bash' || n === 'bashcommand') return { icon: 'terminal', color: 'var(--md-tertiary)' };
  if (n === 'read' || n === 'read_file') return { icon: 'description', color: 'var(--md-primary)' };
  if (n === 'edit' || n === 'edit_file') return { icon: 'edit_note', color: 'var(--md-secondary)' };
  if (n === 'write' || n === 'write_file') return { icon: 'save', color: 'var(--md-secondary)' };
  if (n === 'glob') return { icon: 'search', color: 'var(--md-primary)' };
  if (n === 'grep') return { icon: 'find_in_page', color: 'var(--md-primary)' };
  if (n === 'todowrite' || n === 'task') return { icon: 'checklist', color: 'var(--md-tertiary)' };
  if (n === 'webfetch' || n === 'websearch') return { icon: 'language', color: 'var(--md-primary)' };
  return { icon: 'build', color: 'var(--md-outline)' };
}

function getToolSummary(toolName: string, input: Record<string, unknown>): string {
  const n = toolName.toLowerCase();
  if ((n === 'bash' || n === 'bashcommand') && typeof input.command === 'string') {
    return input.command.length > 80 ? input.command.slice(0, 80) + '...' : input.command;
  }
  if (typeof input.file_path === 'string') return input.file_path.split(/[/\\]/).pop() || input.file_path;
  if (typeof input.pattern === 'string') return input.pattern;
  if (typeof input.description === 'string') return input.description;
  // First string value
  for (const v of Object.values(input)) {
    if (typeof v === 'string' && v.length < 120) return v;
  }
  return '';
}

function formatToolOutput(output: string, maxLen = 2000): string {
  if (output.length <= maxLen) return output;
  return output.slice(0, maxLen) + `\n... (还有 ${output.length - maxLen} 个字符)`;
}

// ── ToolUseCard ───────────────────────────────────────────────────

function ToolUseCard({ block, isStreaming }: { block: Extract<MessageBlock, { type: 'tool_use' }>; isStreaming?: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const { icon, color } = getToolMeta(block.toolName);
  const summary = getToolSummary(block.toolName, block.input);
  const hasResult = block.output !== undefined;
  const isPending = isStreaming && !hasResult;

  return (
    <div style={{
      ...toolStyles.card,
      borderLeftColor: color,
    }}>
      <div style={toolStyles.header} onClick={() => setExpanded(!expanded)}>
        <span className="material-symbols-outlined" style={{ fontSize: 14, color, flexShrink: 0 }}>
          {icon}
        </span>
        <span style={toolStyles.toolName}>{block.toolName}</span>
        {summary && <span style={toolStyles.summary}>{summary}</span>}
        <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 4 }}>
          {isPending && <span className="material-symbols-outlined" style={toolStyles.spinner}>progress_activity</span>}
          {hasResult && !block.isError && (
            <span className="material-symbols-outlined" style={{ fontSize: 14, color: 'var(--md-tertiary)' }}>check_circle</span>
          )}
          {hasResult && block.isError && (
            <span className="material-symbols-outlined" style={{ fontSize: 14, color: 'var(--md-error)' }}>error</span>
          )}
          <span className="material-symbols-outlined" style={{
            fontSize: 14, color: 'var(--md-on-surface-variant)', opacity: 0.6,
            transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.15s',
          }}>
            expand_more
          </span>
        </span>
      </div>
      {expanded && (
        <div style={toolStyles.body}>
          {/* Input */}
          {Object.keys(block.input).length > 0 && (
            <div style={toolStyles.section}>
              <div style={toolStyles.sectionLabel}>输入</div>
              <pre style={toolStyles.code}>{JSON.stringify(block.input, null, 2)}</pre>
            </div>
          )}
          {/* Output */}
          {hasResult && (
            <div style={toolStyles.section}>
              <div style={toolStyles.sectionLabel}>{block.isError ? '错误' : '输出'}</div>
              <pre style={{
                ...toolStyles.code,
                ...(block.isError ? { borderLeft: '3px solid var(--md-error)', color: 'var(--md-error)' } : {}),
              }}>
                {formatToolOutput(block.output!)}
              </pre>
            </div>
          )}
          {isPending && (
            <div style={toolStyles.section}>
              <span style={{ fontSize: 11, color: 'var(--md-on-surface-variant)', fontStyle: 'italic' }}>
                等待结果...
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── ThinkingBlock ─────────────────────────────────────────────────

function ThinkingBlock({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div style={thinkingStyles.panel}>
      <div style={thinkingStyles.header} onClick={() => setExpanded(!expanded)}>
        <span className="material-symbols-outlined" style={{ fontSize: 14, color: 'var(--md-on-surface-variant)' }}>
          psychology
        </span>
        <span style={thinkingStyles.label}>思考中</span>
        <span className="material-symbols-outlined" style={{
          fontSize: 14, color: 'var(--md-on-surface-variant)', opacity: 0.5, marginLeft: 'auto',
          transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.15s',
        }}>
          expand_more
        </span>
      </div>
      {expanded && (
        <div style={thinkingStyles.content}>
          {text}
        </div>
      )}
    </div>
  );
}

// ── MessageBlockRenderer ──────────────────────────────────────────

function MessageBlockRenderer({ block, isStreaming }: { block: MessageBlock; isStreaming?: boolean }) {
  if (block.type === 'thinking') {
    return <ThinkingBlock text={block.text} />;
  }
  if (block.type === 'tool_use') {
    return <ToolUseCard block={block} isStreaming={isStreaming} />;
  }
  // text block
  if (isTerminalFormatted(block.text)) {
    return <pre style={styles.terminalContent}>{block.text}</pre>;
  }
  return (
    <div style={styles.markdownBody}>
      <Markdown>{block.text}</Markdown>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────

interface AgentChatProps {
  provider: AgentProvider | null;
  activeSessionId: string | null;
  onStartAndSend?: (message: string) => Promise<void>;
  onBack?: () => void;
}

export default function AgentChat({ activeSessionId, provider, onStartAndSend, onBack }: AgentChatProps) {
  const streamingSessionId = useAgentStore(s => s.streamingSessionId);
  const appendToken = useAgentStore(s => s.appendToken);
  const appendThinkingBlock = useAgentStore(s => s.appendThinkingBlock);
  const appendToolStartBlock = useAgentStore(s => s.appendToolStartBlock);
  const updateToolBlockResult = useAgentStore(s => s.updateToolBlockResult);
  const startStreaming = useAgentStore(s => s.startStreaming);
  const finishStreaming = useAgentStore(s => s.finishStreaming);
  const appendMessage = useAgentStore(s => s.appendMessage);
  const loadMessages = useAgentStore(s => s.loadMessages);

  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [attachments, setAttachments] = useState<string[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortingRef = useRef(false);

  const currentMessages = useAgentStore(
    s => activeSessionId ? (s.messages[activeSessionId] || EMPTY_MESSAGES) : EMPTY_MESSAGES
  );
  const currentStreamingBlocks = useAgentStore(
    s => activeSessionId ? (s.streamingBlocks[activeSessionId] || EMPTY_BLOCKS) : EMPTY_BLOCKS
  );
  const isStreaming = streamingSessionId === activeSessionId;

  // Hydrate messages from DB when session changes
  useEffect(() => {
    if (!activeSessionId) return;
    if (useAgentStore.getState().messages[activeSessionId]?.length) return;
    sessionsApi.messages(activeSessionId).then(dbMsgs => {
      if (dbMsgs.length > 0) loadMessages(activeSessionId, dbMsgs);
    }).catch(() => {});
  }, [activeSessionId, loadMessages]);

  // Listen for provider stream events
  useEffect(() => {
    if (!provider || !activeSessionId) return;

    const unsub = provider.onStream((event: AgentStreamEvent) => {
      switch (event.type) {
        case 'token':
          appendToken(activeSessionId, event.text);
          break;
        case 'thinking':
          appendThinkingBlock(activeSessionId, event.text);
          break;
        case 'tool_start':
          appendToolStartBlock(activeSessionId, { id: event.id, toolName: event.toolName, input: event.input });
          break;
        case 'tool_result':
          updateToolBlockResult(activeSessionId, event.toolUseId, event.output, event.isError);
          break;
        case 'tool_use':
          break;
        case 'done': {
          if (!activeSessionId) break;
          if (!abortingRef.current) {
            const blocks = useAgentStore.getState().streamingBlocks[activeSessionId] || [];
            if (blocks.length > 0) {
              const content = JSON.stringify({ v: 2, blocks });
              sessionsApi.appendMessage(activeSessionId, 'assistant', content).catch(() => {});
            }
          }
          abortingRef.current = false;
          finishStreaming(activeSessionId);
          setSending(false);
          break;
        }
        case 'error': {
          if (!activeSessionId) break;
          appendMessage(activeSessionId, 'error', `⚠ ${event.error}`);
          const blocks = useAgentStore.getState().streamingBlocks[activeSessionId] || [];
          if (blocks.length > 0) {
            const content = JSON.stringify({ v: 2, blocks });
            sessionsApi.appendMessage(activeSessionId, 'assistant', content).catch(() => {});
          }
          finishStreaming(activeSessionId);
          setSending(false);
          break;
        }
      }
    });

    return () => { unsub(); };
  }, [provider, activeSessionId, appendToken, appendThinkingBlock, appendToolStartBlock, updateToolBlockResult, finishStreaming, appendMessage]);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [currentMessages, currentStreamingBlocks]);

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
    if (!text && attachments.length === 0) return;
    if (sending) return;

    // No active session — delegate to parent to create session and start agent
    if (!activeSessionId) {
      if (!onStartAndSend) return;
      const content = attachments.length > 0
        ? [...attachments.map(p => `@${p}`), text].filter(Boolean).join('\n')
        : text;
      setInput('');
      setAttachments([]);
      setSending(true);
      try {
        await onStartAndSend(content);
      } catch { /* error shown by parent */ } finally {
        setSending(false);
      }
      return;
    }

    if (!provider) return;
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
      appendMessage(activeSessionId, 'error', `⚠ 发送失败: ${msg}`);
      finishStreaming(activeSessionId);
      setSending(false);
    }
  }, [input, attachments, activeSessionId, provider, sending, startStreaming, finishStreaming, appendMessage, onStartAndSend]);

  const handleAbort = useCallback(async () => {
    if (!provider || !activeSessionId) return;
    abortingRef.current = true;
    try {
      await provider.abort();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      appendMessage(activeSessionId, 'error', `⚠ 中止失败: ${msg}`);
    }
    const blocks = useAgentStore.getState().streamingBlocks[activeSessionId] || [];
    if (blocks.length > 0) {
      const content = JSON.stringify({ v: 2, blocks });
      sessionsApi.appendMessage(activeSessionId, 'assistant', content).catch(() => {});
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
    if (!onStartAndSend) {
      return (
        <div style={styles.emptyState}>
          <span className="material-symbols-outlined" style={{ fontSize: 48, color: 'var(--md-outline-variant)', marginBottom: 12 }}>
            code
          </span>
          <h2 style={styles.emptyTitle}>Agent 工作区</h2>
          <p style={styles.emptySubtitle}>
            {provider
              ? 'Agent 正在启动...'
              : '点击「启动」来启动一个 Agent。'}
          </p>
        </div>
      );
    }

    return (
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          <span className="material-symbols-outlined" style={{ fontSize: 40, color: 'var(--md-primary)' }}>smart_toy</span>
          <h2 style={{ ...styles.emptyTitle, margin: 0 }}>有什么可以帮你的？</h2>
          <p style={{ ...styles.emptySubtitle, margin: 0 }}>描述你的任务来开始新对话。</p>
        </div>
        {/* Input area */}
        <div style={styles.inputSection}>
          <div style={styles.inputWrapper}>
            <textarea
              ref={textareaRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="输入消息..."
              rows={1}
              style={styles.textarea}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '4px 8px 6px' }}>
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
      </div>
    );
  }

  const lastStreamingBlock = currentStreamingBlocks[currentStreamingBlocks.length - 1];

  return (
    <div style={styles.container}>
      {/* Back to idle */}
      {onBack && (
        <div style={styles.backBar}>
          <button
            onClick={onBack}
            style={styles.backBtn}
            title="返回"
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--md-surface-container-highest)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'var(--md-surface-container-low)'; }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>arrow_back</span>
            <span style={{ fontSize: 12, fontFamily: 'var(--font-sans)' }}>新对话</span>
          </button>
        </div>
      )}

      {/* Messages */}
      <div style={styles.messages}>
        {currentMessages.length === 0 && !isStreaming && (
          <div style={styles.emptyHint}>
            <span className="material-symbols-outlined" style={{ fontSize: 32, color: 'var(--md-outline-variant)', marginBottom: 8 }}>
              chat
            </span>
            <p style={{ margin: 0, fontSize: 13, color: 'var(--md-on-surface-variant)' }}>
              {provider
                ? 'Agent 已就绪，发送消息开始对话。'
                : '等待 Agent 启动...'}
            </p>
          </div>
        )}

        {/* Rendered conversation messages */}
        {currentMessages.map((msg, idx) => {
          if (msg.role === 'error') {
            const errorText = msg.blocks.map(b => b.type === 'text' ? b.text : '').join('');
            return (
              <div key={idx} style={styles.errorRow}>
                <span className="material-symbols-outlined" style={{ fontSize: 14, color: 'var(--md-error)' }}>
                  error
                </span>
                <span style={styles.errorText}>{errorText}</span>
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
                  msg.blocks.map((block, bIdx) => (
                    block.type === 'text' ? <span key={bIdx} style={styles.userText}>{block.text}</span> : null
                  ))
                ) : (
                  msg.blocks.map((block, bIdx) => (
                    <MessageBlockRenderer key={bIdx} block={block} />
                  ))
                )}
              </div>
            </div>
          );
        })}

        {/* Streaming response */}
        {isStreaming && currentStreamingBlocks.length > 0 && (
          <div style={styles.messageRow}>
            <div style={styles.avatar}>
              <span className="material-symbols-outlined" style={{ fontSize: 16, color: '#ffffff' }}>
                code
              </span>
            </div>
            <div style={{ ...styles.bubble, ...styles.aiBubble }}>
              {currentStreamingBlocks.map((block, bIdx) => (
                <MessageBlockRenderer key={bIdx} block={block} isStreaming />
              ))}
              {lastStreamingBlock?.type === 'text' && <span style={styles.cursor}>|</span>}
            </div>
          </div>
        )}

        {/* Thinking indicator (streaming started but no blocks yet) */}
        {isStreaming && currentStreamingBlocks.length === 0 && (
          <div style={styles.messageRow}>
            <div style={styles.avatar}>
              <span className="material-symbols-outlined" style={{ fontSize: 16, color: '#ffffff' }}>
                code
              </span>
            </div>
            <div style={{ ...styles.bubble, ...styles.aiBubble, ...styles.thinkingBubble }}>
              <span style={styles.thinkingDots}>思考中</span>
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
            placeholder={!provider ? '请先启动 Agent...' : '输入消息...'}
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
              <button style={styles.attachBtn} title="添加文件" onClick={handleAttachFile}>
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>attach_file</span>
              </button>
            </div>
            {isStreaming ? (
              <button onClick={handleAbort} style={styles.stopBtn} title="停止 (Ctrl+C)">
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
                title="发送"
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

// ── Styles ────────────────────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    flex: 1,
    minHeight: 0,
    overflow: 'hidden',
  },
  backBar: {
    display: 'flex',
    alignItems: 'center',
    padding: '6px 12px',
    borderBottom: '1px solid var(--md-outline-variant)',
    flexShrink: 0,
  },
  backBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    padding: '4px 10px',
    borderRadius: 6,
    border: '1px solid var(--md-outline-variant)',
    background: 'var(--md-surface-container-low)',
    color: 'var(--md-on-surface-variant)',
    cursor: 'pointer',
    transition: 'background 0.15s',
    fontFamily: 'var(--font-sans)',
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
    maxWidth: '85%',
    padding: '8px 12px',
    borderRadius: 12,
    fontSize: 13,
    lineHeight: '1.5',
    wordBreak: 'break-word',
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
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
    maxWidth: '90%',
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
    padding: '6px 8px',
    background: 'rgba(0,0,0,0.04)',
    borderRadius: 6,
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

// ── Tool Card Styles ──────────────────────────────────────────────

const toolStyles: Record<string, React.CSSProperties> = {
  card: {
    background: 'var(--md-surface-container)',
    borderRadius: 8,
    border: '1px solid var(--md-outline-variant)',
    borderLeft: '3px solid var(--md-outline)',
    overflow: 'hidden',
    margin: '2px 0',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '6px 8px',
    cursor: 'pointer',
    transition: 'background 0.1s',
    userSelect: 'none',
  },
  toolName: {
    fontSize: 12,
    fontWeight: 600,
    fontFamily: 'var(--font-mono)',
    color: 'var(--md-on-surface)',
  },
  summary: {
    fontSize: 11,
    color: 'var(--md-on-surface-variant)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    flex: 1,
    minWidth: 0,
  },
  spinner: {
    fontSize: 14,
    color: 'var(--md-primary)',
    animation: 'spin 1s linear infinite',
  },
  body: {
    borderTop: '1px solid var(--md-outline-variant)',
    padding: '6px 8px',
    maxHeight: 300,
    overflowY: 'auto',
  },
  section: {
    marginBottom: 6,
  },
  sectionLabel: {
    fontSize: 10,
    fontWeight: 600,
    color: 'var(--md-on-surface-variant)',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    marginBottom: 3,
    fontFamily: 'var(--font-sans)',
  },
  code: {
    fontFamily: 'var(--font-mono)',
    fontSize: 11,
    lineHeight: '1.4',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-all',
    margin: 0,
    padding: '4px 6px',
    background: 'var(--md-surface-container-lowest)',
    borderRadius: 4,
    border: '1px solid var(--md-outline-variant)',
    maxHeight: 200,
    overflowY: 'auto',
    color: 'var(--md-on-surface)',
  },
};

// ── Thinking Block Styles ─────────────────────────────────────────

const thinkingStyles: Record<string, React.CSSProperties> = {
  panel: {
    background: 'var(--md-surface-container-lowest)',
    borderRadius: 6,
    border: '1px solid var(--md-outline-variant)',
    borderLeft: '3px solid var(--md-outline)',
    overflow: 'hidden',
    margin: '2px 0',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '5px 8px',
    cursor: 'pointer',
    userSelect: 'none',
  },
  label: {
    fontSize: 11,
    fontWeight: 500,
    color: 'var(--md-on-surface-variant)',
    fontStyle: 'italic',
    fontFamily: 'var(--font-sans)',
  },
  content: {
    padding: '6px 10px',
    fontSize: 12,
    color: 'var(--md-on-surface-variant)',
    fontStyle: 'italic',
    lineHeight: '1.5',
    fontFamily: 'var(--font-sans)',
    maxHeight: 200,
    overflowY: 'auto',
    borderTop: '1px solid var(--md-outline-variant)',
    whiteSpace: 'pre-wrap',
  },
};
