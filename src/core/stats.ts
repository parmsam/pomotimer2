import type { Mode, SessionRecord } from './types';

/** A day keeps the streak alive with one counted pomodoro or this much focus. */
export const STREAK_FOCUS_MS = 25 * 60_000;

/** Local calendar day, e.g. "2026-09-27". */
export function dayKey(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Same wall-clock time `n` calendar days earlier (DST-safe, unlike subtracting 24h). */
function daysBefore(ts: number, n: number): number {
  const d = new Date(ts);
  d.setDate(d.getDate() - n);
  return d.getTime();
}

export interface DayStats {
  key: string;
  /** Counted (not abandoned) focus sessions. */
  pomodoros: number;
  /** All focus time, including abandoned sessions. */
  focusMs: number;
  completed: Record<Mode, number>;
  abandoned: number;
  interruptions: number;
}

export interface Stats {
  today: DayStats;
  /** Oldest first, ending today. */
  week: DayStats[];
  streak: { current: number; best: number; /** Today already counts toward the streak. */ todayDone: boolean };
  goal: { target: number; done: number; reached: boolean };
  totals: { pomodoros: number; focusMs: number; daysFocused: number };
}

const emptyDay = (key: string): DayStats => ({
  key,
  pomodoros: 0,
  focusMs: 0,
  completed: { focus: 0, short: 0, long: 0 },
  abandoned: 0,
  interruptions: 0,
});

const qualifies = (d: DayStats | undefined) => !!d && (d.pomodoros > 0 || d.focusMs >= STREAK_FOCUS_MS);

export function computeStats(
  history: SessionRecord[],
  opts: { now: number; dailyGoal: number; /** Focus time in the session still running. */ liveFocusMs?: number },
): Stats {
  const days = new Map<string, DayStats>();
  const day = (key: string) => {
    let d = days.get(key);
    if (!d) days.set(key, (d = emptyDay(key)));
    return d;
  };

  for (const r of history) {
    const d = day(dayKey(r.endedAt));
    if (r.mode === 'focus') {
      // Older records (before focus tracking) only have the planned length.
      d.focusMs += r.focusedMs ?? (r.abandoned ? 0 : r.durationMs);
      d.interruptions += (r.interruptions?.internal ?? 0) + (r.interruptions?.external ?? 0);
    }
    if (r.abandoned) d.abandoned++;
    else {
      d.completed[r.mode]++;
      if (r.mode === 'focus') d.pomodoros++;
    }
  }

  const todayKey = dayKey(opts.now);
  const today = { ...day(todayKey) };
  today.focusMs += opts.liveFocusMs ?? 0;
  days.set(todayKey, today);

  const week = Array.from({ length: 7 }, (_, i) => days.get(dayKey(daysBefore(opts.now, 6 - i))) ?? emptyDay(dayKey(daysBefore(opts.now, 6 - i))));

  // Current streak: consecutive qualifying days ending today, or ending yesterday if
  // today hasn't qualified yet (the streak is still alive until the day is over).
  const todayDone = qualifies(today);
  let current = 0;
  for (let i = todayDone ? 0 : 1; qualifies(days.get(dayKey(daysBefore(opts.now, i)))); i++) current++;

  // Best streak across all history.
  const qualifying = [...days.values()].filter(qualifies).map((d) => d.key).sort();
  let best = 0;
  let run = 0;
  let prev: string | null = null;
  for (const key of qualifying) {
    run = prev && dayKey(daysBefore(new Date(`${key}T12:00:00`).getTime(), 1)) === prev ? run + 1 : 1;
    best = Math.max(best, run);
    prev = key;
  }

  let pomodoros = 0;
  let focusMs = 0;
  for (const d of days.values()) {
    pomodoros += d.pomodoros;
    focusMs += d.focusMs;
  }

  return {
    today,
    week,
    streak: { current, best: Math.max(best, current), todayDone },
    goal: { target: opts.dailyGoal, done: today.pomodoros, reached: today.pomodoros >= opts.dailyGoal },
    totals: { pomodoros, focusMs, daysFocused: qualifying.length },
  };
}
