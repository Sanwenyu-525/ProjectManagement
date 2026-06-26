import { useRef, useCallback, useEffect } from 'react';
import type { Terminal } from '@xterm/xterm';
import type { ConversationTurn } from '../../../stores/agentCommandHistoryStore';
import { useAgentCommandHistoryStore } from '../../../stores/agentCommandHistoryStore';

const EMPTY_TURNS: ConversationTurn[] = [];

interface AgentCommandHistoryPanelProps {
  tabId: string;
  termRef: React.RefObject<Terminal | null>;
}

function truncate(text: string, max: number): string {
  const oneLine = text.replace(/\n/g, ' ').trim();
  return oneLine.length > max ? oneLine.slice(0, max) + '…' : oneLine;
}

export default function AgentCommandHistoryPanel({ tabId, termRef }: AgentCommandHistoryPanelProps) {
  const turns = useAgentCommandHistoryStore(s => s.histories[tabId] ?? EMPTY_TURNS);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new turns arrive
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [turns.length]);

  const handleJump = useCallback((lineNumber: number) => {
    termRef.current?.scrollToLine(lineNumber);
  }, [termRef]);

  if (turns.length === 0) return null;

  return (
    <div style={styles.panel}>
      <div style={styles.header}>
        <span className="material-symbols-outlined" style={{ fontSize: 13, color: 'var(--md-primary)' }}>
          chat_bubble_outline
        </span>
        <span style={styles.title}>对话</span>
        <span style={styles.count}>{turns.length}</span>
      </div>

      <div style={styles.list} ref={scrollRef}>
        {turns.map((turn, idx) => (
          <div key={turn.id} style={styles.turn}>
            {/* Turn number + user message */}
            <button
              style={styles.turnBtn}
              onClick={() => handleJump(turn.userLineNumber)}
              title={turn.userText}
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--md-surface-container)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
            >
              <span style={styles.turnNum}>{idx + 1}</span>
              <span style={styles.turnText}>{truncate(turn.userText, 18)}</span>
            </button>

            {/* Connector line */}
            {idx < turns.length - 1 && <div style={styles.connector} />}
          </div>
        ))}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  panel: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    width: 140,
    zIndex: 15,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    fontFamily: 'var(--font-sans)',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    padding: '6px 8px',
    flexShrink: 0,
    background: 'linear-gradient(to right, transparent 0%, var(--md-surface-container-lowest) 30%)',
  },
  title: {
    fontSize: 11,
    fontWeight: 600,
    color: 'var(--md-on-surface)',
  },
  count: {
    fontSize: 9,
    color: 'var(--md-outline)',
    background: 'var(--md-surface-container)',
    padding: '0 4px',
    borderRadius: 6,
  },
  list: {
    flex: 1,
    overflowY: 'auto',
    overflowX: 'hidden',
    padding: '4px 0',
    background: 'linear-gradient(to right, transparent, rgba(128,128,128,0.08) 50%, rgba(128,128,128,0.15))',
  },
  turn: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'stretch',
    position: 'relative',
  },
  turnBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    padding: '3px 8px',
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    textAlign: 'left',
    width: '100%',
    fontFamily: 'var(--font-sans)',
    transition: 'background 0.12s',
  },
  turnNum: {
    fontSize: 10,
    fontWeight: 700,
    color: 'var(--md-primary)',
    width: 16,
    textAlign: 'center',
    flexShrink: 0,
    fontFamily: "'Cascadia Code', 'Fira Code', monospace",
  },
  turnText: {
    fontSize: 11,
    color: 'var(--md-on-surface)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    flex: 1,
    minWidth: 0,
  },
  connector: {
    width: 1,
    height: 4,
    background: 'var(--border)',
    marginLeft: 15,
    flexShrink: 0,
  },
};
