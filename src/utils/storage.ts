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

// Helper: load from AsyncStorage
async function loadData<T>(key: string, defaultValue: T): Promise<T> {
  try {
    const jsonValue = await AsyncStorage.getItem(key);
    return jsonValue != null ? JSON.parse(jsonValue) : defaultValue;
  } catch (e) {
    console.error(`Error loading data for key ${key}:`, e);
    return defaultValue;
  }
}

// Helper: save to AsyncStorage
async function saveData<T>(key: string, value: T): Promise<void> {
  try {
    const jsonValue = JSON.stringify(value);
    await AsyncStorage.setItem(key, jsonValue);
  } catch (e) {
    console.error(`Error saving data for key ${key}:`, e);
  }
}

export const StorageService = {
  // Baby Profiles
  async getProfiles(): Promise<BabyProfile[]> {
    const profiles = await loadData<BabyProfile[]>(STORAGE_KEYS.PROFILES, [DEFAULT_BABY]);
    if (profiles.length === 0) {
      await saveData(STORAGE_KEYS.PROFILES, [DEFAULT_BABY]);
      return [DEFAULT_BABY];
    }
    return profiles;
  },

  async saveProfile(profile: BabyProfile): Promise<BabyProfile[]> {
    const profiles = await this.getProfiles();
    const index = profiles.findIndex((p) => p.id === profile.id);
    if (index >= 0) {
      profiles[index] = profile;
    } else {
      profiles.push(profile);
    }
    await saveData(STORAGE_KEYS.PROFILES, profiles);
    return profiles;
  },

  async deleteProfile(profileId: string): Promise<BabyProfile[]> {
    let profiles = await this.getProfiles();
    profiles = profiles.filter((p) => p.id !== profileId);
    if (profiles.length === 0) {
      profiles = [DEFAULT_BABY];
    }
    await saveData(STORAGE_KEYS.PROFILES, profiles);

    // Clean up logs for this baby
    let logs = await this.getAllLogs();
    logs = logs.filter((log) => log.babyId !== profileId);
    await saveData(STORAGE_KEYS.LOGS, logs);

    // Update settings if deleted active baby
    const settings = await this.getSettings();
    if (settings.activeBabyId === profileId) {
      settings.activeBabyId = profiles[0].id;
      await this.saveSettings(settings);
    }

    return profiles;
  },

  // Feeding Logs
  async getAllLogs(): Promise<FeedingLog[]> {
    return loadData<FeedingLog[]>(STORAGE_KEYS.LOGS, []);
  },

  async getLogsForBaby(babyId: string): Promise<FeedingLog[]> {
    const allLogs = await this.getAllLogs();
    return allLogs
      .filter((log) => log.babyId === babyId)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  },

  async saveLog(log: FeedingLog): Promise<FeedingLog[]> {
    const allLogs = await this.getAllLogs();
    const index = allLogs.findIndex((l) => l.id === log.id);
    if (index >= 0) {
      allLogs[index] = log;
    } else {
      allLogs.push(log);
    }
    await saveData(STORAGE_KEYS.LOGS, allLogs);
    return allLogs;
  },

  async deleteLog(logId: string): Promise<FeedingLog[]> {
    let allLogs = await this.getAllLogs();
    allLogs = allLogs.filter((l) => l.id !== logId);
    await saveData(STORAGE_KEYS.LOGS, allLogs);
    return allLogs;
  },

  // App Settings
  async getSettings(): Promise<AppSettings> {
    return loadData<AppSettings>(STORAGE_KEYS.SETTINGS, DEFAULT_SETTINGS);
  },

  async saveSettings(settings: AppSettings): Promise<AppSettings> {
    await saveData(STORAGE_KEYS.SETTINGS, settings);
    return settings;
  },
};
