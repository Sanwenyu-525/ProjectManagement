/**
 * Browser automation command parsing and payload construction.
 *
 * Extracted from AutomationRouter to be shared across adapter implementations.
 */
import type { BrowserCommand } from './types';

// [devhub-browser:<tabId>] <action> <args...>
export const AUTOMATION_CMD_RE = /\[devhub-browser:(\S+)\]\s+(\S+)\s*(.*)/;

/**
 * Parse an action string and raw arguments into a typed BrowserCommand.
 * Returns null if the action is not recognized.
 */
export function parseCommand(action: string, argsStr: string, nextId: number): BrowserCommand | null {
  const base = { id: nextId, action };

  switch (action) {
    case 'navigate':
      return { ...base, url: argsStr.trim() };
    case 'click':
      return { ...base, selector: argsStr.trim() };
    case 'fill': {
      const parts = argsStr.trim().split(/\s+/);
      return { ...base, selector: parts[0], value: parts.slice(1).join(' ') };
    }
    case 'wait': {
      const wp = argsStr.trim().split(/\s+/);
      return { ...base, selector: wp[0], ...(wp[1] ? { timeout: parseInt(wp[1], 10) } : {}) };
    }
    case 'scroll': {
      const sp = argsStr.trim().split(/\s+/);
      return { ...base, x: parseInt(sp[0] || '0', 10), y: parseInt(sp[1] || '0', 10) };
    }
    case 'screenshot':
    case 'pixel-screenshot':
      return base;
    case 'verify': {
      const vp = argsStr.trim().split(/\s+/);
      return {
        ...base,
        check: vp[0],
        ...(vp[1] ? { selector: vp[1] } : {}),
        ...(vp[2] ? { value: vp.slice(2).join(' ') } : {}),
      };
    }
    case 'scenario': {
      const sp = argsStr.trim().split(/\s+/);
      return { ...base, label: sp[0] || '未命名测试', steps: sp[1] || '' };
    }
    default:
      return null;
  }
}
