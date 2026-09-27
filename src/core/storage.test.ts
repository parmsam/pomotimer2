import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearAll, DEFAULT_SETTINGS, loadAppData, loadSettings, write } from './storage';

beforeEach(() => localStorage.clear());
afterEach(() => vi.restoreAllMocks());

describe('loadSettings', () => {
  it('returns defaults when nothing is stored', () => {
    expect(loadSettings()).toEqual(DEFAULT_SETTINGS);
  });

  it('returns defaults when stored JSON is corrupt', () => {
    localStorage.setItem('pomo:v1:settings', '{not json');
    expect(loadSettings()).toEqual(DEFAULT_SETTINGS);
  });

  it('fills in settings added after the data was saved', () => {
    localStorage.setItem('pomo:v1:settings', JSON.stringify({ theme: 'matcha', durations: { focus: 50 } }));
    const s = loadSettings();
    expect(s.theme).toBe('matcha');
    expect(s.durations).toEqual({ focus: 50, short: 5, long: 15 });
    expect(s.strictMode).toBe(false);
    expect(s.showTasks).toBe(true);
  });

  it('does not share nested objects with the defaults', () => {
    loadSettings().durations.focus = 1;
    expect(DEFAULT_SETTINGS.durations.focus).toBe(25);
  });
});

describe('loadAppData', () => {
  it('upgrades Phase 1 data that lacks tracking fields', () => {
    localStorage.setItem(
      'pomo:v1:data',
      JSON.stringify({
        timer: { mode: 'short', status: 'paused', endsAt: null, remainingMs: 1000, cycleCount: 2 },
        history: [{ mode: 'focus', endedAt: 1, durationMs: 2 }],
      }),
    );
    const d = loadAppData(DEFAULT_SETTINGS);
    expect(d.timer).toMatchObject({ mode: 'short', remainingMs: 1000, segmentStart: null, focusedMs: 0 });
    expect(d.timer.interruptions).toEqual({ internal: 0, external: 0 });
    expect(d.history).toHaveLength(1);
    expect(d.tasks).toEqual([]);
    expect(d.notes).toEqual([]);
    expect(d.activeTaskId).toBeNull();
  });

  it('falls back to a fresh state for garbage', () => {
    localStorage.setItem('pomo:v1:data', JSON.stringify([1, 2, 3]));
    expect(loadAppData(DEFAULT_SETTINGS).timer.remainingMs).toBe(25 * 60_000);
  });
});

describe('write / clearAll', () => {
  it('swallows storage errors (quota, privacy mode)', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('full', 'QuotaExceededError');
    });
    expect(() => write('settings', {})).not.toThrow();
  });

  it('only clears keys that belong to the app', () => {
    localStorage.setItem('pomo:v1:settings', '{}');
    localStorage.setItem('other-app', 'keep');
    clearAll();
    expect(localStorage.getItem('pomo:v1:settings')).toBeNull();
    expect(localStorage.getItem('other-app')).toBe('keep');
  });
});
