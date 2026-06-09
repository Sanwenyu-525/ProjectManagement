import { create } from 'zustand';

interface User {
  id: string;
  username: string;
  email: string;
  avatar?: string;
  createdAt: string;
}

interface AppState {
  user: User | null;
  loading: boolean;
  init: () => Promise<void>;
}

const DEFAULT_USER: User = {
  id: 'default-user',
  username: 'Developer',
  email: 'dev@local',
  createdAt: new Date().toISOString(),
};

export const useAuthStore = create<AppState>((set) => ({
  user: null,
  loading: true,

  init: async () => {
    set({ user: DEFAULT_USER, loading: false });
  },
}));
