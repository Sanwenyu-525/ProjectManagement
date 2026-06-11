import { create } from 'zustand';

interface TerminalStore {
  terminalOpen: boolean;
  setTerminalOpen: (v: boolean) => void;
  defaultCwd: string | null;
  setDefaultCwd: (cwd: string | null) => void;
  consumeDefaultCwd: () => string | null;
  defaultCommand: string | null;
  setDefaultCommand: (cmd: string | null) => void;
  consumeDefaultCommand: () => string | null;
}

export const useTerminalStore = create<TerminalStore>((set, get) => ({
  terminalOpen: false,
  setTerminalOpen: (v) => set({ terminalOpen: v }),
  defaultCwd: null,
  setDefaultCwd: (cwd) => set({ defaultCwd: cwd }),
  consumeDefaultCwd: () => {
    const cwd = get().defaultCwd;
    set({ defaultCwd: null });
    return cwd;
  },
  defaultCommand: null,
  setDefaultCommand: (cmd) => set({ defaultCommand: cmd }),
  consumeDefaultCommand: () => {
    const cmd = get().defaultCommand;
    set({ defaultCommand: null });
    return cmd;
  },
}));
