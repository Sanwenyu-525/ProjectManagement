import { useEffect, useRef } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { listen } from '@tauri-apps/api/event';
import '@xterm/xterm/css/xterm.css';

interface TerminalOutputEvent {
  terminalId: string;
  data: string;
  stream: string;
}

interface TerminalExitEvent {
  terminalId: string;
  code: number | null;
}

interface TerminalPanelProps {
  terminalId: string | null;
}

export default function TerminalPanel({ terminalId }: TerminalPanelProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);

  // Initialize xterm instance
  useEffect(() => {
    if (!containerRef.current) return;

    const term = new Terminal({
      cursorBlink: false,
      disableStdin: true,
      fontSize: 13,
      fontFamily: "'Cascadia Code', 'Fira Code', 'JetBrains Mono', Consolas, monospace",
      theme: {
        background: '#0d1117',
        foreground: '#c9d1d9',
        cursor: '#58a6ff',
        selectionBackground: '#264f78',
        black: '#484f58',
        red: '#ff7b72',
        green: '#3fb950',
        yellow: '#d29922',
        blue: '#58a6ff',
        magenta: '#bc8cff',
        cyan: '#39d353',
        white: '#b1bac4',
        brightBlack: '#6e7681',
        brightRed: '#ffa198',
        brightGreen: '#56d364',
        brightYellow: '#e3b341',
        brightBlue: '#79c0ff',
        brightMagenta: '#d2a8ff',
        brightCyan: '#56d364',
        brightWhite: '#f0f6fc',
      },
      allowProposedApi: true,
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);

    term.open(containerRef.current);
    fitAddon.fit();

    terminalRef.current = term;
    fitAddonRef.current = fitAddon;

    // Resize observer
    const observer = new ResizeObserver(() => {
      fitAddon.fit();
    });
    observer.observe(containerRef.current);

    return () => {
      observer.disconnect();
      term.dispose();
      terminalRef.current = null;
      fitAddonRef.current = null;
    };
  }, []);

  // Listen for terminal output events
  useEffect(() => {
    if (!terminalId || !terminalRef.current) return;

    const term = terminalRef.current;

    // Clear previous content when terminalId changes
    term.clear();

    const unlistenOutput = listen<TerminalOutputEvent>('terminal-output', (event) => {
      if (event.payload.terminalId === terminalId) {
        term.write(event.payload.data);
      }
    });

    const unlistenExit = listen<TerminalExitEvent>('terminal-exit', (event) => {
      if (event.payload.terminalId === terminalId) {
        const code = event.payload.code;
        term.write(`\r\n\x1b[${code === 0 ? '32' : '31'}m▸ 进程退出，代码 ${code}\x1b[0m\r\n`);
      }
    });

    return () => {
      unlistenOutput.then(fn => fn());
      unlistenExit.then(fn => fn());
    };
  }, [terminalId]);

  return (
    <div
      ref={containerRef}
      style={{
        height: '100%',
        minHeight: 300,
        borderRadius: 8,
        overflow: 'hidden',
        background: '#0d1117',
      }}
    />
  );
}
