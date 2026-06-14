/**
 * Top-level automation command router.
 *
 * Listens to terminal-output events once (not per BrowserPane),
 * parses automation commands, and dispatches them to the active
 * browser adapter.
 *
 * Mounted in WorkspacePage alongside other global listeners.
 */
import { useEffect, useRef } from 'react';
import { listen } from '@tauri-apps/api/event';
import { useWorkspaceStore } from '../../stores/workspaceStore';
import { getBrowserAdapter } from './browser';
import { parseCommand, AUTOMATION_CMD_RE } from './browser/commands';
import type { TerminalOutputEvent } from '../terminalTypes';

let cmdId = 0;

export default function AutomationRouter() {
  const tabs = useWorkspaceStore(s => s.tabs);
  const agentIdsRef = useRef<Set<string>>(new Set());

  // Keep all agent tab IDs cached
  useEffect(() => {
    const ids = new Set(
      Object.values(tabs).filter(t => t.contentType === 'agent').map(t => t.id),
    );
    agentIdsRef.current = ids;
  }, [tabs]);

  useEffect(() => {
    const adapter = getBrowserAdapter();

    const unlisten = listen<TerminalOutputEvent>('terminal-output', (event) => {
      const { terminalId, data } = event.payload;
      if (!agentIdsRef.current.has(terminalId)) return;

      const match = data.match(AUTOMATION_CMD_RE);
      if (!match) return;
      const [, targetTabId, action, argsStr] = match;

      const command = parseCommand(action, argsStr, ++cmdId);
      if (!command) return;

      adapter.executeCommand(targetTabId, command);
    });
    return () => { unlisten.then(fn => fn()); };
  }, []);

  return null;
}
