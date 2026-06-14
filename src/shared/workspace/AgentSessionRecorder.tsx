/**
 * Headless component that records agent terminal I/O to the database.
 *
 * Listens to terminal-output and terminal-exit events, creates session
 * records on first output, and batches messages for efficient DB writes.
 *
 * Mounted once in WorkspacePage alongside AutomationRouter.
 */
import { useEffect, useRef } from 'react';
import { listen } from '@tauri-apps/api/event';
import { useWorkspaceStore } from '../../stores/workspaceStore';
import { sessionsApi } from '../../api';
import type { TerminalOutputEvent, TerminalExitEvent } from '../terminalTypes';

const FLUSH_INTERVAL = 500; // ms

export default function AgentSessionRecorder() {
  const tabs = useWorkspaceStore(s => s.tabs);
  const agentIdsRef = useRef<Set<string>>(new Set());
  // agentTabId → sessionId mapping
  const sessionMapRef = useRef<Map<string, string>>(new Map());
  // Buffered messages per session: sessionId → { role, content }[]
  const bufferRef = useRef<Map<string, Array<{ role: string; content: string }>>>(new Map());
  const flushTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Keep agent tab IDs cached
  useEffect(() => {
    const ids = new Set(
      Object.values(tabs).filter(t => t.contentType === 'agent').map(t => t.id),
    );
    agentIdsRef.current = ids;
  }, [tabs]);

  // Flush buffered messages to DB periodically
  useEffect(() => {
    flushTimerRef.current = setInterval(() => {
      flushBuffers();
    }, FLUSH_INTERVAL);
    return () => {
      if (flushTimerRef.current) clearInterval(flushTimerRef.current);
      flushBuffers(); // final flush
    };
  }, []);

  const flushBuffers = () => {
    for (const [sessionId, messages] of bufferRef.current.entries()) {
      if (messages.length === 0) continue;
      const batch = messages.splice(0, messages.length);
      // Write each message (could batch into a single API call in the future)
      for (const msg of batch) {
        sessionsApi.appendMessage(sessionId, msg.role, msg.content).catch(() => {});
      }
    }
  };

  const ensureSession = async (agentTabId: string): Promise<string | null> => {
    // Return existing session
    const existing = sessionMapRef.current.get(agentTabId);
    if (existing) return existing;

    // Create new session
    const tab = useWorkspaceStore.getState().tabs[agentTabId];
    const runtimeId = (tab && 'runtimeId' in tab) ? (tab.runtimeId as string) || 'claude' : 'claude';

    try {
      const sessionId = await sessionsApi.start(agentTabId, runtimeId);
      sessionMapRef.current.set(agentTabId, sessionId);
      bufferRef.current.set(sessionId, []);
      return sessionId;
    } catch {
      return null;
    }
  };

  // Listen for terminal output from agent tabs
  useEffect(() => {
    const unlisten = listen<TerminalOutputEvent>('terminal-output', (event) => {
      const { terminalId, data } = event.payload;
      if (!agentIdsRef.current.has(terminalId)) return;

      // Ensure session exists, then buffer the output
      ensureSession(terminalId).then(sessionId => {
        if (!sessionId) return;
        const buf = bufferRef.current.get(sessionId);
        if (buf) {
          buf.push({ role: 'output', content: data });
        }
      });
    });
    return () => { unlisten.then(fn => fn()); };
  }, []);

  // Listen for agent terminal exit — end the session
  useEffect(() => {
    const unlisten = listen<TerminalExitEvent>('terminal-exit', (event) => {
      const { terminalId } = event.payload;
      const sessionId = sessionMapRef.current.get(terminalId);
      if (!sessionId) return;

      // Flush remaining messages then end session
      const buf = bufferRef.current.get(sessionId);
      if (buf) {
        for (const msg of buf.splice(0, buf.length)) {
          sessionsApi.appendMessage(sessionId, msg.role, msg.content).catch(() => {});
        }
      }
      sessionsApi.end(sessionId).catch(() => {});
      sessionMapRef.current.delete(terminalId);
      bufferRef.current.delete(sessionId);
    });
    return () => { unlisten.then(fn => fn()); };
  }, []);

  return null;
}
