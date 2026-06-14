import { useEffect, useRef, useState, useCallback } from 'react';
import { listen } from '@tauri-apps/api/event';
import { useTerminalStore } from '../../stores/terminalStore';
import type { PaneNode, PaneLeaf } from './types';
import { usePreviewStore } from '../../stores/previewStore';
import { terminalApi } from '../../api';
import { TerminalExitEvent, TerminalOutputEvent } from '../terminalTypes';
import WorkspaceToolbar from './WorkspaceToolbar';
import WorkspaceNavigator from './WorkspaceNavigator';
import WorkspacePane from './WorkspacePane';
import { DEFAULT_SHELL, SHELL_MAP } from '../../lib/constants';
import { useWorkspaceShortcuts } from './WorkspaceShortcuts';
import AutomationRouter from './AutomationRouter';
import AgentSessionRecorder from './AgentSessionRecorder';

// Regex patterns for detecting dev server URLs in terminal output
const URL_PATTERNS = [
  /Local:\s+(https?:\/\/[^\s]+)/,           // Vite: "Local:   http://localhost:5173/"
  /- Local:\s+(https?:\/\/[^\s]+)/,         // Next.js: "- Local:        http://localhost:3000"
  /Network:\s+(https?:\/\/[^\s]+)/,         // Vite/Next network URLs
  /(https?:\/\/localhost:\d+[^\s]*)/,       // Generic: any localhost URL
];

export default function WorkspacePage() {
  const launchQueueLength = useTerminalStore(s => s.launchQueue.length);

  useWorkspaceShortcuts();

  // Process launch queue — when requestLaunch is called from project pages
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
            label: req.label || `终端 ${state.nextTerminalNumber()}`,
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

          // Add to first leaf
          const { useWorkspaceStore } = await import('../../stores/workspaceStore');
          const wsState = useWorkspaceStore.getState();
          const leaves = (() => {
            const walk = (n: PaneNode): PaneLeaf[] => {
              if (n.type === 'leaf') return [n];
              return n.children?.flatMap(walk) ?? [];
            };
            return walk(wsState.root);
          })();
          if (leaves[0]) {
            wsState.addTab(leaves[0].id, {
              id,
              label: newTerminal.label,
              contentType: 'terminal',
              status: 'running',
              shell: cfg.shell,
              cwd: newTerminal.cwd,
            });
          }

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

  // Listen for terminal exit events and update store
  useEffect(() => {
    const unlisten = listen<TerminalExitEvent>('terminal-exit', (event) => {
      const { terminalId, code } = event.payload;
      useTerminalStore.getState().updateTerminal(terminalId, { status: code === 0 ? 'exited' : 'error' });
      usePreviewStore.getState().removePreviewsByTerminal(terminalId);
    });
    return () => { unlisten.then(fn => fn()); };
  }, []);

  // Listen for terminal output and detect localhost URLs (preview auto-discovery)
  useEffect(() => {
    const unlisten = listen<TerminalOutputEvent>('terminal-output', (event) => {
      const { terminalId, data } = event.payload;
      for (const pattern of URL_PATTERNS) {
        const match = data.match(pattern);
        if (match) {
          const url = match[1] || match[0];
          usePreviewStore.getState().addPreview(url, terminalId);
          break;
        }
      }
    });
    return () => { unlisten.then(fn => fn()); };
  }, []);

  // Sidebar resize
  const [sidebarWidth, setSidebarWidth] = useState(200);
  const sidebarWidthRef = useRef(200);
  const isDraggingRef = useRef(false);

  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isDraggingRef.current = true;
    const startX = e.clientX;
    const startWidth = sidebarWidthRef.current;

    const onMove = (ev: MouseEvent) => {
      if (!isDraggingRef.current) return;
      const delta = ev.clientX - startX;
      const newWidth = Math.max(120, Math.min(400, startWidth + delta));
      sidebarWidthRef.current = newWidth;
      setSidebarWidth(newWidth);
    };

    const onUp = () => {
      isDraggingRef.current = false;
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, []);

  return (
    <div style={styles.container}>
      <AutomationRouter />
      <AgentSessionRecorder />
      {/* Top: workspace toolbar */}
      <WorkspaceToolbar />

      {/* Middle: navigator + pane tree */}
      <div style={styles.body}>
        <div style={{ width: sidebarWidth, flexShrink: 0, overflow: 'hidden' }}>
          <WorkspaceNavigator />
        </div>
        <div
          onMouseDown={handleResizeStart}
          style={styles.resizeHandle}
        />
        <div style={styles.paneArea}>
          <WorkspacePane />
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    width: '100%',
    height: '100%',
    background: '#1a1b26',
    overflow: 'hidden',
  },
  body: {
    display: 'flex',
    flex: 1,
    overflow: 'hidden',
  },
  paneArea: {
    flex: 1,
    overflow: 'hidden',
    display: 'flex',
  },
  resizeHandle: {
    width: 4,
    cursor: 'col-resize',
    background: 'transparent',
    flexShrink: 0,
    transition: 'background 0.15s',
  },
};
