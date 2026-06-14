/**
 * Browser adapter interface.
 *
 * Abstracts the browser automation backend so that AutomationRouter
 * and BrowserPane don't need to know whether we're using iframes,
 * Playwright, or CDP directly.
 */

export interface BrowserCommand {
  id: number;
  action: string;
  [key: string]: unknown;
}

export interface BrowserEvent {
  type: 'console' | 'network' | 'inspect' | 'result' | 'screenshot-request';
  tabId: string;
  payload: Record<string, unknown>;
}

export interface BrowserCapabilities {
  /** Supports automation commands (click, fill, verify, etc.) */
  automation: boolean;
  /** Can capture console.log/warn/error */
  consoleCapture: boolean;
  /** Can capture network requests */
  networkCapture: boolean;
  /** Supports element inspection mode */
  inspect: boolean;
  /** Works with cross-origin pages */
  crossOrigin: boolean;
}

export interface BrowserAdapter {
  readonly id: string;
  readonly label: string;
  readonly capabilities: BrowserCapabilities;

  /**
   * Mount the browser view into the given container element.
   * The adapter should create and append its own DOM elements.
   */
  mount(tabId: string, url: string, container: HTMLElement, options: AdapterMountOptions): void;

  /** Remove the browser view and clean up resources. */
  unmount(tabId: string): void;

  /** Execute an automation command on the target tab. */
  executeCommand(tabId: string, command: BrowserCommand): void;

  /** Navigate the tab to a new URL. */
  navigate(tabId: string, url: string): void;

  /** Toggle inspect mode on/off. */
  setInspectMode(tabId: string, active: boolean): void;

  /** Request a screenshot (DOM analysis or pixel capture). */
  requestScreenshot(tabId: string): void;

  /** Subscribe to events from this adapter. Returns unsubscribe function. */
  onEvent(callback: (event: BrowserEvent) => void): () => void;
}

export interface AdapterMountOptions {
  /** Auth token for postMessage verification (iframe adapter uses this) */
  authToken: string;
}
