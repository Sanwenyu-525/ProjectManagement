import { create } from 'zustand';

export type FileOperation = 'read' | 'write' | 'edit' | 'search';

interface FileAccess {
  path: string;
  operations: FileOperation[];
  accessCount: number;
  lastAccessed: number;
}

export interface GraphQueryRecord {
  queryType: 'impact' | 'deps' | 'layers';
  target: string;
  timestamp: number;
  resultSummary: string;
}

export interface ImpactWarningRecord {
  file: string;
  impactCount: number;
  directCount: number;
  indirectCount: number;
  summary: string;
  timestamp: number;
}

interface SessionContext {
  files: Record<string, FileAccess>;
  graphQueries: GraphQueryRecord[];
  impactWarnings: ImpactWarningRecord[];
}

interface AgentContextStore {
  contexts: Record<string, SessionContext>;
  trackFileAccess: (sessionId: string, path: string, operation: FileOperation) => void;
  trackGraphQuery: (sessionId: string, query: GraphQueryRecord) => void;
  trackImpactWarning: (sessionId: string, warning: ImpactWarningRecord) => void;
  clearContext: (sessionId: string) => void;
}

export const useAgentContextStore = create<AgentContextStore>((set) => ({
  contexts: {},

  trackFileAccess: (sessionId, path, operation) =>
    set((state) => {
      const ctx = state.contexts[sessionId] ?? { files: {}, graphQueries: [], impactWarnings: [] };
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
          [sessionId]: { ...ctx, files: { ...ctx.files, [path]: updated } },
        },
      };
    }),

  trackGraphQuery: (sessionId, query) =>
    set((state) => {
      const ctx = state.contexts[sessionId] ?? { files: {}, graphQueries: [], impactWarnings: [] };
      return {
        contexts: {
          ...state.contexts,
          [sessionId]: { ...ctx, graphQueries: [...ctx.graphQueries, query] },
        },
      };
    }),

  trackImpactWarning: (sessionId, warning) =>
    set((state) => {
      const ctx = state.contexts[sessionId] ?? { files: {}, graphQueries: [], impactWarnings: [] };
      return {
        contexts: {
          ...state.contexts,
          [sessionId]: { ...ctx, impactWarnings: [...ctx.impactWarnings, warning] },
        },
      };
    }),

  clearContext: (sessionId) =>
    set((state) => {
      const { [sessionId]: _, ...rest } = state.contexts;
      return { contexts: rest };
    }),
}));
