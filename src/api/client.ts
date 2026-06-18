import { invoke as tauriInvoke } from '@tauri-apps/api/core';
import type { ScreenshotableWindow } from './types';

// Type-safe wrapper for Tauri IPC invoke
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const cmd = <T = any>(name: string, args?: Record<string, unknown>): Promise<T> =>
  tauriInvoke(name, args) as Promise<T>;

// ==================== Screenshots ====================

export const screenshotApi = {
  /** List all screenshotable windows */
  listWindows: (): Promise<ScreenshotableWindow[]> =>
    cmd('plugin:screenshots|get_screenshotable_windows'),

  /** Capture a window by ID, returns path to saved PNG */
  captureWindow: (windowId: number): Promise<string> =>
    cmd('plugin:screenshots|get_window_screenshot', { id: windowId }),

  /** Find the main DevHub window and capture it */
  captureMain: async (): Promise<{ path: string; windowName: string } | null> => {
    const windows = await screenshotApi.listWindows();
    const main = windows.find(w =>
      w.appName.toLowerCase().includes('devhub') ||
      w.title.toLowerCase().includes('devhub')
    );
    if (!main) return null;
    const path = await screenshotApi.captureWindow(main.id);
    return { path, windowName: main.name };
  },
};
