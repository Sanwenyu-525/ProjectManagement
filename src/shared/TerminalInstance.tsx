import { useEffect, useRef } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { listen } from '@tauri-apps/api/event';
import { Terminal as TerminalType, TerminalTheme, TerminalOutputEvent, TerminalExitEvent } from './terminalTypes';
import { getThemeColors } from './terminalThemes';
import '@xterm/xterm/css/xterm.css';

interface TerminalInstanceProps {
  terminal: TerminalType;
  theme: TerminalTheme;
  isActive: boolean;
  onInput: (terminalId: string, data: string) => void;
}

export default function TerminalInstance({ terminal, theme, isActive, onInput }: TerminalInstanceProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);

  // Initialize xterm.js terminal
  useEffect(() => {
    if (!containerRef.current) return;

    const term = new Terminal({
      cursorBlink: true,
      fontSize: 13,
      fontFamily: "'Cascadia Code', 'Fira Code', 'JetBrains Mono', Consolas, monospace",
      theme: getThemeColors(theme).colors,
      allowProposedApi: true,
      scrollback: 10000,
      disableStdin: false,
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);

    term.open(containerRef.current);
    fitAddon.fit();

    termRef.current = term;
    fitAddonRef.current = fitAddon;

    // Handle user input
    const inputDisposable = term.onData((data) => {
      onInput(terminal.id, data);
    });

    // Listen for terminal output events
    const unlistenOutput = listen<TerminalOutputEvent>('terminal-output', (event) => {
      if (event.payload.terminalId === terminal.id) {
        term.write(event.payload.data);
      }
    });

    // Listen for terminal exit events
    const unlistenExit = listen<TerminalExitEvent>('terminal-exit', (event) => {
      if (event.payload.terminalId === terminal.id) {
        const code = event.payload.code;
        const exitMsg = code === 0
          ? '\r\n\x1b[32m✓ 进程正常退出\x1b[0m'
          : `\r\n\x1b[31m✗ 进程异常退出 (code: ${code})\x1b[0m`;
        term.write(exitMsg);
      }
    });

    return () => {
      inputDisposable.dispose();
      unlistenOutput.then((fn) => fn());
      unlistenExit.then((fn) => fn());
      term.dispose();
      termRef.current = null;
      fitAddonRef.current = null;
    };
  }, [terminal.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Update theme when it changes
  useEffect(() => {
    if (termRef.current) {
      termRef.current.options.theme = getThemeColors(theme).colors;
    }
  }, [theme]);

  // Fit terminal when becoming active
  useEffect(() => {
    if (isActive && fitAddonRef.current) {
      // Delay fit to ensure container is visible
      const timer = setTimeout(() => {
        fitAddonRef.current?.fit();
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [isActive]);

  return (
    <div
      ref={containerRef}
      style={{
        height: '100%',
        minHeight: 300,
        display: isActive ? 'block' : 'none',
      }}
    />
  );
}
