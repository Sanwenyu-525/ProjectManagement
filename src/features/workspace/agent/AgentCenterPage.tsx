import { useState, useEffect, useMemo } from 'react';
import { Empty } from 'antd';
import { useThemeStore } from '../../../stores/themeStore';
import { sessionsApi } from '../../../api';
import { stripAnsi } from '../../../lib/stripAnsi';
import { useSessions, useEndSession } from '../../../hooks/useSessions';
import { useTemplates } from '../../../hooks/useBuilds';
import type { AgentSession, AgentMessage, Template } from '../../../types';

/* ---------- Runtime display metadata ---------- */

const RUNTIME_META: Record<string, { name: string; icon: string; color: string }> = {
  claude: { name: 'Claude', icon: 'architecture', color: '#d97706' },
  gemini: { name: 'Gemini', icon: 'fact_check', color: '#4285f4' },
  codex: { name: 'Codex', icon: 'code', color: '#10a37f' },
};

/* ---------- Derived agent view model ---------- */

interface AgentVM {
  id: string;
  name: string;
  icon: string;
  runtimeId: string;
  status: 'active' | 'idle';
  task: string;
  messageCount: number;
  lastUpdate: string;
}

/* ---------- ANSI / control-char stripping ---------- */

// stripAnsi imported from src/lib/stripAnsi.ts

function sessionToVM(session: AgentSession, messages: AgentMessage[]): AgentVM {
  const meta = RUNTIME_META[session.runtimeId] ?? { name: session.runtimeId, icon: 'smart_toy', color: '#6b7280' };
  const outputMsgs = messages.filter(m => m.role === 'assistant' || m.role === 'output');
  const lastMsg = outputMsgs[outputMsgs.length - 1];
  const cleanContent = lastMsg ? stripAnsi(lastMsg.content).trim() : '';
  const task = cleanContent
    ? cleanContent.split('\n').find(l => l.trim())?.slice(0, 80) || '等待输入...'
    : '等待输入...';

  return {
    id: session.id,
    name: meta.name,
    icon: meta.icon,
    runtimeId: session.runtimeId,
    status: session.status === 'running' ? 'active' : 'idle',
    task,
    messageCount: messages.length,
    lastUpdate: lastMsg ? formatRelativeTime(lastMsg.timestamp) : formatRelativeTime(session.startedAt),
  };
}

