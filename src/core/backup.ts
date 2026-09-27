import { normalizeAppData, normalizeSettings } from './storage';
import type { AppData, Settings } from './types';

const APP = 'pomotimer2';
const VERSION = 1;

export interface Backup {
  app: typeof APP;
  version: number;
  exportedAt: string;
  settings: Settings;
  data: AppData;
}

export function makeBackup(settings: Settings, data: AppData, now = Date.now()): Backup {
  return { app: APP, version: VERSION, exportedAt: new Date(now).toISOString(), settings, data };
}

export const backupFilename = (now = Date.now()) => `pomo-backup-${new Date(now).toISOString().slice(0, 10)}.json`;

/**
 * Validates and normalizes a backup file. Throws an Error with a user-facing message.
 * A session that was running at export time comes back paused, so importing never
 * credits a pomodoro that ended while the file sat on disk.
 */
export function parseBackup(text: string): { settings: Settings; data: AppData; exportedAt: string } {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error('That file isn’t valid JSON.');
  }
  const b = raw as Partial<Backup> | null;
  if (!b || typeof b !== 'object' || b.app !== APP) throw new Error('That doesn’t look like a pomo backup file.');
  if (typeof b.version !== 'number' || b.version > VERSION) throw new Error('This backup is from a newer version of pomo.');

  const settings = normalizeSettings(b.settings);
  const data = normalizeAppData(b.data, settings);
  if (data.timer.status === 'running') {
    const left = data.timer.endsAt ? Math.max(0, data.timer.endsAt - Date.parse(b.exportedAt ?? '')) : 0;
    data.timer = { ...data.timer, status: left > 0 ? 'paused' : 'idle', endsAt: null, segmentStart: null, remainingMs: left || settings.durations[data.timer.mode] * 60_000 };
  }
  return { settings, data, exportedAt: typeof b.exportedAt === 'string' ? b.exportedAt : '' };
}
