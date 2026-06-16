import { useEffect } from 'react';
import { useWorkspaceStore } from '../../stores/workspaceStore';
import { getAllLeaves } from './treeUtils';
import { useTerminalStore } from '../../stores/terminalStore';
import { terminalApi } from '../../api';
import { createTerminal } from './terminalFactory';
import { createAgent } from './agentFactory';

/**
 * Workspace keyboard shortcuts:
 * - Ctrl+1~9: Focus pane by index
 * - Ctrl+Shift+C: New terminal in focused pane
 * - Ctrl+Shift+A: New agent (Claude) in focused pane
 * - Ctrl+Shift+B: New browser tab in focused pane
 * - Ctrl+Shift+P: New plugin tab in focused pane
 * - Ctrl+Shift+W: Close focused pane
 * - Ctrl+Arrow: Directional split focused pane
 */
export function useWorkspaceShortcuts() {
  const focusedLeafId = useWorkspaceStore(s => s.focusedLeafId);
  const setFocusedLeaf = useWorkspaceStore(s => s.setFocusedLeaf);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!e.ctrlKey) return;
      if (e.isComposing) return;
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

      const targetId = focusedLeafId && leaves.some(l => l.id === focusedLeafId)
        ? focusedLeafId
        : leaves[0].id;

      // Ctrl+Arrow: Directional split
      const arrowMap: Record<string, { dir: 'horizontal' | 'vertical'; newFirst: boolean }> = {
        ArrowLeft:  { dir: 'horizontal', newFirst: true },
        ArrowRight: { dir: 'horizontal', newFirst: false },
        ArrowUp:    { dir: 'vertical',   newFirst: true },
        ArrowDown:  { dir: 'vertical',   newFirst: false },
      };
      if (arrowMap[e.key]) {
        e.preventDefault();
        const { splitPane } = useWorkspaceStore.getState();
        const leaf = leaves.find(l => l.id === targetId);
        const activeTabId = leaf?.activeTabId;
        if (leaf && activeTabId) {
          const { dir, newFirst } = arrowMap[e.key];
          splitPane(targetId, activeTabId, dir, 0.5, newFirst);
        }
        return;
      }

      if (!e.shiftKey) return;

      if (e.key === 'C' || e.key === 'c') {
        // Ctrl+Shift+C: New terminal
        e.preventDefault();
        createTerminal().then(result => {
          if (!result) return;
          const { terminal } = result;
          useWorkspaceStore.getState().addTab(targetId, {
            id: terminal.id,
            label: terminal.label,
            contentType: 'terminal',
            status: 'running',
            shell: terminal.shell,
            cwd: terminal.cwd,
          });
        });
      } else if (e.key === 'A' || e.key === 'a') {
        // Ctrl+Shift+A: New Claude agent
        e.preventDefault();
        createAgent('claude').then(result => {
          if (!result) return;
          useWorkspaceStore.getState().addTab(targetId, {
            id: result.id,
            label: result.label,
            contentType: 'agent',
            runtimeId: result.runtimeId,
          });
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
            } else if (tab?.contentType === 'agent') {
              terminalApi.stop(tabId).catch(() => {});
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
      } else if (e.key === 'P' || e.key === 'p') {
        // Ctrl+Shift+P: New plugin tab
        e.preventDefault();
        const uid = Math.random().toString(36).slice(2, 10);
        useWorkspaceStore.getState().addTab(targetId, {
          id: `plugin-${uid}`,
          label: '插件',
          contentType: 'plugin',
          pluginId: 'markdown-viewer',
        });
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [focusedLeafId, setFocusedLeaf]);
}
