import { useEffect, useRef, useState, useCallback } from 'react';
import { listen } from '@tauri-apps/api/event';
import { terminalApi, sessionsApi, knowledgeApi, projectsApi, graphApi, auditApi } from '../../../api';
import { useXtermTerminal } from '../components/useXtermTerminal';
import { useThemeStore } from '../../../stores/themeStore';
import { useTerminalStore } from '../../../stores/terminalStore';
import { useAgentTabStore } from '../../../stores/agentTabStore';
import { useAgentContextStore } from '../../../stores/agentContextStore';
import { useAgentCommandHistoryStore } from '../../../stores/agentCommandHistoryStore';
import AgentCommandHistoryPanel from './AgentCommandHistoryPanel';
import { TerminalExitEvent } from '../../../shared/terminalTypes';

/** Intercept direct terminal typing to record commands in the conversation timeline. */
function useKeystrokeRecorder(
  terminalId: string,
  tabId: string,
  skipNextRecordRef: React.MutableRefObject<boolean>,
) {
  const bufferRef = useRef('');
  const termRefForBuffer = useRef<import('@xterm/xterm').Terminal | null>(null);

  const onData = useCallback((data: string) => {
    // Forward to PTY
    terminalApi.input(terminalId, data).catch(() => {});

    for (const ch of data) {
      const code = ch.charCodeAt(0);

      // xterm.js onData provides parsed keystrokes — arrow/function keys
      // arrive as full sequences (e.g. \x1b[B), not individual chars.
      // Control chars (Enter, Backspace) and printable chars are clean.
      // Just filter non-printable (< 32 except CR/LF) to be safe.
      if (code < 32 && code !== 13 && code !== 10) continue;

      if (code === 13 || code === 10) {
        // Enter — record the buffered command
        const text = bufferRef.current.trim();
        if (text) {
          if (skipNextRecordRef.current) {
            skipNextRecordRef.current = false;
          } else {
            const lineNumber = termRefForBuffer.current?.buffer.active.baseY ?? 0;
            useAgentCommandHistoryStore.getState().addUserMessage(tabId, text, lineNumber);
          }
        }
        bufferRef.current = '';
      } else if (code === 127 || code === 8) {
        // Backspace
        bufferRef.current = bufferRef.current.slice(0, -1);
      } else if (code >= 32) {
        // Printable character
        bufferRef.current += ch;
      }
    }
  }, [terminalId, tabId, skipNextRecordRef]);

  return { onData, termRefForBuffer };
}

interface AgentTerminalProps {
  tabId: string;
  style?: React.CSSProperties;
}

