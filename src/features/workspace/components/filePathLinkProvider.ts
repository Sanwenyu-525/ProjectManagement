import type { ILinkProvider, ILink, Terminal } from '@xterm/xterm';
import { useTerminalStore } from '../../../stores/terminalStore';
import { useWorkspaceStore } from '../../../stores/workspaceStore';

// Matches file paths with optional :line and :column suffixes.
// Captures: (driveOrDot)(pathSep+pathBody)(line)(col)
// - driveOrDot: drive letter + colon (C:) or dot (./) or just a separator (/ or \)
// - pathBody: path segments separated by / or \, ending in a filename with extension
// - line/col: optional :123 and :456
// Excludes URLs (http:// etc.) via negative lookahead.
const FILE_PATH_RE =
  /(?!(?:https?|ftp|file):\/\/)((?:[A-Za-z]:|\.)(?:[\\/][^\s\0"':<>|*?]+)+[\\/]?)(?::(\d+))?(?::(\d+))?/g;

// Common source/config extensions to reduce false positives
const EXT_RE = /\.\w{1,10}$/;

// Limit per-line matches to avoid pathological lines
const MAX_MATCHES_PER_LINE = 5;

const resolvedCache = new Map<string, string | null>();
const CACHE_LIMIT = 500;

function trimTrailingPunctuation(path: string): string {
  // Remove trailing punctuation that's unlikely part of a real path
  return path.replace(/[),;}\]>]+$/, '');
}

function resolveFilePath(rawMatch: string, terminalId: string): string | null {
  const trimmed = trimTrailingPunctuation(rawMatch);
  const cached = resolvedCache.get(trimmed);
  if (cached !== undefined) return cached;

  let resolved: string | null = null;
  const term = useTerminalStore.getState().terminals.find(t => t.id === terminalId);
  const cwd = term?.cwd;

  if (/^[A-Za-z]:[\\/]/.test(trimmed)) {
    // Absolute Windows path: C:\foo\bar.ts
    resolved = trimmed.replace(/\//g, '\\');
  } else if (cwd) {
    // Relative path: resolve against terminal cwd
    const stripped = trimmed.replace(/^\.[\\/]/, '');
    if (/^[A-Za-z]:[\\/]/.test(cwd)) {
      resolved = cwd + '\\' + stripped.replace(/\//g, '\\');
    } else {
      resolved = cwd + '/' + stripped;
    }
  }

  if (resolvedCache.size >= CACHE_LIMIT) resolvedCache.clear();
  resolvedCache.set(trimmed, resolved);
  return resolved;
}

export function createFilePathLinkProvider(
  term: Terminal,
  terminalId: string,
): ILinkProvider {
  return {
    provideLinks(bufferLineNumber: number, callback: (links: ILink[] | undefined) => void) {
      const line = term.buffer.active.getLine(bufferLineNumber);
      if (!line) { callback(undefined); return; }

      const text = line.translateToString(true);
      if (!text) { callback(undefined); return; }

      const links: ILink[] = [];
      let match: RegExpExecArray | null;
      let count = 0;

      FILE_PATH_RE.lastIndex = 0;
      while ((match = FILE_PATH_RE.exec(text)) !== null && count < MAX_MATCHES_PER_LINE) {
        const rawPath = match[1];
        if (!EXT_RE.test(rawPath)) continue;

        const resolved = resolveFilePath(rawPath, terminalId);
        if (!resolved) continue;

        count++;
        const fullMatch = match[0];
        const startCol = match.index + 1; // xterm uses 1-based columns
        const endCol = match.index + fullMatch.length + 1;

        links.push({
          range: {
            start: { x: startCol, y: bufferLineNumber },
            end: { x: endCol, y: bufferLineNumber },
          },
          text: fullMatch,
          decorations: {
            underline: true,
            pointerCursor: true,
          },
          activate: () => {
            useWorkspaceStore.getState().requestOpenFile(resolved);
          },
          hover: () => {
            // Could show a tooltip with the resolved path
          },
        });
      }

      callback(links.length > 0 ? links : undefined);
    },
  };
}
