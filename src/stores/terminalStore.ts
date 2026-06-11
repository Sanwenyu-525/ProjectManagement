import { create } from 'zustand';

export interface LaunchRequest {
  cwd: string;
  command?: string;
}

interface TerminalStore {
  terminalOpen: boolean;
  setTerminalOpen: (v: boolean) => void;
  launchRequest: LaunchRequest | null;
  requestLaunch: (req: LaunchRequest) => void;
  consumeLaunchRequest: () => LaunchRequest | null;
}

export const useTerminalStore = create<TerminalStore>((set, get) => ({
  terminalOpen: false,
  setTerminalOpen: (v) => set({ terminalOpen: v }),
  launchRequest: null,
  requestLaunch: (req) => set({ launchRequest: req, terminalOpen: true }),
  consumeLaunchRequest: () => {
    const req = get().launchRequest;
    set({ launchRequest: null });
    return req;
  },
}));
