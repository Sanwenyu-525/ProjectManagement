import { useState, useEffect, useMemo } from 'react';
import { useAgentStore } from '../../../stores/agentStore';
import { getToolIcon, getToolSummary } from '../../../lib/toolUtils';
import type { MessageBlock } from './AgentProvider';

const EMPTY_BLOCKS: MessageBlock[] = [];
const EMPTY_DERIVED = { activeTool: null as string | null, activeToolTarget: '', activeToolIcon: '', uniqueFiles: 0, toolCount: 0 };

interface AgentActivityBarProps {
  sessionId: string;
  isStreaming: boolean;
}

/** Extract a human-readable target from a tool block (file path, command, pattern) */
function getToolTarget(block: Extract<MessageBlock, { type: 'tool_use' }>): string {
  return getToolSummary(block.toolName, block.input, 50);
}

/** Format elapsed seconds */
function formatElapsed(ms: number): string {
  const secs = Math.floor(ms / 1000);
  if (secs < 60) return `${secs}s`;
  const mins = Math.floor(secs / 60);
  const remainSecs = secs % 60;
  return `${mins}m${remainSecs}s`;
}

export default function AgentActivityBar({ sessionId, isStreaming }: AgentActivityBarProps) {
  const streamingBlocks = useAgentStore(s => s.streamingBlocks[sessionId] ?? EMPTY_BLOCKS);
  const streamingStartTime = useAgentStore(s => s.streamingStartTime[sessionId]);
  const sessionResults = useAgentStore(s => s.sessionResults[sessionId]);

  const [now, setNow] = useState(Date.now());

  // Tick every second for elapsed time
  useEffect(() => {
    if (!isStreaming) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [isStreaming]);

  // Compute derived data (skip expensive work when not streaming)
  const { activeTool, activeToolTarget, activeToolIcon, uniqueFiles, toolCount } = useMemo(() => {
    if (!isStreaming) return EMPTY_DERIVED;
    const toolBlocks = streamingBlocks.filter((b): b is Extract<MessageBlock, { type: 'tool_use' }> => b.type === 'tool_use');
    const pending = toolBlocks.find(b => b.output === undefined);
    const files = new Set<string>();
    for (const b of toolBlocks) {
      if (typeof b.input.file_path === 'string') files.add(b.input.file_path);
    }
    return {
      activeTool: pending?.toolName ?? null,
      activeToolTarget: pending ? getToolTarget(pending) : '',
      activeToolIcon: pending ? getToolIcon(pending.toolName) : '',
      uniqueFiles: files.size,
      toolCount: toolBlocks.length,
    };
  }, [streamingBlocks, isStreaming]);

  if (!isStreaming) return null;

  const elapsed = streamingStartTime ? now - streamingStartTime : 0;
  const cost = sessionResults?.costUsd;

  return (
    <div style={styles.bar}>
      {activeTool ? (
        <>
          <span className="material-symbols-outlined" style={styles.toolIcon}>
            {activeToolIcon}
          </span>
          <span style={styles.toolName}>{activeTool}</span>
          {activeToolTarget && <span style={styles.target}>{activeToolTarget}</span>}
        </>
      ) : (
        <>
          <span className="material-symbols-outlined" style={{ ...styles.toolIcon, animation: 'spin 1s linear infinite' }}>
            progress_activity
          </span>
          <span style={styles.thinkingLabel}>思考中</span>
        </>
      )}

      <div style={styles.divider} />

      {cost !== undefined && (
        <span style={styles.stat}>
          <span className="material-symbols-outlined" style={styles.statIcon}>paid</span>
          ${cost.toFixed(4)}
        </span>
      )}
      {uniqueFiles > 0 && (
        <span style={styles.stat}>
          <span className="material-symbols-outlined" style={styles.statIcon}>folder_open</span>
          {uniqueFiles} 文件
        </span>
      )}
      {toolCount > 0 && (
        <span style={styles.stat}>
          <span className="material-symbols-outlined" style={styles.statIcon}>build</span>
          {toolCount} 调用
        </span>
      )}
      {elapsed > 0 && (
        <span style={styles.stat}>
          <span className="material-symbols-outlined" style={styles.statIcon}>timer</span>
          {formatElapsed(elapsed)}
        </span>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  bar: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '5px 12px',
    background: 'var(--md-surface-container)',
    borderBottom: '1px solid var(--md-outline-variant)',
    fontSize: 11,
    fontFamily: 'var(--font-mono)',
    color: 'var(--md-on-surface-variant)',
    flexShrink: 0,
    minHeight: 28,
    overflow: 'hidden',
  },
  toolIcon: {
    fontSize: 13,
    color: 'var(--md-primary)',
    flexShrink: 0,
  },
  toolName: {
    fontWeight: 600,
    color: 'var(--md-on-surface)',
    fontSize: 11,
    flexShrink: 0,
  },
  target: {
    color: 'var(--md-on-surface-variant)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    minWidth: 0,
    fontSize: 11,
  },
  thinkingLabel: {
    fontStyle: 'italic',
    fontSize: 11,
    color: 'var(--md-on-surface-variant)',
  },
  divider: {
    width: 1,
    height: 12,
    background: 'var(--md-outline-variant)',
    flexShrink: 0,
    margin: '0 2px',
  },
  stat: {
    display: 'flex',
    alignItems: 'center',
    gap: 3,
    fontSize: 10,
    color: 'var(--md-on-surface-variant)',
    flexShrink: 0,
    whiteSpace: 'nowrap',
  },
  statIcon: {
    fontSize: 12,
    opacity: 0.7,
  },
};
