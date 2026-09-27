import { describe, expect, it } from 'vitest';
import { computeStats, dayKey } from './stats';
import type { SessionRecord } from './types';

const MIN = 60_000;
// Local noon avoids edge-of-day surprises in any test timezone.
const at = (date: string, time = '12:00') => new Date(`${date}T${time}:00`).getTime();
const NOW = at('2026-03-10', '15:00');

const focus = (date: string, extra: Partial<SessionRecord> = {}): SessionRecord => ({
  mode: 'focus',
  endedAt: at(date),
  durationMs: 25 * MIN,
  focusedMs: 25 * MIN,
  ...extra,
});
const brk = (date: string, mode: 'short' | 'long' = 'short'): SessionRecord => ({ mode, endedAt: at(date), durationMs: 5 * MIN });

const stats = (history: SessionRecord[], extra: { liveFocusMs?: number; dailyGoal?: number } = {}) =>
  computeStats(history, { now: NOW, dailyGoal: extra.dailyGoal ?? 4, liveFocusMs: extra.liveFocusMs });

describe('dayKey', () => {
  it('uses the local calendar day', () => {
    expect(dayKey(at('2026-03-10', '00:05'))).toBe('2026-03-10');
    expect(dayKey(at('2026-03-10', '23:55'))).toBe('2026-03-10');
  });
});

describe('today', () => {
  it('counts pomodoros, per-mode sessions, focus time, abandoned and interruptions', () => {
    const s = stats([
      focus('2026-03-10', { interruptions: { internal: 1, external: 2 } }),
      brk('2026-03-10'),
      focus('2026-03-10'),
      brk('2026-03-10', 'long'),
      focus('2026-03-10', { abandoned: true, focusedMs: 7 * MIN }),
      focus('2026-03-09'),
    ]);
    expect(s.today).toMatchObject({
      pomodoros: 2,
      focusMs: 57 * MIN,
      completed: { focus: 2, short: 1, long: 1 },
      abandoned: 1,
      interruptions: 3,
    });
  });

  it('includes the running session in today’s focus time', () => {
    expect(stats([], { liveFocusMs: 3 * MIN }).today.focusMs).toBe(3 * MIN);
  });

  it('falls back to the planned length for old records without focusedMs', () => {
    expect(stats([focus('2026-03-10', { focusedMs: undefined })]).today.focusMs).toBe(25 * MIN);
  });
});

describe('week', () => {
  it('has seven days oldest first, ending today, with gaps filled', () => {
    const s = stats([focus('2026-03-04'), focus('2026-03-10'), focus('2026-03-01')]);
    expect(s.week.map((d) => d.key)).toEqual([
      '2026-03-04', '2026-03-05', '2026-03-06', '2026-03-07', '2026-03-08', '2026-03-09', '2026-03-10',
    ]);
    expect(s.week.map((d) => d.pomodoros)).toEqual([1, 0, 0, 0, 0, 0, 1]);
  });
});

describe('streak', () => {
  it('counts consecutive days ending today', () => {
    const s = stats([focus('2026-03-08'), focus('2026-03-09'), focus('2026-03-10')]);
    expect(s.streak).toEqual({ current: 3, best: 3, todayDone: true });
  });

  it('stays alive through today until the day is over', () => {
    const s = stats([focus('2026-03-08'), focus('2026-03-09')]);
    expect(s.streak).toMatchObject({ current: 2, todayDone: false });
  });

  it('breaks after a missed day', () => {
    expect(stats([focus('2026-03-07'), focus('2026-03-08')]).streak.current).toBe(0);
  });

  it('a day counts with enough focus even without a counted pomodoro', () => {
    const s = stats([
      focus('2026-03-09', { abandoned: true, focusedMs: 12 * MIN }),
      focus('2026-03-09', { abandoned: true, focusedMs: 14 * MIN }),
      focus('2026-03-10', { abandoned: true, focusedMs: 5 * MIN }),
    ]);
    expect(s.streak).toMatchObject({ current: 1, todayDone: false });
  });

  it('remembers the best streak', () => {
    const s = stats([
      focus('2026-02-01'), focus('2026-02-02'), focus('2026-02-03'), focus('2026-02-04'),
      focus('2026-03-10'),
    ]);
    expect(s.streak).toMatchObject({ current: 1, best: 4 });
  });

  it('crosses a DST change without breaking', () => {
    // 2026-03-08 is the US spring-forward day; a naive 24h step would skip or repeat a day.
    const s = stats([focus('2026-03-07'), focus('2026-03-08'), focus('2026-03-09'), focus('2026-03-10')]);
    expect(s.streak.current).toBe(4);
  });
});

describe('goal and totals', () => {
  it('tracks the daily goal', () => {
    expect(stats([focus('2026-03-10')], { dailyGoal: 2 }).goal).toEqual({ target: 2, done: 1, reached: false });
    expect(stats([focus('2026-03-10'), focus('2026-03-10')], { dailyGoal: 2 }).goal.reached).toBe(true);
  });

  it('sums all-time totals', () => {
    const s = stats([focus('2026-01-01'), focus('2026-03-10'), focus('2026-03-10', { abandoned: true, focusedMs: 5 * MIN })]);
    expect(s.totals).toEqual({ pomodoros: 2, focusMs: 55 * MIN, daysFocused: 2 });
  });
});
