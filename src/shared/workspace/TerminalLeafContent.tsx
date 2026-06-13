import { useCallback, useEffect } from 'react';
import { PlusOutlined } from '@ant-design/icons';
import { terminalApi } from '../../api';
import { useTerminalStore } from '../../stores/terminalStore';
import { useWorkspaceStore } from '../../stores/workspaceStore';
import TerminalInstance from '../TerminalInstance';
import { DEFAULT_SHELL, SHELL_MAP } from '../../lib/constants';
import type { Terminal } from '../terminalTypes';

interface Props {
  leafId: string;
  activeTabId: string | null;
  terminalIds: string[];
}

export default function TerminalLeafContent({ leafId, activeTabId, terminalIds }: Props) {
  const terminals = useTerminalStore(s => s.terminals);
  const addTerminal = useTerminalStore(s => s.addTerminal);
  const updateTerminal = useTerminalStore(s => s.updateTerminal);
  const theme = useTerminalStore(s => s.theme);
  const defaultCwd = useTerminalStore(s => s.defaultCwd);
  const leafTerminals = terminals.filter(t => terminalIds.includes(t.id));

  // Auto-recreate terminals that are in workspace tabs but missing from terminal store
  useEffect(() => {
    if (terminalIds.length === 0) return;

    const wsTabs = useWorkspaceStore.getState().tabs;
    const currentTerminals = useTerminalStore.getState().terminals;
    for (const tid of terminalIds) {
      // Skip if already exists
      if (currentTerminals.some(t => t.id === tid)) continue;

      const tab = wsTabs[tid];
      if (!tab || tab.contentType !== 'terminal') continue;

      const shell = tab.shell || (() => {
        const shellPref = localStorage.getItem('devhub_terminal_shell') || DEFAULT_SHELL;
        return (SHELL_MAP[shellPref] || SHELL_MAP[DEFAULT_SHELL]).shell;
      })();
      const cwd = tab.cwd || defaultCwd;

      terminalApi.startShell(tid, shell, cwd).catch(() => {});
      useTerminalStore.getState().addTerminal({
        id: tid,
        label: tab.label,
        createdAt: new Date(),
        shell,
        cwd,
        status: 'running',
        projectId: null,
        groupId: null,
        pane: 'left',
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [terminalIds.join(',')]);

  const handleInput = useCallback((terminalId: string, data: string) => {
    terminalApi.input(terminalId, data).catch(console.error);
  }, []);

  const handleExit = useCallback((terminalId: string, code: number | null) => {
    updateTerminal(terminalId, { status: code === 0 ? 'exited' : 'error' });
  }, [updateTerminal]);

  const handleCreate = useCallback(async () => {
    const state = useTerminalStore.getState();
    if (state.terminals.length >= 10) return;

    const id = `global-${Math.random().toString(36).slice(2, 10)}`;
    const shellPref = localStorage.getItem('devhub_terminal_shell') || DEFAULT_SHELL;
    const cfg = SHELL_MAP[shellPref] || SHELL_MAP[DEFAULT_SHELL];
    const label = `终端 ${state.terminals.length + 1}`;

    const newTerminal: Terminal = {
      id,
      label,
      createdAt: new Date(),
      shell: cfg.shell,
      cwd: defaultCwd,
      status: 'running',
      projectId: null,
      groupId: null,
      pane: 'left',
    };

    await terminalApi.startShell(id, cfg.shell, defaultCwd, cfg.args);
    addTerminal(newTerminal);
    useWorkspaceStore.getState().addTab(leafId, {
      id,
      label,
      contentType: 'terminal',
      status: 'running',
      shell: cfg.shell,
      cwd: defaultCwd,
    });
  }, [addTerminal, defaultCwd, leafId]);

  // All terminals rendered, active one visible (xterm persists across tab switches)
  if (leafTerminals.length > 0) {
    return (
      <div style={{ width: '100%', height: '100%', position: 'relative' }}>
        {leafTerminals.map(t => (
          <TerminalInstance
            key={t.id}
            terminal={t}
            theme={theme}
            isActive={t.id === activeTabId}
            onInput={handleInput}
            onExit={handleExit}
          />
        ))}
      </div>
    );
  }

  // Empty state
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      width: '100%',
      height: '100%',
      gap: 12,
      background: '#1a1b26',
    }}>
      <span style={{ fontSize: 20, opacity: 0.3, fontFamily: "'Fira Code', monospace", color: '#94a3b8' }}>
        ⌘
      </span>
      <button
        onClick={handleCreate}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '8px 16px',
          borderRadius: 6,
          border: '1px solid rgba(255, 255, 255, 0.1)',
          background: 'rgba(255, 255, 255, 0.05)',
          color: '#94a3b8',
          cursor: 'pointer',
          fontSize: 12,
          fontFamily: "'Fira Code', monospace",
          transition: 'all 0.15s',
        }}
        onMouseEnter={e => {
          e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
          e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)';
        }}
        onMouseLeave={e => {
          e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
          e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
        }}
      >
        <PlusOutlined style={{ fontSize: 11 }} />
        <span>新建终端</span>
      </button>
    </div>
  );
}
