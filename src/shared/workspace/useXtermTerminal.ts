import { useEffect, useRef } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { listen } from '@tauri-apps/api/event';
import { terminalApi } from '../../api';
import { getThemeColors } from '../terminalThemes';
import type { TerminalTheme, TerminalOutputEvent, TerminalExitEvent } from '../terminalTypes';
import '@xterm/xterm/css/xterm.css';

interface XtermOptions {
  terminalId: string;
  theme: TerminalTheme;
  /** Called when user types input (terminal stdin). Omit for non-interactive (agent) use. */
  onData?: (data: string) => void;
  /** Called when the PTY process exits. */
  onExit?: (code: number | null) => void;
}

/**
 * Shared xterm.js lifecycle hook used by both TerminalInstance and AgentPane.
 * Manages terminal creation, fit addon, resize observer, PTY event listeners, and cleanup.
 */
export function useXtermTerminal(
  containerRef: React.RefObject<HTMLDivElement | null>,
  options: XtermOptions,
) {
  const termRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const onDataRef = useRef(options.onData);
  const onExitRef = useRef(options.onExit);
  onDataRef.current = options.onData;
  onExitRef.current = options.onExit;

  const { terminalId, theme } = options;

  useEffect(() => {
    if (!containerRef.current) return;

    const term = new Terminal({
      cursorBlink: true,
      fontSize: 13,
      fontFamily: "'Cascadia Code', 'Fira Code', 'JetBrains Mono', Consolas, monospace",
      theme: getThemeColors(theme).colors,
      allowProposedApi: true,
      scrollback: 10000,
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(containerRef.current);
    termRef.current = term;
    fitAddonRef.current = fitAddon;

    const fitTimer = setTimeout(() => fitAddon.fit(), 350);

    let resizeTimer: ReturnType<typeof setTimeout> | null = null;
    const observer = new ResizeObserver(() => {
      if (fitAddonRef.current && termRef.current) {
        fitAddonRef.current.fit();
        if (resizeTimer) clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => {
          const dims = fitAddonRef.current?.proposeDimensions();
          if (dims) terminalApi.resize(terminalId, dims.cols, dims.rows).catch(() => {});
        }, 100);
      }
    });
    observer.observe(containerRef.current);

    // Stdin handler (only for interactive terminals, not agents)
    const inputDisposable = onDataRef.current
      ? term.onData((data) => onDataRef.current!(data))
      : null;

    const unlistenOutput = listen<TerminalOutputEvent>('terminal-output', (event) => {
      if (event.payload.terminalId === terminalId) {
        term.write(event.payload.data);
      }
    });

    const unlistenExit = listen<TerminalExitEvent>('terminal-exit', (event) => {
      if (event.payload.terminalId === terminalId) {
        onExitRef.current?.(event.payload.code);
      }
    });

    return () => {
      clearTimeout(fitTimer);
      if (resizeTimer) clearTimeout(resizeTimer);
      observer.disconnect();
      inputDisposable?.dispose();
      unlistenOutput.then(fn => fn());
      unlistenExit.then(fn => fn());
      term.dispose();
      termRef.current = null;
      fitAddonRef.current = null;
    };
  }, [terminalId, theme]); // eslint-disable-line react-hooks/exhaustive-deps

  // Re-fit when needed (e.g. tab becoming active, status change)
  const refit = () => {
    if (fitAddonRef.current && termRef.current) {
      fitAddonRef.current.fit();
      const dims = fitAddonRef.current?.proposeDimensions();
      if (dims) terminalApi.resize(terminalId, dims.cols, dims.rows).catch(() => {});
    }
  };

  return { termRef, fitAddonRef, refit };
}
