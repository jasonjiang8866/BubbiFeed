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

export type NursingSide = 'left' | 'right';

export interface NursingSession {
  id: string;
  babyId: string;
  revision: number;
  side: NursingSide;
  runningSince: number | null;
  leftMs: number;
  rightMs: number;
}

function nursingMilliseconds(session: NursingSession | null, now: number) {
  let leftMs = session?.leftMs ?? 0;
  let rightMs = session?.rightMs ?? 0;
  if (session && session.runningSince !== null) {
    const elapsed = Math.max(0, now - session.runningSince);
    if (session.side === 'left') leftMs += elapsed;
    else rightMs += elapsed;
  }
  return { leftMs, rightMs };
}

export function nursingDurations(session: NursingSession | null, now: number): BreastDetails {
  const { leftMs, rightMs } = nursingMilliseconds(session, now);
  return {
    leftDuration: Math.floor(leftMs / 1000),
    rightDuration: Math.floor(rightMs / 1000),
    lastBreastUsed: session?.side ?? null,
  };
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

export function localCalendarDate(date = new Date()): string {
  const year = String(date.getFullYear()).padStart(4, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Initial Default Baby Profile
const DEFAULT_BABY: BabyProfile = {
  id: 'default-baby-id',
  name: 'Little Sweetheart',
  birthDate: localCalendarDate(),
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

async function requireActiveBaby(babyId: string) {
  const [settings, profiles] = await Promise.all([readSettings(), readProfiles()]);
  const active = profiles.find(p => p.id === settings.activeBabyId) ?? profiles[0];
  if (active.id !== babyId) throw new ActiveBabyChangedError();
}

const nursingKey = (babyId: string) => `@feedmybaby_nursing_v1:${babyId}`;
const readStoredNursing = (babyId: string) => loadData<NursingSession | null>(nursingKey(babyId), null);

// A completed log is authoritative if the app closed before clearing its timer.
async function readNursing(babyId: string) {
  const session = await readStoredNursing(babyId);
  if (session && (await readLogs()).some(log => log.id === session.id)) {
    return null;
  }
  return session;
}

export class NursingSessionChangedError extends Error {
  constructor() {
    super('The nursing timer changed. Review the current timer and try again.');
  }
}

function checkSession(current: NursingSession | null, expected: NursingSession | null) {
  if (current?.id !== expected?.id || current?.revision !== expected?.revision) {
    throw new NursingSessionChangedError();
  }
}

export const StorageService = {
  getProfiles: readProfiles,
  getSettings: readSettings,
  getAllLogs: readLogs,

  getNursingSession(babyId: string) {
    return mutate(() => readNursing(babyId));
  },

  setNursingSide(babyId: string, expected: NursingSession | null, side: NursingSide | null, now = Date.now()) {
    return mutate(async () => {
      await requireActiveBaby(babyId);
      const current = await readNursing(babyId);
      checkSession(current, expected);
      const lastSide = side ?? current?.side;
      if (!lastSide) return null;
      const next: NursingSession = {
        id: current?.id ?? newLogId(),
        babyId,
        revision: (current?.revision ?? 0) + 1,
        side: lastSide,
        runningSince: side ? now : null,
        ...nursingMilliseconds(current, now),
      };
      await AsyncStorage.setItem(nursingKey(babyId), JSON.stringify(next));
      return next;
    });
  },

  discardNursing(expected: NursingSession) {
    return mutate(async () => {
      await requireActiveBaby(expected.babyId);
      checkSession(await readNursing(expected.babyId), expected);
      await AsyncStorage.removeItem(nursingKey(expected.babyId));
    });
  },

  finishNursing(expected: NursingSession, timestamp: string, notes?: string, now = Date.now()) {
    return mutate(async () => {
      const { babyId, id } = expected;
      await requireActiveBaby(babyId);
      const logs = await readLogs();
      const current = await readStoredNursing(babyId);
      if (!logs.some(log => log.id === id)) {
        checkSession(current, expected);
        const breast = nursingDurations(current, now);
        if (!breast.leftDuration && !breast.rightDuration) throw new Error('Run the timer for at least one second.');
        logs.push({ id, babyId, type: 'breast', timestamp, notes, details: { breast } });
        await AsyncStorage.setItem(STORAGE_KEYS.LOGS, JSON.stringify(logs));
      }
      // Retrying a completed save must never clear a newer timer.
      if (current?.id !== id) return current;
      try {
        await AsyncStorage.removeItem(nursingKey(babyId));
      } catch {
        // The log is durable. readNursing hides this timer until it is overwritten or removed.
      }
      return null;
    });
  },

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
        [nursingKey(profileId), 'null'],
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
      if (options.requireActiveBaby) await requireActiveBaby(log.babyId);
      const logs = await readLogs();
      const index = logs.findIndex(item => item.id === log.id);
      if (index < 0) logs.push(log);
      else logs[index] = log;
      await AsyncStorage.setItem(STORAGE_KEYS.LOGS, JSON.stringify(logs));
      return logs;
    });
  },

  updateBottle(original: FeedingLog, changes: { amount: number; timestamp: string; notes?: string }): Promise<void> {
    return mutate(async () => {
      await requireActiveBaby(original.babyId);
      const logs = await readLogs();
      const entry = logs.find(log => log.id === original.id && log.babyId === original.babyId);
      if (!entry || entry.type !== 'bottle' || !entry.details.bottle || !original.details.bottle) {
        throw new Error('This bottle is no longer in history.');
      }
      if (!Number.isFinite(changes.amount) || changes.amount <= 0 || !Number.isFinite(Date.parse(changes.timestamp))) {
        throw new Error('Check the bottle volume and time.');
      }
      if (entry.timestamp === changes.timestamp && entry.notes === changes.notes && entry.details.bottle.amount === changes.amount) return;
      if (entry.timestamp !== original.timestamp || entry.notes !== original.notes ||
          entry.details.bottle.amount !== original.details.bottle.amount) {
        throw new Error('This bottle changed. Reopen it to see the latest values.');
      }
      entry.timestamp = changes.timestamp;
      entry.notes = changes.notes;
      entry.details.bottle.amount = changes.amount;
      await AsyncStorage.setItem(STORAGE_KEYS.LOGS, JSON.stringify(logs));
    });
  },

  deleteLog(logId: string): Promise<FeedingLog[]> {
    return mutate(async () => {
      const existing = await readLogs();
      const entry = existing.find(log => log.id === logId);
      if (entry?.type === 'breast' && (await readStoredNursing(entry.babyId))?.id === logId) {
        await AsyncStorage.removeItem(nursingKey(entry.babyId));
      }
      const logs = existing.filter(log => log.id !== logId);
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
