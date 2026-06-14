/**
 * Global registry of browser pane iframes, keyed by tab ID.
 * Used by AutomationRouter to dispatch commands to the correct iframe
 * without each BrowserPane needing to listen to terminal-output events.
 */

const iframes = new Map<string, HTMLIFrameElement>();

export function registerIframe(tabId: string, el: HTMLIFrameElement) {
  iframes.set(tabId, el);
}

export function unregisterIframe(tabId: string) {
  iframes.delete(tabId);
}

export function getIframe(tabId: string): HTMLIFrameElement | undefined {
  return iframes.get(tabId);
}
