import { useEffect, useRef } from 'react';
import { listen } from '@tauri-apps/api/event';
import { useTerminalStore } from '../../../stores/terminalStore';
import { usePreviewStore } from '../../../stores/previewStore';
import { useLogStore } from '../../../stores/logStore';
import type { TerminalExitEvent, TerminalOutputEvent } from '../../../shared/terminalTypes';

// Regex patterns for detecting dev server URLs in terminal output
const URL_PATTERNS = [
  /Local:\s+(https?:\/\/[^\s]+)/,
  /- Local:\s+(https?:\/\/[^\s]+)/,
  /Network:\s+(https?:\/\/[^\s]+)/,
  /(https?:\/\/localhost:\d+[^\s]*)/,
];

export function useTerminalEvents() {
  const urlLastSeenRef = useRef<Set<string>>(new Set());
  // Per-terminal line buffer for log aggregation
  const lineBufferRef = useRef<Map<string, string>>(new Map());
  const flushTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  useEffect(() => {
    const unlistenExit = listen<TerminalExitEvent>('terminal-exit', (event) => {
      const { terminalId, code } = event.payload;
      if (terminalId.startsWith('agent-')) return;
      useTerminalStore.getState().updateTerminal(terminalId, { status: code === 0 ? 'exited' : 'error' });
      usePreviewStore.getState().removePreviewsByTerminal(terminalId);
      // Flush remaining buffer on exit
      flushBuffer(terminalId);
      lineBufferRef.current.delete(terminalId);
      const timer = flushTimersRef.current.get(terminalId);
      if (timer) { clearTimeout(timer); flushTimersRef.current.delete(terminalId); }
    }).catch(() => {});

    function flushBuffer(terminalId: string) {
      const buf = lineBufferRef.current.get(terminalId);
      if (!buf) return;
      lineBufferRef.current.set(terminalId, '');
      emitLogLine(terminalId, buf);
    }

    function emitLogLine(terminalId: string, line: string) {
      // eslint-disable-next-line no-control-regex
      const stripped = line.replace(/\x1b\[[0-9;]*[a-zA-Z]|\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)|[\x00-\x08\x0e-\x1f]/g, '').trimEnd();
      if (!stripped) return;
      const terminal = useTerminalStore.getState().terminals.find(t => t.id === terminalId);
      useLogStore.getState().addEntry({
        terminalId,
        terminalLabel: terminal?.label || terminalId,
        data: stripped,
        stream: 'stdout',
        timestamp: Date.now(),
      });
    }

    const unlistenOutput = listen<TerminalOutputEvent>('terminal-output', (event) => {
      const { data, terminalId } = event.payload;

      // URL detection for preview
      if (data.includes('http')) {
        for (const pattern of URL_PATTERNS) {
          const match = data.match(pattern);
          if (match) {
            const url = match[1] || match[0];
            if (urlLastSeenRef.current.has(url)) break;
            urlLastSeenRef.current.add(url);
            usePreviewStore.getState().addPreview(url, terminalId);
            break;
          }
        }
      }

      // Log capture — only non-interactive terminals (global-*) have clean output worth logging.
      // Interactive shells (term-*) include prompts, keystroke echo, cursor sequences — too noisy.
      if (terminalId.startsWith('agent-') || terminalId.startsWith('claude-') || terminalId.startsWith('term-')) return;

      // Buffer by line: accumulate chunks, flush on newline
      const prev = lineBufferRef.current.get(terminalId) || '';
      const combined = prev + data;
      const lines = combined.split(/\n/);

      // All segments except the last are complete lines — flush them
      for (let i = 0; i < lines.length - 1; i++) {
        emitLogLine(terminalId, lines[i]);
      }
      // Last segment is a partial line — keep buffering
      lineBufferRef.current.set(terminalId, lines[lines.length - 1]);

      // Debounce: flush partial line after 500ms of silence
      const existingTimer = flushTimersRef.current.get(terminalId);
      if (existingTimer) clearTimeout(existingTimer);
      flushTimersRef.current.set(terminalId, setTimeout(() => {
        flushTimersRef.current.delete(terminalId);
        flushBuffer(terminalId);
      }, 500));
    }).catch(() => {});

    return () => {
      flushTimersRef.current.forEach(t => clearTimeout(t));
      flushTimersRef.current.clear();
      lineBufferRef.current.clear();
      unlistenExit.then(fn => fn?.());
      unlistenOutput.then(fn => fn?.());
    };
  }, []);
}
