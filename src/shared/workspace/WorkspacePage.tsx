import { useState, useEffect, useCallback, useRef } from 'react';
import { listen } from '@tauri-apps/api/event';
import { useTerminalStore } from '../../stores/terminalStore';
import { usePreviewStore } from '../../stores/previewStore';
import { useAgentStore } from '../../stores/agentStore';
import { terminalApi, sessionsApi } from '../../api';
import { TerminalExitEvent, TerminalOutputEvent } from '../terminalTypes';
import WorkspaceHeader from './WorkspaceHeader';
import AgentSelector from './AgentSelector';
import type { AgentWithSession } from './AgentSelector';
import AgentChat from './AgentChat';
import BottomPanel from './BottomPanel';
import AgentRightPanel from './AgentRightPanel';
import { DEFAULT_SHELL, SHELL_MAP } from '../../lib/constants';
import { folderName } from './terminalFactory';
import { getProviders, getProvider } from '../../features/workspace/agent/providers';
import type { AgentProvider } from '../../features/workspace/agent/AgentProvider';

// Regex patterns for detecting dev server URLs in terminal output
const URL_PATTERNS = [
  /Local:\s+(https?:\/\/[^\s]+)/,
  /- Local:\s+(https?:\/\/[^\s]+)/,
  /Network:\s+(https?:\/\/[^\s]+)/,
  /(https?:\/\/localhost:\d+[^\s]*)/,
];

// Build agent list from provider registry
const allProviders = getProviders();

