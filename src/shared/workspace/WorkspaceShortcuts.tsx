import { useEffect } from 'react';
import { useWorkspaceStore } from '../../stores/workspaceStore';
import type { PaneNode, PaneLeaf } from './types';
import { useTerminalStore } from '../../stores/terminalStore';
import { terminalApi } from '../../api';
import { DEFAULT_SHELL, SHELL_MAP } from '../../lib/constants';

// Pure function (not in store — avoids re-render issues)
function getAllLeaves(node: PaneNode): PaneLeaf[] {
  if (node.type === 'leaf') return [node];
  return node.children.flatMap(getAllLeaves);
}

/**
 * Workspace keyboard shortcuts:
 * - Ctrl+1~9: Focus pane by index
 * - Ctrl+Shift+C: New terminal in focused pane
 * - Ctrl+Shift+A: New agent (Claude) in focused pane
 * - Ctrl+Shift+B: New browser tab in focused pane
 * - Ctrl+Shift+W: Close focused pane
 */
export function useWorkspaceShortcuts() {
  const focusedLeafId = useWorkspaceStore(s => s.focusedLeafId);
  const setFocusedLeaf = useWorkspaceStore(s => s.setFocusedLeaf);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!e.ctrlKey) return;
      const root = useWorkspaceStore.getState().root;
      const leaves = getAllLeaves(root);
      if (leaves.length === 0) return;

      // Ctrl+1~9: Focus pane by index
      const num = parseInt(e.key, 10);
      if (!e.shiftKey && num >= 1 && num <= 9 && num <= leaves.length) {
        e.preventDefault();
        setFocusedLeaf(leaves[num - 1].id);
        return;
      }

      if (!e.shiftKey) return;

      const targetId = focusedLeafId && leaves.some(l => l.id === focusedLeafId)
        ? focusedLeafId
        : leaves[0].id;

      if (e.key === 'C' || e.key === 'c') {
        // Ctrl+Shift+C: New terminal
        e.preventDefault();
        const state = useTerminalStore.getState();
        if (state.terminals.length >= 10) return;

        const uid = Math.random().toString(36).slice(2, 10);
        const id = `global-${uid}`;
        const shellPref = localStorage.getItem('devhub_terminal_shell') || DEFAULT_SHELL;
        const cfg = SHELL_MAP[shellPref] || SHELL_MAP[DEFAULT_SHELL];
        const label = `终端 ${state.terminals.length + 1}`;
        const cwd = state.defaultCwd;

        terminalApi.startShell(id, cfg.shell, cwd, cfg.args);
        state.addTerminal({
          id,
          label,
          createdAt: new Date(),
          shell: cfg.shell,
          cwd,
          status: 'running',
          projectId: null,
          groupId: null,
          pane: 'left',
        });
        useWorkspaceStore.getState().addTab(targetId, {
          id,
          label,
          contentType: 'terminal',
          status: 'running',
          shell: cfg.shell,
          cwd,
        });
      } else if (e.key === 'A' || e.key === 'a') {
        // Ctrl+Shift+A: New Claude agent
        e.preventDefault();
        const uid = Math.random().toString(36).slice(2, 10);
        useWorkspaceStore.getState().addTab(targetId, {
          id: `tab-${uid}`,
          label: 'Claude',
          contentType: 'agent',
          status: 'running',
          runtimeId: 'claude',
        });
      } else if (e.key === 'W' || e.key === 'w') {
        // Ctrl+Shift+W: Close focused pane
        e.preventDefault();
        if (!targetId) return;
        const { tabs, closePane } = useWorkspaceStore.getState();
        const leaf = leaves.find(l => l.id === targetId);
        if (leaf) {
          const { removeTerminal } = useTerminalStore.getState();
          for (const tabId of leaf.tabIds) {
            const tab = tabs[tabId];
            if (tab?.contentType === 'terminal') {
              terminalApi.stop(tabId).catch(() => {});
              removeTerminal(tabId);
            }
          }
          closePane(targetId);
        }
      } else if (e.key === 'B' || e.key === 'b') {
        // Ctrl+Shift+B: New browser tab
        e.preventDefault();
        const uid = Math.random().toString(36).slice(2, 10);
        useWorkspaceStore.getState().addTab(targetId, {
          id: `browser-${uid}`,
          label: '预览',
          contentType: 'browser',
        });
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [focusedLeafId, setFocusedLeaf]);
}
