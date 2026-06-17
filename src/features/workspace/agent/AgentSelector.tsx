import type { AgentSession } from '../../../types';
import StatusDot from '../components/StatusDot';

export interface AgentWithSession {
  id: string;
  name: string;
  icon: string;
  session: AgentSession | null;
}

interface AgentSelectorProps {
  agents: AgentWithSession[];
  activeAgentId: string | null;
  onSelect: (agent: AgentWithSession) => void;
}

export default function AgentSelector({ agents, activeAgentId, onSelect }: AgentSelectorProps) {
  if (agents.length === 0) {
    return (
      <div style={styles.empty}>
        No agents configured.{' '}
        <a
          href="#"
          onClick={(e) => { e.preventDefault(); window.location.hash = '#/settings'; }}
          style={styles.link}
        >
          Go to Settings
        </a>
      </div>
    );
  }

  return (
    <div style={styles.row}>
      {agents.map((agent) => {
        const status: 'running' | 'ended' | 'none' = agent.session?.status === 'running'
          ? 'running'
          : agent.session ? 'ended' : 'none';
        const isActive = activeAgentId === agent.id;

        return (
          <button
            key={agent.id}
            style={{
              ...styles.chip,
              borderColor: isActive ? 'var(--md-primary)' : 'transparent',
              background: isActive ? 'var(--md-primary-container)' : 'var(--md-surface-container-low)',
            }}
            onClick={() => onSelect(agent)}
            title={agent.name}
          >
            <span
              className="material-symbols-outlined"
              style={{
                fontSize: 14,
                color: isActive ? 'var(--md-on-primary-container)' : 'var(--md-on-surface-variant)',
              }}
            >
              {agent.icon || 'smart_toy'}
            </span>
            <span style={{
              ...styles.chipLabel,
              color: isActive ? 'var(--md-on-primary-container)' : 'var(--md-on-surface)',
            }}>
              {agent.name}
            </span>
            <StatusDot status={status} />
          </button>
        );
      })}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  row: {
    display: 'flex',
    gap: 6,
    padding: '8px 12px',
    overflowX: 'auto',
    flexShrink: 0,
    borderBottom: '1px solid var(--md-outline-variant)',
  },
  chip: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '4px 10px',
    borderRadius: 16,
    border: '1px solid transparent',
    cursor: 'pointer',
    flexShrink: 0,
    transition: 'border-color 0.15s, background 0.15s',
    fontFamily: 'var(--font-sans)',
    fontSize: 12,
  },
  chipLabel: {
    fontWeight: 500,
    letterSpacing: '0.02em',
    lineHeight: '16px',
    whiteSpace: 'nowrap',
  },
  empty: {
    padding: '10px 12px',
    fontSize: 12,
    color: 'var(--md-on-surface-variant)',
    textAlign: 'center',
    borderBottom: '1px solid var(--md-outline-variant)',
  },
  link: {
    color: 'var(--md-primary)',
    textDecoration: 'none',
    fontWeight: 500,
  },
};