export default function AgentTerminal({ tabId, style: extraStyle }: AgentTerminalProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [terminalId, setTerminalId] = useState(() => `agent-${Date.now().toString(36)}`);
  const [spawnError, setSpawnError] = useState<string | null>(null);
  const [ptyExited, setPtyExited] = useState(false);
  const cleanupRef = useRef(false);
  const cwdRef = useRef(localStorage.getItem('agent_lastCwd') || useTerminalStore.getState().defaultCwd || '');
  const isDark = useThemeStore(s => s.mode === 'dark');
  const skipNextRecordRef = useRef(false);

  // On mount: clear stale sessionId from a previous app session
  useEffect(() => {
    const tab = useAgentTabStore.getState().tabs.find(t => t.id === tabId);
    if (tab?.sessionId) useAgentTabStore.getState().setSessionId(tabId, null);
  }, [tabId]);

  // Listen for quick commands from AgentTabBar
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      let text: string;
      // detail can be a string (legacy broadcast) or { text, tabId? }
      if (typeof detail === 'object' && detail !== null && 'text' in detail) {
        // Targeted message: only process if directed at this tab (or no tabId = broadcast)
        if (detail.tabId && detail.tabId !== tabId) {
          console.log(`[AgentTerminal] tabId 过滤: 目标=${detail.tabId}, 当前=${tabId}, 跳过`);
          return;
        }
        text = detail.text;
        console.log(`[AgentTerminal] 收到定向消息: tabId=${detail.tabId}, 当前=${tabId}`);
      } else if (typeof detail === 'string') {
        text = detail;
      } else {
        return;
      }

      // Record user message in conversation history
      const lineNumber = termRef.current?.buffer.active.baseY ?? 0;
      useAgentCommandHistoryStore.getState().addUserMessage(tabId, text, lineNumber);
      // Prevent keystroke buffer from double-recording this command
      skipNextRecordRef.current = true;

      // Intercept /knowledge command: fetch context before sending to Agent
      const km = text.match(/^\/knowledge\s+(.+)/);
      if (km) {
        const query = km[1].trim();
        knowledgeApi
          .searchContext(query, undefined, 5)
          .then(items => {
            const ctx = items
              .map((it, i) => `[${i + 1}] ${it.title} (${it.category}): ${it.contentSnippet}`)
              .join('\n');
            const enriched = ctx
              ? `[知识库检索 "${query}"]\n${ctx}\n---\n${query}`
              : query;
            terminalApi.input(terminalId, enriched).catch(() => {});
          })
          .catch(() => {
            // Fallback: send raw query if search fails
            terminalApi.input(terminalId, query).catch(() => {});
          });
        return;
      }

      // Intercept /graph command: query graph and inject context
      const gm = text.match(/^\/graph\s+(impact|deps|layers)\s*(.*)/);
      if (gm) {
        const subCmd = gm[1];
        const arg = gm[2].trim();
        const cwd = cwdRef.current;

        if (!cwd) {
          terminalApi.input(terminalId, '[图谱查询] 未设置工作目录').catch(() => {});
          return;
        }

        projectsApi.resolveId(cwd).then(projectId => {
          if (!projectId) {
            terminalApi.input(terminalId, `[图谱查询] 当前目录未注册为项目: ${cwd}`).catch(() => {});
            return;
          }

          const params: Record<string, string> = {};
          if (subCmd === 'impact' || subCmd === 'deps') {
            if (!arg) {
              terminalApi.input(terminalId, `[图谱查询] 用法: /graph ${subCmd} <file>`).catch(() => {});
              return;
            }
            params.file = arg;
            if (subCmd === 'deps') params.direction = 'backward';
          }

          graphApi.query(projectId, subCmd, params).then(result => {
            const summary = formatGraphResult(subCmd, arg, result);
            // Record query in context store
            const tab = useAgentTabStore.getState().tabs.find(t => t.id === tabId);
            if (tab?.sessionId) {
              useAgentContextStore.getState().trackGraphQuery(tab.sessionId, {
                queryType: subCmd as 'impact' | 'deps' | 'layers',
                target: arg || 'all',
                timestamp: Date.now(),
                resultSummary: summary.slice(0, 200),
              });
            }
            terminalApi.input(terminalId, summary).catch(() => {});
          }).catch(err => {
            terminalApi.input(terminalId, `[图谱查询] 错误: ${err}`).catch(() => {});
          });
        }).catch(() => {
          terminalApi.input(terminalId, '[图谱查询] 解析项目失败').catch(() => {});
        });
        return;
      }

      // Intercept /audit command: run project audit
      const am = text.match(/^\/audit\s*$/);
      if (am) {
        const cwd = cwdRef.current;
        if (!cwd) {
          terminalApi.input(terminalId, '[巡检] 未设置工作目录').catch(() => {});
          return;
        }
        terminalApi.input(terminalId, '[巡检] 正在执行项目巡检...').catch(() => {});
        projectsApi.resolveId(cwd).then(projectId => {
          if (!projectId) {
            terminalApi.input(terminalId, `[巡检] 当前目录未注册为项目: ${cwd}`).catch(() => {});
            return;
          }
          auditApi.runForProject(projectId).then(result => {
            const lines = [
              `[巡检完成] 总分: ${result.totalScore}/100`,
              '',
              `  架构健康: ${result.scoreArchitecture}/20`,
              `  代码质量: ${result.scoreCodeQuality}/20`,
              `  依赖风险: ${result.scoreDependencies}/20`,
              `  变更影响: ${result.scoreChangeImpact}/20`,
              `  知识缺口: ${result.scoreKnowledgeGap}/20`,
            ];
            if (result.riskItems.length > 0) {
              lines.push('', '风险项:');
              for (const r of result.riskItems.slice(0, 5)) {
                lines.push(`  [${r.severity}] ${r.label}: ${r.detail}`);
              }
            }
            if (result.recommendations.length > 0) {
              lines.push('', '改进建议:');
              for (const r of result.recommendations.slice(0, 5)) {
                lines.push(`  [${r.priority}] ${r.label}: ${r.detail}`);
              }
            }
            terminalApi.input(terminalId, lines.join('\n')).catch(() => {});
          }).catch(err => {
            terminalApi.input(terminalId, `[巡检] 失败: ${err}`).catch(() => {});
          });
        }).catch(() => {
          terminalApi.input(terminalId, '[巡检] 解析项目失败').catch(() => {});
        });
        return;
      }

      terminalApi.input(terminalId, text).catch(() => {});
    };
    window.addEventListener('agentQuickCommand', handler);
    return () => window.removeEventListener('agentQuickCommand', handler);
  }, [terminalId, tabId]); // eslint-disable-line react-hooks/exhaustive-deps -- termRef is a stable ref

  // Record direct terminal typing into conversation timeline
  const { onData: recordInput, termRefForBuffer } = useKeystrokeRecorder(terminalId, tabId, skipNextRecordRef);

  // xterm: render PTY output, forward user input
  const { termRef, refit } = useXtermTerminal(containerRef, {
    terminalId,
    theme: isDark ? 'dark' : 'light',
    onData: recordInput,
    onExit: useCallback((_code: number | null) => {}, []),
    onTitleChange: useCallback((title: string) => {
      const label = title.length > 20 ? title.slice(0, 20) + '…' : title;
      useAgentTabStore.getState().setLabel(tabId, label);
    }, [tabId]),
  });

  useEffect(() => { setTimeout(refit, 150); }, [terminalId, refit]);

  // Sync keystroke recorder's ref with the actual terminal ref
  useEffect(() => { termRefForBuffer.current = termRef.current; }, [termRef]); // eslint-disable-line react-hooks/exhaustive-deps -- ref identity is stable

  const spawnClaude = useCallback((tid: string, cwd: string) => {
    setSpawnError(null);
    const args: string[] = ['--dangerously-skip-permissions'];
    terminalApi.startAgent(tid, 'claude', args, cwd || '').catch(e => {
      console.error('[AgentTerminal] Failed to start claude:', e);
      setSpawnError(String(e));
    });
  }, []);

  useEffect(() => {
    spawnClaude(terminalId, cwdRef.current);
    sessionsApi.start(tabId, 'claude', undefined, cwdRef.current, 'dangerously-skip-permissions')
      .then(sid => {
        useAgentTabStore.getState().setSessionId(tabId, sid);
      })
      .catch(() => {});
    return () => {
      cleanupRef.current = true;
      terminalApi.stop(terminalId).catch(() => {});
    };
  }, [terminalId, spawnClaude, tabId]);

  useEffect(() => {
    const unlisten = listen<TerminalExitEvent>('terminal-exit', (event) => {
      if (event.payload.terminalId !== terminalId) return;
      if (cleanupRef.current) {
        cleanupRef.current = false;
        return;
      }
      setPtyExited(true);
    });
    return () => { unlisten.then(fn => fn()); };
  }, [terminalId]);

  const handleRestart = useCallback(() => {
    setPtyExited(false);
    setSpawnError(null);
    const newId = `agent-${Date.now().toString(36)}`;
    setTerminalId(newId);
  }, []);

  return (
    <div className="xterm-focus" style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', position: 'relative', ...extraStyle }}>
      <div ref={containerRef} style={{ flex: 1, minHeight: 0, overflow: 'hidden' }} />

      {/* Conversation timeline — overlaid on right side of terminal */}
      <AgentCommandHistoryPanel tabId={tabId} termRef={termRef} />

      {ptyExited && !spawnError && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 10,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          gap: 12,
          background: 'var(--md-surface-container-lowest)',
          opacity: 0.92,
        }}>
          <span className="material-symbols-outlined" style={{ fontSize: 36, color: 'var(--md-outline-variant)' }}>
            power_settings_new
          </span>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--md-on-surface-variant)', fontFamily: 'var(--font-sans)' }}>
            Agent 已退出
          </p>
          <button
            onClick={handleRestart}
            style={{
              padding: '8px 24px',
              borderRadius: 8,
              border: '1px solid var(--md-primary)',
              background: 'var(--md-primary)',
              color: 'var(--md-on-primary)',
              fontSize: 13,
              fontFamily: 'var(--font-sans)',
              cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 6,
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>refresh</span>
            重新启动
          </button>
        </div>
      )}

      {spawnError && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 10,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          gap: 12,
          background: 'var(--md-surface-container-lowest)',
          opacity: 0.92,
        }}>
          <span className="material-symbols-outlined" style={{ fontSize: 36, color: 'var(--md-error)' }}>error</span>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--md-error)', fontFamily: 'var(--font-sans)' }}>
            启动失败: {spawnError}
          </p>
          <button
            onClick={handleRestart}
            style={{
              padding: '8px 24px', borderRadius: 8,
              border: '1px solid var(--md-primary)',
              background: 'var(--md-primary)',
              color: 'var(--md-on-primary)',
              fontSize: 13, fontFamily: 'var(--font-sans)',
              cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 6,
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>refresh</span>
            重新启动
          </button>
        </div>
      )}

    </div>
  );
}

