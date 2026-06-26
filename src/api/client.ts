import { invoke as tauriInvoke } from '@tauri-apps/api/core';

// Type-safe wrapper for Tauri IPC invoke
export const cmd = <T,>(name: string, args?: Record<string, unknown>): Promise<T> =>
  tauriInvoke(name, args) as Promise<T>;
