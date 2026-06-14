/**
 * Launch profile storage and management
 */

export interface LaunchProfile {
  id: string;
  name: string;
  description?: string;
  projectIds: string[];
  launchOrder: 'smart' | 'manual' | 'selected';
  customOrder?: string[];
  createdAt: Date;
  lastUsed?: Date;
  useCount: number;
}

export interface LaunchHistoryEntry {
  id: string;
  timestamp: Date;
  projects: Array<{
    projectId: string;
    projectName: string;
    status: 'success' | 'failed';
    port?: number;
    error?: string;
  }>;
  totalDuration: number;
  successCount: number;
  failedCount: number;
}

const PROFILES_KEY = 'devhub_launch_profiles';
const HISTORY_KEY = 'devhub_launch_history';

// ==================== Launch Profiles ====================

export const launchProfilesStorage = {
  getAll: (): LaunchProfile[] => {
    try {
      const data = localStorage.getItem(PROFILES_KEY);
      if (!data) return [];
      const profiles = JSON.parse(data);
      // Convert date strings back to Date objects
      return profiles.map((p: Record<string, unknown>) => ({
        ...p,
        createdAt: new Date(p.createdAt as string),
        lastUsed: p.lastUsed ? new Date(p.lastUsed as string) : undefined,
      }));
    } catch {
      return [];
    }
  },

  getById: (id: string): LaunchProfile | null => {
    const profiles = launchProfilesStorage.getAll();
    return profiles.find(p => p.id === id) || null;
  },

  save: (profile: Omit<LaunchProfile, 'id' | 'createdAt' | 'useCount'>): LaunchProfile => {
    const profiles = launchProfilesStorage.getAll();
    const existingIndex = profiles.findIndex(p => p.id === profile.name.toLowerCase().replace(/\s+/g, '-'));

    const newProfile: LaunchProfile = {
      ...profile,
      id: existingIndex >= 0 ? profiles[existingIndex].id : `${profile.name.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}`,
      createdAt: existingIndex >= 0 ? profiles[existingIndex].createdAt : new Date(),
      useCount: existingIndex >= 0 ? profiles[existingIndex].useCount : 0,
    };

    if (existingIndex >= 0) {
      profiles[existingIndex] = newProfile;
    } else {
      profiles.push(newProfile);
    }

    localStorage.setItem(PROFILES_KEY, JSON.stringify(profiles));
    return newProfile;
  },

  update: (id: string, updates: Partial<LaunchProfile>): LaunchProfile | null => {
    const profiles = launchProfilesStorage.getAll();
    const index = profiles.findIndex(p => p.id === id);
    if (index === -1) return null;

    profiles[index] = { ...profiles[index], ...updates };
    localStorage.setItem(PROFILES_KEY, JSON.stringify(profiles));
    return profiles[index];
  },

  delete: (id: string): boolean => {
    const profiles = launchProfilesStorage.getAll();
    const filtered = profiles.filter(p => p.id !== id);
    if (filtered.length === profiles.length) return false;
    localStorage.setItem(PROFILES_KEY, JSON.stringify(filtered));
    return true;
  },

  incrementUseCount: (id: string): void => {
    const profiles = launchProfilesStorage.getAll();
    const profile = profiles.find(p => p.id === id);
    if (profile) {
      profile.useCount++;
      profile.lastUsed = new Date();
      localStorage.setItem(PROFILES_KEY, JSON.stringify(profiles));
    }
  },

  sortByLastUsed: (): LaunchProfile[] => {
    return launchProfilesStorage.getAll().sort((a, b) => {
      if (a.lastUsed && b.lastUsed) {
        return b.lastUsed.getTime() - a.lastUsed.getTime();
      }
      if (a.lastUsed) return -1;
      if (b.lastUsed) return 1;
      return b.createdAt.getTime() - a.createdAt.getTime();
    });
  },
};

// ==================== Launch History ====================

export const launchHistoryStorage = {
  getAll: (): LaunchHistoryEntry[] => {
    try {
      const data = localStorage.getItem(HISTORY_KEY);
      if (!data) return [];
      const history = JSON.parse(data);
      // Convert date strings back to Date objects
      return history.map((h: Record<string, unknown>) => ({
        ...h,
        timestamp: new Date(h.timestamp as string),
      }));
    } catch {
      return [];
    }
  },

  add: (entry: Omit<LaunchHistoryEntry, 'id' | 'timestamp'>): LaunchHistoryEntry => {
    const history = launchHistoryStorage.getAll();
    const newEntry: LaunchHistoryEntry = {
      ...entry,
      id: `history-${Date.now()}`,
      timestamp: new Date(),
    };

    // Add to beginning and keep only last 50 entries
    history.unshift(newEntry);
    const trimmedHistory = history.slice(0, 50);

    localStorage.setItem(HISTORY_KEY, JSON.stringify(trimmedHistory));
    return newEntry;
  },

  clear: (): void => {
    localStorage.removeItem(HISTORY_KEY);
  },

  getRecent: (count: number = 10): LaunchHistoryEntry[] => {
    return launchHistoryStorage.getAll().slice(0, count);
  },
};
