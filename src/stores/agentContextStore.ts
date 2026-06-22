import { create } from 'zustand';

export type FileOperation = 'read' | 'write' | 'edit' | 'search';

interface FileAccess {
  path: string;
  operations: FileOperation[];
  accessCount: number;
  lastAccessed: number;
}

interface SessionContext {
  files: Record<string, FileAccess>;
}

interface AgentContextStore {
  contexts: Record<string, SessionContext>;
  trackFileAccess: (sessionId: string, path: string, operation: FileOperation) => void;
  clearContext: (sessionId: string) => void;
}

export const useAgentContextStore = create<AgentContextStore>((set) => ({
  contexts: {},

  trackFileAccess: (sessionId, path, operation) =>
    set((state) => {
      const ctx = state.contexts[sessionId] ?? { files: {} };
      const existing = ctx.files[path];
      const updated: FileAccess = existing
        ? {
            path,
            operations: existing.operations.includes(operation)
              ? existing.operations
              : [...existing.operations, operation],
            accessCount: existing.accessCount + 1,
            lastAccessed: Date.now(),
          }
        : { path, operations: [operation], accessCount: 1, lastAccessed: Date.now() };
      return {
        contexts: {
          ...state.contexts,
          [sessionId]: { files: { ...ctx.files, [path]: updated } },
        },
      };
    }),

  clearContext: (sessionId) =>
    set((state) => {
      const { [sessionId]: _, ...rest } = state.contexts;
      return { contexts: rest };
    }),
}));
