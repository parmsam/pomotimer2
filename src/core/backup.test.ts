import { describe, expect, it } from 'vitest';
import { makeBackup, parseBackup, backupFilename } from './backup';
import { DEFAULT_SETTINGS, defaultAppData } from './storage';

const settings = { ...structuredClone(DEFAULT_SETTINGS), theme: 'matcha', dailyGoal: 5 };
const data = {
  ...defaultAppData(settings),
  tasks: [{ id: 'a', title: 'Write', estimate: 2, pomodoros: 1, trackedMs: 1000, done: false, createdAt: 1, doneAt: null }],
  history: [{ mode: 'focus' as const, endedAt: 5, durationMs: 1500000, focusedMs: 1500000 }],
};

describe('backup', () => {
  it('round-trips settings and data', () => {
    const out = parseBackup(JSON.stringify(makeBackup(settings, data)));
    expect(out.settings).toEqual(settings);
    expect(out.data.tasks).toEqual(data.tasks);
    expect(out.data.history).toEqual(data.history);
  });

  it('names files by date', () => {
    expect(backupFilename(Date.UTC(2026, 8, 27, 12))).toBe('pomo-backup-2026-09-27.json');
  });

  it.each([
    ['not json', 'That file isn’t valid JSON.'],
    ['{"hello":1}', 'That doesn’t look like a pomo backup file.'],
    ['{"app":"pomotimer2","version":99}', 'This backup is from a newer version of pomo.'],
  ])('rejects %s', (text, message) => {
    expect(() => parseBackup(text)).toThrow(message);
  });

  it('migrates and fills gaps using the normal loaders', () => {
    const out = parseBackup(JSON.stringify({ app: 'pomotimer2', version: 1, settings: { accent: '#abcdef' }, data: {} }));
    expect(out.settings.modeColors.focus).toBe('#abcdef');
    expect(out.data.tasks).toEqual([]);
  });

  it('brings a running session back paused with the time it had left', () => {
    const exportedAt = Date.UTC(2026, 0, 1, 9, 0);
    const running = { ...data, timer: { ...data.timer, status: 'running' as const, endsAt: exportedAt + 10 * 60_000, segmentStart: exportedAt - 60_000 } };
    const out = parseBackup(JSON.stringify(makeBackup(settings, running, exportedAt)));
    expect(out.data.timer).toMatchObject({ status: 'paused', endsAt: null, segmentStart: null, remainingMs: 10 * 60_000 });
  });
});
