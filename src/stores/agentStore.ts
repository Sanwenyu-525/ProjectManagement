import { create } from 'zustand';
import type { MessageBlock } from '../features/workspace/agent/AgentProvider';

/** Max messages kept per session. Oldest are trimmed when exceeded. */
const MAX_MESSAGES_PER_SESSION = 200;

export interface AgentMessage {
  role: 'user' | 'assistant' | 'error';
  blocks: MessageBlock[];
  timestamp: number;
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
  /** Currently streaming session ID */
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

  /** Tool invocation events per session — deprecated, kept for AgentContextPanel compat */
  toolEvents: Record<string, Array<{ id: string; toolName: string; description: string; timestamp: number }>>;
  /** Append a tool event — deprecated */
  appendToolEvent: (sessionId: string, event: { id: string; toolName: string; description: string; timestamp: number }) => void;
  /** Clear tool events — deprecated */
  clearToolEvents: (sessionId: string) => void;

  /** Currently active agent provider ID */
  activeProviderId: string | null;
  setActiveProvider: (id: string | null) => void;

  /** Active session ID — persisted in store to survive remounts */
  activeSessionId: string | null;
  setActiveSessionId: (id: string | null) => void;
}

export const useAgentStore = create<AgentStore>((set) => ({
  streamingBlocks: {},
  streamingSessionId: null,

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
      }];
      return { streamingBlocks: { ...state.streamingBlocks, [sessionId]: blocks } };
    }),

  updateToolBlockResult: (sessionId, toolUseId, output, isError) =>
    set((state) => {
      const blocks = (state.streamingBlocks[sessionId] || []).map(b => {
        if (b.type === 'tool_use' && b.id === toolUseId) {
          return { ...b, output, isError };
        }
        return b;
      });
      return { streamingBlocks: { ...state.streamingBlocks, [sessionId]: blocks } };
    }),

  startStreaming: (sessionId) =>
    set((state) => ({
      streamingSessionId: sessionId,
      streamingBlocks: { ...state.streamingBlocks, [sessionId]: [] },
    })),

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
      return {
        messages: { ...state.messages, [sessionId]: trimmed },
        streamingBlocks: restBlocks,
        streamingSessionId: state.streamingSessionId === sessionId ? null : state.streamingSessionId,
      };
    }),

  clearStreaming: () =>
    set({ streamingBlocks: {}, streamingSessionId: null }),

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
      return { messages: rest };
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

  // Deprecated — kept for AgentContextPanel backward compat
  toolEvents: {},

  appendToolEvent: (sessionId, event) =>
    set((state) => ({
      toolEvents: {
        ...state.toolEvents,
        [sessionId]: [...(state.toolEvents[sessionId] || []), event],
      },
    })),

  clearToolEvents: (sessionId) =>
    set((state) => {
      const { [sessionId]: _, ...rest } = state.toolEvents;
      return { toolEvents: rest };
    }),

  activeProviderId: null,
  setActiveProvider: (id) => set({ activeProviderId: id }),

  activeSessionId: null,
  setActiveSessionId: (id) => set({ activeSessionId: id }),
}));
