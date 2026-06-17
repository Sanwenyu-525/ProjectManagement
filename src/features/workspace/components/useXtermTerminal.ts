import { useEffect, useRef } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { listen } from '@tauri-apps/api/event';
import { terminalApi } from '../../../api';
import { getThemeColors } from '../../../shared/terminalThemes';
import type { TerminalTheme, TerminalOutputEvent, TerminalExitEvent } from '../../../shared/terminalTypes';
import '@xterm/xterm/css/xterm.css';

interface XtermOptions {
  terminalId: string;
  theme: TerminalTheme;
  /** Called when user types input (terminal stdin). Omit for non-interactive (agent) use. */
  onData?: (data: string) => void;
  /** Called when the PTY process exits. */
  onExit?: (code: number | null) => void;
  /** Called when a directory change is detected from shell output. */
  onCwdChange?: (cwd: string) => void;
  /** Called when the shell sets a title (OSC 0/2) — usually the running program name. */
  onTitleChange?: (title: string) => void;
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
  const onCwdChangeRef = useRef(options.onCwdChange);
  const onTitleChangeRef = useRef(options.onTitleChange);
  onDataRef.current = options.onData;
  onExitRef.current = options.onExit;
  onCwdChangeRef.current = options.onCwdChange;
  onTitleChangeRef.current = options.onTitleChange;

  const { terminalId, theme } = options;

  useEffect(() => {
    if (!containerRef.current) return;

    const term = new Terminal({
      cursorBlink: false,
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

    // IME composition guard — suppress onData during IME candidate selection
    let composing = false;
    let compositionData = '';
    // On Windows, keydown may fire before IME sets isComposing, causing xterm to
    // process the key via onData. compositionend then also sends the character.
    // This flag blocks the onData that fires right after compositionend.
    let justComposed = false;
    const onCompositionStart = () => { composing = true; compositionData = ''; justComposed = false; };
    const onCompositionEnd = (e: CompositionEvent) => {
      composing = false;
      const text = e.data || compositionData;
      compositionData = '';
      if (text && onDataRef.current) onDataRef.current(text);
      // Block the next onData call (from xterm processing the same character)
      justComposed = true;
      setTimeout(() => { justComposed = false; }, 0);
    };
    const onCompositionUpdate = (e: CompositionEvent) => {
      compositionData = e.data || '';
    };
    if (term.textarea) {
      term.textarea.addEventListener('compositionstart', onCompositionStart);
      term.textarea.addEventListener('compositionend', onCompositionEnd);
      term.textarea.addEventListener('compositionupdate', onCompositionUpdate);
    }
    // Block key events during composition so xterm doesn't insert raw keycodes
    term.attachCustomKeyEventHandler((e: KeyboardEvent) => {
      if (e.type === 'keydown' && e.isComposing) return false;
      return true;
    });

    // Right-click paste (only when no text is selected)
    const onContextMenu = (e: MouseEvent) => {
      const selection = termRef.current?.getSelection();
      if (!selection) {
        e.preventDefault();
        navigator.clipboard.readText()
          .then(text => { if (text && termRef.current) termRef.current.write(text); })
          .catch(() => {});
      }
    };

    if (term.textarea) {
      term.textarea.addEventListener('contextmenu', onContextMenu);
    }

    const fitTimer = setTimeout(() => {
      fitAddon.fit();
      // Immediately sync PTY dimensions so child process sees correct size from the start
      const dims = fitAddon.proposeDimensions();
      if (dims) terminalApi.resize(terminalId, dims.cols, dims.rows).catch(() => {});
    }, 350);

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
      ? term.onData((data) => { if (!composing && !justComposed) onDataRef.current!(data); })
      : null;

    let cwdDebounce: ReturnType<typeof setTimeout> | null = null;
    let lastDetectedCwd = '';
    let titleDebounce: ReturnType<typeof setTimeout> | null = null;

    const unlistenOutput = listen<TerminalOutputEvent>('terminal-output', (event) => {
      if (event.payload.terminalId !== terminalId) return;
      let data = event.payload.data;

      // Detect OSC 0 / OSC 2 title sequences: ESC ] 0;title BEL  or  ESC ] 2;title BEL(ST)
      if (onTitleChangeRef.current) {
        const oscMatch = data.match(/\x1b\]0;([^\x07\x1b]*)/);
        if (oscMatch) {
          const title = oscMatch[1].trim();
          if (title) {
            if (titleDebounce) clearTimeout(titleDebounce);
            titleDebounce = setTimeout(() => onTitleChangeRef.current?.(title), 300);
          }
        }
        // Strip OSC sequences before writing to xterm
        data = data.replace(/\x1b\][02];[^\x07\x1b]*(?:\x07|\x1b\\)/g, '');
      }

      term.write(data);

      // Detect cwd from shell prompts
      if (onCwdChangeRef.current) {
        let detected: string | null = null;
        const psMatch = data.match(/PS\s+([A-Za-z]:\\[^\n\r]+?)\s*>/);
        if (psMatch) {
          detected = psMatch[1].replace(/[\\]+$/, '');
        } else {
          const cmdMatch = data.match(/([A-Za-z]:\\[^\s>]+)\s*>/);
          if (cmdMatch) {
            detected = cmdMatch[1];
          } else {
            const bashMatch = data.match(/[~\/][^\s$#]*[\$#]\s?$/);
            if (bashMatch) {
              detected = bashMatch[0].replace(/[\$#]\s?$/, '').trim();
            }
          }
        }
        if (detected && detected !== lastDetectedCwd) {
          lastDetectedCwd = detected;
          if (cwdDebounce) clearTimeout(cwdDebounce);
          cwdDebounce = setTimeout(() => onCwdChangeRef.current?.(detected!), 300);
        }
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
      if (cwdDebounce) clearTimeout(cwdDebounce);
      if (titleDebounce) clearTimeout(titleDebounce);
      observer.disconnect();
      inputDisposable?.dispose();
      unlistenOutput.then(fn => fn());
      unlistenExit.then(fn => fn());
      if (term.textarea) {
        term.textarea.removeEventListener('compositionstart', onCompositionStart);
        term.textarea.removeEventListener('compositionend', onCompositionEnd);
        term.textarea.removeEventListener('compositionupdate', onCompositionUpdate);
        term.textarea.removeEventListener('contextmenu', onContextMenu);
      }
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
