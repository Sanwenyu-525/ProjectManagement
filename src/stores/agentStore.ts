import { create } from 'zustand';
import type { MessageBlock } from '../features/workspace/agent/AgentProvider';

/** Max messages kept per session. Oldest are trimmed when exceeded. */
const MAX_MESSAGES_PER_SESSION = 200;
/** Max chars per shared result to prevent memory pressure */
const MAX_SHARED_RESULT_CHARS = 2000;

interface SessionResult {
  costUsd?: number;
  durationMs?: number;
  numTurns?: number;
}

export interface AgentMessage {
  role: 'user' | 'assistant' | 'error';
  blocks: MessageBlock[];
  timestamp: number;
}

export interface SharedResult {
  stepId: string;
  title: string;
  output: string;
  timestamp: number;
  sessionId: string;
}

export interface RunningAgentInfo {
  tabId: string | null;
  sessionId: string;
  stepTitle: string;
  startedAt: number;
}

function parseMessageContent(content: string, role: string): MessageBlock[] {
  if (role === 'user') return [{ type: 'text', text: content }];
  try {
    const parsed = JSON.parse(content);
    if (parsed.v === 2 && Array.isArray(parsed.blocks)) return parsed.blocks;
  } catch { /* plain text */ }
  return [{ type: 'text', text: content }];
}

interface AgentStore {
  /** Structured streaming blocks per session */
  streamingBlocks: Record<string, MessageBlock[]>;
  /** Currently streaming session IDs (supports parallel agents) */
  streamingSessionIds: Record<string, boolean>;
  /** Legacy: first streaming session ID for backward compat */
  streamingSessionId: string | null;
  /** Append a text token to the last text block (or create one) */
  appendToken: (sessionId: string, token: string) => void;
  /** Append a thinking block */
  appendThinkingBlock: (sessionId: string, text: string) => void;
  /** Append a tool_use block */
  appendToolStartBlock: (sessionId: string, block: { id: string; toolName: string; input: Record<string, unknown> }) => void;
  /** Update a tool_use block with its result */
  updateToolBlockResult: (sessionId: string, toolUseId: string, output: string, isError: boolean) => void;
  /** Mark streaming as done — move streamingBlocks into messages */
  finishStreaming: (sessionId: string) => void;
  /** Start streaming for a session */
  startStreaming: (sessionId: string) => void;
  /** Timestamp when current streaming started (for ActivityBar duration) */
  streamingStartTime: Record<string, number>;
  /** Clear streaming state */
  clearStreaming: () => void;

  /** Completed messages per session */
  messages: Record<string, AgentMessage[]>;
  /** Append a user message (plain text) */
  appendMessage: (sessionId: string, role: 'user' | 'assistant' | 'error', content: string) => void;
  /** Load messages from DB into store */
  loadMessages: (sessionId: string, dbMessages: Array<{ role: string; content: string; timestamp: string }>) => void;
  /** Clear messages for a session */
  clearMessages: (sessionId: string) => void;

  /** Session ended tracking — key is sessionId, value is always true */
  endedSessionIds: Record<string, boolean>;
  /** Session error tracking — key is sessionId, value is always true */
  errorSessionIds: Record<string, boolean>;
  markSessionEnded: (sessionId: string) => void;
  markSessionError: (sessionId: string) => void;

  /** Currently active agent provider ID */
  activeProviderId: string | null;
  setActiveProvider: (id: string | null) => void;

  /** Active session ID — persisted in store to survive remounts */
  activeSessionId: string | null;
  setActiveSessionId: (id: string | null) => void;

  /** Result metadata per session (cost, duration, turns) */
  sessionResults: Record<string, SessionResult>;
  setSessionResult: (sessionId: string, result: SessionResult) => void;

  /** Plan mode: when true, agent area shows plan execution UI instead of chat */
  planMode: boolean;
  setPlanMode: (mode: boolean) => void;

