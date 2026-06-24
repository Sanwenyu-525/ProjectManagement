import { invoke as tauriInvoke } from '@tauri-apps/api/core';

// Type-safe wrapper for Tauri IPC invoke
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const cmd = <T = any>(name: string, args?: Record<string, unknown>): Promise<T> =>
  tauriInvoke(name, args) as Promise<T>;
