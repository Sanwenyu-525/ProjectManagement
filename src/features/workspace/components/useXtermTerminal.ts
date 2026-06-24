import { useEffect, useRef } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebglAddon } from '@xterm/addon-webgl';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { LigaturesAddon } from '@xterm/addon-ligatures';
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
      scrollback: 10000,
      lineHeight: 1.2,
      letterSpacing: 0.5,
      drawBoldTextInBrightColors: true,
      minimumContrastRatio: 1,
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(containerRef.current);
    term.focus();
    termRef.current = term;
    fitAddonRef.current = fitAddon;

    // Load enhanced addons (fail gracefully if unavailable)
    try { term.loadAddon(new WebLinksAddon()); } catch { /* optional */ }
    try {
      const webgl = new WebglAddon();
      webgl.onContextLoss(() => { webgl.dispose(); });
      term.loadAddon(webgl);
    } catch { /* fallback to canvas renderer */ }
    try { term.loadAddon(new LigaturesAddon()); } catch { /* optional */ }

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

    // Helper: send pasted text to PTY (via onData) if available, else write to display
    const sendPaste = (text: string) => {
      if (onDataRef.current) {
        onDataRef.current(text);
      } else {
        termRef.current?.write(text);
      }
    };

    // Track whether xterm has focus to gate document-level paste
    let xtermFocused = false;
    const onFocus = () => { xtermFocused = true; };
    const onBlur = () => { xtermFocused = false; };
    if (term.textarea) {
      term.textarea.addEventListener('focus', onFocus);
      term.textarea.addEventListener('blur', onBlur);
    }

    // Document-level paste — only forward to PTY when xterm has focus.
    // Without the focus guard, pasting into the text editor would also
    // send text to xterm via this global listener.
    const onDocPaste = (e: ClipboardEvent) => {
      if (!termRef.current) return;
      if (!xtermFocused) return;
      const text = e.clipboardData?.getData('text');
      if (text) {
        e.preventDefault();
        sendPaste(text);
      }
    };
    document.addEventListener('paste', onDocPaste);

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

    // Ctrl+V keyboard fallback — some Tauri WebView builds intercept the paste
    // event before xterm's textarea receives it. Reading the clipboard directly
    // on keydown ensures paste works regardless of WebView quirks.
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'v' && xtermFocused) {
        navigator.clipboard.readText()
          .then(text => { if (text) sendPaste(text); })
          .catch(() => {});
      }
    };
    document.addEventListener('keydown', onKeyDown);

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
      clearTimeout(fitTimer2);
      if (resizeTimer) clearTimeout(resizeTimer);
      if (rafId) cancelAnimationFrame(rafId);
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
        term.textarea.removeEventListener('focus', onFocus);
        term.textarea.removeEventListener('blur', onBlur);
      }
      document.removeEventListener('paste', onDocPaste);
      document.removeEventListener('keydown', onKeyDown);
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