  /** Shared results from completed plan steps, keyed by taskId */
  sharedResults: Record<string, SharedResult>;
  setSharedResult: (stepId: string, result: SharedResult) => void;
  /** Get merged context text from specified step IDs' results */
  getSharedContext: (stepIds: string[]) => string;
  /** Clear all shared results (e.g. before a new plan execution) */
  clearSharedResults: () => void;

  /** Running agent statuses across all tabs (for cross-tab view) */
  runningAgents: Record<string, RunningAgentInfo>;
  setRunningAgent: (agentId: string, info: RunningAgentInfo) => void;
  removeRunningAgent: (agentId: string) => void;
}

export const useAgentStore = create<AgentStore>((set, get) => ({
  streamingBlocks: {},
  streamingSessionIds: {},
  streamingSessionId: null,
  streamingStartTime: {},

  appendToken: (sessionId, token) =>
    set((state) => {
      const blocks = [...(state.streamingBlocks[sessionId] || [])];
      const last = blocks[blocks.length - 1];
      if (last && last.type === 'text') {
        blocks[blocks.length - 1] = { ...last, text: last.text + token };
      } else {
        blocks.push({ type: 'text', text: token });
      }
      return { streamingBlocks: { ...state.streamingBlocks, [sessionId]: blocks } };
    }),

  appendThinkingBlock: (sessionId, text) =>
    set((state) => {
      const blocks = [...(state.streamingBlocks[sessionId] || []), { type: 'thinking' as const, text }];
      return { streamingBlocks: { ...state.streamingBlocks, [sessionId]: blocks } };
    }),

  appendToolStartBlock: (sessionId, block) =>
    set((state) => {
      const blocks = [...(state.streamingBlocks[sessionId] || []), {
        type: 'tool_use' as const,
        id: block.id,
        toolName: block.toolName,
        input: block.input,
        startedAt: Date.now(),
      }];
      return { streamingBlocks: { ...state.streamingBlocks, [sessionId]: blocks } };
    }),

  updateToolBlockResult: (sessionId, toolUseId, output, isError) =>
    set((state) => {
      const blocks = (state.streamingBlocks[sessionId] || []).map(b => {
        if (b.type === 'tool_use' && b.id === toolUseId) {
          const durationMs = b.startedAt ? Date.now() - b.startedAt : undefined;
          return { ...b, output, isError, durationMs };
        }
        return b;
      });
      return { streamingBlocks: { ...state.streamingBlocks, [sessionId]: blocks } };
    }),

  startStreaming: (sessionId) =>
    set((state) => {
      const ids = { ...state.streamingSessionIds, [sessionId]: true };
      // Legacy: first streaming session becomes streamingSessionId
      const firstId = state.streamingSessionId || sessionId;
      return {
        streamingSessionIds: ids,
        streamingSessionId: firstId,
        streamingBlocks: { ...state.streamingBlocks, [sessionId]: [] },
        streamingStartTime: { ...state.streamingStartTime, [sessionId]: Date.now() },
      };
    }),

  finishStreaming: (sessionId) =>
    set((state) => {
      const blocks = state.streamingBlocks[sessionId] || [];
      const existing = state.messages[sessionId] || [];
      const updated: AgentMessage[] = blocks.length > 0
        ? [...existing, { role: 'assistant' as const, blocks, timestamp: Date.now() }]
        : existing;
      const trimmed = updated.length > MAX_MESSAGES_PER_SESSION
        ? updated.slice(updated.length - MAX_MESSAGES_PER_SESSION)
        : updated;
      const { [sessionId]: _, ...restBlocks } = state.streamingBlocks;
      const { [sessionId]: _2, ...restIds } = state.streamingSessionIds;
      const { [sessionId]: _3, ...restStart } = state.streamingStartTime;
      // Update legacy streamingSessionId
      const remainingIds = Object.keys(restIds);
      const newLegacyId = remainingIds.length > 0 ? remainingIds[0] : null;
      return {
        messages: { ...state.messages, [sessionId]: trimmed },
        streamingBlocks: restBlocks,
        streamingSessionIds: restIds,
        streamingSessionId: newLegacyId,
        streamingStartTime: restStart,
        endedSessionIds: { ...state.endedSessionIds, [sessionId]: true },
      };
    }),

  clearStreaming: () =>
    set({ streamingBlocks: {}, streamingSessionIds: {}, streamingSessionId: null, streamingStartTime: {} }),

  messages: {},

  appendMessage: (sessionId, role, content) =>
    set((state) => {
      const existing = state.messages[sessionId] || [];
      const msg: AgentMessage = {
        role,
        blocks: [{ type: 'text', text: content }],
        timestamp: Date.now(),
      };
      const updated = [...existing, msg];
      return {
        messages: {
          ...state.messages,
          [sessionId]: updated.length > MAX_MESSAGES_PER_SESSION
            ? updated.slice(updated.length - MAX_MESSAGES_PER_SESSION)
            : updated,
        },
      };
    }),

  clearMessages: (sessionId) =>
    set((state) => {
      const { [sessionId]: _, ...rest } = state.messages;
      const { [sessionId]: _2, ...restEnded } = state.endedSessionIds;
      const { [sessionId]: _3, ...restError } = state.errorSessionIds;
      return { messages: rest, endedSessionIds: restEnded, errorSessionIds: restError };
    }),

  loadMessages: (sessionId, dbMessages) =>
    set((state) => {
      const mapped: AgentMessage[] = dbMessages.map(m => ({
        role: (m.role === 'output' ? 'assistant' : m.role === 'input' ? 'user' : m.role) as 'user' | 'assistant' | 'error',
        blocks: parseMessageContent(m.content, m.role),
        timestamp: new Date(m.timestamp).getTime(),
      }));
      return { messages: { ...state.messages, [sessionId]: mapped } };
    }),

  endedSessionIds: {},
  errorSessionIds: {},

  markSessionEnded: (sessionId) =>
    set((state) => ({
      endedSessionIds: { ...state.endedSessionIds, [sessionId]: true },
    })),

  markSessionError: (sessionId) =>
    set((state) => ({
      errorSessionIds: { ...state.errorSessionIds, [sessionId]: true },
    })),

  activeProviderId: null,
  setActiveProvider: (id) => set({ activeProviderId: id }),

  activeSessionId: null,
  setActiveSessionId: (id) => set({ activeSessionId: id }),

  sessionResults: {},
  setSessionResult: (sessionId, result) =>
    set((state) => ({
      sessionResults: { ...state.sessionResults, [sessionId]: result },
    })),

  planMode: false,
  setPlanMode: (mode) => set({ planMode: mode }),

  // Shared results (P4.2)
  sharedResults: {},

  setSharedResult: (stepId, result) =>
    set((state) => ({
      sharedResults: {
        ...state.sharedResults,
        [stepId]: {
          ...result,
          output: result.output.slice(0, MAX_SHARED_RESULT_CHARS),
        },
      },
    })),

  getSharedContext: (stepIds) => {
    const { sharedResults } = get();
    return stepIds
      .filter(id => sharedResults[id])
      .map(id => {
        const r = sharedResults[id];
        return `### ${r.title}\n${r.output}`;
      })
      .join('\n\n');
  },

  clearSharedResults: () => set({ sharedResults: {} }),

  // Running agents across tabs (P4.2)
  runningAgents: {},

  setRunningAgent: (agentId, info) =>
    set((state) => ({
      runningAgents: { ...state.runningAgents, [agentId]: info },
    })),

  removeRunningAgent: (agentId) =>
    set((state) => {
      const { [agentId]: _, ...rest } = state.runningAgents;
      return { runningAgents: rest };
    }),
}));
