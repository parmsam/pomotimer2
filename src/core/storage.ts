import type { AppData, Settings } from './types';

const PREFIX = 'pomo:v1:';

export const DEFAULT_SETTINGS: Settings = {
  durations: { focus: 25, short: 5, long: 15 },
  longBreakEvery: 4,
  autoStartBreaks: false,
  autoStartFocus: false,
  theme: 'lofi-dusk',
  modeColors: { focus: null, short: null, long: null },
  clockFace: 'ring',
  background: 'blobs',
  rollingDigits: false,
  alarm: 'bell',
  volume: 0.6,
  tick: false,
  notifications: false,
  titleCountdown: true,
  strictMode: false,
  showTasks: true,
  muted: false,
  alarmIgnoresSilent: true,
  mobileTipSeen: false,
  trackInterruptions: false,
  dailyGoal: 8,
  focusModeOnStart: false,
  shortcutsHintSeen: false,
};

export function defaultAppData(settings: Settings): AppData {
  return {
    timer: {
      mode: 'focus',
      status: 'idle',
      endsAt: null,
      remainingMs: settings.durations.focus * 60_000,
      cycleCount: 0,
      segmentStart: null,
      focusedMs: 0,
      interruptions: { internal: 0, external: 0 },
    },
    history: [],
    tasks: [],
    activeTaskId: null,
    notes: [],
    goalCelebratedOn: null,
  };
}

function read(key: string): unknown {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function write(key: string, value: unknown): void {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    // Storage full or blocked; the app keeps working in memory.
  }
}

export function clearAll(): void {
  try {
    Object.keys(localStorage)
      .filter((k) => k.startsWith(PREFIX))
      .forEach((k) => localStorage.removeItem(k));
  } catch {
    // ignore
  }
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/**
 * Merges stored values over defaults so new settings get sane values, and migrates
 * older shapes. Also used to validate imported backups.
 */
export function normalizeSettings(stored: unknown): Settings {
  if (!isObject(stored)) return structuredClone(DEFAULT_SETTINGS);
  const { accent, ...rest } = stored;
  const modeColors = { ...DEFAULT_SETTINGS.modeColors, ...(isObject(stored.modeColors) ? stored.modeColors : {}) };
  // v1 had a single focus "accent" color.
  if (typeof accent === 'string' && !isObject(stored.modeColors)) modeColors.focus = accent;
  return {
    ...structuredClone(DEFAULT_SETTINGS),
    ...rest,
    durations: { ...DEFAULT_SETTINGS.durations, ...(isObject(stored.durations) ? stored.durations : {}) },
    modeColors,
  } as Settings;
}

export const loadSettings = (): Settings => normalizeSettings(read('settings'));

export const loadAppData = (settings: Settings): AppData => normalizeAppData(read('data'), settings);

export function normalizeAppData(stored: unknown, settings: Settings): AppData {
  const fallback = defaultAppData(settings);
  if (!isObject(stored)) return fallback;
  return {
    timer: isObject(stored.timer) ? { ...fallback.timer, ...stored.timer } : fallback.timer,
    history: Array.isArray(stored.history) ? (stored.history as AppData['history']) : [],
    tasks: Array.isArray(stored.tasks) ? (stored.tasks as AppData['tasks']) : [],
    activeTaskId: typeof stored.activeTaskId === 'string' ? stored.activeTaskId : null,
    notes: Array.isArray(stored.notes) ? (stored.notes as AppData['notes']) : [],
    goalCelebratedOn: typeof stored.goalCelebratedOn === 'string' ? stored.goalCelebratedOn : null,
  };
}
