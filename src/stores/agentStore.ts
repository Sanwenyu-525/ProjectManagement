import { create } from 'zustand';

/** Max messages kept per session. Oldest are trimmed when exceeded. */
const MAX_MESSAGES_PER_SESSION = 200;

export interface ToolEvent {
  id: string;
  toolName: string;
  description: string;
  timestamp: number;
}

interface AgentStore {
  /** Accumulated streaming text per session */
  streamingText: Record<string, string>;
  /** Currently streaming session ID */
  streamingSessionId: string | null;
  /** Append a token to the streaming text */
  appendToken: (sessionId: string, token: string) => void;
  /** Mark streaming as done for a session */
  finishStreaming: (sessionId: string) => void;
  /** Start streaming for a session */
  startStreaming: (sessionId: string) => void;
  /** Clear streaming state */
  clearStreaming: () => void;

  /** Completed messages per session (conversation history) */
  messages: Record<string, Array<{ role: 'user' | 'assistant' | 'error'; content: string; timestamp: number }>>;
  /** Append a message to the conversation history */
  appendMessage: (sessionId: string, role: 'user' | 'assistant' | 'error', content: string) => void;
  /** Load messages from DB into store (hydrates on session switch) */
  loadMessages: (sessionId: string, dbMessages: Array<{ role: string; content: string; timestamp: string }>) => void;
  /** Clear messages for a session */
  clearMessages: (sessionId: string) => void;

  /** Tool invocation events per session (for status indicators) */
  toolEvents: Record<string, ToolEvent[]>;
  /** Append a tool event */
  appendToolEvent: (sessionId: string, event: ToolEvent) => void;
  /** Clear tool events for a session */
  clearToolEvents: (sessionId: string) => void;

  /** Currently active agent provider ID */
  activeProviderId: string | null;
  setActiveProvider: (id: string | null) => void;
}

export const useAgentStore = create<AgentStore>((set) => ({
  streamingText: {},
  streamingSessionId: null,

  appendToken: (sessionId, token) =>
    set((state) => ({
      streamingText: {
        ...state.streamingText,
        [sessionId]: (state.streamingText[sessionId] || '') + token,
      },
    })),

  finishStreaming: (sessionId) =>
    set((state) => {
      const { [sessionId]: _, ...rest } = state.streamingText;
      return {
        streamingText: rest,
        streamingSessionId: state.streamingSessionId === sessionId ? null : state.streamingSessionId,
      };
    }),

  startStreaming: (sessionId) =>
    set({
      streamingSessionId: sessionId,
    }),

  clearStreaming: () =>
    set({
      streamingText: {},
      streamingSessionId: null,
    }),

  messages: {},

  appendMessage: (sessionId, role, content) =>
    set((state) => {
      const existing = state.messages[sessionId] || [];
      const updated = [...existing, { role, content, timestamp: Date.now() }];
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
      // Map DB roles to local roles; keep legacy 'input'/'output' as-is for backward compat
      const mapped = dbMessages.map(m => ({
        role: (m.role === 'output' ? 'assistant' : m.role === 'input' ? 'user' : m.role) as 'user' | 'assistant' | 'error',
        content: m.content,
        timestamp: new Date(m.timestamp).getTime(),
      }));
      return {
        messages: {
          ...state.messages,
          [sessionId]: mapped,
        },
      };
    }),

  toolEvents: {},

  appendToolEvent: (sessionId, event) =>
    set((state) => ({
      toolEvents: {
        ...state.toolEvents,
        [sessionId]: [
          ...(state.toolEvents[sessionId] || []),
          event,
        ],
      },
    })),

  clearToolEvents: (sessionId) =>
    set((state) => {
      const { [sessionId]: _, ...rest } = state.toolEvents;
      return { toolEvents: rest };
    }),

  activeProviderId: null,
  setActiveProvider: (id) => set({ activeProviderId: id }),
}));
