import { useEffect, useRef } from 'react';
import { useXtermTerminal } from './workspace/useXtermTerminal';
import { getThemeColors } from './terminalThemes';
import type { Terminal as TerminalType, TerminalTheme } from './terminalTypes';

interface TerminalInstanceProps {
  terminal: TerminalType;
  theme: TerminalTheme;
  isActive: boolean;
  onInput: (terminalId: string, data: string) => void;
  onExit?: (terminalId: string, code: number | null) => void;
}

export default function TerminalInstance({ terminal, theme, isActive, onInput, onExit }: TerminalInstanceProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const onExitRef = useRef(onExit);
  onExitRef.current = onExit;

  const { termRef, refit } = useXtermTerminal(containerRef, {
    terminalId: terminal.id,
    theme,
    onData: (data: string) => onInput(terminal.id, data),
    onExit: (code: number | null) => {
      if (termRef.current) {
        const exitMsg = code === 0
          ? '\r\n\x1b[32m✓ 进程正常退出\x1b[0m'
          : `\r\n\x1b[31m✗ 进程异常退出 (code: ${code})\x1b[0m`;
        termRef.current.write(exitMsg);
      }
      onExitRef.current?.(terminal.id, code);
    },
  });

  // Update theme when it changes
  useEffect(() => {
    if (termRef.current) {
      termRef.current.options.theme = getThemeColors(theme).colors;
    }
  }, [theme, termRef]);

  // Re-fit when becoming active (handles tab switching)
  useEffect(() => {
    if (isActive) {
      const timer = setTimeout(refit, 50);
      return () => clearTimeout(timer);
    }
  }, [isActive, refit]);

  return (
    <div
      ref={containerRef}
      style={{
        height: '100%',
        minHeight: 200,
        display: isActive ? 'block' : 'none',
      }}
    />
  );
}
