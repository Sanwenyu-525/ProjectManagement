import { useState, useRef, useEffect, useCallback } from 'react';
import Markdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { message as antMessage } from 'antd';
import { sessionsApi, memoryApi } from '../../../api';
import { useAgentStore } from '../../../stores/agentStore';
import { useAgentContextStore } from '../../../stores/agentContextStore';
import type { AgentMessage } from '../../../stores/agentStore';
import { open } from '@tauri-apps/plugin-dialog';
import { useSlashCommands, SlashMenu } from './useSlashCommands';
import type { AgentProvider, AgentStreamEvent, MessageBlock } from './AgentProvider';
import AgentActivityBar from './AgentActivityBar';
import { ModelPicker, QuickConfig, handleSlashCommand } from './AgentCommandPanels';

import { getToolIcon, getToolColor, getToolSummary as getToolSummaryBase } from '../../../lib/toolUtils';

const EMPTY_BLOCKS: MessageBlock[] = [];
const EMPTY_MESSAGES: AgentMessage[] = [];

// Auto-save agent conclusions to memory
function autoSaveMemory(sessionId: string) {
  try {
    const msgs = useAgentStore.getState().messages[sessionId] ?? [];
    const lastAssistant = [...msgs].reverse().find(m => m.role === 'assistant');
    if (!lastAssistant) return;
    const text = lastAssistant.blocks
      .filter(b => b.type === 'text')
      .map(b => b.text)
      .join('\n');
    if (text.length < 50) return;
    const title = text.slice(0, 60).replace(/\n/g, ' ').trim();
    const content = text.length > 500 ? text.slice(0, 500) + '...' : text;
    memoryApi.create({
      memoryType: 'session',
      title,
      content,
      source: 'agent',
      sessionId,
    }).catch(() => {});
  } catch {
    // silent — auto-save should never block the UI
  }
}

// ── Tool rendering helpers ────────────────────────────────────────
function isTerminalFormatted(text: string): boolean {
  if (/[╭╮╰╯┌┐└┘╔╗╚╝║═]/.test(text)) return true;
  if (/──{4,}/.test(text)) return true;
  if (/\|.{4,}\|/.test(text)) return true;
  if (/[─]{2,}▸/.test(text)) return true;
  return false;
}

// ── Tool rendering helpers ────────────────────────────────────────

function getToolMeta(toolName: string): { icon: string; color: string } {
  return { icon: getToolIcon(toolName), color: getToolColor(toolName) };
}

function getToolSummary(toolName: string, input: Record<string, unknown>): string {
  return getToolSummaryBase(toolName, input, 80);
}

/** Compute line diff stats for edit/write tools. Returns "+N -M" or null. */
function getLineStats(toolName: string, input: Record<string, unknown>): string | null {
  const n = toolName.toLowerCase();
  if ((n === 'edit' || n === 'edit_file') && typeof input.old_string === 'string' && typeof input.new_string === 'string') {
    const removed = input.old_string.split('\n').length;
    const added = input.new_string.split('\n').length;
    return `+${added} -${removed}`;
  }
  if ((n === 'write' || n === 'write_file') && typeof input.content === 'string') {
    const lines = input.content.split('\n').length;
    return `+${lines}`;
  }
  return null;
}

/** Format duration in ms to human-readable string */
function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

/** Extract file paths from a tool's input for context tracking */
function extractFilePaths(toolName: string, input: Record<string, unknown>): string[] {
  const paths: string[] = [];
  if (typeof input.file_path === 'string') paths.push(input.file_path);
  if (Array.isArray(input.files)) {
    for (const f of input.files) {
      if (typeof f === 'string') paths.push(f);
    }
  }
  // For bash commands, extract obvious file paths
  if ((toolName === 'Bash' || toolName === 'BashCommand') && typeof input.command === 'string') {
    const cmd = input.command;
    // Match paths with extensions that look like source files
    const pathMatches = cmd.match(/(?:^|\s)([^\s]+\.(?:ts|tsx|js|jsx|rs|py|css|html|json|md|sql|toml|yaml|yml|lock))(?:\s|$)/g);
    if (pathMatches) {
      for (const m of pathMatches) {
        const p = m.trim();
        if (p && !p.startsWith('-')) paths.push(p);
      }
    }
  }
  return paths;
}

