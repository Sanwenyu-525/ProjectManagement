import { create } from 'zustand';

export interface LogEntry {
  terminalId: string;
  terminalLabel: string;
  data: string;
  stream: string;
  timestamp: number;
}

const MAX_ENTRIES = 2000;

interface LogStore {
  entries: LogEntry[];
  addEntry: (entry: LogEntry) => void;
  clearByTerminal: (terminalId: string) => void;
  clearAll: () => void;
}

export const useLogStore = create<LogStore>((set) => ({
  entries: [],

  addEntry: (entry) => set((state) => {
    const next = [...state.entries, entry];
    return { entries: next.length > MAX_ENTRIES ? next.slice(next.length - MAX_ENTRIES) : next };
  }),

  clearByTerminal: (terminalId) => set((state) => ({
    entries: state.entries.filter((e) => e.terminalId !== terminalId),
  })),

  clearAll: () => set({ entries: [] }),
}));
