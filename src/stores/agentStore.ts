import { create } from 'zustand';

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

  activeProviderId: null,
  setActiveProvider: (id) => set({ activeProviderId: id }),
}));
