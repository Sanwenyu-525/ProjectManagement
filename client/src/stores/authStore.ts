import { create } from 'zustand';
import { authApi } from '../api';

interface User {
  id: string;
  username: string;
  email: string;
  avatar?: string;
  createdAt: string;
}

interface AuthState {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (username: string, email: string, password: string) => Promise<void>;
  logout: () => void;
  fetchUser: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: localStorage.getItem('devhub_token'),
  loading: false,

  login: async (email, password) => {
    const res = await authApi.login({ email, password });
    const { user, token } = res.data.data;
    localStorage.setItem('devhub_token', token);
    set({ user, token });
  },

  register: async (username, email, password) => {
    const res = await authApi.register({ username, email, password });
    const { user, token } = res.data.data;
    localStorage.setItem('devhub_token', token);
    set({ user, token });
  },

  logout: () => {
    localStorage.removeItem('devhub_token');
    set({ user: null, token: null });
  },

  fetchUser: async () => {
    set({ loading: true });
    try {
      const res = await authApi.me();
      set({ user: res.data.data, loading: false });
    } catch {
      set({ user: null, token: null, loading: false });
      localStorage.removeItem('devhub_token');
    }
  },
}));
