import { useCallback, useEffect } from 'react';
import { PlusOutlined } from '@ant-design/icons';
import { terminalApi } from '../../api';
import { useTerminalStore } from '../../stores/terminalStore';
import { useWorkspaceStore } from '../../stores/workspaceStore';
import TerminalInstance from '../TerminalInstance';
import { DEFAULT_SHELL, SHELL_MAP } from '../../lib/constants';
import type { Terminal } from '../terminalTypes';
import { folderName } from './terminalFactory';

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

  const handleCwdChange = useCallback((terminalId: string, cwd: string) => {
    const tab = useWorkspaceStore.getState().tabs[terminalId];
    if (!tab || tab.namePinned) return;
    const name = folderName(cwd);
    if (name && name !== tab.label) {
      useWorkspaceStore.getState().updateTabLabel(terminalId, name);
      updateTerminal(terminalId, { label: name, cwd });
    }
  }, [updateTerminal]);

  const handleTitleChange = useCallback((terminalId: string, title: string) => {
    const tab = useWorkspaceStore.getState().tabs[terminalId];
    if (!tab || tab.namePinned) return;
    const name = title.replace(/[\\\/]+$/, '').split(/[\\\/]/).pop() || title;
    if (name && name !== tab.label) {
      useWorkspaceStore.getState().updateTabLabel(terminalId, name);
      updateTerminal(terminalId, { label: name });
    }
  }, [updateTerminal]);

  const handleCreate = useCallback(async () => {
    const state = useTerminalStore.getState();
    if (state.terminals.length >= 10) return;

    const id = `global-${Math.random().toString(36).slice(2, 10)}`;
    const shellPref = localStorage.getItem('devhub_terminal_shell') || DEFAULT_SHELL;
    const cfg = SHELL_MAP[shellPref] || SHELL_MAP[DEFAULT_SHELL];
    const label = folderName(defaultCwd);

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
      <div
        style={{ width: '100%', height: '100%', position: 'relative' }}
        onDragOver={e => {
          if (e.dataTransfer.types.includes('text/plain')) {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'copy';
          }
        }}
        onDrop={e => {
          e.preventDefault();
          const filePath = e.dataTransfer.getData('text/plain');
          if (filePath && activeTabId) {
            // Quote path if it contains spaces
            const quoted = filePath.includes(' ') ? `"${filePath}"` : filePath;
            terminalApi.input(activeTabId, quoted).catch(() => {});
          }
        }}
      >
        {leafTerminals.map(t => (
          <TerminalInstance
            key={t.id}
            terminal={t}
            theme={theme}
            isActive={t.id === activeTabId}
            onInput={handleInput}
            onExit={handleExit}
            onCwdChange={handleCwdChange}
            onTitleChange={handleTitleChange}
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
      background: 'var(--ws-content-bg)',
    }}>
      <span style={{ fontSize: 20, opacity: 0.3, fontFamily: "'Fira Code', monospace", color: 'var(--ws-text-secondary)' }}>
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
          border: '1px solid var(--ws-border)',
          background: 'var(--ws-hover)',
          color: 'var(--ws-text-secondary)',
          cursor: 'pointer',
          fontSize: 12,
          fontFamily: "'Fira Code', monospace",
          transition: 'all 0.15s',
        }}
        onMouseEnter={e => {
          e.currentTarget.style.background = 'var(--ws-active-bg)';
          e.currentTarget.style.borderColor = 'var(--ws-active-border)';
        }}
        onMouseLeave={e => {
          e.currentTarget.style.background = 'var(--ws-hover)';
          e.currentTarget.style.borderColor = 'var(--ws-border)';
        }}
      >
        <PlusOutlined style={{ fontSize: 11 }} />
        <span>新建终端</span>
      </button>
    </div>
  );
}