function formatGraphResult(subCmd: string, target: string, result: Record<string, unknown>): string {
  if (subCmd === 'impact') {
    const nodes = (result.impactedNodes ?? []) as Array<{ filePath: string; depth: number }>;
    const directCount = result.directCount ?? 0;
    const indirectCount = result.indirectCount ?? 0;
    const maxDepth = result.maxDepth ?? 0;
    if (nodes.length === 0) return `[图谱影响分析] ${target} 没有受影响的文件`;
    const lines = [
      `[图谱影响分析] ${target}`,
      `直接影响 ${directCount} 个文件，间接影响 ${indirectCount} 个文件，最大深度 ${maxDepth} 层`,
      '',
      ...nodes.slice(0, 20).map(n => `  ${n.depth === 0 ? '●' : n.depth <= 2 ? '○' : '·'} ${n.filePath} (深度 ${n.depth})`),
    ];
    if (nodes.length > 20) lines.push(`  ... 等 ${nodes.length} 个文件`);
    return lines.join('\n');
  }
  if (subCmd === 'deps') {
    const nodes = (result.chainNodes ?? []) as Array<{ filePath: string; depth: number }>;
    const direction = result.direction ?? 'backward';
    if (nodes.length === 0) return `[图谱依赖链] ${target} 没有依赖关系`;
    const lines = [
      `[图谱依赖链] ${target} (${direction === 'backward' ? '谁依赖我' : '我依赖谁'})`,
      '',
      ...nodes.slice(0, 30).map(n => `  ${'  '.repeat(n.depth)}${n.depth === 0 ? '►' : '↳'} ${n.filePath}`),
    ];
    if (nodes.length > 30) lines.push(`  ... 等 ${nodes.length} 个文件`);
    return lines.join('\n');
  }
  if (subCmd === 'layers') {
    const layers = (result.layers ?? []) as Array<{ level: number; nodes: Array<{ filePath: string }> }>;
    const cycles = (result.cycles ?? []) as Array<{ nodeIds: string[] }>;
    const lines = [`[图谱架构分层] 共 ${result.totalNodes ?? 0} 个文件`, ''];
    for (const layer of layers.slice(0, 10)) {
      lines.push(`第 ${layer.level} 层 (${layer.nodes.length} 个文件):`);
      for (const node of layer.nodes.slice(0, 5)) {
        lines.push(`  ${node.filePath}`);
      }
      if (layer.nodes.length > 5) lines.push(`  ... 等 ${layer.nodes.length} 个文件`);
    }
    if (cycles.length > 0) {
      lines.push('', `⚠ ${cycles.length} 个循环依赖`);
    }
    return lines.join('\n');
  }
  return JSON.stringify(result, null, 2);
}
