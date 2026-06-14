/**
 * Browser adapter factory.
 *
 * Returns the active BrowserAdapter instance. Defaults to IframeAdapter.
 * In the future, PlaywrightAdapter or others can be swapped in here.
 */
import type { BrowserAdapter } from './types';
import { IframeAdapter } from './IframeAdapter';

let adapter: BrowserAdapter | null = null;

export function getBrowserAdapter(): BrowserAdapter {
  if (!adapter) {
    adapter = new IframeAdapter();
  }
  return adapter;
}

// Future: allow runtime switching
// export function setBrowserAdapter(a: BrowserAdapter) { adapter = a; }

export type { BrowserAdapter, BrowserCommand, BrowserEvent, BrowserCapabilities } from './types';