export default function WorkspacePage() {
  const launchQueueLength = useTerminalStore(s => s.launchQueue.length);
  const activeProviderId = useAgentStore(s => s.activeProviderId);
  const setActiveProvider = useAgentStore(s => s.setActiveProvider);

  const [agent, setAgent] = useState<AgentWithSession>({
    id: allProviders[0]?.id ?? '',
    name: allProviders[0]?.name ?? 'Agent',
    icon: allProviders[0]?.icon ?? 'smart_toy',
    session: null,
  });
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const defaultCwd = useTerminalStore(s => s.defaultCwd);
  const providerRef = useRef<AgentProvider | null>(null);

  // Load recent sessions to restore state
  useEffect(() => {
    sessionsApi.list(5).then(sessions => {
      const running = sessions.find(s => s.status === 'running' && s.cwd);
      if (running) {
        const provider = getProvider(running.runtimeId);
        if (provider) {
          providerRef.current = provider;
          setActiveProvider(provider.id);
        }
        setAgent(prev => ({ ...prev, session: running }));
        setActiveSessionId(running.id);
      }
    }).catch(() => {});
  }, [setActiveProvider]);

  // Start agent using provider
  const handleStartAgent = useCallback(async (providerId?: string, cwd?: string) => {
    const pid = providerId || allProviders[0]?.id;
    if (!pid) return;
    const provider = getProvider(pid);
    if (!provider) return;
    const workDir = cwd || defaultCwd;

    const sessionId = await sessionsApi.start(provider.id, provider.id, undefined, workDir);
    const connectionId = await provider.start({ sessionId, cwd: workDir });
    setActiveProvider(provider.id);
    providerRef.current = provider;

    setAgent({
      id: provider.id,
      name: provider.name,
      icon: provider.icon,
      session: {
        id: sessionId,
        agentTabId: connectionId,
        runtimeId: provider.id,
        startedAt: new Date().toISOString(),
        status: 'running',
      },
    });
    setActiveSessionId(sessionId);
  }, [defaultCwd, setActiveProvider]);

  // Stop agent via provider
  const handleStopAgent = useCallback(async () => {
    if (providerRef.current) {
      try {
        await providerRef.current.stop();
      } catch { /* ignore */ }
      providerRef.current = null;
    }
    setActiveProvider(null);
    if (activeSessionId) {
      try {
        await sessionsApi.end(activeSessionId);
      } catch { /* ignore */ }
    }
    setAgent(prev => ({ ...prev, session: null }));
    setActiveSessionId(null);
  }, [activeSessionId, setActiveProvider]);

  // Handle "New Chat" — stop existing and start fresh
  const handleNewChat = useCallback(async () => {
    const providerId = providerRef.current?.id || allProviders[0]?.id;
    await handleStopAgent();
    setTimeout(() => handleStartAgent(providerId), 200);
  }, [handleStopAgent, handleStartAgent]);

  // Handle agent selection
  const handleSelectAgent = useCallback((selected: AgentWithSession) => {
    if (!agent.session) {
      handleStartAgent(selected.id);
    }
  }, [agent.session, handleStartAgent]);

  // Listen for PTY exit (agent terminal)
  useEffect(() => {
    if (!providerRef.current) return;
    const connectionId = providerRef.current.connectionId;
    if (!connectionId) return;

    const unlisten = listen<TerminalExitEvent>('terminal-exit', (event) => {
      if (event.payload.terminalId === connectionId) {
        setActiveProvider(null);
        providerRef.current = null;
        if (activeSessionId) {
          sessionsApi.end(activeSessionId).catch(() => {});
        }
        setAgent(prev => ({ ...prev, session: null }));
        setActiveSessionId(null);
      }
    });
    return () => { unlisten.then(fn => fn()); };
  }, [activeProviderId, activeSessionId, setActiveProvider]);

  // Process launch queue from project pages
  const processingRef = useRef(false);
  useEffect(() => {
    if (launchQueueLength === 0) return;
    if (processingRef.current) return;
    processingRef.current = true;

    const process = async () => {
      let req = useTerminalStore.getState().consumeLaunchRequest();
      while (req) {
        const state = useTerminalStore.getState();
        if (state.terminals.length >= 10) break;

        const id = `global-${Math.random().toString(36).slice(2, 10)}`;
        try {
          const shellPref = localStorage.getItem('devhub_terminal_shell') || DEFAULT_SHELL;
          const cfg = SHELL_MAP[shellPref] || SHELL_MAP[DEFAULT_SHELL];

          const newTerminal = {
            id,
            label: req.label || folderName(req.cwd || state.defaultCwd),
            createdAt: new Date(),
            shell: cfg.shell,
            cwd: req.cwd || state.defaultCwd,
            status: 'running' as const,
            projectId: req.projectId || null,
            groupId: null,
            pane: 'left' as const,
          };

          await terminalApi.startShell(id, cfg.shell, newTerminal.cwd, cfg.args);
          state.addTerminal(newTerminal);

          if (req.command) {
            await terminalApi.input(id, req.command + '\r');
          }
        } catch (e) {
          console.error('Failed to create terminal from launch queue:', e);
        }

        req = useTerminalStore.getState().consumeLaunchRequest();
      }
      processingRef.current = false;
    };

    process();
  }, [launchQueueLength]);

  // Listen for terminal exit events (non-agent terminals)
  const agentConnectionId = providerRef.current?.connectionId ?? null;
  useEffect(() => {
    const unlisten = listen<TerminalExitEvent>('terminal-exit', (event) => {
      const { terminalId, code } = event.payload;
      if (terminalId !== agentConnectionId) {
        useTerminalStore.getState().updateTerminal(terminalId, { status: code === 0 ? 'exited' : 'error' });
        usePreviewStore.getState().removePreviewsByTerminal(terminalId);
      }
    });
    return () => { unlisten.then(fn => fn()); };
  }, [agentConnectionId]);

  // Listen for terminal output and detect localhost URLs
  useEffect(() => {
    const unlisten = listen<TerminalOutputEvent>('terminal-output', (event) => {
      const { data } = event.payload;
      for (const pattern of URL_PATTERNS) {
        const match = data.match(pattern);
        if (match) {
          const url = match[1] || match[0];
          usePreviewStore.getState().addPreview(url, event.payload.terminalId);
          break;
        }
      }
    });
    return () => { unlisten.then(fn => fn()); };
  }, []);

  return (
    <div style={styles.container}>
      {/* Center: Header + AgentSelector + Chat + Bottom Panel */}
      <div style={styles.center}>
        <WorkspaceHeader
          isRunning={!!activeProviderId}
          onNewChat={handleNewChat}
          onStart={() => handleStartAgent()}
          onStop={handleStopAgent}
        />

        <AgentSelector
          agents={allProviders.map(p => ({
            id: p.id,
            name: p.name,
            icon: p.icon,
            session: p.id === agent.id ? agent.session : null,
          }))}
          activeAgentId={agent.id}
          onSelect={handleSelectAgent}
        />

        <div style={styles.chatArea}>
          <AgentChat
            provider={providerRef.current}
            activeSessionId={activeSessionId}
          />
        </div>

        <BottomPanel />
      </div>

      {/* Right: Task/Plan Panel */}
      <AgentRightPanel sessionId={activeSessionId} />
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    width: '100%',
    height: '100%',
    gap: 8,
    padding: 8,
    background: 'var(--md-surface-container-lowest)',
    overflow: 'hidden',
  },
  center: {
    display: 'flex',
    flexDirection: 'column',
    flex: 1,
    gap: 0,
    minWidth: 0,
  },
  chatArea: {
    display: 'flex',
    flexDirection: 'column',
    flex: 1,
    minHeight: 0,
    overflow: 'hidden',
  },
};
