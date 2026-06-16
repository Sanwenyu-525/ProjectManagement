import React from 'react';

/** Returns true when Enter is pressed and no IME composition is active. */
export function isEnterCommit(e: React.KeyboardEvent): boolean {
  return e.key === 'Enter' && !e.nativeEvent.isComposing;
}
