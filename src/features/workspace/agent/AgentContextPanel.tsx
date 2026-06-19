import { useAgentStore } from '../../../stores/agentStore';

interface AgentContextPanelProps {
  sessionId: string | null;
}

export default function AgentContextPanel({ sessionId }: AgentContextPanelProps) {
  const messages = useAgentStore(s => sessionId ? (s.messages[sessionId] ?? []) : []);

  // Derive tool calls from message blocks (toolEvents store is deprecated)
  const toolCalls = useAgentStore(s => {
    if (!sessionId) return [];
    const msgs = s.messages[sessionId] ?? [];
    const calls: Array<{ id: string; toolName: string; description: string; timestamp: number }> = [];
    for (const msg of msgs) {
      for (const block of msg.blocks) {
        if (block.type === 'tool_use') {
          const inputStr = block.input ? JSON.stringify(block.input) : '';
          calls.push({
            id: block.id,
            toolName: block.toolName,
            description: inputStr.length > 100 ? inputStr.slice(0, 100) + '...' : inputStr,
            timestamp: msg.timestamp,
          });
        }
      }
    }
    return calls;
  });

  if (!sessionId) {
    return (
      <div style={styles.empty}>
        <span className="material-symbols-outlined" style={{ fontSize: 28, color: 'var(--md-outline-variant)' }}>
          psychology
        </span>
        <p style={styles.emptyText}>启动会话后查看上下文信息。</p>
      </div>
    );
  }

  const recentMessages = messages.slice(-10);

  return (
    <div style={styles.container}>
      {/* Session info */}
      <div style={styles.section}>
        <div style={styles.sectionTitle}>会话</div>
        <div style={styles.infoRow}>
          <span style={styles.label}>会话 ID</span>
          <span style={styles.mono}>{sessionId.slice(0, 12)}...</span>
        </div>
        <div style={styles.infoRow}>
          <span style={styles.label}>消息数</span>
          <span style={styles.value}>{messages.length}</span>
        </div>
        <div style={styles.infoRow}>
          <span style={styles.label}>工具调用</span>
          <span style={styles.value}>{toolCalls.length}</span>
        </div>
      </div>

      {/* Tool calls */}
      {toolCalls.length > 0 && (
        <div style={styles.section}>
          <div style={styles.sectionTitle}>最近的工具调用</div>
          <div style={styles.eventList}>
            {toolCalls.slice(-15).reverse().map((evt, i) => (
              <div key={evt.id ?? i} style={styles.eventItem}>
                <span className="material-symbols-outlined" style={{ fontSize: 13, color: 'var(--md-primary)', flexShrink: 0 }}>
                  build
                </span>
                <div style={styles.eventContent}>
                  <span style={styles.toolName}>{evt.toolName}</span>
                  {evt.description && (
                    <span style={styles.toolDesc} title={evt.description}>
                      {evt.description.length > 80 ? evt.description.slice(0, 80) + '...' : evt.description}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent messages */}
      {recentMessages.length > 0 && (
        <div style={styles.section}>
          <div style={styles.sectionTitle}>最近消息</div>
          <div style={styles.eventList}>
            {recentMessages.map((msg, i) => (
              <div key={i} style={styles.msgItem}>
                <span style={{
                  ...styles.roleTag,
                  background: msg.role === 'user' ? 'var(--md-primary-container)' : 'var(--md-secondary-container)',
                  color: msg.role === 'user' ? 'var(--md-on-primary-container)' : 'var(--md-on-secondary-container)',
                }}>
                  {msg.role}
                </span>
                <span style={styles.msgPreview} title={msg.blocks.map(b => b.type === 'text' || b.type === 'thinking' ? b.text : '').join('')}>
                  {(() => {
                    const preview = msg.blocks.map(b => b.type === 'text' || b.type === 'thinking' ? b.text : '').join('');
                    return preview.length > 80 ? preview.slice(0, 80) + '...' : preview || '(工具调用)';
                  })()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {messages.length === 0 && toolCalls.length === 0 && (
        <div style={styles.empty}>
          <p style={styles.emptyText}>暂无活动。</p>
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    flex: 1,
    overflowY: 'auto',
    padding: 0,
  },
  section: {
    padding: '10px 12px',
    borderBottom: '1px solid var(--md-outline-variant)',
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: 600,
    color: 'var(--md-on-surface-variant)',
    fontFamily: 'var(--font-label)',
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
    marginBottom: 8,
    opacity: 0.7,
  },
  infoRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '3px 0',
  },
  label: {
    fontSize: 12,
    color: 'var(--md-on-surface-variant)',
  },
  value: {
    fontSize: 12,
    color: 'var(--md-on-surface)',
    fontWeight: 500,
  },
  mono: {
    fontSize: 11,
    color: 'var(--md-on-surface)',
    fontFamily: 'var(--font-mono)',
  },
  eventList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  eventItem: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 6,
    padding: '4px 0',
  },
  eventContent: {
    display: 'flex',
    flexDirection: 'column',
    gap: 1,
    minWidth: 0,
    flex: 1,
  },
  toolName: {
    fontSize: 12,
    fontWeight: 500,
    color: 'var(--md-on-surface)',
    fontFamily: 'var(--font-mono)',
  },
  toolDesc: {
    fontSize: 11,
    color: 'var(--md-on-surface-variant)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  msgItem: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 6,
    padding: '3px 0',
  },
  roleTag: {
    fontSize: 9,
    fontWeight: 600,
    padding: '1px 5px',
    borderRadius: 3,
    flexShrink: 0,
    fontFamily: 'var(--font-label)',
    letterSpacing: '0.02em',
    marginTop: 1,
  },
  msgPreview: {
    fontSize: 11,
    color: 'var(--md-on-surface-variant)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    flex: 1,
  },
  empty: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  emptyText: {
    margin: '8px 0 0',
    fontSize: 12,
    color: 'var(--md-on-surface-variant)',
  },
};
