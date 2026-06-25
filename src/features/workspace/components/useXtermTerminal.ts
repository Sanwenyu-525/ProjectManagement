import { useEffect, useRef } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { LigaturesAddon } from '@xterm/addon-ligatures';
import { WebglAddon } from '@xterm/addon-webgl';
import { listen } from '@tauri-apps/api/event';
import { terminalApi } from '../../../api';
import { getThemeColors } from '../../../shared/terminalThemes';
import type { TerminalTheme, TerminalOutputEvent, TerminalExitEvent } from '../../../shared/terminalTypes';
import '@xterm/xterm/css/xterm.css';

interface XtermOptions {
  terminalId: string;
  theme: TerminalTheme;
  /** 当 false 时不创建终端（用于 terminalId 尚未就绪时）。默认 true */
  enabled?: boolean;
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

  const { terminalId, theme, enabled = true } = options;

  useEffect(() => {
    if (!enabled || !containerRef.current) return;

    const term = new Terminal({
      cursorBlink: true,
      cursorStyle: 'bar',
      cursorWidth: 2,
      fontSize: 13,
      fontFamily: "'Cascadia Code', 'Fira Code', 'JetBrains Mono', Consolas, monospace",
      theme: getThemeColors(theme).colors,
      allowProposedApi: true,
      scrollback: 5000,
      lineHeight: 1.2,
      letterSpacing: 0.5,
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(containerRef.current);
    term.focus();
    termRef.current = term;
    fitAddonRef.current = fitAddon;

    // Load enhanced addons (fail gracefully if unavailable)
    try { term.loadAddon(new WebLinksAddon()); } catch { /* optional */ }
    try { term.loadAddon(new LigaturesAddon()); } catch { /* optional */ }

    // WebGL renderer: better truecolor support for ANSI art (e.g. Claude logo)
    let webglAddon: WebglAddon | null = null;
    try {
      webglAddon = new WebglAddon();
      term.loadAddon(webglAddon);
    } catch { /* fall back to canvas renderer */ }

    // xterm.js CompositionHelper handles IME natively:
    // - compositionstart/update: shows composing text in .composition-view
    // - compositionend → _finalizeComposition → triggerDataEvent (single send)
    // - keydown(229): blocks during composition, defers to compositionend
    // No custom composition handling needed — adding one causes double-input.
    // Intercept Ctrl+V to prevent xterm's internal paste handling — we handle
    // paste ourselves via the document keydown handler below.
    term.attachCustomKeyEventHandler((e: KeyboardEvent) => {
      if (e.type === 'keydown' && (e.ctrlKey || e.metaKey) && e.key === 'v') return false;
      return true;
    });

    // Helper: send pasted text to PTY (via onData) if available, else write to display
    const sendPaste = (text: string) => {
      if (onDataRef.current) {
        onDataRef.current(text);
      } else {
        termRef.current?.write(text);
      }
    };

    // Track whether xterm has focus to gate keydown paste
    let xtermFocused = false;
    const onFocus = () => { xtermFocused = true; };
    const onBlur = () => { xtermFocused = false; };
    if (term.textarea) {
      term.textarea.addEventListener('focus', onFocus);
      term.textarea.addEventListener('blur', onBlur);
    }

    // Ctrl+V paste — clipboard read in keydown handler (user gesture context).
    // xterm's internal paste relies on the browser paste event which may not
    // fire in some Tauri WebView builds. Reading the clipboard directly on
    // keydown ensures paste works regardless of WebView quirks.
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'v' && xtermFocused) {
        e.preventDefault();
        navigator.clipboard.readText()
          .then(text => { if (text) sendPaste(text); })
          .catch(() => {});
      }
    };
    document.addEventListener('keydown', onKeyDown);

    // Right-click paste (only when no text is selected)
    const onContextMenu = (e: MouseEvent) => {
      const selection = termRef.current?.getSelection();
      if (!selection) {
        e.preventDefault();
        // Try Clipboard API first; fall back silently if permission denied
        navigator.clipboard.readText()
          .then(text => { if (text) sendPaste(text); })
          .catch(() => {});
      }
    };

    if (term.textarea) {
      term.textarea.addEventListener('contextmenu', onContextMenu);
    }

    // Fit after flex layout settles (tab switch / first render)
    const fitTimer = setTimeout(() => {
      fitAddon.fit();
      const dims = fitAddon.proposeDimensions();
      if (dims) terminalApi.resize(terminalId, dims.cols, dims.rows).catch(() => {});
    }, 350);

    // Second fit for slow layout settling
    const fitTimer2 = setTimeout(() => {
      if (fitAddonRef.current && termRef.current) {
        fitAddonRef.current.fit();
        const dims = fitAddonRef.current.proposeDimensions();
        if (dims) terminalApi.resize(terminalId, dims.cols, dims.rows).catch(() => {});
      }
    }, 1000);

    let resizeTimer: ReturnType<typeof setTimeout> | null = null;
    let rafId = 0;
    const observer = new ResizeObserver(() => {
      // Cancel any pending fit so only the latest resize triggers one
      if (rafId) cancelAnimationFrame(rafId);
      // Double-rAF: first frame lets browser flush layout, second reads final dimensions
      rafId = requestAnimationFrame(() => {
        rafId = requestAnimationFrame(() => {
          if (fitAddonRef.current && termRef.current) {
            fitAddonRef.current.fit();
            if (resizeTimer) clearTimeout(resizeTimer);
            resizeTimer = setTimeout(() => {
              const dims = fitAddonRef.current?.proposeDimensions();
              if (dims) terminalApi.resize(terminalId, dims.cols, dims.rows).catch(() => {});
            }, 50);
          }
        });
      });
    });
    observer.observe(containerRef.current);

    // Stdin handler (only for interactive terminals, not agents)
    const inputDisposable = onDataRef.current
      ? term.onData((data) => { onDataRef.current!(data); })
      : null;

    let cwdDebounce: ReturnType<typeof setTimeout> | null = null;
    let lastDetectedCwd = '';
    let titleDebounce: ReturnType<typeof setTimeout> | null = null;

    // RAF-batched write buffer — coalesces multiple terminal-output events per frame
    let writeBuffer = '';
    let writeRafId = 0;
    const flushWrite = () => {
      writeRafId = 0;
      if (writeBuffer) {
        term.write(writeBuffer);
        writeBuffer = '';
      }
    };

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

      writeBuffer += data;
      if (!writeRafId) writeRafId = requestAnimationFrame(flushWrite);

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
      clearTimeout(fitTimer2);
      if (resizeTimer) clearTimeout(resizeTimer);
      if (rafId) cancelAnimationFrame(rafId);
      if (writeRafId) cancelAnimationFrame(writeRafId);
      if (cwdDebounce) clearTimeout(cwdDebounce);
      if (titleDebounce) clearTimeout(titleDebounce);
      observer.disconnect();
      inputDisposable?.dispose();
      unlistenOutput.then(fn => fn());
      unlistenExit.then(fn => fn());
      if (term.textarea) {
        term.textarea.removeEventListener('contextmenu', onContextMenu);
      }
      document.removeEventListener('keydown', onKeyDown);
      webglAddon?.dispose();
      term.dispose();
      termRef.current = null;
      fitAddonRef.current = null;
    };
  }, [enabled, terminalId, theme]); // eslint-disable-line react-hooks/exhaustive-deps

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