function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 0) return '刚刚';
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}秒前`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}分钟前`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}小时前`;
  const d = Math.floor(h / 24);
  return `${d}天前`;
}

function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString('zh-CN', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

/* ---------- Status badge config ---------- */

const STATUS_CONFIG = {
  active: { color: 'var(--md-secondary)', bg: 'rgba(107, 56, 212, 0.08)', border: 'rgba(107, 56, 212, 0.2)', label: '运行中' },
  idle: { color: 'var(--md-on-surface-variant)', bg: 'var(--md-surface)', border: 'var(--md-outline-variant)', label: '已结束' },
};

/* ---------- Templates (fetched from API) ---------- */

interface AgentTemplateVM {
  name: string;
  category: string;
  desc: string;
  icon: string;
  iconBg: string;
  iconColor: string;
}

const DEFAULT_AGENT_TEMPLATES: AgentTemplateVM[] = [
  { name: 'React 脚手架', category: '智能体模板', desc: '生成完整的 React 组件结构及 Storybook 测试。', icon: 'code_blocks', iconBg: 'rgba(0, 107, 95, 0.12)', iconColor: 'var(--md-primary)' },
  { name: 'SQL 优化器', category: '市场', desc: '分析 Prisma Schema 并输出原始优化 SQL 查询。', icon: 'database', iconBg: 'rgba(107, 56, 212, 0.12)', iconColor: 'var(--md-secondary)' },
];

function templateToVM(t: Template): AgentTemplateVM {
  let extra: Record<string, string> = {};
  try { extra = JSON.parse(t.data); } catch { /* ok */ }
  return {
    name: t.name,
    category: t.category === 'agent' ? '智能体模板' : t.category,
    desc: t.description || '',
    icon: t.icon || 'smart_toy',
    iconBg: extra.iconBg || 'rgba(0, 107, 95, 0.12)',
    iconColor: extra.iconColor || 'var(--md-primary)',
  };
}

/* ---------- Log entry for stream ---------- */

interface LogEntry {
  time: string;
  agent: string;
  color: string;
  message: string;
}

/* ---------- Theme-agnostic style constants ---------- */

const labelStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 500,
  color: 'var(--md-on-surface-variant)',
  letterSpacing: '0.02em',
  lineHeight: '16px',
  fontFamily: 'var(--font-label)',
};

const monoStyle: React.CSSProperties = {
  fontFamily: 'var(--font-mono)',
  fontSize: 12,
  lineHeight: '16px',
};

/* ---------- Component ---------- */

export default function AgentCenterPage() {
  const isDark = useThemeStore(s => s.mode === 'dark');
  const [messagesMap, setMessagesMap] = useState<Record<string, AgentMessage[]>>({});

  // ── Queries (React Query with 5s polling ──
  const { data: sessions = [], isLoading: loading } = useSessions(20);
  const { data: templatesData } = useTemplates('agent');
  const endSession = useEndSession();

  const templates = useMemo(() => {
    if (templatesData && templatesData.length > 0) return templatesData.map(templateToVM);
    return DEFAULT_AGENT_TEMPLATES;
  }, [templatesData]);

  // Fetch messages for visible sessions (top 6 running + 3 ended)
  useEffect(() => {
    if (sessions.length === 0) return;
    const toFetch = sessions.filter(s => s.status === 'running').slice(0, 6);
    const endedToFetch = sessions.filter(s => s.status !== 'running').slice(0, 3);
    const fetchIds = [...toFetch, ...endedToFetch].map(s => s.id);

    // Clean up stale sessions once on mount
    sessionsApi.cleanupStale(30, 10).catch(() => {});

    let cancelled = false;
    Promise.all(
      fetchIds.map(async id => {
        const msgs = await sessionsApi.messages(id);
        return [id, msgs] as const;
      })
    ).then(entries => {
      if (cancelled) return;
      setMessagesMap(prev => {
        const next = { ...prev };
        for (const [id, msgs] of entries) next[id] = msgs;
        return next;
      });
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [sessions]);

  // Build view models (active first, then ended)
  const agentVMs = useMemo(
    () => sessions.map(s => sessionToVM(s, messagesMap[s.id] ?? [])),
    [sessions, messagesMap],
  );
  const activeVMs = useMemo(() => agentVMs.filter(a => a.status === 'active'), [agentVMs]);
  const endedVMs = useMemo(() => agentVMs.filter(a => a.status !== 'active'), [agentVMs]);

  const handleEndSession = (sessionId: string) => {
    endSession.mutate(sessionId);
  };

  // Build log entries from all fetched messages
  const logEntries = useMemo<LogEntry[]>(() =>
    Object.entries(messagesMap)
      .flatMap(([sessionId, msgs]) => {
        const session = sessions.find(s => s.id === sessionId);
        if (!session) return [];
        const meta = RUNTIME_META[session.runtimeId] ?? { name: session.runtimeId, color: '#6b7280' };
        return msgs
          .filter(m => m.role === 'assistant' || m.role === 'output')
          .slice(-50)
          .map(m => ({
            time: formatTimestamp(m.timestamp),
            agent: meta.name,
            color: meta.color,
            message: stripAnsi(m.content).trim().split('\n').find(l => l.trim())?.slice(0, 120) || '',
          }));
      })
      .sort((a, b) => a.time.localeCompare(b.time)),
    [messagesMap, sessions],
  );

  // Telemetry from real data
  const totalSessions = sessions.length;
  const activeCount = sessions.filter(s => s.status === 'running').length;
  const totalMessages = Object.values(messagesMap).reduce((sum, msgs) => sum + msgs.length, 0);

  // Message distribution for bar chart (per-session message counts, max 7 bars)
  const msgCounts = activeVMs.slice(0, 7).map(a => a.messageCount);
  const maxCount = Math.max(...msgCounts, 1);

  const borderColor = isDark ? 'var(--md-outline-variant)' : '#E2E8F0';
  const cardBg = isDark ? 'var(--md-surface-container-lowest)' : 'rgba(255,255,255,0.7)';
  const glassBg = isDark ? 'rgba(33, 49, 69, 0.6)' : 'rgba(255,255,255,0.6)';

  const cardStyle: React.CSSProperties = {
    background: glassBg,
    backdropFilter: 'blur(24px)',
    WebkitBackdropFilter: 'blur(24px)',
    borderRadius: 12,
    border: `1px solid ${borderColor}`,
    boxShadow: '0 4px 12px rgba(0,0,0,0.03)',
    overflow: 'hidden',
    transition: 'border-color 0.2s ease',
  };

  const sectionTitleStyle: React.CSSProperties = {
    fontSize: 18,
    fontWeight: 600,
    color: 'var(--md-on-surface)',
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    margin: 0,
    letterSpacing: '-0.01em',
    lineHeight: '24px',
  };

  return (
    <div style={{ padding: 'var(--layout-container-padding)', maxWidth: 1600, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 24, overflowY: 'auto', minHeight: 0 }}>
      {/* Page Header */}
      <div style={{ marginBottom: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--md-secondary)' }}>
          <span className="material-symbols-outlined" style={{ fontSize: 28 }}>hub</span>
          <h1 style={{ fontSize: 32, fontWeight: 600, color: 'var(--md-on-surface)', lineHeight: '40px', letterSpacing: '-0.02em', margin: 0 }}>
            AI 智能体中心
          </h1>
        </div>
        <p style={{ fontSize: 14, color: 'var(--md-on-surface-variant)', marginTop: 4, marginBottom: 0, lineHeight: '20px' }}>
          管理、监控和部署自主工作流
        </p>
      </div>

      {/* Bento Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: 16 }}>
        {/* Running Agents (8 cols) */}
        <div style={{ gridColumn: 'span 8', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h2 style={{ ...sectionTitleStyle, margin: 0 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--md-tertiary-container)', display: 'inline-block', animation: 'pulse 2s infinite' }} />
              运行中的智能体
              <span style={{ fontSize: 13, color: 'var(--md-on-surface-variant)', fontWeight: 400 }}>
                ({activeVMs.length})
              </span>
            </h2>
          </div>

          {loading ? (
            <div style={{ ...cardStyle, padding: 40, display: 'flex', justifyContent: 'center' }}>
              <span className="material-symbols-outlined" style={{ fontSize: 24, color: 'var(--md-on-surface-variant)', animation: 'pulse 1.5s infinite' }}>hourglass_top</span>
            </div>
          ) : activeVMs.length === 0 ? (
            <div style={{ ...cardStyle, padding: 40 }}>
              <Empty description="暂无运行中的智能体" image={Empty.PRESENTED_IMAGE_SIMPLE} />
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              {activeVMs.map(agent => {
                const st = STATUS_CONFIG[agent.status];
                const isActive = agent.status === 'active';
                return (
                  <div
                    key={agent.id}
                    style={{ ...cardStyle, position: 'relative', display: 'flex', flexDirection: 'column', gap: 16, padding: 20 }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(107, 56, 212, 0.3)'; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = borderColor; }}
                  >
                    {/* Accent bar */}
                    <div style={{ position: 'absolute', top: 0, left: 0, width: 3, height: '100%', background: isActive ? st.color : `${st.color}60`, borderRadius: '12px 0 0 12px' }} />

                    {/* Header */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{
                          width: 40, height: 40, borderRadius: 8,
                          background: isDark ? 'var(--md-surface-container-high)' : 'var(--md-surface-container-high)',
                          border: `1px solid ${borderColor}`,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                          <span className="material-symbols-outlined" style={{ fontSize: 20, color: 'var(--md-on-surface)' }}>{agent.icon}</span>
                        </div>
                        <div>
                          <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--md-on-surface)', margin: 0, lineHeight: '20px' }}>
                            {agent.name}
                          </h3>
                          <span style={{
                            display: 'inline-block', marginTop: 4,
                            padding: '2px 8px', borderRadius: 4,
                            background: st.bg, color: st.color,
                            border: `1px solid ${st.border}`,
                            fontSize: 12, fontWeight: 500,
                            fontFamily: 'var(--font-label)',
                            letterSpacing: '0.02em', lineHeight: '16px',
                            textTransform: 'uppercase',
                          }}>
                            {st.label}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Current Task */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <span style={{ ...labelStyle, textTransform: 'uppercase' }}>当前任务</span>
                      <p style={{ fontSize: 14, color: isActive ? 'var(--md-on-surface)' : 'var(--md-on-surface-variant)', margin: 0, lineHeight: '20px', fontStyle: !isActive ? 'italic' : 'normal', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {agent.task}
                      </p>
                    </div>

                    {/* Progress — active agents get a pulsing bar */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, opacity: isActive ? 1 : 0.5, marginTop: 'auto' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ ...monoStyle, color: 'var(--md-on-surface-variant)' }}>消息数</span>
                        <span style={{ ...monoStyle, color: 'var(--md-secondary)', fontWeight: 500 }}>{agent.messageCount}</span>
                      </div>
                      <div style={{ width: '100%', height: 6, background: 'var(--md-surface-container-high)', borderRadius: 3, overflow: 'hidden' }}>
                        <div style={{
                          height: '100%', borderRadius: 3,
                          background: 'var(--md-secondary)',
                          width: isActive ? '100%' : `${Math.min(100, agent.messageCount * 5)}%`,
                          transition: 'width 0.5s ease',
                          position: 'relative',
                          ...(isActive ? { overflow: 'hidden', animation: 'indeterminate 2s linear infinite' } : {}),
                        }}>
                          {isActive && (
                            <div style={{
                              position: 'absolute', inset: 0,
                              background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.25), transparent)',
                              animation: 'shimmer 2s infinite',
                            }} />
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Footer */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 12, borderTop: `1px solid ${borderColor}60` }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span className="material-symbols-outlined" style={{ fontSize: 14, color: 'var(--md-on-surface-variant)' }}>chat_bubble</span>
                        <span style={{ ...monoStyle, color: 'var(--md-on-surface-variant)' }}>{agent.messageCount} 条消息</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        {isActive && (
                          <button
                            onClick={() => handleEndSession(agent.id)}
                            style={{
                              fontSize: 12, fontWeight: 500, padding: '4px 10px',
                              borderRadius: 6, border: '1px solid var(--md-outline-variant)',
                              background: 'transparent', color: 'var(--md-on-surface-variant)',
                              cursor: 'pointer', transition: 'all 0.15s',
                            }}
                            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--md-error)'; e.currentTarget.style.color = 'var(--md-error)'; }}
                            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--md-outline-variant)'; e.currentTarget.style.color = 'var(--md-on-surface-variant)'; }}
                          >
                            结束
                          </button>
                        )}
                        <span style={{ fontSize: 13, color: 'var(--md-on-surface-variant)' }}>{agent.lastUpdate}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* History (ended sessions) */}
        {endedVMs.length > 0 && (
          <div style={{ gridColumn: '1 / -1', display: 'flex', flexDirection: 'column', gap: 12, marginTop: 8 }}>
            <h2 style={{ ...sectionTitleStyle, fontSize: 15, color: 'var(--md-on-surface-variant)' }}>
              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>history</span>
              历史会话
              <span style={{ fontSize: 13, fontWeight: 400 }}>({endedVMs.length})</span>
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
              {endedVMs.slice(0, 8).map(agent => (
                <div
                  key={agent.id}
                  style={{
                    ...cardStyle, padding: 14, display: 'flex', flexDirection: 'column', gap: 10,
                    opacity: 0.8,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{
                      width: 28, height: 28, borderRadius: 6,
                      background: 'var(--md-surface-container-high)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <span className="material-symbols-outlined" style={{ fontSize: 16, color: 'var(--md-on-surface-variant)' }}>{agent.icon}</span>
                    </div>
                    <div>
                      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--md-on-surface)', lineHeight: '18px' }}>{agent.name}</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                        <span style={{ fontSize: 11, color: 'var(--md-on-surface-variant)' }}>{agent.messageCount} 条</span>
                        <span style={{ fontSize: 11, color: 'var(--md-outline-variant)' }}>·</span>
                        <span style={{ fontSize: 11, color: 'var(--md-on-surface-variant)' }}>{agent.lastUpdate}</span>
                      </div>
                    </div>
                  </div>
                  <p style={{ fontSize: 12, color: 'var(--md-on-surface-variant)', margin: 0, lineHeight: '16px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {agent.task}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Right Side Panel (4 cols) */}
        <div style={{ gridColumn: 'span 4', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* System Telemetry */}
          <div style={{ ...cardStyle, padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h2 style={{ ...sectionTitleStyle }}>
                <span className="material-symbols-outlined" style={{ fontSize: 20 }}>monitoring</span>
                系统遥测
              </h2>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {[
                { label: '总会话数', value: String(totalSessions) },
                { label: '活跃智能体', value: String(activeCount) },
                { label: '总消息数', value: String(totalMessages) },
                { label: '已结束会话', value: String(totalSessions - activeCount) },
              ].map(stat => (
                <div key={stat.label} style={{
                  background: 'var(--md-surface-container-low)',
                  borderRadius: 8,
                  border: `1px solid ${borderColor}66`,
                  padding: 12,
                  display: 'flex', flexDirection: 'column', gap: 4,
                }}>
                  <span style={{ ...labelStyle }}>{stat.label}</span>
                  <span style={{ fontSize: 18, fontWeight: 600, color: 'var(--md-on-surface)', lineHeight: '24px', letterSpacing: '-0.01em' }}>{stat.value}</span>
                </div>
              ))}
            </div>

            {/* Mini bar chart — message distribution per session */}
            {msgCounts.length > 0 && (
              <div style={{
                width: '100%', height: 96,
                background: 'var(--md-surface-container-lowest)',
                border: `1px solid ${borderColor}66`,
                borderRadius: 8,
                position: 'relative', overflow: 'hidden',
                display: 'flex', alignItems: 'flex-end',
                padding: '0 8px 8px', gap: 3,
              }}>
                {msgCounts.map((count, i) => (
                  <div key={i} style={{
                    flex: 1,
                    height: `${Math.max(8, (count / maxCount) * 100)}%`,
                    borderRadius: 2,
                    background: 'var(--md-secondary)',
                    opacity: 0.3 + (i / Math.max(msgCounts.length - 1, 1)) * 0.7,
                    transition: 'height 0.3s ease',
                  }} />
                ))}
                <span style={{ position: 'absolute', top: 8, left: 8, ...monoStyle, fontSize: 10, color: 'var(--md-on-surface-variant)' }}>消息分布</span>
              </div>
            )}
          </div>

          {/* Stream Logs */}
          <div style={{ ...cardStyle, display: 'flex', flexDirection: 'column', flex: 1, minHeight: 300, overflow: 'hidden' }}>
            {/* Log header */}
            <div style={{
              padding: '12px 16px',
              borderBottom: `1px solid ${borderColor}60`,
              background: isDark ? 'rgba(33, 49, 69, 0.5)' : 'rgba(248, 249, 255, 0.5)',
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              zIndex: 1,
            }}>
              <h2 style={{ ...sectionTitleStyle, fontSize: 14 }}>
                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>terminal</span>
                流式日志
              </h2>
              <div style={{ display: 'flex', gap: 6 }}>
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--md-outline-variant)' }} />
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--md-outline-variant)' }} />
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--md-outline-variant)' }} />
              </div>
            </div>

            {/* Log content */}
            <div style={{
              flex: 1,
              background: 'var(--md-inverse-surface)',
              padding: 16,
              overflowY: 'auto',
              fontFamily: 'var(--font-mono)',
              fontSize: 12,
              lineHeight: '20px',
              display: 'flex', flexDirection: 'column', gap: 8,
            }}>
              {logEntries.length === 0 ? (
                <div style={{ color: 'var(--md-outline-variant)', textAlign: 'center', padding: '32px 0' }}>
                  暂无日志
                </div>
              ) : (
                logEntries.slice(-50).map((entry, i) => (
                  <div key={i} style={{ display: 'flex', gap: 12 }}>
                    <span style={{ color: 'var(--md-tertiary-fixed-dim)', flexShrink: 0 }}>[{entry.time}]</span>
                    <span style={{ color: entry.color, flexShrink: 0 }}>{entry.agent}:</span>
                    <span style={{ color: 'var(--md-inverse-on-surface)', opacity: 0.8, wordBreak: 'break-word' }}>{entry.message}</span>
                  </div>
                ))
              )}
              {activeCount > 0 && (
                <div style={{ display: 'flex', gap: 12, animation: 'pulse 2s infinite' }}>
                  <span style={{ color: 'var(--md-outline-variant)', flexShrink: 0 }}>···</span>
                  <span style={{ color: 'var(--md-outline-variant)' }}>等待数据流...</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Resources & Templates (12 cols) */}
        <div style={{ gridColumn: '1 / -1', display: 'flex', flexDirection: 'column', gap: 16, marginTop: 8 }}>
          <h2 style={{ ...sectionTitleStyle }}>
            <span className="material-symbols-outlined" style={{ fontSize: 20 }}>storefront</span>
            资源与模板
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
            {templates.map(template => (
              <div
                key={template.name}
                style={{
                  background: cardBg,
                  borderRadius: 12,
                  border: `1px solid ${borderColor}`,
                  padding: 16,
                  boxShadow: '0 4px 12px rgba(0,0,0,0.03)',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                }}
                onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.08)'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
                onMouseLeave={e => { e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.03)'; e.currentTarget.style.transform = 'translateY(0)'; }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 12 }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: 6,
                    background: template.iconBg,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 18, color: template.iconColor }}>{template.icon}</span>
                  </div>
                  <div>
                    <h4 style={{ fontSize: 14, fontWeight: 600, color: 'var(--md-on-surface)', margin: 0, lineHeight: '20px' }}>{template.name}</h4>
                    <span style={{ fontSize: 13, color: 'var(--md-on-surface-variant)', lineHeight: '18px' }}>{template.category}</span>
                  </div>
                </div>
                <p style={{ fontSize: 13, color: 'var(--md-on-surface-variant)', margin: 0, lineHeight: '18px', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                  {template.desc}
                </p>
              </div>
            ))}

            {/* Browse Hub card */}
            <div
              style={{
                background: 'var(--md-surface-container-low)',
                borderRadius: 12,
                border: '2px dashed var(--md-outline-variant)',
                padding: 16,
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center',
                color: 'var(--md-on-surface-variant)',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                minHeight: 120,
              }}
              onMouseEnter={e => { e.currentTarget.style.color = 'var(--md-primary)'; e.currentTarget.style.borderColor = 'var(--md-primary)'; e.currentTarget.style.background = 'rgba(0, 107, 95, 0.04)'; }}
              onMouseLeave={e => { e.currentTarget.style.color = 'var(--md-on-surface-variant)'; e.currentTarget.style.borderColor = 'var(--md-outline-variant)'; e.currentTarget.style.background = 'var(--md-surface-container-low)'; }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 24, marginBottom: 4 }}>add_circle</span>
              <span style={{ fontSize: 14, fontWeight: 500 }}>浏览市场</span>
            </div>
          </div>
        </div>
      </div>

      {/* Keyframes */}
      <style>{`
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        @keyframes indeterminate {
          0% { width: 0%; margin-left: 0; }
          50% { width: 60%; margin-left: 20%; }
          100% { width: 0%; margin-left: 100%; }
        }
      `}</style>
    </div>
  );
}
