import { create } from 'zustand';

const STORAGE_KEY = 'agent_command_history';
const MAX_TURNS_PER_TAB = 100;

export interface ConversationTurn {
  id: string;
  userText: string;
  userLineNumber: number;
  timestamp: number;
}

interface CommandHistoryStore {
  histories: Record<string, ConversationTurn[]>;
  addUserMessage: (tabId: string, text: string, lineNumber: number) => string;
  clearHistory: (tabId: string) => void;
}

function loadFromStorage(): Record<string, ConversationTurn[]> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const data = JSON.parse(raw) as Record<string, ConversationTurn[]>;
    return typeof data === 'object' && data !== null ? data : {};
  } catch { return {}; }
}

function saveToStorage(histories: Record<string, ConversationTurn[]>): void {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(histories)); } catch { /* quota */ }
}

export const useAgentCommandHistoryStore = create<CommandHistoryStore>((set, get) => ({
  histories: loadFromStorage(),

  addUserMessage: (tabId, text, lineNumber) => {
    const id = Date.now().toString(36);
    const turn: ConversationTurn = { id, userText: text, userLineNumber: lineNumber, timestamp: Date.now() };
    const { histories } = get();
    const prev = histories[tabId] ?? [];
    const next = [...prev, turn].slice(-MAX_TURNS_PER_TAB);
    const updated = { ...histories, [tabId]: next };
    set({ histories: updated });
    saveToStorage(updated);
    return id;
  },

  clearHistory: (tabId) => {
    const { histories } = get();
    const { [tabId]: _, ...rest } = histories;
    set({ histories: rest });
    saveToStorage(rest);
  },
}));
