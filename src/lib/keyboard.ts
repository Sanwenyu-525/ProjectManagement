import React from 'react';

const _isMac = typeof navigator !== 'undefined'
  && navigator.platform.toUpperCase().indexOf('MAC') >= 0;

/** Returns true when Enter is pressed and no IME composition is active. */
export function isEnterCommit(e: React.KeyboardEvent): boolean {
  return e.key === 'Enter' && !e.nativeEvent.isComposing;
}

/** Format a key combo for display (cross-platform: Ctrl vs ⌘). */
export function formatShortcut(keys: { ctrl?: boolean; shift?: boolean; key: string }): string {
  const parts: string[] = [];
  if (keys.ctrl) parts.push(_isMac ? '⌘' : 'Ctrl');
  if (keys.shift) parts.push(_isMac ? '⇧' : 'Shift');
  // Map key names to display-friendly versions
  const keyDisplay: Record<string, string> = {
    '\\': '\\',
    '`': '`',
    '?': '?',
  };
  parts.push(keyDisplay[keys.key] ?? keys.key.toUpperCase());
  return parts.join('+');
}

export function isMac(): boolean {
  return _isMac;
}
