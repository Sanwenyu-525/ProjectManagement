import { useEffect, useRef, useState, useCallback, useImperativeHandle, forwardRef } from 'react';
import { listen } from '@tauri-apps/api/event';
import { terminalApi, sessionsApi } from '../../../api';
import { useXtermTerminal } from '../components/useXtermTerminal';
import { useThemeStore } from '../../../stores/themeStore';
import { useTerminalStore } from '../../../stores/terminalStore';
import { useAgentTabStore } from '../../../stores/agentTabStore';
import { TerminalExitEvent } from '../../../shared/terminalTypes';

export interface AgentTerminalHandle {
  switchCwd: (newCwd: string) => void;
}

interface AgentTerminalProps {
  tabId: string;
  style?: React.CSSProperties;
}

const AgentTerminal = forwardRef<AgentTerminalHandle, AgentTerminalProps>(function AgentTerminal({ tabId, style: extraStyle }, ref) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [terminalId, setTerminalId] = useState(() => `agent-${Date.now().toString(36)}`);
  const [spawnError, setSpawnError] = useState<string | null>(null);
  const [ptyExited, setPtyExited] = useState(false);
  const [restored, setRestored] = useState(() => {
    // Check if tab was restored from localStorage (has sessionId from a previous session)
    return !!useAgentTabStore.getState().tabs.find(t => t.id === tabId)?.sessionId;
  });
  const switchingRef = useRef(false);
  const cwdRef = useRef(localStorage.getItem('agent_lastCwd') || useTerminalStore.getState().defaultCwd || '');
  const isDark = useThemeStore(s => s.mode === 'dark');

  // Listen for quick commands from AgentTabBar
  useEffect(() => {
    const handler = (e: Event) => {
      const text = (e as CustomEvent).detail;
      if (typeof text === 'string') {
        terminalApi.input(terminalId, text).catch(() => {});
      }
    };
    window.addEventListener('agentQuickCommand', handler);
    return () => window.removeEventListener('agentQuickCommand', handler);
  }, [terminalId]);

  // xterm: render PTY output, forward user input
  const { refit } = useXtermTerminal(containerRef, {
    terminalId,
    theme: isDark ? 'dark' : 'light',
    onData: useCallback((data: string) => {
      terminalApi.input(terminalId, data).catch(() => {});
    }, [terminalId]),
    onExit: useCallback((_code: number | null) => {}, []),
    onTitleChange: useCallback((title: string) => {
      const label = title.length > 20 ? title.slice(0, 20) + '…' : title;
      useAgentTabStore.getState().setLabel(tabId, label);
    }, [tabId]),
  });

  useEffect(() => { setTimeout(refit, 150); }, [terminalId, refit]);

  const spawnClaude = useCallback((tid: string, cwd: string) => {
    setSpawnError(null);
    const args: string[] = ['--dangerously-skip-permissions'];
    terminalApi.startAgent(tid, 'claude', args, cwd || '').catch(e => {
      console.error('[AgentTerminal] Failed to start claude:', e);
      setSpawnError(String(e));
    });
  }, []);

  const switchCwd = useCallback((newCwd: string) => {
    localStorage.setItem('agent_lastCwd', newCwd);
    cwdRef.current = newCwd;
    switchingRef.current = true;
    terminalApi.input(terminalId, 'exit\r').catch(() => {
      switchingRef.current = false;
      terminalApi.stop(terminalId).catch(() => {});
      const newId = `agent-${Date.now().toString(36)}`;
      setTerminalId(newId);
      spawnClaude(newId, newCwd);
    });
  }, [terminalId, spawnClaude]);

  useImperativeHandle(ref, () => ({ switchCwd }), [switchCwd]);

  useEffect(() => {
    if (restored) return; // Don't spawn for restored tabs — process is dead
    spawnClaude(terminalId, cwdRef.current);
    sessionsApi.start(tabId, 'claude', undefined, cwdRef.current, 'dangerously-skip-permissions')
      .then(sid => {
        useAgentTabStore.getState().setSessionId(tabId, sid);
      })
      .catch(() => {});
    return () => { terminalApi.stop(terminalId).catch(() => {}); };
  }, [terminalId, spawnClaude, tabId, restored]);

  useEffect(() => {
    const unlisten = listen<TerminalExitEvent>('terminal-exit', (event) => {
      if (event.payload.terminalId !== terminalId) return;
      if (switchingRef.current) {
        switchingRef.current = false;
        const newId = `agent-${Date.now().toString(36)}`;
        setTerminalId(newId);
      } else {
        setPtyExited(true);
      }
    });
    return () => { unlisten.then(fn => fn()); };
  }, [terminalId]);

  const handleRestart = useCallback(() => {
    setPtyExited(false);
    setSpawnError(null);
    const newId = `agent-${Date.now().toString(36)}`;
    setTerminalId(newId);
  }, []);

  const handleNewConversation = useCallback(() => {
    setRestored(false);
    // Clear old sessionId so the spawn effect creates a fresh session
    const tab = useAgentTabStore.getState().tabs.find(t => t.id === tabId);
    if (tab?.sessionId) {
      useAgentTabStore.getState().setSessionId(tabId, null);
    }
    const newId = `agent-${Date.now().toString(36)}`;
    setTerminalId(newId);
  }, [tabId]);

  return (
    <div className="xterm-focus" style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', position: 'relative', ...extraStyle }}>
      <div ref={containerRef} style={{ flex: 1, minHeight: 0, overflow: 'hidden' }} />

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

      {restored && !ptyExited && !spawnError && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 10,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          gap: 12,
          background: 'var(--md-surface-container-lowest)',
          opacity: 0.92,
        }}>
          <span className="material-symbols-outlined" style={{ fontSize: 36, color: 'var(--md-outline-variant)' }}>
            history
          </span>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--md-on-surface-variant)', fontFamily: 'var(--font-sans)' }}>
            会话已结束
          </p>
          <button
            onClick={handleNewConversation}
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
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>add</span>
            开始新对话
          </button>
        </div>
      )}
    </div>
  );
});

export default AgentTerminal;
