// API-local types — entity types live in src/types/index.ts

export interface FileEntry {
  name: string;
  path: string;
  isDir: boolean;
  size: number;
  modified: string;
  extension?: string;
}

export interface FileTreeNode {
  name: string;
  path: string;
  isDir: boolean;
  children?: FileTreeNode[];
  size?: number;
  extension?: string;
  modified?: string;
}

export interface FileContent {
  path: string;
  content: string;
  language: string;
  size: number;
  lineCount: number;
  isBinary: boolean;
  isWritable: boolean;
  tooLarge: boolean;
  modified: string;
}

export interface ContentSearchMatch {
  fileName: string;
  filePath: string;
  extension?: string;
  lineNumber: number;
  lineText: string;
}

export interface SystemClipboardPasteResult {
  kind: 'files' | 'image' | 'text' | 'empty';
  count: number;
  skippedCount: number;
  imagePath?: string;
  message: string;
}

export interface ScreenshotableWindow {
  id: number;
  name: string;
  title: string;
  appName: string;
}

export interface FileChangedEvent {
  rootPath: string;
  changedPath: string;
  kind: 'create' | 'delete' | 'modify' | 'rename' | 'other';
}

export interface TerminalApi {
  start: (projectId: string, commandStr: string, cwd: string) => Promise<string>;
  startShell: (terminalId: string, shell: string, cwd: string, args?: string[]) => Promise<string>;
  startAgent: (terminalId: string, command: string, args: string[], cwd: string) => Promise<string>;
  startAgentPiped: (terminalId: string, command: string, args: string[], cwd: string, stdinData: string) => Promise<string>;
  startAgentPipedPty: (terminalId: string, command: string, args: string[], cwd: string, stdinData: string) => Promise<string>;
  stop: (terminalId: string) => Promise<void>;
  input: (terminalId: string, data: string) => Promise<void>;
  resize: (terminalId: string, cols: number, rows: number) => Promise<void>;
  openExternal: (cwd: string) => Promise<void>;
}
