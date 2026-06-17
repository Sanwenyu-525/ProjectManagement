import { useCallback, useEffect, useRef } from 'react';
import { listen } from '@tauri-apps/api/event';
import { terminalApi, projectsApi } from '../api';
import { Terminal, TerminalExitEvent, PanePosition } from './terminalTypes';
import { LaunchRequest, useTerminalStore } from '../stores/terminalStore';
import { useWorkspaceStore } from '../stores/workspaceStore';
import TerminalPane from './terminal/TerminalPane';
import SplitDivider from './terminal/SplitDivider';
import { DEFAULT_SHELL, SHELL_MAP } from '../lib/constants';

interface TerminalManagerProps {
  visible: boolean;
  consumeLaunchRequest: () => LaunchRequest | null;
}

export default function TerminalManager({ visible, consumeLaunchRequest }: TerminalManagerProps) {
  const terminals = useTerminalStore(s => s.terminals);
  const addTerminal = useTerminalStore(s => s.addTerminal);
  const updateTerminal = useTerminalStore(s => s.updateTerminal);
  const setActiveId = useWorkspaceStore(s => s.setActiveId);
  const defaultCwd = useTerminalStore(s => s.defaultCwd);
  const launchQueueLength = useTerminalStore(s => s.launchQueue.length);
  const splitPaneOpen = useWorkspaceStore(s => s.splitPaneOpen);
  const splitRatio = useWorkspaceStore(s => s.splitRatio);
  const splitVerticalOpen = useWorkspaceStore(s => s.splitVerticalOpen);
  const splitVerticalRatio = useWorkspaceStore(s => s.splitVerticalRatio);
  const groups = useTerminalStore(s => s.groups);
  const addGroup = useTerminalStore(s => s.addGroup);
  const shellPref = localStorage.getItem('devhub_terminal_shell') || DEFAULT_SHELL;

  const terminalsRef = useRef(terminals);
  terminalsRef.current = terminals;

  const groupsRef = useRef(groups);
  groupsRef.current = groups;

  // Queue-based launch processing to avoid React batching issues
  const launchQueueRef = useRef<LaunchRequest[]>([]);
  const processingRef = useRef(false);

  const shellPrefRef = useRef(shellPref);
  shellPrefRef.current = shellPref;

  const createTerminal = useCallback(async (label?: string, cwdOverride?: string, idOverride?: string, projectId?: string, existingGroupId?: string, pane?: PanePosition) => {
    if (terminalsRef.current.length >= 10) {
      console.warn('Max terminals reached');
      return;
    }

    const id = idOverride || `global-${Math.random().toString(36).slice(2, 10)}`;
    const cfg = SHELL_MAP[shellPrefRef.current] || SHELL_MAP[DEFAULT_SHELL];
    const shell = cfg.shell;
    const shellArgs = cfg.args;

    // Resolve groupId: project takes priority, then explicit groupId
    let groupId: string | null = existingGroupId || null;
    if (projectId) {
      const existingGroup = groupsRef.current.find(g => g.id === `project-${projectId}`);
      if (existingGroup) {
        groupId = existingGroup.id;
      } else {
        // Use project name as group label (strip " - 前端/后端" suffix if present)
        const groupName = (label || '').split(' - ')[0] || projectId;
        groupId = addGroup(projectId, true);
        useTerminalStore.getState().renameGroup(groupId, groupName);
      }
    }

    // Resolve cwd: if not provided, look up project's localPath from group or projectId
    let cwd = cwdOverride || defaultCwd;
    if (!cwdOverride) {
      const pid = projectId || (existingGroupId?.startsWith('project-') ? existingGroupId.slice(8) : null);
      if (pid) {
        try {
          const project = await projectsApi.getById(pid);
          if (project?.localPath) cwd = project.localPath;
        } catch { /* fall back to defaultCwd */ }
      }
    }

    // Deduplicate terminal name within group
    let name = label || `终端 ${terminalsRef.current.length + 1}`;
    if (groupId) {
      const siblings = terminalsRef.current.filter(t => t.groupId === groupId);
      if (siblings.some(t => t.label === name)) {
        let n = 2;
        while (siblings.some(t => t.label === `${name} ${n}`)) n++;
        name = `${name} ${n}`;
      }
    }

    // Determine which pane to use
    let terminalPane: PanePosition = pane || 'left';
    if (!pane) {
      // Auto-assign based on current split state
      if (useWorkspaceStore.getState().splitPaneOpen) {
        terminalPane = 'right';
      }
    }

    const newTerminal: Terminal = {
      id,
      label: name,
      createdAt: new Date(),
      shell,
      cwd,
      status: 'running',
      projectId: projectId || null,
      groupId,
      pane: terminalPane,
    };

    await terminalApi.startShell(id, shell, cwd, shellArgs);
    addTerminal(newTerminal);
    setActiveId('left', id);
  }, [defaultCwd, addTerminal, setActiveId, addGroup]);

  const processNextInQueue = useCallback(async () => {
    if (processingRef.current || launchQueueRef.current.length === 0) return;
    processingRef.current = true;

    while (launchQueueRef.current.length > 0) {
      const req = launchQueueRef.current.shift()!;
      const cwd = req.cwd || defaultCwd;
      const label = req.label;

      try {
        const id = `global-${Math.random().toString(36).slice(2, 10)}`;
        await createTerminal(label, cwd, id, req.projectId);
        if (req.command) {
          await terminalApi.input(id, req.command + '\r');
        }
      } catch (e) {
        console.error('Failed to create terminal:', e);
      }
    }

    processingRef.current = false;
  }, [defaultCwd, createTerminal]);

  // Consume launch request queue when items are added
  useEffect(() => {
    if (!visible) return;
    // Drain all pending requests into the ref-based queue
    let req = consumeLaunchRequest();
    while (req) {
      launchQueueRef.current.push(req);
      req = consumeLaunchRequest();
    }
    processNextInQueue();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, launchQueueLength]);

  // Update terminal status when backend process exits
  useEffect(() => {
    if (!visible) return;
    const unlisten = listen<TerminalExitEvent>('terminal-exit', (event) => {
      const { terminalId, code } = event.payload;
      updateTerminal(terminalId, {
        status: code === 0 ? 'exited' : 'error',
      });
    });
    return () => { unlisten.then(fn => fn()); };
  }, [visible, updateTerminal]);

  // Auto-cleanup empty project groups
  useEffect(() => {
    const state = useTerminalStore.getState();
    for (const group of state.groups) {
      if (group.isProjectGroup && group.id !== 'global') {
        const hasTerminals = state.terminals.some(t => t.groupId === group.id);
        if (!hasTerminals) {
          useTerminalStore.getState().removeGroup(group.id);
        }
      }
    }
  }, [terminals.length]);

  // Keyboard shortcut for clear screen (Ctrl+L)
  const clearTerminal = useCallback(() => {
    const state = useWorkspaceStore.getState();
    const leftActive = state.leftPane.activeId;
    if (leftActive) {
      terminalApi.input(leftActive, '\x0c').catch(console.error);
    }
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === 'l') {
        e.preventDefault();
        clearTerminal();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [clearTerminal]);

  const handleTerminalInput = useCallback((terminalId: string, data: string) => {
    terminalApi.input(terminalId, data).catch(console.error);
  }, []);

  if (!visible) return null;

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'row',
      height: '100%',
      background: '#1e1e1e',
      borderRadius: '12px 12px 0 0',
      overflow: 'hidden',
    }}>
      {/* Left pane */}
      <div style={{
        flex: splitPaneOpen ? splitRatio : 1,
        display: 'flex',
        overflow: 'hidden',
        transition: 'flex 0.2s ease',
      }}>
        <TerminalPane
          pane="left"
          onCreateTerminal={(groupId) => {
            const group = groupsRef.current.find(g => g.id === groupId);
            createTerminal(group?.label, undefined, undefined, undefined, groupId);
          }}
          onTerminalInput={handleTerminalInput}
        />
      </div>

      {/* Split divider */}
      {splitPaneOpen && <SplitDivider />}

      {/* Right pane */}
      {splitPaneOpen && (
        <div style={{
          flex: 1 - splitRatio,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}>
          {/* Top pane (or full right pane if no vertical split) */}
          <div style={{
            flex: splitVerticalOpen ? splitVerticalRatio : 1,
            display: 'flex',
            overflow: 'hidden',
            transition: 'flex 0.2s ease',
          }}>
            <TerminalPane
              pane="right"
              onCreateTerminal={(groupId) => {
                const group = groupsRef.current.find(g => g.id === groupId);
                createTerminal(group?.label, undefined, undefined, undefined, groupId, 'right');
              }}
              onTerminalInput={handleTerminalInput}
            />
          </div>

          {/* Vertical split divider */}
          {splitVerticalOpen && (
            <div style={{
              height: 8,
              cursor: 'row-resize',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              background: 'rgba(255,255,255,0.05)',
              borderTop: '1px solid rgba(255,255,255,0.08)',
              borderBottom: '1px solid rgba(255,255,255,0.08)',
            }}>
              <div style={{
                width: 20,
                height: 2,
                background: 'rgba(255,255,255,0.3)',
                borderRadius: 1,
              }} />
            </div>
          )}

          {/* Bottom pane */}
          {splitVerticalOpen && (
            <div style={{
              flex: 1 - splitVerticalRatio,
              display: 'flex',
              overflow: 'hidden',
            }}>
              <TerminalPane
                pane="bottom"
                onCreateTerminal={(groupId) => {
                  const group = groupsRef.current.find(g => g.id === groupId);
                  createTerminal(group?.label, undefined, undefined, undefined, groupId, 'bottom');
                }}
                onTerminalInput={handleTerminalInput}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
