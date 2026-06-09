import { useEffect, useRef } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { listen } from '@tauri-apps/api/event';
import { PlusOutlined, ClearOutlined } from '@ant-design/icons';
import { terminalApi } from '../api';
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

interface GlobalTerminalPanelProps {
  visible: boolean;
}

export default function GlobalTerminalPanel({ visible }: GlobalTerminalPanelProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const terminalIdRef = useRef<string | null>(null);

  // Initialize xterm instance once
  useEffect(() => {
    if (!containerRef.current) return;

    const term = new Terminal({
      cursorBlink: true,
      fontSize: 13,
      fontFamily: "'Cascadia Code', 'Fira Code', 'JetBrains Mono', Consolas, monospace",
      theme: {
        background: '#1e1e1e',
        foreground: '#cccccc',
        cursor: '#ffffff',
        cursorAccent: '#1e1e1e',
        selectionBackground: '#264f78',
        selectionForeground: '#ffffff',
        black: '#000000',
        red: '#cd3131',
        green: '#0dbc79',
        yellow: '#e5e510',
        blue: '#2472c8',
        magenta: '#bc3fbc',
        cyan: '#11a8cd',
        white: '#e5e5e5',
        brightBlack: '#666666',
        brightRed: '#f14c4c',
        brightGreen: '#23d18b',
        brightYellow: '#f5f543',
        brightBlue: '#3b8eea',
        brightMagenta: '#d670d6',
        brightCyan: '#29b8db',
        brightWhite: '#ffffff',
      },
      allowProposedApi: true,
      scrollback: 10000,
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);

    term.open(containerRef.current);
    fitAddon.fit();

    terminalRef.current = term;
    fitAddonRef.current = fitAddon;

    // Handle user input → send to backend
    const inputDisposable = term.onData((data) => {
      if (terminalIdRef.current) {
        terminalApi.input(terminalIdRef.current, data);
      }
    });

    // Resize observer
    const observer = new ResizeObserver(() => {
      fitAddon.fit();
    });
    observer.observe(containerRef.current);

    return () => {
      inputDisposable.dispose();
      observer.disconnect();
      term.dispose();
      terminalRef.current = null;
      fitAddonRef.current = null;
    };
  }, []);

  // Start/stop terminal when visible changes
  useEffect(() => {
    if (!visible) {
      if (terminalIdRef.current) {
        terminalApi.stop(terminalIdRef.current).catch(() => {});
        terminalIdRef.current = null;
      }
      return;
    }

    const startShell = async () => {
      const term = terminalRef.current;
      if (!term) return;

      const isWin = navigator.platform.includes('Win');
      const shell = isWin ? 'powershell.exe' : 'bash';
      const cwd = isWin
        ? (import.meta.env.USERPROFILE || 'C:\\')
        : (import.meta.env.HOME || '/');

      const tid = `global-${Math.random().toString(36).slice(2, 10)}`;
      terminalIdRef.current = tid;

      try {
        await terminalApi.startShell(tid, shell, cwd);
      } catch (e) {
        term.write(`\r\n\x1b[31m▸ 启动失败: ${String(e)}\x1b[0m\r\n`);
      }
    };

    startShell();
  }, [visible]);

  // Listen for terminal output events
  useEffect(() => {
    const term = terminalRef.current;
    if (!term) return;

    const unlistenOutput = listen<TerminalOutputEvent>('terminal-output', (event) => {
      if (event.payload.terminalId === terminalIdRef.current) {
        term.write(event.payload.data);
      }
    });

    const unlistenExit = listen<TerminalExitEvent>('terminal-exit', (event) => {
      if (event.payload.terminalId === terminalIdRef.current) {
        const code = event.payload.code;
        term.write(`\r\n\x1b[${code === 0 ? '32' : '31'}m▸ 进程退出，代码 ${code}\x1b[0m\r\n`);
        terminalIdRef.current = null;
      }
    });

    return () => {
      unlistenOutput.then(fn => fn());
      unlistenExit.then(fn => fn());
    };
  }, []);

  // Fit terminal when becoming visible
  useEffect(() => {
    if (visible && fitAddonRef.current) {
      const timer = setTimeout(() => fitAddonRef.current?.fit(), 300);
      return () => clearTimeout(timer);
    }
  }, [visible]);

  const handleClear = () => {
    terminalRef.current?.clear();
  };

  const handleNewShell = async () => {
    // Stop old shell
    if (terminalIdRef.current) {
      await terminalApi.stop(terminalIdRef.current).catch(() => {});
      terminalIdRef.current = null;
    }
    terminalRef.current?.clear();

    const term = terminalRef.current;
    if (!term) return;

    const isWin = navigator.platform.includes('Win');
    const shell = isWin ? 'powershell.exe' : 'bash';
    const cwd = isWin
      ? (import.meta.env.USERPROFILE || 'C:\\')
      : (import.meta.env.HOME || '/');

    const tid = `global-${Math.random().toString(36).slice(2, 10)}`;
    terminalIdRef.current = tid;

    try {
      await terminalApi.startShell(tid, shell, cwd);
    } catch (e) {
      term.write(`\r\n\x1b[31m▸ 启动失败: ${String(e)}\x1b[0m\r\n`);
    }
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      background: '#1e1e1e',
      borderRadius: '12px 12px 0 0',
      overflow: 'hidden',
    }}>
      {/* Header bar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        height: 36,
        padding: '0 12px',
        background: '#252526',
        borderBottom: '1px solid #3c3c3c',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: '#cccccc', letterSpacing: '0.3px' }}>
            终端
          </span>
          <div style={{ display: 'flex', gap: 4 }}>
            <button
              onClick={handleNewShell}
              style={{
                background: 'none',
                border: 'none',
                color: '#999',
                cursor: 'pointer',
                padding: '3px 6px',
                borderRadius: 4,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.1s',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = '#3c3c3c'; e.currentTarget.style.color = '#fff'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = '#999'; }}
              title="新建终端"
            >
              <PlusOutlined style={{ fontSize: 12 }} />
            </button>
            <button
              onClick={handleClear}
              style={{
                background: 'none',
                border: 'none',
                color: '#999',
                cursor: 'pointer',
                padding: '3px 6px',
                borderRadius: 4,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.1s',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = '#3c3c3c'; e.currentTarget.style.color = '#fff'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = '#999'; }}
              title="清屏"
            >
              <ClearOutlined style={{ fontSize: 12 }} />
            </button>
          </div>
        </div>
        <span style={{ fontSize: 11, color: '#666' }}>powershell</span>
      </div>

      {/* Terminal viewport */}
      <div
        ref={containerRef}
        style={{
          flex: 1,
          padding: '8px 4px',
          overflow: 'hidden',
        }}
      />
    </div>
  );
}
