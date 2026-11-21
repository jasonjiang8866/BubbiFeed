import AsyncStorage from '@react-native-async-storage/async-storage';

export interface BabyProfile {
  id: string;
  name: string;
  birthDate: string; // ISO date string
  gender: 'boy' | 'girl' | 'other';
  birthWeight: number; // in grams
}

export type FeedingType = 'breast' | 'bottle' | 'solid';

export interface BreastDetails {
  leftDuration: number; // in seconds
  rightDuration: number; // in seconds
  lastBreastUsed: 'left' | 'right' | null;
}

export interface BottleDetails {
  amount: number; // in ml
  bottleType: 'formula' | 'breastmilk';
}

export interface SolidDetails {
  foodDescription: string;
  amountCategory: 'few_bites' | 'medium_bowl' | 'large_bowl';
}

export interface FeedingLog {
  id: string;
  babyId: string;
  type: FeedingType;
  timestamp: string; // ISO date string
  notes?: string;
  details: {
    breast?: BreastDetails;
    bottle?: BottleDetails;
    solid?: SolidDetails;
  };
}

export interface AppSettings {
  activeBabyId: string | null;
  volumeUnit: 'ml' | 'oz';
  isDarkMode: boolean;
}

const STORAGE_KEYS = {
  PROFILES: '@feedmybaby_profiles_v1',
  LOGS: '@feedmybaby_logs_v1',
  SETTINGS: '@feedmybaby_settings_v1',
};

// Initial Default Baby Profile
const DEFAULT_BABY: BabyProfile = {
  id: 'default-baby-id',
  name: 'Little Sweetheart',
  birthDate: new Date().toISOString(),
  gender: 'boy',
  birthWeight: 3200, // 3.2 kg
};

const DEFAULT_SETTINGS: AppSettings = {
  activeBabyId: 'default-baby-id',
  volumeUnit: 'ml',
  isDarkMode: false,
};


async function loadData<T>(key: string, defaultValue: T): Promise<T> {
  const value = await AsyncStorage.getItem(key);
  return value === null ? defaultValue : JSON.parse(value);
}

const readSettings = () => loadData<AppSettings>(STORAGE_KEYS.SETTINGS, DEFAULT_SETTINGS);
const readLogs = () => loadData<FeedingLog[]>(STORAGE_KEYS.LOGS, []);
async function readProfiles(): Promise<BabyProfile[]> {
  const profiles = await loadData<BabyProfile[]>(STORAGE_KEYS.PROFILES, []);
  if (!Array.isArray(profiles)) throw new Error('Invalid stored baby profiles.');
  return profiles.length ? profiles : [DEFAULT_BABY];
}

// AsyncStorage has no atomic read-modify-write. Keep the read inside the same
// queue as the write, and share the lock with other web tabs where supported.
let pending: Promise<void> = Promise.resolve();
function mutate<T>(operation: () => Promise<T>): Promise<T> {
  const result = pending.then(() => {
    if (typeof navigator !== 'undefined' && navigator.locks) {
      return navigator.locks.request('feedmybaby-storage-v1', operation);
    }
    return operation();
  });
  pending = result.then(() => {}, () => {});
  return result;
}

export class ActiveBabyChangedError extends Error {
  constructor() {
    super('The active baby changed.');
  }
}

export function newLogId(): string {
  return `log-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

export const StorageService = {
  getProfiles: readProfiles,
  getSettings: readSettings,
  getAllLogs: readLogs,

  saveProfile(profile: BabyProfile, makeActive = false): Promise<BabyProfile[]> {
    return mutate(async () => {
      const profiles = await readProfiles();
      const index = profiles.findIndex((p) => p.id === profile.id);
      if (index < 0) profiles.push(profile);
      else profiles[index] = profile;
      const changes: [string, string][] = [[STORAGE_KEYS.PROFILES, JSON.stringify(profiles)]];
      if (makeActive) {
        const settings = await readSettings();
        changes.push([STORAGE_KEYS.SETTINGS, JSON.stringify({ ...settings, activeBabyId: profile.id })]);
      }
      await AsyncStorage.multiSet(changes);
      return profiles;
    });
  },

  deleteProfile(profileId: string): Promise<BabyProfile[]> {
    return mutate(async () => {
      const [existing, logs, settings] = await Promise.all([readProfiles(), readLogs(), readSettings()]);
      const profiles = existing.filter(p => p.id !== profileId);
      if (!profiles.length) profiles.push(DEFAULT_BABY);
      const changes: [string, string][] = [
        [STORAGE_KEYS.LOGS, JSON.stringify(logs.filter(log => log.babyId !== profileId))],
        [STORAGE_KEYS.PROFILES, JSON.stringify(profiles)],
      ];
      if (settings.activeBabyId === profileId) {
        changes.push([STORAGE_KEYS.SETTINGS, JSON.stringify({ ...settings, activeBabyId: profiles[0].id })]);
      }
      await AsyncStorage.multiSet(changes);
      return profiles;
    });
  },

  async getLogsForBaby(babyId: string): Promise<FeedingLog[]> {
    return (await readLogs())
      .filter(log => log.babyId === babyId)
      .sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp));
  },

  saveLog(log: FeedingLog, options: { requireActiveBaby?: boolean } = {}): Promise<FeedingLog[]> {
    return mutate(async () => {
      if (options.requireActiveBaby) {
        const [settings, profiles] = await Promise.all([readSettings(), readProfiles()]);
        const active = profiles.find(p => p.id === settings.activeBabyId) ?? profiles[0];
        if (active.id !== log.babyId) throw new ActiveBabyChangedError();
      }
      const logs = await readLogs();
      const index = logs.findIndex(item => item.id === log.id);
      if (index < 0) logs.push(log);
      else logs[index] = log;
      await AsyncStorage.setItem(STORAGE_KEYS.LOGS, JSON.stringify(logs));
      return logs;
    });
  },

  deleteLog(logId: string): Promise<FeedingLog[]> {
    return mutate(async () => {
      const logs = (await readLogs()).filter(log => log.id !== logId);
      await AsyncStorage.setItem(STORAGE_KEYS.LOGS, JSON.stringify(logs));
      return logs;
    });
  },

  saveSettings(changes: Partial<AppSettings>): Promise<AppSettings> {
    return mutate(async () => {
      const settings = { ...await readSettings(), ...changes };
      await AsyncStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
      return settings;
    });
  },
};
