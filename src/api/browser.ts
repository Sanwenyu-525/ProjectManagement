import { cmd } from './client';
import type { BrowserVisit } from '../types';

// ==================== Browser Memory ====================

export const browserMemoryApi = {
  recordVisit: (data: { tabId: string; url: string; title?: string; domAnalysis?: string; projectId?: string }) =>
    cmd('browser_record_visit', data),
  listVisits: (tabId?: string, limit?: number) =>
    cmd<BrowserVisit[]>('browser_list_visits', { tabId: tabId ?? null, limit: limit ?? null }),
  findByUrl: (url: string) =>
    cmd<BrowserVisit[]>('browser_find_visits_by_url', { url }),
};
