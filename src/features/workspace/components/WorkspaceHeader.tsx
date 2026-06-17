interface WorkspaceHeaderProps {
  isRunning: boolean;
  onNewChat: () => void;
  onStart: () => void;
  onStop: () => void;
}

export default function WorkspaceHeader({ isRunning, onNewChat, onStart, onStop }: WorkspaceHeaderProps) {
  return (
    <div style={styles.header}>
      <div style={styles.titleArea}>
        <h1 style={styles.title}>Agent Workspace</h1>
        <p style={styles.subtitle}>
          {isRunning ? (
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={styles.statusDot} />
              Claude Code — Connected
            </span>
          ) : (
            'Claude Code CLI — Click Start to begin'
          )}
        </p>
      </div>

      <div style={styles.actions}>
        {isRunning ? (
          <>
            <button onClick={onNewChat} style={styles.newChatBtn} title="New Chat">
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>add</span>
              New Chat
            </button>
            <button onClick={onStop} style={styles.stopBtn} title="Stop Agent">
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>stop</span>
            </button>
          </>
        ) : (
          <button onClick={onStart} style={styles.startBtn} title="Start Claude Code">
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>play_arrow</span>
            Start
          </button>
        )}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '12px 16px 8px',
    flexShrink: 0,
  },
  titleArea: {
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
  },
  title: {
    margin: 0,
    fontSize: 22,
    fontWeight: 600,
    fontFamily: 'var(--font-sans)',
    color: 'var(--md-on-surface)',
    lineHeight: '28px',
  },
  subtitle: {
    margin: 0,
    fontSize: 13,
    color: 'var(--md-on-surface-variant)',
    fontFamily: 'var(--font-sans)',
  },
  statusDot: {
    display: 'inline-block',
    width: 6,
    height: 6,
    borderRadius: '50%',
    background: '#16bb83',
  },
  actions: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  startBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    padding: '6px 14px',
    fontSize: 13,
    fontWeight: 500,
    fontFamily: 'var(--font-sans)',
    borderRadius: 8,
    border: 'none',
    background: 'var(--md-primary)',
    color: 'var(--md-on-primary)',
    cursor: 'pointer',
    transition: 'opacity 0.15s',
  },
  newChatBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    padding: '6px 14px',
    fontSize: 13,
    fontWeight: 500,
    fontFamily: 'var(--font-sans)',
    borderRadius: 8,
    border: '1px solid var(--md-primary)',
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
    border: '1px solid var(--md-outline-variant)',
    background: 'transparent',
    color: 'var(--md-error)',
    cursor: 'pointer',
  },
};
