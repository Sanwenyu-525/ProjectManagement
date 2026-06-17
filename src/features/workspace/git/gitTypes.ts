/** Shared types for Git management features. */

export interface Branch {
  name: string;
  current: boolean;
  isRemote: boolean;
  upstream?: string;
  ahead: number;
  behind: number;
}

export interface GitCommit {
  hash: string;
  shortHash: string;
  message: string;
  author: string;
  date: string;
  branches?: string[];
  parents: string[];
  branchIdx: number;
}

export interface GitFileChange {
  path: string;
  status: 'M' | 'A' | 'D' | 'R' | 'C' | '?';
  staged: boolean;
}

export interface DiffLine {
  type: 'context' | 'add' | 'del' | 'hunk';
  oldNum: number | null;
  newNum: number | null;
  content: string;
}

export interface DiffSection {
  lines: DiffLine[];
}

export interface ProjectOption {
  id: string;
  name: string;
  localPath: string;
}
