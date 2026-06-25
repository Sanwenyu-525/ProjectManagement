const STORAGE_KEY = 'devhub_recent_commands';
const MAX_RECENT = 8;

/** Get recent command IDs from localStorage. */
export function getRecentCommandIds(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.slice(0, MAX_RECENT) : [];
  } catch {
    return [];
  }
}

/** Record a command use — prepend ID, dedupe, trim to MAX_RECENT. */
export function recordCommandUse(id: string): void {
  const ids = getRecentCommandIds().filter(x => x !== id);
  ids.unshift(id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(ids.slice(0, MAX_RECENT)));
}

/** Clear all recent commands. */
export function clearRecentCommands(): void {
  localStorage.removeItem(STORAGE_KEY);
}