/** Determine the operation type from tool name */
function getOperationType(toolName: string): 'read' | 'write' | 'edit' | 'search' {
  const n = toolName.toLowerCase();
  if (n === 'read' || n === 'read_file') return 'read';
  if (n === 'write' || n === 'write_file') return 'write';
  if (n === 'edit' || n === 'edit_file') return 'edit';
  if (n === 'glob' || n === 'grep') return 'search';
  return 'read'; // default
}

function formatToolOutput(output: string, maxLen = 2000): string {
  if (output.length <= maxLen) return output;
  return output.slice(0, maxLen) + `\n... (还有 ${output.length - maxLen} 个字符)`;
}

// ── InlineDiff ──────────────────────────────────────────────────

function InlineDiff({ oldText, newText }: { oldText: string; newText: string }) {
  const oldLines = oldText.split('\n');
  const newLines = newText.split('\n');

  return (
    <div style={diffStyles.container}>
      <div style={diffStyles.table}>
        {oldLines.map((line, i) => (
          <div key={`d-${i}`} style={diffStyles.row}>
            <span style={{ ...diffStyles.lineNum, ...diffStyles.lineNumDel }}>{i + 1}</span>
            <span style={diffStyles.delMarker}>−</span>
            <span style={diffStyles.delLine}>{line || ' '}</span>
          </div>
        ))}
        {newLines.map((line, i) => (
          <div key={`a-${i}`} style={diffStyles.row}>
            <span style={{ ...diffStyles.lineNum, ...diffStyles.lineNumAdd }}>{i + 1}</span>
            <span style={diffStyles.addMarker}>+</span>
            <span style={diffStyles.addLine}>{line || ' '}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function FileContentPreview({ content }: { content: string }) {
  const lines = content.split('\n');
  return (
    <div style={diffStyles.container}>
      <div style={diffStyles.table}>
        {lines.map((line, i) => (
          <div key={i} style={diffStyles.row}>
            <span style={{ ...diffStyles.lineNum, ...diffStyles.lineNumAdd }}>{i + 1}</span>
            <span style={diffStyles.addMarker}>+</span>
            <span style={diffStyles.addLine}>{line || ' '}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Tool input rendering ────────────────────────────────────────

function renderToolInput(toolName: string, input: Record<string, unknown>): React.ReactNode {
  const n = toolName.toLowerCase();
  const filePath = typeof input.file_path === 'string' ? input.file_path : null;

  if ((n === 'edit' || n === 'edit_file') && typeof input.old_string === 'string' && typeof input.new_string === 'string') {
    return (
      <div style={toolStyles.section}>
        {filePath && (
          <div style={diffStyles.filePath}>
            <span className="material-symbols-outlined" style={{ fontSize: 13 }}>description</span>
            {filePath}
          </div>
        )}
        <InlineDiff oldText={input.old_string} newText={input.new_string} />
      </div>
    );
  }

  if ((n === 'write' || n === 'write_file') && typeof input.content === 'string') {
    return (
      <div style={toolStyles.section}>
        {filePath && (
          <div style={diffStyles.filePath}>
            <span className="material-symbols-outlined" style={{ fontSize: 13 }}>description</span>
            {filePath}
          </div>
        )}
        <FileContentPreview content={input.content} />
      </div>
    );
  }

  // Default: raw JSON
  if (Object.keys(input).length === 0) return null;
  return (
    <div style={toolStyles.section}>
      <div style={toolStyles.sectionLabel}>输入</div>
      <pre style={toolStyles.code}>{JSON.stringify(input, null, 2)}</pre>
    </div>
  );
}

// ── ToolUseCard ───────────────────────────────────────────────────

function ToolUseCard({ block, isStreaming }: { block: Extract<MessageBlock, { type: 'tool_use' }>; isStreaming?: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const { icon, color } = getToolMeta(block.toolName);
  const summary = getToolSummary(block.toolName, block.input);
  const lineStats = getLineStats(block.toolName, block.input);
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
        {block.durationMs !== undefined && (
          <span style={toolStyles.duration}>{formatDuration(block.durationMs)}</span>
        )}
        {lineStats && <span style={toolStyles.lineStats}>{lineStats}</span>}
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
      {isPending && <div style={toolStyles.progressBar}><div style={toolStyles.progressFill} /></div>}
      {expanded && (
        <div style={toolStyles.body}>
          {renderToolInput(block.toolName, block.input)}
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

function ThinkingBlock({ text, isStreaming, isLast }: { text: string; isStreaming?: boolean; isLast?: boolean }) {
  const isLive = isStreaming && isLast;
  const [expanded, setExpanded] = useState(isLive);

  // Auto-expand when this becomes the live (last) thinking block during streaming
  useEffect(() => {
    if (isLive) setExpanded(true);
  }, [isLive]);

  const preview = text.split('\n')[0];
  const previewText = preview.length > 80 ? preview.slice(0, 80) + '...' : preview;

  return (
    <div style={thinkingStyles.panel}>
      <div style={thinkingStyles.header} onClick={() => setExpanded(!expanded)}>
        <span className="material-symbols-outlined" style={{
          fontSize: 14,
          color: isLive ? 'var(--md-primary)' : 'var(--md-on-surface-variant)',
          ...(isLive ? { animation: 'pulse 2s ease-in-out infinite' } : {}),
        }}>
          psychology
        </span>
        {expanded ? (
          <span style={thinkingStyles.label}>思考中</span>
        ) : (
          <span style={thinkingStyles.preview}>{previewText || '思考中'}</span>
        )}
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
          {isLive && <span style={thinkingStyles.cursor}>|</span>}
        </div>
      )}
    </div>
  );
}

// ── MessageBlockRenderer ──────────────────────────────────────────

const markdownComponents = {
  code({ className, children, ...props }: React.ComponentPropsWithoutRef<'code'> & { className?: string }) {
    const match = /language-(\w+)/.exec(className || '');
    const codeStr = String(children).replace(/\n$/, '');
    if (match) {
      return (
        <SyntaxHighlighter
          style={oneLight}
          language={match[1]}
          customStyle={{ margin: 0, borderRadius: 6, fontSize: 12, lineHeight: '1.5' }}
        >
          {codeStr}
        </SyntaxHighlighter>
      );
    }
    return (
      <code className={className} style={{ background: 'var(--md-surface-container-high)', padding: '1px 4px', borderRadius: 3, fontSize: 12, fontFamily: 'var(--font-mono)' }} {...props}>
        {children}
      </code>
    );
  },
};

function MessageBlockRenderer({ block, isStreaming, isLastThinking }: { block: MessageBlock; isStreaming?: boolean; isLastThinking?: boolean }) {
  if (block.type === 'thinking') {
    return <ThinkingBlock text={block.text} isStreaming={isStreaming} isLast={isLastThinking} />;
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
      <Markdown components={markdownComponents}>
        {block.text}
      </Markdown>
    </div>
  );
}


// ── Helpers ─────────────────────────────────────────────────────

/** Format content with @-prefixed attachment paths */
function formatContent(attachments: string[], text: string): string {
  if (attachments.length > 0) {
    return [...attachments.map(p => `@${p}`), text].filter(Boolean).join('\n');
  }
  return text;
}


// ── Main Component ────────────────────────────────────────────────

interface AgentChatProps {
  provider: AgentProvider | null;
  activeSessionId: string | null;
  tabId?: string;
  onStartAndSend?: (message: string) => Promise<void>;
}

export default function AgentChat({ activeSessionId, provider, onStartAndSend }: AgentChatProps) {
  const streamingSessionId = useAgentStore(s => s.streamingSessionId);
  const appendToken = useAgentStore(s => s.appendToken);
  const appendThinkingBlock = useAgentStore(s => s.appendThinkingBlock);
  const appendToolStartBlock = useAgentStore(s => s.appendToolStartBlock);
  const updateToolBlockResult = useAgentStore(s => s.updateToolBlockResult);
  const startStreaming = useAgentStore(s => s.startStreaming);
  const finishStreaming = useAgentStore(s => s.finishStreaming);
  const appendMessage = useAgentStore(s => s.appendMessage);
  const loadMessages = useAgentStore(s => s.loadMessages);
  const sessionResults = useAgentStore(s => s.sessionResults);
  const setSessionResult = useAgentStore(s => s.setSessionResult);

  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [retrying, setRetrying] = useState<{attempt: number; maxAttempts: number; delayMs: number} | null>(null);
  const [attachments, setAttachments] = useState<string[]>([]);
  const [showModelPicker, setShowModelPicker] = useState(false);
  const [showConfigPanel, setShowConfigPanel] = useState(false);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const [hoveredMsgIdx, setHoveredMsgIdx] = useState<number | null>(null);
  const slash = useSlashCommands();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const abortingRef = useRef(false);
  const pendingCommandRef = useRef<string | null>(null);
  const autoScrollRef = useRef(true);

  const currentMessages = useAgentStore(
    s => activeSessionId ? (s.messages[activeSessionId] || EMPTY_MESSAGES) : EMPTY_MESSAGES
  );
  const currentStreamingBlocks = useAgentStore(
    s => activeSessionId ? (s.streamingBlocks[activeSessionId] || EMPTY_BLOCKS) : EMPTY_BLOCKS
  );
  const isStreaming = streamingSessionId === activeSessionId;

  // Reset interactive panels when session changes
  useEffect(() => { setShowModelPicker(false); setShowConfigPanel(false); }, [activeSessionId]);

  // Hydrate messages from DB when session changes
  useEffect(() => {
    if (!activeSessionId) return;
    if (useAgentStore.getState().messages[activeSessionId]?.length) return;
    sessionsApi.messages(activeSessionId).then(dbMsgs => {
      if (dbMsgs.length > 0) loadMessages(activeSessionId, dbMsgs);
    }).catch(() => {});
  }, [activeSessionId, loadMessages]);

  const trackFileAccess = useAgentContextStore(s => s.trackFileAccess);

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
          // Track file access for context panel
          extractFilePaths(event.toolName, event.input).forEach(path => {
            trackFileAccess(activeSessionId, path, getOperationType(event.toolName));
          });
          break;
        case 'tool_result':
          updateToolBlockResult(activeSessionId, event.toolUseId, event.output, event.isError);
          break;
        case 'tool_use':
          break;
        case 'result':
          setSessionResult(activeSessionId, {
            costUsd: event.costUsd,
            durationMs: event.durationMs,
            numTurns: event.numTurns,
          });
          break;
        case 'retrying':
          setRetrying({ attempt: event.attempt, maxAttempts: event.maxAttempts, delayMs: event.delayMs });
          break;
        case 'done': {
          setRetrying(null);
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
          autoSaveMemory(activeSessionId);
          setSending(false);
          break;
        }
        case 'error': {
          setRetrying(null);
          if (!activeSessionId) break;
          appendMessage(activeSessionId, 'error', `⚠ ${event.error}`);
          const blocks = useAgentStore.getState().streamingBlocks[activeSessionId] || [];
          if (blocks.length > 0) {
            const content = JSON.stringify({ v: 2, blocks });
            sessionsApi.appendMessage(activeSessionId, 'assistant', content).catch(() => {});
          }
          finishStreaming(activeSessionId);
          autoSaveMemory(activeSessionId);
          setSending(false);
          break;
        }
      }
    });

    return () => { unsub(); };
  }, [provider, activeSessionId, appendToken, appendThinkingBlock, appendToolStartBlock, updateToolBlockResult, finishStreaming, appendMessage, trackFileAccess]);

  // Auto-scroll: only when user is near bottom
  useEffect(() => {
    if (autoScrollRef.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [currentMessages, currentStreamingBlocks]);

  // Detect scroll position to toggle scroll-to-bottom button
  const handleScroll = useCallback(() => {
    const el = messagesContainerRef.current;
    if (!el) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 100;
    autoScrollRef.current = nearBottom;
    setShowScrollBtn(!nearBottom);
  }, []);

  const scrollToBottom = useCallback(() => {
    autoScrollRef.current = true;
    setShowScrollBtn(false);
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

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
    // Priority: process pending command selected from slash menu (ref avoids stale closure)
    const pending = pendingCommandRef.current;
    if (pending) {
      pendingCommandRef.current = null;
      if (handleSlashCommand(pending, setShowModelPicker, setShowConfigPanel, activeSessionId ? () => useAgentStore.getState().clearMessages(activeSessionId) : undefined)) return;
      // Non-interactive command — send to PTY as-is (no user bubble)
      if (activeSessionId && provider) {
        try { await provider.send(pending); } catch { /* ignore */ }
      }
      setInput('');
      return;
    }

    const text = input.trim();
    if (!text && attachments.length === 0) return;
    if (sending) return;

    // Intercept interactive slash commands (typed manually, not from menu)
    if (handleSlashCommand(text, setShowModelPicker, setShowConfigPanel, activeSessionId ? () => useAgentStore.getState().clearMessages(activeSessionId) : undefined)) return;

    // Format content with @-prefixed attachment paths
    const content = formatContent(attachments, text);

    // No active session — delegate to parent to create session and start agent
    if (!activeSessionId) {
      if (!onStartAndSend) return;
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

  const handleModelSelect = useCallback(async (modelId: string) => {
    setShowModelPicker(false);
    setShowConfigPanel(false);
    if (provider && activeSessionId) {
      try { await provider.send(`/model ${modelId}`); } catch { /* ignore */ }
    }
  }, [provider, activeSessionId]);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = slash.handleInputChange(e);
    setInput(val);
  }, [slash.handleInputChange]);

  const handleCopyMessage = useCallback((msg: typeof currentMessages[number]) => {
    const text = msg.blocks
      .filter(b => b.type === 'text')
      .map(b => b.text)
      .join('\n');
    navigator.clipboard.writeText(text).then(
      () => antMessage.success('已复制'),
      () => antMessage.error('复制失败'),
    );
  }, []);

  const handleRetryMessage = useCallback(async (msg: typeof currentMessages[number]) => {
    if (!activeSessionId || sending || isStreaming) return;
    const text = msg.blocks
      .filter(b => b.type === 'text')
      .map(b => b.text)
      .join('\n')
      .trim();
    if (!text) return;

    // Find index of this message and remove it + all subsequent messages
    const msgs = useAgentStore.getState().messages[activeSessionId] || [];
    const idx = msgs.indexOf(msg);
    if (idx < 0) return;
    const keepCount = idx;
    useAgentStore.getState().removeMessagesFrom(activeSessionId, idx);
    sessionsApi.truncateMessages(activeSessionId, keepCount).catch(() => {});

    // Resend the message
    if (!provider) return;
    appendMessage(activeSessionId, 'user', text);
    sessionsApi.appendMessage(activeSessionId, 'user', text).catch(() => {});
    setSending(true);
    startStreaming(activeSessionId);
    try {
      await provider.send(text);
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : String(e);
      appendMessage(activeSessionId, 'error', `⚠ 发送失败: ${errMsg}`);
      finishStreaming(activeSessionId);
      setSending(false);
    }
  }, [activeSessionId, provider, sending, isStreaming, appendMessage, startStreaming, finishStreaming]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Slash menu is open — let it handle navigation, but auto-submit on selection
    if (slash.open && slash.filtered.length > 0) {
      const result = slash.handleKeyDown(e);
      if (typeof result === 'string') {
        const cmd = result.trim();
        setInput(result);
        // Auto-submit known slash commands immediately (single Enter)
        if (cmd.startsWith('/')) {
          pendingCommandRef.current = cmd; // sync ref — avoids stale closure in handleSend
          requestAnimationFrame(() => handleSend());
        }
        requestAnimationFrame(() => textareaRef.current?.focus());
        return;
      }
      if (result) return; // Arrow keys, Escape — menu handled it
    }

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
          <span className="material-symbols-outlined" aria-hidden="true" style={{ fontSize: 48, color: 'var(--md-outline-variant)', marginBottom: 12 }}>
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
          <span className="material-symbols-outlined" aria-hidden="true" style={{ fontSize: 40, color: 'var(--md-primary)' }}>smart_toy</span>
          <h2 style={{ ...styles.emptyTitle, margin: 0 }}>有什么可以帮你的？</h2>
          <p style={{ ...styles.emptySubtitle, margin: 0 }}>描述你的任务来开始新对话。</p>
        </div>
        {/* Input area */}
        <div style={styles.inputSection}>
          <div ref={slash.anchorRef} style={styles.inputWrapper}>
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
              placeholder="输入消息或 / 查看命令..."
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
  let lastThinkingIdx = -1;
  for (let i = currentStreamingBlocks.length - 1; i >= 0; i--) {
    if (currentStreamingBlocks[i].type === 'thinking') { lastThinkingIdx = i; break; }
  }

  return (
    <div style={styles.container}>
      {isStreaming && activeSessionId && (
        <AgentActivityBar sessionId={activeSessionId} isStreaming={isStreaming} />
      )}
      <div ref={messagesContainerRef} style={styles.messages} onScroll={handleScroll}>
        {retrying && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '8px 12px', borderRadius: 8,
            background: 'rgba(245, 158, 11, 0.08)',
            border: '1px solid rgba(245, 158, 11, 0.3)',
            fontSize: 12, color: 'var(--md-on-surface)',
            fontFamily: 'var(--font-sans)',
            alignSelf: 'center',
          }}
          role="status"
          aria-live="polite"
          >
            <span className="material-symbols-outlined" style={{ fontSize: 16, color: '#F59E0B', animation: 'spin 1s linear infinite' }}>progress_activity</span>
            {'遇到限流，' + retrying.attempt + '/' + retrying.maxAttempts + ' 次重试中... (等待 ' + Math.round(retrying.delayMs / 1000) + 's)'}
          </div>
        )}
        {currentMessages.length === 0 && !isStreaming && (
          <div style={styles.emptyHint}>
            <span className="material-symbols-outlined" aria-hidden="true" style={{ fontSize: 32, color: 'var(--md-outline-variant)', marginBottom: 8 }}>
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
              <div key={idx} style={styles.errorRow} role="alert">
                <span className="material-symbols-outlined" style={{ fontSize: 14, color: 'var(--md-error)' }}>
                  error
                </span>
                <span style={styles.errorText}>{errorText}</span>
              </div>
            );
          }
          const isUser = msg.role === 'user';
          return (
            <div
              key={idx}
              style={{ ...styles.messageRow, justifyContent: isUser ? 'flex-end' : 'flex-start' }}
            >
              {!isUser && (
                <div style={styles.avatar}>
                  <span className="material-symbols-outlined" aria-hidden="true" style={{ fontSize: 16, color: '#ffffff' }}>
                    code
                  </span>
                </div>
              )}
              {isUser ? (
                <div
                  style={styles.userBubbleAnchor}
                  onMouseEnter={() => setHoveredMsgIdx(idx)}
                  onMouseLeave={() => setHoveredMsgIdx(null)}
                >
                  <div style={{ ...styles.bubble, ...styles.userBubble }}>
                    {msg.blocks.map((block, bIdx) => (
                      block.type === 'text' ? <span key={bIdx} style={styles.userText}>{block.text}</span> : null
                    ))}
                  </div>
                  {hoveredMsgIdx === idx && (
                    <div style={styles.userActionRow}>
                      <button
                        onClick={() => handleCopyMessage(msg)}
                        style={styles.msgActionBtn}
                        title="复制"
                        aria-label="复制"
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: 14 }}>content_copy</span>
                      </button>
                      <button
                        onClick={() => handleRetryMessage(msg)}
                        style={styles.msgActionBtn}
                        title="回退并重新发送"
                        aria-label="回退并重新发送"
                        disabled={sending || isStreaming}
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: 14 }}>replay</span>
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div
                  style={{ position: 'relative' }}
                  onMouseEnter={() => setHoveredMsgIdx(idx)}
                  onMouseLeave={() => setHoveredMsgIdx(null)}
                >
                  <div style={{ ...styles.bubble, ...styles.aiBubble }}>
                    {msg.blocks.map((block, bIdx) => (
                      <MessageBlockRenderer key={bIdx} block={block} />
                    ))}
                  </div>
                  {hoveredMsgIdx === idx && (
                    <button
                      onClick={() => handleCopyMessage(msg)}
                      style={styles.msgCopyBtn}
                      title="复制消息"
                      aria-label="复制消息"
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: 14 }}>content_copy</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {/* Streaming response */}
        {isStreaming && currentStreamingBlocks.length > 0 && (
          <div style={styles.messageRow}>
            <div style={styles.avatar}>
              <span className="material-symbols-outlined" aria-hidden="true" style={{ fontSize: 16, color: '#ffffff' }}>
                code
              </span>
            </div>
            <div style={{ ...styles.bubble, ...styles.aiBubble }}>
              {currentStreamingBlocks.map((block, bIdx) => (
                <MessageBlockRenderer key={bIdx} block={block} isStreaming isLastThinking={bIdx === lastThinkingIdx} />
              ))}
              {lastStreamingBlock?.type === 'text' && <span style={styles.cursor}>|</span>}
            </div>
          </div>
        )}

        {/* Thinking indicator (streaming started but no blocks yet) */}
        {isStreaming && currentStreamingBlocks.length === 0 && (
          <div style={styles.messageRow} aria-live="polite">
            <div style={styles.avatar}>
              <span className="material-symbols-outlined" aria-hidden="true" style={{ fontSize: 16, color: '#ffffff' }}>
                code
              </span>
            </div>
            <div style={{ ...styles.bubble, ...styles.aiBubble, ...styles.thinkingBubble }}>
              <span style={styles.thinkingDots}>思考中</span>
            </div>
          </div>
        )}

        {/* Model picker */}
        {showModelPicker && (
          <div style={styles.messageRow}>
            <div style={styles.avatar}>
              <span className="material-symbols-outlined" aria-hidden="true" style={{ fontSize: 16, color: '#ffffff' }}>code</span>
            </div>
            <ModelPicker onSelect={handleModelSelect} />
          </div>
        )}

        {/* Quick config panel */}
        {showConfigPanel && (
          <div style={styles.messageRow}>
            <div style={styles.avatar}>
              <span className="material-symbols-outlined" aria-hidden="true" style={{ fontSize: 16, color: '#ffffff' }}>code</span>
            </div>
            <QuickConfig onSelectModel={() => { setShowConfigPanel(false); setShowModelPicker(true); }} />
          </div>
        )}

        {/* Session result metadata */}
        {!isStreaming && activeSessionId && sessionResults[activeSessionId] && (() => {
          const r = sessionResults[activeSessionId];
          const parts: string[] = [];
          if (r.costUsd !== undefined) parts.push(`$${r.costUsd.toFixed(4)}`);
          if (r.durationMs !== undefined) parts.push(`${(r.durationMs / 1000).toFixed(1)}s`);
          if (r.numTurns !== undefined) parts.push(`${r.numTurns} 轮`);
          if (parts.length === 0) return null;
          return (
            <div style={styles.resultMeta}>
              <span className="material-symbols-outlined" style={{ fontSize: 13, color: 'var(--md-on-surface-variant)', opacity: 0.6 }}>
                data_usage
              </span>
              <span>{parts.join(' · ')}</span>
            </div>
          );
        })()}

        <div ref={messagesEndRef} />
      </div>

      {/* Scroll to bottom FAB */}
      {showScrollBtn && (
        <button onClick={scrollToBottom} style={styles.scrollToBottomBtn} aria-label="滚动到底部">
          <span className="material-symbols-outlined" style={{ fontSize: 18 }}>keyboard_arrow_down</span>
        </button>
      )}

      {/* Input area */}
      <div style={styles.inputSection}>
        <div ref={slash.anchorRef} style={styles.inputWrapper}>
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
            placeholder={!provider ? '请先启动 Agent...' : '输入消息或 / 查看命令...'}
            rows={2}
            disabled={!provider}
            style={styles.textarea}
          />
          {attachments.length > 0 && (
            <div style={styles.attachmentList}>
              {attachments.map((path, i) => {
                const parts = path.split(/[/\\]/);
                const name = parts.length > 1 ? parts.slice(-2).join('/') : path;
                return (
                  <span key={i} style={styles.attachmentChip} title={path}>
                    <span className="material-symbols-outlined" style={{ fontSize: 13 }}>description</span>
                    <span style={{ maxWidth: 'min(320px, 75vw)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</span>
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
              <button style={styles.attachBtn} title="添加文件" aria-label="添加文件" onClick={handleAttachFile}>
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
                aria-label="发送"
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
    position: 'relative',
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
  userBubbleAnchor: {
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-end',
    alignSelf: 'flex-end',
    width: 'fit-content',
    maxWidth: '85%',
  },
  userBubble: {
    background: 'var(--md-primary-container)',
    color: 'var(--md-on-primary-container)',
    borderRadius: '12px 12px 4px 12px',
    width: 'fit-content',
    maxWidth: '100%',
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
  resultMeta: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    paddingLeft: 38,
    fontSize: 11,
    color: 'var(--md-on-surface-variant)',
    opacity: 0.7,
    fontFamily: 'var(--font-mono)',
  },
  inputSection: {
    padding: '8px 16px 12px',
    borderTop: '1px solid var(--md-outline-variant)',
    flexShrink: 0,
  },
  inputWrapper: {
    position: 'relative',
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
    padding: '8px 12px',
    resize: 'none',
    outline: 'none',
    color: 'var(--md-on-surface)',
    lineHeight: '1.5',
    boxSizing: 'border-box',
    minHeight: 36,
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
    width: 24,
    height: 24,
    borderRadius: '50%',
    border: 'none',
    background: 'transparent',
    color: 'var(--md-outline)',
    cursor: 'pointer',
    padding: 0,
    transition: 'background 0.15s',
  },
  scrollToBottomBtn: {
    position: 'absolute',
    bottom: 80,
    left: '50%',
    transform: 'translateX(-50%)',
    width: 32,
    height: 32,
    borderRadius: '50%',
    border: '1px solid var(--md-outline-variant)',
    background: 'var(--md-surface-container)',
    color: 'var(--md-on-surface)',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: 'var(--shadow-md)',
    zIndex: 10,
    transition: 'opacity 0.15s',
  },
  msgCopyBtn: {
    position: 'absolute',
    top: 4,
    right: -32,
    width: 26,
    height: 26,
    borderRadius: 6,
    border: '1px solid var(--md-outline-variant)',
    background: 'var(--md-surface-container)',
    color: 'var(--md-on-surface-variant)',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'background 0.15s',
    flexShrink: 0,
  },
  userActionRow: {
    position: 'absolute',
    top: '100%',
    right: 0,
    display: 'flex',
    gap: 4,
    marginTop: 2,
  },
  msgActionBtn: {
    width: 26,
    height: 26,
    borderRadius: 6,
    border: '1px solid var(--md-outline-variant)',
    background: 'var(--md-surface-container)',
    color: 'var(--md-on-surface-variant)',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'background 0.15s',
    flexShrink: 0,
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
  duration: {
    fontSize: 10,
    color: 'var(--md-on-surface-variant)',
    fontFamily: 'var(--font-mono)',
    opacity: 0.7,
    flexShrink: 0,
  },
  lineStats: {
    fontSize: 10,
    fontWeight: 600,
    color: 'var(--md-tertiary)',
    fontFamily: 'var(--font-mono)',
    background: 'var(--md-surface-container-lowest)',
    border: '1px solid var(--md-outline-variant)',
    borderRadius: 4,
    padding: '0 4px',
    lineHeight: '16px',
    flexShrink: 0,
  },
  progressBar: {
    height: 2,
    background: 'var(--md-outline-variant)',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    width: '40%',
    background: 'var(--md-primary)',
    borderRadius: 1,
    animation: 'progressSlide 1.5s ease-in-out infinite',
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
  preview: {
    fontSize: 11,
    fontWeight: 400,
    color: 'var(--md-on-surface-variant)',
    fontFamily: 'var(--font-sans)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    flex: 1,
    minWidth: 0,
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
  cursor: {
    display: 'inline-block',
    animation: 'blink 1s step-end infinite',
    fontWeight: 'bold',
    color: 'var(--md-primary)',
    marginLeft: 1,
    fontSize: 12,
  },
};

// ── Diff Styles ─────────────────────────────────────────────────

const diffStyles: Record<string, React.CSSProperties> = {
  container: {
    borderRadius: 6,
    border: '1px solid var(--md-outline-variant)',
    overflow: 'hidden',
    maxHeight: 240,
    overflowY: 'auto',
    background: 'var(--md-surface-container-lowest)',
  },
  filePath: {
    display: 'flex',
    alignItems: 'center',
    gap: 5,
    fontSize: 11,
    fontFamily: 'var(--font-mono)',
    color: 'var(--md-on-surface-variant)',
    padding: '3px 0',
    marginBottom: 4,
  },
  table: {
    fontFamily: 'var(--font-mono)',
    fontSize: 11,
    lineHeight: '1.5',
  },
  row: {
    display: 'flex',
    alignItems: 'stretch',
    minHeight: 18,
  },
  lineNum: {
    display: 'inline-block',
    width: 32,
    textAlign: 'right',
    paddingRight: 6,
    flexShrink: 0,
    fontSize: 10,
    userSelect: 'none',
    lineHeight: '18px',
  },
  lineNumDel: {
    background: 'var(--color-diff-del-bg)',
    color: 'var(--md-error)',
  },
  lineNumAdd: {
    background: 'var(--color-diff-add-bg)',
    color: 'var(--color-tertiary)',
  },
  delMarker: {
    display: 'inline-block',
    width: 14,
    textAlign: 'center',
    flexShrink: 0,
    color: 'var(--color-diff-del-text)',
    background: 'var(--color-diff-del-bg)',
    lineHeight: '18px',
    fontWeight: 600,
  },
  addMarker: {
    display: 'inline-block',
    width: 14,
    textAlign: 'center',
    flexShrink: 0,
    color: 'var(--color-diff-add-text)',
    background: 'var(--color-diff-add-bg)',
    lineHeight: '18px',
    fontWeight: 600,
  },
  delLine: {
    flex: 1,
    background: 'var(--color-diff-del-bg)',
    color: 'var(--color-diff-del-text)',
    paddingLeft: 4,
    whiteSpace: 'pre',
    overflowX: 'auto',
    lineHeight: '18px',
  },
  addLine: {
    flex: 1,
    background: 'var(--color-diff-add-bg)',
    color: 'var(--color-diff-add-text)',
    paddingLeft: 4,
    whiteSpace: 'pre',
    overflowX: 'auto',
    lineHeight: '18px',
  },
};
